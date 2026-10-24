// meta/temporal-delta — delta temporal + estados (corpo idêntico ao ex-engine,
// D-TEMP-01..05). PRD temporal §5: Δ=θ(t2)−θ(t1); em logit, log-odds NUNCA
// como pp. Nunca causal sem desenho. Puro, sem I/O.
// Primitiva logit via ../utils/statistics.js; config local.
import { logit } from "../utils/statistics.js";
import { C_REFERENCE, DELTA_DEFAULT } from "../utils/config.js";

/** TMP: delta temporal + estados (D-TEMP-01..05). PRD temporal §5: Δ=θ(t2)−θ(t1); em logit, log-odds NUNCA como pp. Nunca causal sem desenho. */
export function temporalDelta({ thetaNow, thetaBase, se = 0.02, threshold = DELTA_DEFAULT, c = C_REFERENCE, confirmed = false } = {}) {
  if (![thetaNow, thetaBase].every(Number.isFinite)) {
    return { delta: null, delta_logit: null, interval_95: null, temporal_status: "inconclusive", patch_association_status: "not_evaluated", exposure_status: "unvalidated" };
  }
  const delta = thetaNow - thetaBase;
  const lo = logit(Math.min(0.999999, Math.max(1e-6, thetaNow))), lb = logit(Math.min(0.999999, Math.max(1e-6, thetaBase)));
  const delta_logit = (Number.isFinite(lo) && Number.isFinite(lb)) ? +(lo - lb).toFixed(4) : null;
  const half = 1.96 * se * Math.sqrt(C_REFERENCE / c);
  const sig = Math.abs(delta) > threshold && Math.abs(delta) > half;
  let temporal_status = "initial";
  if (!sig) temporal_status = "inconclusive";
  // NOTA (critic-016): "reverted" exigiria comparar com o delta anterior (prevDelta),
  // que esta assinatura não recebe — era tautologia (sempre "persistent"). Comportamento
  // preservado byte a byte; reversão real é feature nova (requer spec + testes).
  else temporal_status = confirmed ? "persistent" : "initial";
  return { delta: +delta.toFixed(4), delta_logit, delta_unit: "pp-na-escala-identidade; logit separado (log-odds ≠ pp)", interval_95: [+(delta - half).toFixed(4), +(delta + half).toFixed(4)], delta_threshold: threshold, c_reference: c, temporal_status, patch_association_status: "temporal_association", exposure_status: "unvalidated" };
}
