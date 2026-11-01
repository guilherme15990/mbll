// @radar/engine · matchups/counters — matriz de pares, taxas cruzadas, evidência e governança de exposição.
// Consolidado (ADR-061): reúne governance/exposure.js, counters/pair-key.js, counters/evidence.js, counters/counter.js, counters/relations-agreement.js, counters/distortion.js, counters/matchup-ordering.js, counters/duration.js.
// Barrel público: src/index.js (nenhum nome público muda).

import { DURATION_BANDS } from "../core/config.js";
import { MIN_LIFT_SIGNAL, MIN_SUPPORT_N } from "../core/thresholds.js";
import { median } from "../core/math.js";

// ── governance/exposure.js ──
// governance/exposure — envelope de exposição + validação do denominador
// (corpo idêntico ao ex-engine, EXP INV-101/D-EXP-01..03, RF-EXP-04).
// Puro, sem I/O, zero dependências.
/** EXP: envelope de exposição — pick é slot_share, nunca contagem (INV-101/D-EXP-01..03). */
export function makeExposure(pick) {
  void pick;
  return { unit: "slot_share", status: "unvalidated" };
}
/** EXP: soma pick_rate por snapshot deve ≈1 (±0.005, RF-EXP-04). Retorna {sum, ok}. */
export function checkPickSum(picks) {
  const sum = (picks ?? []).filter(Number.isFinite).reduce((a, b) => a + b, 0);
  return { sum: +sum.toFixed(4), ok: Math.abs(sum - 1) <= 0.005, expectedApprox: 1 };
}

// ── counters/pair-key.js ──
// counters/pair-key — chave canônica do par M6 (corpo idêntico ao ex-engine,
// D-MTCH-01). Counter direcional, teammate ordenado.
// Puro, sem I/O, zero dependências.
/** Chave canônica do par M6 (D-MTCH-01): counter direcional, teammate ordenado. */
export function makePairKey(a, b, type) {
  const x = Number(a), y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (type === "teammate") {
    const [lo, hi] = x <= y ? [x, y] : [y, x];
    return `${lo}-${hi}:teammate`;
  }
  return `${x}-${y}:counter`;
}

// ── counters/evidence.js ──
// counters/evidence — qualidade da evidência M6 (corpo idêntico ao ex-engine,
// D-MTCH-06). Descritiva, sem IC de pseudo-contagem.
// Puro, sem I/O, zero dependências.
/** M6: qualidade da evidência descritiva (sem IC de pseudo-contagem, D-MTCH-06). */
export function evidenceQuality({ coverage = "unknown", stable = null, hetero = null } = {}) {
  const reasons = [];
  if (coverage !== "full") reasons.push("coverage:" + coverage);
  if (stable === false) reasons.push("unstable-temporal");
  if (hetero === true) reasons.push("rank-heterogeneous");
  if (!reasons.length) reasons.push("consistent");
  // LOW (V2 §1/§8.2): valor era "robusto" — colidia com o selo de confiança.
  // Qualidade descritiva de pares passa a "consistente"; reasons preservados.
  let quality = "limitado";
  if (coverage === "full" && stable === true && hetero === false) quality = "consistente";
  else if (coverage === "extremes" || stable === false) quality = "limitado";
  else quality = "dependente-de-contexto";
  return { quality, reasons, exposure_status: "unvalidated", interval_status: "indisponivel", uncertainty_method: null, causal_status: "nao-avaliado" };
}

// ── counters/counter.js ──
// Comparador de counters — modelo (a) da matriz (DMX-L2-03, R-08).
// Cruza relação DECLARADA (relations: weak/strong) com δ OBSERVADO (matchups).
// Regras: relations entra SÓ como reasons[]; par ausente = desconhecido, nunca 0;
// sem causal, sem score único, sem N inventado (n = pares, nunca partidas).
// Pura, sem I/O, zero dependências.



export const COUNTER_VERDICT_VERSION = "counter-verdict-v1";

