// hero/scoring/significance-tester — q (BH) e rótulos strong/weak/isGem como CANDIDATOS.
import { benjaminiHochberg } from "../utils/statistics.js";
import { FDR_ALPHA, GEM_QUANTILE } from "./constants.js";

/**
 * Significância exploratória do lote.
 *
 * Responsabilidade única: transformar p-valores em q e decidir strong/weak/isGem.
 * IMPORTANTE (P1 auditoria, V2 §9): os p-valores vêm de um z após shrinkage e o nulo NÃO foi
 * validado; portanto strong/weak/isGem são candidatos experimentais (`inference_status`).
 */
export class SignificanceTester {
  #alpha;
  #gemQuantile;

  /** @param {{alpha?: number, gemQuantile?: number}} [options] */
  constructor({ alpha = FDR_ALPHA, gemQuantile = GEM_QUANTILE } = {}) {
    this.#alpha = alpha;
    this.#gemQuantile = gemQuantile;
  }

  get alpha() {
    return this.#alpha;
  }

  get gemQuantile() {
    return this.#gemQuantile;
  }

  /** Benjamini–Hochberg sobre o lote COMPLETO (nunca sobre subconjunto de tela). */
  adjust(pValues) {
    return benjaminiHochberg(pValues);
  }

  /**
   * EC-003: taxa exatamente 0/1 = ruído. (`B < 1` é praticamente sempre verdadeiro; mantido por fidelidade.)
   * @param {number} win  Taxa observada.
   * @param {number} B    Peso do dado.
   */
  isDegenerate(win, B) {
    return (win === 0 || win === 1) && B < 1;
  }

  /**
   * @param {{q: number, theta: number, mu: number, degenerate: boolean, smallSample: boolean,
   *          pickQuantile: number|null, banQuantile: number|null}} input
   * @returns {{strong: boolean, weak: boolean, isGem: boolean}}
   */
  classify({ q, theta, mu, degenerate, smallSample, pickQuantile, banQuantile }) {
    const significant = !smallSample && !degenerate && q <= this.#alpha;
    const strong = significant && theta > mu;
    const weak = significant && theta < mu;
    const isGem = strong && pickQuantile < this.#gemQuantile && banQuantile < this.#gemQuantile; // regra §16
    return { strong, weak, isGem };
  }
}
