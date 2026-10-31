// draft/draft-score — Draft Score do motor (v1).
//
// Objetivo: pontuar um candidato a pick dentro de um draft (aliados,
// inimigos, bans, lane) com um número EXPLICÁVEL e com incerteza explícita,
// resolvendo os 12 defeitos diagnosticados na auditoria do app antigo
// (`scoreCandidatesWithSTEAM`): pesos por dispersão, percentil sem magnitude,
// dupla contagem, pick/ban como força, meanPositive sem cobertura, matchups
// empíricos ignorados, WR global, normalização heurística e ausência de
// validação contra desfecho.
//
// Princípios (mesma cultura do resto do motor):
// - Estatística pura: shrinkage empírico-Bayes por par (primitiva `ebShrink`).
// - SEM N na API: `pick` é o PROXY de exposição (nunca partidas inventadas).
// - Ausência de par = DESCONHECIDO: entra como 0 no efeito e como variância
//   (prior), nunca como zero silencioso.
// - Cada termo é legível em pontos percentuais (pp-hipótese, unidade NÃO
//   validada — ver `unit_status`).
// - Saída principal = delta esperado de WR em pp (`expected_pp`) com limite
//   inferior (`lower_bound = expected_pp - k·sigma_pp - penalidade_de_lane`).
//   O `score` 0–100 é só um mapa monotônico do lote, NUNCA probabilidade.
// - Zero I/O. Puro.

// Primitivas de PAR vêm de `./pair-effect.js` (fonte única da direção e do
// shrinkage do par).
import { C_REFERENCE, DELTA_DEFAULT } from "../utils/config.js";
import { MIN_SUPPORT_N } from "../utils/thresholds.js";
import {
  PAIR_FALLBACK_PICK,
  asHero,
  exposurePick,
  idOf,
  numOrNull,
  pairExposure,
  pairMatchup,
  pairSynergy,
  shrinkEffect,
} from "./pair-effect.js";

export const DRAFT_SCORE_VERSION = "draft-score-v1";

// ── parâmetros DECLARADOS (não calibrados; ver ADR-054) ──────────────────────
// Penalidade do limite inferior aplicada ao termo de incerteza. k=1 => "1 desvio".
export const DS_K = 1;
// Variância do prior (efeito típico de par / desvio de WR). Reutiliza DELTA_DEFAULT.
export const DS_PRIOR_VAR = DELTA_DEFAULT * DELTA_DEFAULT;
// Fator de amortecimento das somas de par (pares do mesmo time não são
// independentes). 1 = soma plena; <1 reduz sobreposição. Declarado.
export const DS_PAIR_DAMPING = 1;
// Penalidade (pp) de limite inferior quando a lane pedida não está nas lanes
// conhecidas do candidato. Nunca entra em `expected_pp`.
export const DS_OFFLANE_PENALTY_PP = 3;
// Exposição (pick) de fallback quando o `pick` de um parceiro/candidato é
// DESCONHECIDO (vem só como id, ou ausente). Alias do default de `pair-effect`.
// `pick = 0` NÃO usa fallback: ausência de pick é `null`/`undefined`, não zero.
export const DS_FALLBACK_PICK = PAIR_FALLBACK_PICK;
// Unidade do efeito de par — hipótese, não medida (a semântica de
// `increase_win_rate` não é documentada pela fonte; ver relatório de suporte).
export const DS_UNIT_STATUS = "pp_hypothesis_strong";

/** Parâmetro válido dentro de [min,max]; senão o default (evita NaN a jusante). */
function numParam(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return def;
  return n;
}

// ── parâmetros do lote (defaults) ──
const paramK = (v) => numParam(v, DS_K, 0, 100);
const paramPriorVar = (v) => numParam(v, DS_PRIOR_VAR, 1e-12, 1e3);
const paramDamping = (v) => numParam(v, DS_PAIR_DAMPING, 0, 100);
const paramPenalty = (v) => numParam(v, DS_OFFLANE_PENALTY_PP, 0, 100);

/**
 * Pontua candidatos de draft.
 *
 * @param {{
 *   candidates?: Array<object>,
 *   allies?: Array<object|number>,
 *   enemies?: Array<object|number>,
 *   bans?: Array<number>,
 *   lane?: string|null,
 *   params?: { k?: number, priorVar?: number, damping?: number, offLanePenaltyPp?: number },
 * }} input
 * @returns {{ version: string, lane: string|null, k: number, priorVar: number, damping: number,
 *   unit_status: string, rows: Array<object>, meta: object }}
 */