// Limiar de materialidade do δ (pp): abaixo disso, sinal = neutro.
// Canônico em ./thresholds.js (MIN_LIFT_SIGNAL — mesmo conceito do "emergente").
export const COUNTER_MIN_ABS_DELTA = MIN_LIFT_SIGNAL;
// Cobertura mínima para veredito pleno (paralelo a RF-BLND-06 n<5).
// Canônico em ./thresholds.js (MIN_SUPPORT_N — piso de suporte único).
export const COUNTER_MIN_PAIRS = MIN_SUPPORT_N;

// Unidade assumida do δ (LOW, V2 §5.2): declarada na saída, nunca adivinhada na entrada.
const UNIT = "fraction_0_1_assumed";

/**
 * @param expected -1 (declarado counter/weak) | +1 (declarado favorável/strong) | 0 | null (não declarado)
 * @param delta δ observado já orientado p/ o par avaliado (v(i,j)) | null.
 *   Unidade esperada: FRAÇÃO em escala 0–1 (ex.: 0.025, não 2.5). Escalas diferentes
 *   não mudam o sinal, mas deslocam o limiar — ver `unit` na saída (LOW, V2 §5.2).
 * @param nPairs nº de pares elegíveis (cobertura, não partidas)
 * @param coverage "extremes" | "full" | "unknown"
 * @returns { verdict: "confirmado"|"contestado"|"so-observado"|"desconhecido", reasons: string[], unit: string }
 */
export function compareCounterRelation({ expected = null, delta = null, nPairs = 0, coverage = "unknown", minAbs = COUNTER_MIN_ABS_DELTA } = {}) {
  const reasons = [];
  const exp = expected === -1 || expected === 1 ? expected : null;
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const mag = hasDelta ? Math.abs(delta) : 0;
  const sign = !hasDelta || mag < minAbs ? 0 : Math.sign(delta);
  const weak = !Number.isFinite(nPairs) || nPairs < COUNTER_MIN_PAIRS;
  if (weak) reasons.push(nPairs === 1 ? "n=1" : `n=${Number.isFinite(nPairs) ? nPairs : 0}<${COUNTER_MIN_PAIRS}`);
  if (coverage !== "extremes" && coverage !== "full") reasons.push("cobertura-nao-informada");

  if (!hasDelta) {
    if (exp == null) return { verdict: "desconhecido", reasons: [...reasons, "sem-declaracao-sem-observado"], unit: UNIT };
    return { verdict: "contestado", reasons: [...reasons, "declarado-sem-observado"], unit: UNIT };
  }
  if (exp == null) {
    if (sign === 0) return { verdict: "desconhecido", reasons: [...reasons, "abaixo-do-limiar-sem-declaracao"], unit: UNIT };
    return { verdict: "so-observado", reasons: [...reasons, "observado-sem-declaracao"], unit: UNIT };
  }
  if (sign === exp) {
    return { verdict: "confirmado", reasons: [...reasons, "acordo-declarado-observado"], unit: UNIT };
  }
  if (sign === 0) {
    return { verdict: "contestado", reasons: [...reasons, "declarado-abaixo-do-limiar"], unit: UNIT };
  }
  return { verdict: "contestado", reasons: [...reasons, "direcao-divergente"], unit: UNIT };
}

// ── counters/relations-agreement.js ──
// Acordo declaração×observado por par — modelo (a) estendido ao `relations`.
// Mapeia `relations.{weak,strong}.target_hero_id` → `expected` (-1|+1|null) e
// alimenta `compareCounterRelation` (dono do veredito; nada duplicado aqui).
// `relations.assist` NUNCA entra: sinergia é categoria errada p/ counter — a
// exclusão é auditável em reasons[] (`assist-ignorado(n=…)`).
// Pura, sem I/O, zero dependências além de ./counter.js e ./thresholds.js.



export const RELATIONS_AGREEMENT_VERSION = "relations-agreement-v1";

function idsOf(bucket) {
  const v = bucket?.target_hero_id;
  if (!Array.isArray(v)) return [];
  return v.map((x) => Number(x)).filter((x) => Number.isFinite(x));
}

