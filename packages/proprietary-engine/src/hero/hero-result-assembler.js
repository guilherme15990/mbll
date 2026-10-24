// hero/scoring/hero-result-assembler — monta o objeto de saída por herói (contrato V2 §19).

/**
 * Monta os objetos do contrato `HERO_CONTRACT`.
 *
 * Responsabilidade única: composição de saída. Não calcula estatística — recebe tudo pronto.
 * Eco do input (`id`, `name`, `win`, `pick`, `ban` e extras da UI) passa por `...hero` e NÃO é
 * campo do motor. Metadados de lote vivem em `meta`, nunca por herói.
 */
export class HeroResultAssembler {
  /**
   * Herói pontuado.
   * @param {object} p
   * @param {object} p.hero         Linha de entrada.
   * @param {import("./shrinkage-model.js").HeroPosterior} p.posterior
   * @param {number|null} p.q       q-valor BH (null em lote pequeno).
   * @param {{strong: boolean, weak: boolean, isGem: boolean}} p.flags
   * @param {boolean} p.degenerate
   * @param {boolean} p.smallSample
   * @param {string} p.tier
   * @param {number|null} p.strengthIndex
   * @param {object|null} p.debug   Bloco `_debug` (só com `opts.debug`).
   */
  scored({ hero, posterior, q, flags, degenerate, smallSample, tier, strengthIndex, debug }) {
    const { trioBatch, trioStar } = posterior;
    const out = {
      ...hero,
      wrAdj: posterior.theta,
      tier,
      strength_index: strengthIndex,
      se: posterior.se,
      B: posterior.B,
      credible_interval_95: trioStar.credible_interval_95,
      posterior_prob_above_threshold: trioStar.posterior_prob_above_threshold,
      uncertainty_status: trioBatch.uncertainty_status,
      q: smallSample ? null : q,
      strong: flags.strong,
      weak: flags.weak,
      isGem: flags.isGem,
      degenerate,
      smallSample,
      data_status: "ok",
      // V2 §19: proveniência por herói — ativa o teto proxy do HeroTrustPolicy na UI.
      sample_size_method: "not_provided_by_api",
      inference_status: "experimental_candidates_only",
      // DESVIO (a): posterior_mean no topo — a ConfiancaSection exibe por exigência do PRD.
      posterior_mean: trioStar.posterior_mean,
      // DESVIO (b): z no topo — views/semana ordenam por ele.
      z: posterior.z,
    };
    if (debug) out._debug = debug;
    return out;
  }

  /**
   * Stub de herói SEM exposição (pick ≤ 0): anexado ao fim, fora de μ/τ/BH/ranks.
   * Ausência de dado nunca vira Tier D, 50% nem confiança alta (V2 §5.3).
   * @param {object} hero
   * @param {boolean} smallSample
   * @param {boolean} withDebug
   */
  stub(hero, smallSample, withDebug) {
    const out = {
      ...hero,
      wrAdj: null,
      tier: "?",
      strength_index: null,
      se: null,
      B: 0,
      credible_interval_95: null,
      posterior_prob_above_threshold: null,
      uncertainty_status: "insufficient_exposure",
      q: null,
      strong: false,
      weak: false,
      isGem: false,
      degenerate: false,
      smallSample,
      data_status: "insufficient_exposure",
      sample_size_method: "not_provided_by_api",
      inference_status: "experimental_candidates_only",
      posterior_mean: null,
      z: null,
    };
    if (withDebug) out._debug = { z: null, p: null, wrAdjBatch: null, seBatch: null, qPick: null, qBan: null, noExposure: true };
    return out;
  }
}
