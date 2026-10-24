// ranks/rank-difference — diferença ajustada entre ranks (D-RANK-01..06).
// Puro, sem I/O. Config via ../utils/config.js (local, sem ciclo).
//
// v3: banda na grade c REMOVIDA (mesmo motivo do confidence-trio — nunca cruzava);
// `classification_status` é provisional_model_based (descritivo do ponto estimado,
// nunca validação) e `uncertainty_method` declara a proveniência (V2 §8).
import { C_REFERENCE, DELTA_DEFAULT } from "../utils/config.js";

/** RNK: diferença ajustada entre ranks com intervalo provisório (D-RANK-01..06). */
export function rankDifference({ thetaA, thetaB, seA = 0.02, seB = 0.02, c = C_REFERENCE, deltaR = DELTA_DEFAULT } = {}) {
  if (![thetaA, thetaB].every(Number.isFinite)) {
    return { diff: null, interval_95: null, prob_above: null, c_reference: c, classification_status: "unavailable", uncertainty_method: "model_based_proxy", exposure_status: "unvalidated" };
  }
  const diff = thetaA - thetaB;
  const se = Math.sqrt(seA * seA + seB * seB);
  const half = 1.96 * se;
  const z = (diff - deltaR) / (se || 1e-9);
  const prob = 0.5 * (1 + erfApprox(z / Math.SQRT2));
  return { diff: +diff.toFixed(4), interval_95: [+(diff - half).toFixed(4), +(diff + half).toFixed(4)], prob_above: +prob.toFixed(4), delta_r: deltaR, c_reference: c, classification_status: "provisional_model_based", uncertainty_method: "model_based_proxy", exposure_status: "unvalidated" };
}
function erfApprox(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, pp = 0.3275911;
  const s = Math.sign(x) || 1; const t = Math.abs(x); const tt = 1 / (1 + pp * t);
  const poly = ((((a5 * tt + a4) * tt + a3) * tt + a2) * tt + a1) * tt;
  return s * (1 - poly * Math.exp(-t * t));
}