export function scoreDraftCandidates(input = {}) {
  const src = input ?? {};
  const candidates = src.candidates ?? [];
  const lane = src.lane ?? null;
  const params = src.params ?? {};
  const k = paramK(params.k);
  const priorVar = paramPriorVar(params.priorVar);
  const damping = paramDamping(params.damping);
  const offLanePenaltyPp = paramPenalty(params.offLanePenaltyPp);

  const A = (src.allies ?? []).map(asHero).filter(Boolean);
  const E = (src.enemies ?? []).map(asHero).filter(Boolean);
  const banSet = new Set((src.bans ?? []).map(Number).filter(Number.isFinite));
  const usedSet = new Set([...A, ...E].map(idOf).filter(Number.isFinite));

  const rows = [];
  const seen = new Set();

  for (const raw of candidates) {
    const hero = asHero(raw);
    if (!hero) continue;
    const id = idOf(hero);
    if (seen.has(id)) continue;        // dedupe
    if (banSet.has(id)) continue;      // banido sai do lote
    if (usedSet.has(id)) continue;     // já drafted sai do lote
    seen.add(id);

    const pick = numOrNull(hero.pick);

    // ── base: WR da lane (se houver) ou global; desvio vs 50% + shrinkage ──
    const baseRaw = numOrNull(hero.laneWin) ?? numOrNull(hero.win);
    // Exposição: pick 0 (herói sem presença) => 0; pick desconhecido => fallback.
    const nBase = baseRaw == null ? 0 : C_REFERENCE * exposurePick(pick);
    const baseObs = baseRaw == null ? { present: false, raw: null } : { present: true, raw: baseRaw - 0.5 };
    const base = shrinkEffect(baseObs, nBase, priorVar);
    const basePp = 100 * base.effect;

    // ── sinergia com aliados (exceto self) ──
    let synEffect = 0, synVar = 0;
    const synTerms = [];
    for (const ally of A) {
      if (idOf(ally) === id) continue;
      const obs = pairSynergy(hero, ally);
      const s = shrinkEffect(obs, pairExposure(pick, ally.pick), priorVar);
      synEffect += s.effect * damping;
      synVar += s.var * damping * damping;
      synTerms.push(term("synergy", ally, s));
    }

    // ── confronto com inimigos ──
    let matEffect = 0, matVar = 0;
    const matTerms = [];
    for (const en of E) {
      if (idOf(en) === id) continue;
      const obs = pairMatchup(hero, en);
      const s = shrinkEffect(obs, pairExposure(pick, en.pick), priorVar);
      matEffect += s.effect * damping;
      matVar += s.var * damping * damping;
      matTerms.push(term("matchup", en, s));
    }

    // ── lane: penalidade de limite inferior (nunca no expected) ──
    const lanes = Array.isArray(hero.lanes) ? hero.lanes : null;
    const laneFit = lane && lanes && lanes.length ? lanes.includes(lane) : null;
    const lanePenaltyPp = laneFit === false ? offLanePenaltyPp : 0;

    const expectedPp = basePp + 100 * (synEffect + matEffect);
    const sigmaPp = 100 * Math.sqrt(base.var + synVar + matVar);
    const lowerBound = expectedPp - k * sigmaPp - lanePenaltyPp;

    const observedPairs = [...synTerms, ...matTerms].filter((t) => t.present).length;
    const totalPairs = synTerms.length + matTerms.length;

    rows.push({
      id,
      name: hero.name ?? null,
      head: hero.head ?? null,
      lane,
      lane_fit: laneFit,
      expected_pp: expectedPp,
      sigma_pp: sigmaPp,
      lower_bound: lowerBound,
      mu: expectedPp / 100,
      sigma: sigmaPp / 100,
      // média Efetiva: a penalidade de lane entra na dominância (consistente com lower_bound)
      __muEff: (expectedPp - lanePenaltyPp) / 100,
      breakdown: {
        base_pp: round2(basePp),
        synergy_pp: round2(100 * synEffect),
        matchup_pp: round2(100 * matEffect),
        lane_penalty_pp: round2(lanePenaltyPp),
        coverage: { observed: observedPairs, total: totalPairs, ratio: totalPairs ? round3(observedPairs / totalPairs) : 0 },
        terms: [...synTerms, ...matTerms],
      },
      reasons: buildReasons({ basePp, synTerms, matTerms, laneFit, lane }),
      evidence_status: !base.observed && !observedPairs ? "sem-dado"
        : observedPairs >= MIN_SUPPORT_N ? "provisional" : "inconclusive",
      score: null,
      dominated: false,
      frontier: false,
    });
  }

  markFrontierAndScore(rows);
  for (const r of rows) {
    delete r.__muEff;
    r.expected_pp = round2(r.expected_pp);
    r.sigma_pp = round2(r.sigma_pp);
    r.lower_bound = round3(r.lower_bound);
    r.mu = round3(r.mu);
    r.sigma = round3(r.sigma);
  }

  const allObserved = rows.reduce((s, r) => s + r.breakdown.coverage.observed, 0);
  const anyUnobserved = rows.some((r) => r.breakdown.coverage.observed < r.breakdown.coverage.total);
  return {
    version: DRAFT_SCORE_VERSION,
    lane,
    k,
    priorVar,
    damping,
    unit_status: DS_UNIT_STATUS,
    rows,
    meta: {
      n_candidates: rows.length,
      n_allies: A.length,
      n_enemies: E.length,
      observed_pairs_total: allObserved,
      coverage_incomplete: anyUnobserved,
      calibrated: false,
      note: "expected_pp é delta esperado de WR em pontos percentuais (HIPÓTESE de unidade, "
        + "não validada). score 0–100 é posição relativa do limite inferior no lote — NÃO é "
        + "probabilidade (null quando o lote não tem limite finito). Ausência de par = "
        + "desconhecido (variância), nunca zero.",
    },
  };
}

