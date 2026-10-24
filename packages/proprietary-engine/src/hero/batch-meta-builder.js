// hero/scoring/batch-meta-builder — metadados de LOTE (μ, τ, c, versões, qualidade, contagens).
import * as config from "../utils/config.js";
import { STRENGTH_INDEX_VERSION } from "./strength-index.js";
import { TIER_VERSION } from "./tierOf.js";
import { MODEL_VERSION, STRENGTH_MODEL, NULL_MODEL_VERSION, FDR_ALPHA, GEM_QUANTILE, MIN_LOT } from "./constants.js";

/**
 * Constrói e atualiza o objeto `meta` do lote.
 *
 * Responsabilidade única: proveniência e qualidade do lote. Tudo que vira número por herói
 * fica fora (nunca misturar escalas). `meta` é mutável só durante a construção, dentro de
 * {@link HeroScorer}; depois é entregue ao chamador.
 */
export class BatchMetaBuilder {
  /**
   * Metadados conhecidos ANTES de qualquer estatística.
   * @param {object} p
   * @param {number} p.c
   * @param {import("./walk-forward-prior.js").WalkForwardPrior} p.prior
   * @param {number} p.nFitted           Heróis expostos e válidos.
   * @param {number} p.nNoExposure
   * @param {{id: *, reason: string}[]} p.droppedReasons
   * @param {number} p.duplicatesDropped
   * @param {boolean} p.smallSample
   * @param {string|object|null} p.cohortKey
   */
  static initial({ c, prior, nFitted, nNoExposure, droppedReasons, duplicatesDropped, smallSample, cohortKey }) {
    const qualityFlags = [];
    if (nFitted > 0 && nFitted < MIN_LOT) qualityFlags.push("small_lot_suppress_significance");
    if (droppedReasons.length) qualityFlags.push("rows_quarantined");
    if (nNoExposure) qualityFlags.push("no_exposure_isolated");
    qualityFlags.push("global_sample_count_missing", "uncertainty_proxy");

    // V2 §3.6/§6.4: coorte homogênea é responsabilidade da ingestão; aqui só normalizamos/sinalizamos.
    const cohort_key = typeof cohortKey === "string" ? cohortKey : cohortKey == null ? null : JSON.stringify(cohortKey);
    if (cohort_key == null) qualityFlags.push("cohort_unvalidated");

    return {
      n: nFitted,
      n_total: nFitted + nNoExposure,
      n_fitted: nFitted,
      n_no_exposure: nNoExposure,
      n_dropped: droppedReasons.filter((d) => d.reason !== "duplicate_id").length,
      n_duplicates_dropped: duplicatesDropped,
      dropped_reasons: droppedReasons.slice(0, 50),
      mu: null,
      tau: null,
      mu_clamped: false,
      near_zero_between_hero_variance: false,
      tau2_mad: null, // diagnóstico P1: MAD pode superestimar τ² (ruído amostral incluso)
      tau2_moment: null, // DerSimonian–Laird; sem n real é proxy
      tau2_method: "mad_robust_proxy",
      between_hero_variance_note: "mad_includes_sampling_noise_unadjusted",
      c,
      c_reference: config.C_REFERENCE,
      c_grade: null, // v3: grade c podada — null por compat de fio
      fdr_alpha: FDR_ALPHA,
      gem_quantile: GEM_QUANTILE,
      small_sample: smallSample,
      prior: prior.stamp,
      version_break: prior.versionBroken,
      strength_index_version: STRENGTH_INDEX_VERSION,
      tier_version: TIER_VERSION,
      // V2 §19/§24: contrato de saída — nunca número nu sem proveniência.
      model_version: MODEL_VERSION,
      strength_model: STRENGTH_MODEL,
      sample_size_method: "not_provided_by_api",
      cohort_key,
      cohort_enforced: false, // L2 registrada: validação de mistura vive em cohorts/cohort-key.js (ingestão)
      quality_flags: qualityFlags,
      // V2 §9 + P1: q/strong/weak/isGem são CANDIDATOS experimentais.
      q_status: "experimental_unvalidated_null",
      inference_status: "experimental_candidates_only",
      null_model_version: NULL_MODEL_VERSION,
      test_family: null,
      allow_confirmatory_q_values: false,
      counts: { strong: 0, weak: 0, gem: 0, degenerate: 0 },
    };
  }

  /**
   * Aplica μ/τ estimados.
   * @param {object} meta
   * @param {import("./baseline-estimator.js").BaselineEstimate} baseline
   */
  static applyBaseline(meta, baseline) {
    meta.mu = baseline.mu;
    meta.tau = baseline.tau;
    meta.tau2_mad = baseline.tau2;
    meta.tau2_moment = baseline.tau2Moment;
    meta.tau2_method = baseline.method;
    if (baseline.muClamped) meta.mu_clamped = true;
    if (baseline.nearZero) meta.near_zero_between_hero_variance = true;
  }

  /** Conta um herói pontuado nas contagens do lote. */
  static count(meta, { strong, weak, isGem, degenerate }) {
    if (strong) meta.counts.strong++;
    if (weak) meta.counts.weak++;
    if (isGem) meta.counts.gem++;
    if (degenerate) meta.counts.degenerate++;
  }
}
