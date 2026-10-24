// confidence/confidence-trio — trio provisório CNF (D-CONF-01..03).
// Posterior/IC/prob separados, com c_reference declarado. Puro, sem I/O.
// Config via ../utils/config.js (local, sem ciclo);
// exposure via ../governance/exposure.js (local, nunca via engine).
//
// v3: banda de sensibilidade na grade c REMOVIDA — 4 cenários por herói que nunca
// cruzavam no regime proxy (132/132 "provisional" sondado). A premissa é um único
// c declarado; `uncertainty_status` volta a ser provisional|unavailable.
import { C_REFERENCE, DELTA_DEFAULT } from "../utils/config.js";
import { makeExposure } from "../governance/exposure.js";

/** CNF: trio provisório — posterior/IC/prob separados, com c_reference declarado. */
export function confidenceTrio({ wrAdj, med, se = 0.02, c = C_REFERENCE, delta = DELTA_DEFAULT } = {}) {
  if (![wrAdj, med, se].every(Number.isFinite) || se <= 0) {
    return { posterior_mean: null, credible_interval_95: null, posterior_prob_above_threshold: null, c_reference: c, uncertainty_status: "unavailable", exposure: makeExposure(NaN) };
  }
  const mean = wrAdj;
  const half = 1.96 * se;
  const lo = mean - half, hi = mean + half;
  const z = (mean - (med + delta)) / (se || 1e-9);
  // P(θ>μ+Δ) = Φ(z) — probabilidade posterior CONDICIONAL ao modelo/proxy (V2 §8.3).
  const prob = 0.5 * (1 + erfApprox(z / Math.SQRT2));
  return {
    posterior_mean: +mean.toFixed(4), credible_interval_95: [+lo.toFixed(4), +hi.toFixed(4)],
    posterior_prob_above_threshold: +prob.toFixed(4), delta_threshold: delta,
    c_reference: c,
    uncertainty_status: "provisional",
    exposure: makeExposure(NaN),
  };
}
function erfApprox(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, pp = 0.3275911;
  const s = Math.sign(x) || 1; const t = Math.abs(x); const tt = 1 / (1 + pp * t);
  const poly = ((((a5 * tt + a4) * tt + a3) * tt + a2) * tt + a1) * tt;
  return s * (1 - poly * Math.exp(-t * t));
}
