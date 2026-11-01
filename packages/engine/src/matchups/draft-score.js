// @radar/engine · matchups/draft-score — score de composição, sinergia de pares e score de draft do herói.
// Consolidado (ADR-061): reúne draft/pair-effect.js, draft/draft-score.js, draft/hero-draft-score.js.
// Barrel público: src/index.js (nenhum nome público muda).

import { C_REFERENCE, DELTA_DEFAULT } from "../core/config.js";
import { MIN_SUPPORT_N } from "../core/thresholds.js";
import { ebShrink } from "../core/statistics.js";
import { medianNull } from "../core/math.js";
import { EvidenceStatus } from "../core/states.js";

// ── draft/pair-effect.js ──
// draft/pair-effect — primitivas de PAR compartilhadas pelos modelos de draft.
//
// Fonte ÚNICA da DIREÇÃO dos pares (sinergia pelo sinal da lista, confronto com
// lado observado pelos dois lados valendo 0 — contestado), do proxy de exposição
// (`pick` é N, nunca tamanho de amostra real) e do shrinkage empírico-Bayes de um
// efeito de par. Consumido por `draft-score.js` (candidato DENTRO de um draft) —
// fonte única da direção/exposição/shrinkage de um par sobre o mesmo par.
// (`hero-draft-score.js` NÃO usa pares: o Draft Score do herói é min–max da WR
//  no recorte — não há termo de par.)
//
// Princípios (mesma cultura do motor):
// - Ausência de par = DESCONHECIDO: efeito 0 e variância = prior, nunca zero
//   silencioso.
// - SEM N na API: `pick` é o PROXY de exposição.
// - Zero I/O. Puro.





const EMPTY_BOOK = { countersUp: [], countersDown: [], synergiesUp: [], synergiesDown: [] };
const VAR_UNIT = 0.25; // teto Bernoulli p(1-p)

// Exposição (pick) de fallback quando o `pick` de um parceiro/candidato é
// DESCONHECIDO (vem só como id, ou ausente). Evita descartar um par OBSERVADO
// por falta de exposição. Declarado, não calibrado (≈ RARE_PICK_MAX).
// `pick = 0` NÃO usa fallback: ausência de pick é `null`/`undefined`, não zero.
const PAIR_FALLBACK_PICK = 0.02;

/** Normaliza um herói de contexto: aceita `{id,...}` ou um id cru. */
function asHero(x) {
  if (x == null) return null;
  if (typeof x === "number") return { id: x };
  if (typeof x === "object" && Number.isFinite(Number(x.id))) return x;
  return null;
}

const idOf = (x) => Number(x?.id);

/** Número finito ou `null` quando ausente/vazio/não numérico (null NÃO vira 0). */
function numOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** |δ| observado de um par numa lista de livro, ou null quando ausente/inválido. */
function absDelta(list, otherId) {
  const row = (list ?? []).find((p) => Number(p?.id) === otherId);
  const d = row ? numOrNull(row.delta) : null;
  return d == null ? null : Math.abs(d);
}

/**
 * Sinergia observada entre `hero` e `ally` (direção vem da LISTA, |δ| é o
 * tamanho; nunca o sinal cru — ver `matchups.js` e `pairs.ts`).
 * Duas perspectivas (livro do herói e do aliado) entram com o mesmo peso.
 */
export function pairSynergy(hero, ally) {
  const hb = hero.book ?? EMPTY_BOOK;
  const ab = ally.book ?? EMPTY_BOOK;
  const vals = [];
  const up = absDelta(hb.synergiesUp, idOf(ally));
  const dn = absDelta(hb.synergiesDown, idOf(ally));
  if (up != null) vals.push(up);
  if (dn != null) vals.push(-dn);
  const up2 = absDelta(ab.synergiesUp, idOf(hero));
  const dn2 = absDelta(ab.synergiesDown, idOf(hero));
  if (up2 != null) vals.push(up2);
  if (dn2 != null) vals.push(-dn2);
  const raw = medianNull(vals);
  return { present: raw != null, raw, perspectives: vals.length };
}

/**
 * Confronto observado entre `hero` e `enemy`. Positivo = vantagem do herói.
 * Direção em quarentena (Fase 0): os dois lados observados => contestado => 0.
 */