/**
 * @param relations {weak?: {target_hero_id?: number[]}, strong?: {...}, assist?: {...}}
 * @param targetId id do herói-alvo avaliado
 * @returns { expected: -1|+1|null, reasons: string[] }
 *   weak contém o alvo → -1 (declarado counter do herói);
 *   strong contém o alvo → +1 (declarado favorável);
 *   ambos → null (declaração conflitante, nunca chute);
 *   nenhum → null (não declarado).
 */
export function expectedForTarget(relations, targetId) {
  const t = Number(targetId);
  const reasons = [];
  const assist = idsOf(relations?.assist);
  if (assist.length) reasons.push(`assist-ignorado(n=${assist.length})`);
  if (!Number.isFinite(t)) return { expected: null, reasons: [...reasons, "alvo-invalido"] };
  const inWeak = idsOf(relations?.weak).includes(t);
  const inStrong = idsOf(relations?.strong).includes(t);
  if (inWeak && inStrong) return { expected: null, reasons: [...reasons, "declaracao-conflitante"] };
  if (inWeak) return { expected: -1, reasons: [...reasons, "declarado-weak"] };
  if (inStrong) return { expected: 1, reasons: [...reasons, "declarado-strong"] };
  return { expected: null, reasons: [...reasons, "sem-declaracao"] };
}

/**
 * @param relations objeto `relations` do herói (weak/strong/assist)
 * @param opts {targetId, delta: δ observado orientado p/ o par | null,
 *   nPairs: nº de pares elegíveis, coverage: "extremes"|"full"|"unknown"}
 * @returns { expected, verdict: gramática de compareCounterRelation,
 *   reasons: mapeamento + veredito, version }
 */
export function agreementForPair(
  relations,
  { targetId, delta = null, nPairs = 0, coverage = "unknown" } = {},
) {
  const { expected, reasons: mapReasons } = expectedForTarget(relations, targetId);
  const r = compareCounterRelation({ expected, delta, nPairs, coverage });
  return {
    expected,
    verdict: r.verdict,
    reasons: [...mapReasons, ...r.reasons],
    minAbs: COUNTER_MIN_ABS_DELTA,
    minPairs: COUNTER_MIN_PAIRS,
    version: RELATIONS_AGREEMENT_VERSION,
  };
}

// ── counters/distortion.js ──
// counters/distortion — resíduos de draft (corpo idêntico ao ex-engine,
// D-DIST-01..03). Pick/ban separados, nunca somados.
// Puro, sem I/O, zero dependências.
/** DRF: resíduos pick/ban separados, nunca somados (D-DIST-01..03). */
export function distortionResidual({ observed, expected, kind = "pick" } = {}) {
  if (![observed, expected].every(Number.isFinite)) {
    return { kind, observed: observed ?? null, expected: expected ?? null, residual: null, unit_status: "unvalidated", classification_status: "inconclusive", exposure_status: "unvalidated" };
  }
  return { kind, observed, expected, residual: +(observed - expected).toFixed(4), unit_status: "unvalidated", classification_status: "provisional", exposure_status: "unvalidated" };
}

// ── counters/matchup-ordering.js ──
// Ordenação e seleção de pares (matchups) por δ — FONTE ÚNICA.
// Movidos da web (semântica idêntica):
// - comparePairsByDeltaAsc/sortPairsByDeltaAsc ← ConfrontosSection (δ asc,
//   ausente por último via ?? Infinity; par ausente = desconhecido, nunca 0)
// - selectTopCountersByDelta/selectTopSynergiesByDelta ← HeroDetails (filtro
//   finito antes de ordenar; corte N)
// - firstPairByDeltaAsc ← ConfrontosSection (anti-sinergia dominante)
// - sortPairsByDeltaDesc ← ConfrontosSection/ConfrontosPreview (grupos "a favor")
// - hasFiniteDelta ← predicado reutilizado pelos dois lados
// Puros, sem I/O.

/** δ asc; δ ausente vai para o fim (desconhecido, nunca 0). */
export function comparePairsByDeltaAsc(a, b) {
  return ((a && a.delta) ?? Infinity) - ((b && b.delta) ?? Infinity);
}

