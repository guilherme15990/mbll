// hero/scoring/shrinkage-model — M1: shrinkage empírico Bayesiano por herói.
import { ebShrink, obsVariance, pFromZ } from "../utils/statistics.js";
import { confidenceTrio } from "../confidence/confidence-trio.js";

/**
 * Posterior de UM herói.
 * @typedef {Object} HeroPosterior
 * @property {number} theta       θ̂ final (com pull do prior, se ativo).
 * @property {number} se          Erro-padrão final.
 * @property {number} B           Peso do dado τ²/(τ²+s²).
 * @property {number} z           (θ̂ − μ)/se.
 * @property {number} p           p-valor bicaudal de z (NÃO validado — ver `null_model_version`).
 * @property {number} wrAdjBatch  Média posterior do lote (sem prior).
 * @property {number} seBatch     Erro-padrão do lote (sem prior).
 * @property {object} trioBatch   confidenceTrio do LOTE (status/banda nunca mascarados pelo prior).
 * @property {object} trioStar    confidenceTrio de θ̂/se (IC e probabilidade).
 */

/**
 * M1 fiel (spec §16 + PRD shrinkage §3.1/§3.3):
 *   y_i | θ_i ~ N(θ_i, s_i²),  s_i² = μ(1−μ)/(c·pick_i),  θ_i ~ N(μ, τ²).
 *   V_i = (1/s_i² + 1/τ²)⁻¹,  m_i = V_i(y_i/s_i² + μ/τ²),  B_i = τ²/(τ²+s_i²).
 *
 * Responsabilidade única: transformar a taxa observada de um herói em posterior.
 * Não conhece lote, ranking nem significância. `c` é PREMISSA (proxy), não contagem.
 */
export class EmpiricalBayesShrinkage {
  #c;
  #mu;
  #tau2;
  #prior;

  /**
   * @param {{c: number, mu: number, tau2: number, prior: import("./walk-forward-prior.js").WalkForwardPrior}} params
   */
  constructor({ c, mu, tau2, prior }) {
    this.#c = c;
    this.#mu = mu;
    this.#tau2 = tau2;
    this.#prior = prior;
  }

  /**
   * @param {{win: number, pick: number}} hero  Linha válida e exposta.
   * @returns {HeroPosterior}
   */
  posterior(hero) {
    const b = ebShrink(hero.win, obsVariance(this.#mu, hero.pick, this.#c), this.#mu, this.#tau2);
    const theta = this.#prior.pullPoint(b.m, b.V);
    const se = this.#prior.standardError(b.V, b.se);
    const z = (theta - this.#mu) / (se || 1e-9); // centro μ do LOTE (L2-WF-03: sem máscara)
    const trioBatch = confidenceTrio({ wrAdj: b.m, med: this.#mu, se: b.se, c: this.#c });
    const trioStar = this.#prior.active ? confidenceTrio({ wrAdj: theta, med: this.#mu, se, c: this.#c }) : trioBatch;
    return { theta, se, B: b.B, z, p: pFromZ(z), wrAdjBatch: b.m, seBatch: b.se, trioBatch, trioStar };
  }
}