function term(kind, other, s) {
  return {
    kind,
    other_id: idOf(other),
    other_name: other?.name ?? null,
    present: s.observed,
    contested: s.contested ?? false,
    raw_pp: s.raw != null ? round2(100 * s.raw) : null,
    effect_pp: round2(100 * s.effect),
    var_pp2: round2(100 * 100 * s.var),
    exposure_proxy: Math.round(s.n),
    unit_status: DS_UNIT_STATUS,
  };
}

/**
 * Fronteira eficiente em (muEfetivo, sigma) — usada a média efetiva, que já
 * inclui a penalidade de lane, para ficar consistente com `lower_bound`.
 * `score` = mapa monotônico do limite inferior no lote (0–100); `null` se o
 * lote não tiver limites finitos.
 */
function markFrontierAndScore(rows) {
  for (const r of rows) {
    const muEff = r.__muEff;
    r.dominated = rows.some((o) => o !== r && o.__muEff >= muEff && o.sigma <= r.sigma
      && (o.__muEff > muEff || o.sigma < r.sigma));
    r.frontier = !r.dominated;
  }
  const lowers = rows.map((r) => r.lower_bound).filter(Number.isFinite);
  if (!lowers.length) {
    for (const r of rows) r.score = null;
    return;
  }
  const min = Math.min(...lowers);
  const max = Math.max(...lowers);
  for (const r of rows) {
    r.score = max === min ? 50 : round2((100 * (r.lower_bound - min)) / (max - min));
  }
}

function buildReasons({ basePp, synTerms, matTerms, laneFit, lane }) {
  const out = [];
  if (Math.abs(basePp) >= 0.5) {
    out.push(`${basePp >= 0 ? "+" : ""}${round1(basePp)} pp de base vs 50%${lane ? ` (lane ${lane})` : ""}`);
  }
  const strong = [...synTerms].filter((t) => t.present && Math.abs(t.effect_pp) >= 0.1)
    .sort((a, b) => Math.abs(b.effect_pp) - Math.abs(a.effect_pp)).slice(0, 2);
  for (const t of strong) {
    out.push(`${t.effect_pp >= 0 ? "sinergia" : "anti-sinergia"} com ${t.other_name ?? `#${t.other_id}`} (${t.effect_pp >= 0 ? "+" : ""}${t.effect_pp} pp)`);
  }
  const match = [...matTerms].filter((t) => t.present && Math.abs(t.effect_pp) >= 0.1)
    .sort((a, b) => Math.abs(b.effect_pp) - Math.abs(a.effect_pp)).slice(0, 2);
  for (const t of match) {
    if (t.contested) out.push(`confronto contestado com ${t.other_name ?? `#${t.other_id}`} (0 pp)`);
    else out.push(`${t.effect_pp >= 0 ? "leve vantagem contra" : "leve desvantagem contra"} ${t.other_name ?? `#${t.other_id}`} (${t.effect_pp >= 0 ? "+" : ""}${t.effect_pp} pp)`);
  }
  if (laneFit === false) out.push(`fora da lane ${lane} — penalidade de ${DS_OFFLANE_PENALTY_PP} pp no limite`);
  const missing = [...synTerms, ...matTerms].filter((t) => !t.present).length;
  if (missing) out.push(`${missing} de ${synTerms.length + matTerms.length} pares sem observação (incerteza)`);
  if (!out.length) out.push("sem sinal material neste contexto");
  return out;
}

const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;
const round3 = (v) => Math.round(v * 1000) / 1000;
