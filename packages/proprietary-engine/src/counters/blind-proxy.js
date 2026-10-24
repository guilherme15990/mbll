// counters/blind-proxy — proxy de blind pick (corpo idêntico ao ex-engine,
// D-BLND-01..06). Distribuição de δ + cauda adversa. Nunca probabilidade.
// Puro, sem I/O. Primitiva quantile via ../utils/math.js.
import { quantile } from "../utils/math.js";

/** BPS: proxy de blind pick — distribuição de δ + cauda adversa (D-BLND-01..06). Nunca probabilidade. */
export function blindProxy(deltas = []) {
  const xs = (deltas ?? []).filter(Number.isFinite).sort((a, b) => a - b);
  // P0 EC-V2-02 fix: n<5 não sustenta p10/robusto — inconclusivo
  if (xs.length < 5) {
    return { safety_status: "inconclusive", robustness_status: "inconclusive", adverse_p10: null, worst_counter: null, worst_observed: xs.length ? +xs[0].toFixed(4) : null, n_pairs: xs.length, classification_status: "inconclusive", exposure_status: "unvalidated", note: "proxy — n<5, inconclusivo; não é probabilidade" };
  }
  const p10 = quantile(xs, 0.1);
  const worst = xs[0];
  const spread = xs[xs.length - 1] - xs[0];
  const robust = spread < 0.04 && p10 > -0.02;
  return {
    safety_status: "proxy", robustness_status: robust ? "robusto" : "sensivel-a-counter",
    adverse_p10: +p10.toFixed(4), worst_observed: +worst.toFixed(4), spread: +spread.toFixed(4),
    n_pairs: xs.length, classification_status: "provisional", exposure_status: "unvalidated",
    note: "proxy — não é probabilidade de vitória",
  };
}
