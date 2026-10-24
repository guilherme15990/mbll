// hero/scoring/baseline-estimator — estimadores de μ (baseline) e τ (dispersão entre heróis).
import { median, mad } from "../utils/math.js";
import { obsVariance } from "../utils/statistics.js";
import { EPS } from "./constants.js";

/**
 * Resultado de um estimador de baseline.
 * @typedef {Object} BaselineEstimate
 * @property {number} mu          Baseline da coorte.
 * @property {number} tau         Desvio entre heróis.
 * @property {number} tau2        τ².
 * @property {boolean} muClamped  μ precisou ser limitado a [ε, 1−ε].
 * @property {boolean} nearZero   Dispersão ≈ 0 (usou piso 1e-6).
 * @property {number|null} tau2Moment  Diagnóstico DerSimonian–Laird (não é usado no ajuste).
 * @property {string} method      Nome do método (vai para `meta.tau2_method`).
 */

/**
 * @interface BaselineEstimator
 * Contrato (duck typing): `estimate(heroes, c) → BaselineEstimate`.
 * Qualquer classe com esse método pode ser injetada em {@link HeroScorer} (OCP/DIP) —
 * por exemplo, um estimador por momentos que desconte o ruído amostral de τ.
 */

/**
 * Estimador robusto atual: μ = mediana, τ = 1,4826·MAD (preservado do M1).
 *
 * Limitação conhecida e registrada: o MAD inclui ruído amostral, então τ tende a superestimar
 * a dispersão real e o shrinkage fica mais fraco do que deveria. `tau2Moment` é exposto como
 * diagnóstico para calibrar uma troca futura, SEM mudar o estimador nesta versão.
 */
export class MadBaselineEstimator {
  /**
   * @param {object[]} heroes  Linhas válidas e expostas (`win`, `pick`).
   * @param {number} c         Premissa de tamanho efetivo (proxy), usada só no diagnóstico.
   * @returns {BaselineEstimate}
   */
  estimate(heroes, c) {
    const wins = heroes.map((h) => h.win);
    let mu = median(wins);
    let muClamped = false;
    if (Number.isFinite(mu) && (mu < EPS || mu > 1 - EPS)) {
      mu = Math.min(1 - EPS, Math.max(EPS, mu));
      muClamped = true;
    }
    const rawMad = mad(wins, mu) || 0;
    const nearZero = !(rawMad > 0);
    const tau = 1.4826 * (rawMad || 1e-6);
    return { mu, tau, tau2: tau * tau, muClamped, nearZero, tau2Moment: this.#momentDiagnostic(heroes, wins, mu, c), method: "mad_robust_proxy" };
  }

  /** max(0, var(y) − mean(s²)): se var(y) < mean(s²), o MAD provavelmente capta ruído. */
  #momentDiagnostic(heroes, wins, mu, c) {
    try {
      const s2s = heroes.map((h) => obsVariance(mu, h.pick, c)).filter((v) => Number.isFinite(v));
      const meanS2 = s2s.length ? s2s.reduce((a, b) => a + b, 0) / s2s.length : NaN;
      const meanY = wins.reduce((a, b) => a + b, 0) / wins.length;
      const varY = wins.reduce((a, b) => a + (b - meanY) * (b - meanY), 0) / wins.length;
      return Number.isFinite(varY) && Number.isFinite(meanS2) ? Math.max(0, varY - meanS2) : null;
    } catch {
      return null;
    }
  }
}