/** Cópia ordenada por δ asc (estável no sentido de cópia, sem mutar entrada). */
export function sortPairsByDeltaAsc(pairs) {
  return [...(pairs ?? [])].sort(comparePairsByDeltaAsc);
}

/** δ desc; δ ausente vai para o fim (desconhecido nunca lidera "a favor"). */
export function comparePairsByDeltaDesc(a, b) {
  return ((b && b.delta) ?? -Infinity) - ((a && a.delta) ?? -Infinity);
}

/** Cópia ordenada por δ desc (não muta a entrada). */
export function sortPairsByDeltaDesc(pairs) {
  return [...(pairs ?? [])].sort(comparePairsByDeltaDesc);
}

/** δ finito? */
export function hasFiniteDelta(p) {
  return Number.isFinite(p && p.delta);
}

/** Top-N counters (δ finito, asc). */
export function selectTopCountersByDelta(pairs, n = 3) {
  return [...(pairs ?? [])].filter(hasFiniteDelta).sort(comparePairsByDeltaAsc).slice(0, n);
}

/** Top-N sinergias (δ finito, desc). */
export function selectTopSynergiesByDelta(pairs, n = 3) {
  return [...(pairs ?? [])]
    .filter(hasFiniteDelta)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, n);
}

/** Par dominante por δ asc (undefined sem pares). */
export function firstPairByDeltaAsc(pairs) {
  return sortPairsByDeltaAsc(pairs)[0];
}

// ── counters/duration.js ──
// counters/duration — curva de duração S7 (corpo idêntico ao ex-engine).
// Rótulos em ../utils/config.js (DURATION_BANDS); chaves e pontos médios
// locais (nunca exportados). Puro, sem I/O.
// Primitiva median via ../utils/math.js.



const DURATION_KEYS = ["min_win_rate6", "min_win_rate6_8", "min_win_rate8_10", "min_win_rate10_12", "min_win_rate12_14", "min_win_rate14_16", "min_win_rate16_18", "min_win_rate18_20", "min_win_rate20"];
const DURATION_MID = [5, 7, 9, 11, 13, 15, 17, 19, 22];

/** Extrai curva de duração {label, win} descartando 0/1 degenerados (L2). */
export function durationCurve(src) {
  return durationCurveDetailed(src).curve;
}

/** V2: curva + quarentena serializável (HIGH: prop em Array some no JSON). */
export function durationCurveDetailed(src) {
  const curve = [];
  const quarantined = [];
  for (let i = 0; i < DURATION_KEYS.length; i++) {
    const raw = src?.[DURATION_KEYS[i]];
    if (raw == null) continue;
    const v = Number(raw);
    // V2 §5.2/EC-010B: fora de [0,1] (ex: 53) = quarentena, nunca entra na curva.
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      quarantined.push({ key: DURATION_KEYS[i], reason: "rate_out_of_range" });
      continue;
    }
    // V2 §13/EC-010A: 0/1 preserva-se apenas com n validado; sem n, mantém-se
    // a guarda legada (descarta) e documenta.
    if (v === 0 || v === 1) continue;
    curve.push({ label: DURATION_BANDS[i], mid: DURATION_MID[i], win: v });
  }
  return { curve, quarantined };
}

/** Classifica perfil S7: snowball (cai com o tempo), scaling (sobe) ou uniforme. */
export function classifyDuration(curve) {
  // V2 §13/EC-011: <3 pontos válidos = sem cobertura → insufficient_data (nunca "uniforme").
  if (!Array.isArray(curve) || curve.length < 3) return "insufficient_data";
  const xs = curve.map((p) => p.mid), ys = curve.map((p) => p.win);
  const slopes = [];
  for (let i = 0; i < xs.length; i++)
    for (let j = i + 1; j < xs.length; j++) slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
  const s = median(slopes);
  if (s > 0.005) return "scaling";
  if (s < -0.005) return "snowball";
  return "uniforme";
}