export function pairMatchup(hero, enemy) {
  const hb = hero.book ?? EMPTY_BOOK;
  const eb = enemy.book ?? EMPTY_BOOK;
  const heroCounters = absDelta(hb.countersUp, idOf(enemy)) ?? absDelta(eb.countersDown, idOf(hero));
  const enemyCounters = absDelta(hb.countersDown, idOf(enemy)) ?? absDelta(eb.countersUp, idOf(hero));
  if (heroCounters != null && enemyCounters != null) return { present: true, raw: 0, contested: true, perspectives: 2 };
  if (heroCounters != null) return { present: true, raw: heroCounters, contested: false, perspectives: 1 };
  if (enemyCounters != null) return { present: true, raw: -enemyCounters, contested: false, perspectives: 1 };
  return { present: false, raw: null, contested: false, perspectives: 0 };
}

/** pick informado; ausente (null/undefined/""/NaN) => fallback; 0 permanece 0. */
function exposurePick(p) {
  const n = numOrNull(p);
  return n == null ? PAIR_FALLBACK_PICK : n;
}

/** n proxy do par = C_REFERENCE · pick_herói · pick_outro (0 => não exposto). */
function pairExposure(pA, pB) {
  return C_REFERENCE * exposurePick(pA) * exposurePick(pB);
}

/**
 * Shrinkage empírico-Bayes de um efeito de par rumo ao prior 0.
 * `n` = exposição proxy; s2 = VAR_UNIT/n; posterior via `ebShrink(y,s2,0,priorVar)`.
 * Par não observado (ou sem exposição): efeito 0 e variância = priorVar
 * (desconhecido, não zero).
 */
function shrinkEffect(obs, n, priorVar) {
  const hasExposure = n > 0;
  if (!obs.present || !hasExposure) {
    // Sem observação OU sem exposição: efeito 0 e variância do prior.
    // `observed` exige exposição — par listado sem exposição NÃO conta como
    // observado (evita inflar cobertura/evidência com efeito 0 sem sinal).
    return { effect: 0, var: priorVar, observed: obs.present && hasExposure, contested: obs.contested ?? false, n };
  }
  const s2 = VAR_UNIT / n;
  const post = ebShrink(obs.raw, s2, 0, priorVar);
  return { effect: post.m, var: post.V, observed: true, contested: obs.contested ?? false, n, raw: obs.raw, B: post.B };
}

// ── draft/draft-score.js ──
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




