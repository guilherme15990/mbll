// Comparador de counters — modelo (a) da matriz (DMX-L2-03, R-08).
// Cruza relação DECLARADA (relations: weak/strong) com δ OBSERVADO (matchups).
// Regras: relations entra SÓ como reasons[]; par ausente = desconhecido, nunca 0;
// sem causal, sem score único, sem N inventado (n = pares, nunca partidas).
// Pura, sem I/O, zero dependências.

import { MIN_LIFT_SIGNAL, MIN_SUPPORT_N } from "../utils/thresholds.js";

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