// ── parâmetros DECLARADOS (não calibrados; ver ADR-054) ──────────────────────
// Penalidade do limite inferior aplicada ao termo de incerteza. k=1 => "1 desvio".
const DS_K = 1;
// Variância do prior (efeito típico de par / desvio de WR). Reutiliza DELTA_DEFAULT.
export const DS_PRIOR_VAR = DELTA_DEFAULT * DELTA_DEFAULT;
// Fator de amortecimento das somas de par (pares do mesmo time não são
// independentes). 1 = soma plena; <1 reduz sobreposição. Declarado.
const DS_PAIR_DAMPING = 1;
// Penalidade (pp) de limite inferior quando a lane pedida não está nas lanes
// conhecidas do candidato. Nunca entra em `expected_pp`.
export const DS_OFFLANE_PENALTY_PP = 3;
// Unidade do efeito de par — hipótese, não medida (a semântica de
// `increase_win_rate` não é documentada pela fonte; ver relatório de suporte).
// Struct da unidade declarada (fonte única do nome; `DS_UNIT_STATUS` = alias compat).
const DsUnitStatus = Object.freeze({
  PP_HYPOTHESIS_STRONG: "pp_hypothesis_strong",
});
export const DS_UNIT_STATUS = DsUnitStatus.PP_HYPOTHESIS_STRONG;

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
 * @returns {{ lane: string|null, k: number, priorVar: number, damping: number,
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
      evidence_status: !base.observed && !observedPairs ? EvidenceStatus.SEM_DADO
        : observedPairs >= MIN_SUPPORT_N ? EvidenceStatus.PROVISIONAL : EvidenceStatus.INCONCLUSIVE,
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

// ── draft/hero-draft-score.js ──
// draft/hero-draft-score — Draft Score: UM número 0–100 por herói.
//
// Substitui o score do app legado (`scoreCandidatesWithSTEAM`), que misturava
// percentis de WR, pick, ban, confiança e adaptabilidade. Lá popularidade entrava
// como força e o número não tinha unidade. Aqui entra SÓ o desfecho medido (a WR
// do recorte), reescalado para 0–100 dentro do próprio lote:
//
//     draft_score = 100 · (WR − WR_min) / (WR_max − WR_min)
//
// O melhor WR do recorte lê 100; o pior lê 0; o resto se distribui entre os dois.
// Não há constante declarada nem peso inventado — os únicos parâmetros são o
// mínimo e o máximo OBSERVADOS no lote (a escala é a do próprio recorte).
//
// `pick` e `ban` NÃO entram: são exposição (quanto o herói é jogado/banido),
// nunca força. Quem ganha mais vale mais; ponto. O número é RELATIVO ao recorte
// (elo + janela): não compare Draft Score entre recortes diferentes.
//
// Casos degenerados (registrados): herói sem WR no recorte sai com
// `draft_score: null` (sem-dado, nunca 0 silencioso); lote sem nenhuma WR, ou com
// todos os WR iguais (sem faixa para reescalar), dá `50` para quem tem dado — meio
// da escala, que é a leitura honesta de "não há spread para ranquear".
//
// Limitação registrada (ADR-054 §D10): como a escala é min–max do lote, um herói
// de WR alto lê 100 mesmo que a WR esteja inflada (difícil, escolhido por pro).
// A versão que removeria essa inflação usaria WR por lane (agregada por exposição)
// e desconto de confusão por elo — a fonte atual não expõe nem uma nem outra.
// Zero I/O. Puro.

/** Número finito ou null (ausente/vazio/NaN nunca vira 0). [local: hero-draft-score] */
function hdsNumOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const hdsRound2 = (v) => Math.round(v * 100) / 100;
const round4 = (v) => Math.round(v * 10000) / 10000;

/**
 * Draft Score do pool. Puro, sem I/O.
 *
 * @param {{ heroes?: Array<{ id: number|string, name?: string|null, head?: string|null, win?: number|null }> }} [input]
 *   `heroes`: uma entrada por herói do recorte. `win` é a WR em fração 0–1.
 * @returns {{ rows: Array<{ id: number, name: string|null, head: string|null, draft_score: number|null }>, meta: object }}
 */
export function scoreHeroDraftScore(input = {}) {
  const src = input ?? {};
  const seen = new Set();
  const pool = [];
  for (const raw of src.heroes ?? []) {
    if (raw == null) continue;
    const id = Number(raw.id);
    if (!Number.isFinite(id) || seen.has(id)) continue; // dedupe; id não-numérico fora
    seen.add(id);
    pool.push({ id, name: raw.name ?? null, head: raw.head ?? null, win: hdsNumOrNull(raw.win) });
  }

  const wins = pool.filter((h) => h.win != null).map((h) => h.win);
  const wrMin = wins.length ? Math.min(...wins) : null;
  const wrMax = wins.length ? Math.max(...wins) : null;
  const spread = wrMin != null && wrMax > wrMin; // sem faixa não há o que reescalar

  const rows = pool.map((h) => ({
    id: h.id,
    name: h.name,
    head: h.head,
    draft_score:
      h.win == null
        ? null
        : spread
          ? hdsRound2(100 * ((h.win - wrMin) / (wrMax - wrMin)))
          : 50, // lote sem spread: meio da escala, a leitura honesta de "sem faixa"
  }));

  const withData = rows.reduce((n, r) => n + (r.draft_score == null ? 0 : 1), 0);
  return {
    rows,
    meta: {
      n_heroes: rows.length,
      with_data: withData,
      wr_min: wrMin == null ? null : round4(wrMin),
      wr_max: wrMax == null ? null : round4(wrMax),
      calibrated: false,
      note: "draft_score = 100·(WR − WR_min)/(WR_max − WR_min), reescalado no "
        + "recorte: o melhor WR lê 100, o pior lê 0. Número RELATIVO ao elo+janela "
        + "(não compare entre recortes). Só o desfecho medido entra — `pick`/`ban` "
        + "são exposição, nunca força; sem pesos nem constantes declaradas. Sem WR "
        + "no recorte ⇒ `draft_score: null`; sem faixa (lote constante) ⇒ 50. "
        + "Não é probabilidade.",
    },
  };
}
