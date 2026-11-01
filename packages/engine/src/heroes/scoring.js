// @radar/engine · heroes/scoring — pipeline de score do lote de heróis (classes + facade funcional).
// Consolidado (ADR-061): reúne hero/constants.js, hero/baseline-estimator.js, hero/shrinkage-model.js, hero/significance-tester.js, hero/batch-meta-builder.js, hero/hero-scorer.js, hero/score-heroes.js.
// Barrel público: src/index.js (nenhum nome público muda).

import * as config from "../core/config.js";
import { C_REFERENCE } from "../core/config.js";
import { HeroResultAssembler, HeroRowValidator } from "./assembler.js";
import { LotRanking } from "./ranking.js";
import { WalkForwardPrior } from "./trends.js";
import { benjaminiHochberg, ebShrink, obsVariance, pFromZ } from "../core/statistics.js";
import { confidenceTrio } from "./trust.js";
import { mad, median } from "../core/math.js";
import { InferenceStatus, QStatus } from "../core/states.js";

// ── hero/constants.js ──
// hero/scoring/constants — constantes do pipeline de pontuação de heróis.
// Dono único; as classes recebem estes valores por padrão e aceitam override por injeção.

/** Nível BH (FDR) do lote — spec §16. */
const FDR_ALPHA = 0.05;
/** Joia = quartil inferior de pick E de ban — spec §16. */
const GEM_QUANTILE = 0.25;
/** EC-004: abaixo deste nº de heróis válidos MAD/BH/tiers não se sustentam. */
const MIN_LOT = 10;
/** Piso/teto numérico de μ (V2 §6.1). */
const EPS = 1e-6;
/** Identificador do modelo de força (nome do estimador, não versão de build). */
const STRENGTH_MODEL = "eb_rate_proxy_v1";

// ── hero/baseline-estimator.js ──
// hero/scoring/baseline-estimator — estimadores de μ (baseline) e τ (dispersão entre heróis).




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
class MadBaselineEstimator {
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

// ── hero/shrinkage-model.js ──
// hero/scoring/shrinkage-model — M1: shrinkage empírico Bayesiano por herói.



/**
 * Posterior de UM herói.
 * @typedef {Object} HeroPosterior
 * @property {number} theta       θ̂ final (com pull do prior, se ativo).
 * @property {number} se          Erro-padrão final.
 * @property {number} B           Peso do dado τ²/(τ²+s²).
 * @property {number} z           (θ̂ − μ)/se.
 * @property {number} p           p-valor bicaudal de z (NÃO validado — o nulo não foi validado).
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
class EmpiricalBayesShrinkage {
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

// ── hero/significance-tester.js ──
// hero/scoring/significance-tester — q (BH) e rótulos strong/weak/isGem como CANDIDATOS.



/**
 * Significância exploratória do lote.
 *
 * Responsabilidade única: transformar p-valores em q e decidir strong/weak/isGem.
 * IMPORTANTE (P1 auditoria, V2 §9): os p-valores vêm de um z após shrinkage e o nulo NÃO foi
 * validado; portanto strong/weak/isGem são candidatos experimentais (`inference_status`).
 */
class SignificanceTester {
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

// ── hero/batch-meta-builder.js ──
// hero/scoring/batch-meta-builder — metadados de LOTE (μ, τ, c, versões, qualidade, contagens).





/**
 * Constrói e atualiza o objeto `meta` do lote.
 *
 * Responsabilidade única: proveniência e qualidade do lote. Tudo que vira número por herói
 * fica fora (nunca misturar escalas). `meta` é mutável só durante a construção, dentro de
 * {@link HeroScorer}; depois é entregue ao chamador.
 */
class BatchMetaBuilder {
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
      strength_model: STRENGTH_MODEL,
      sample_size_method: "not_provided_by_api",
      cohort_key,
      cohort_enforced: false, // L2 registrada: validação de mistura vive em cohorts/cohort-key.js (ingestão)
      quality_flags: qualityFlags,
      // V2 §9 + P1: q/strong/weak/isGem são CANDIDATOS experimentais.
      q_status: QStatus.EXPERIMENTAL_UNVALIDATED_NULL,
      inference_status: InferenceStatus.EXPERIMENTAL_CANDIDATES_ONLY,
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

// ── hero/hero-scorer.js ──
// hero/scoring/hero-scorer — orquestrador do pipeline de pontuação de heróis.











/**
 * Opções de {@link HeroScorer#score}.
 * @typedef {Object} ScoreOptions
 * @property {number} [c]                 Premissa de tamanho efetivo (padrão `C_REFERENCE`).
 * @property {object} [prior]            Prior walk-forward {mu, tau2, n, game_version}.
 * @property {string} [gameVersion]      Versão do jogo do lote (alias `game_version`).
 * @property {string|object} [cohortKey] Chave de coorte (alias `cohort_key`).
 * @property {boolean} [debug]           Acrescenta `_debug` por herói.
 */

/**
 * Pontua um lote (elo + janela). Pipeline, em ordem:
 *
 *   validar → estimar baseline (μ, τ) → shrinkage por herói → BH no lote →
 *   ranking relativo → classificar → montar saída.
 *
 * SOLID:
 *  - S: cada etapa é uma classe própria; aqui só se orquestra.
 *  - O: trocar o estimador de τ, o teste de significância ou a montagem de saída é injetar outra
 *       implementação — sem editar este arquivo.
 *  - L: qualquer `BaselineEstimator` respeita o mesmo contrato (`estimate(heroes, c)`).
 *  - I: cada colaborador expõe só o que o pipeline usa (ex.: `LotRanking` não sabe de p-valor).
 *  - D: depende de contratos injetados; os padrões são os do M1 atual.
 *
 * Puro, sem I/O, determinístico: nada depende da ordem de entrada nem de `Map`. Sem estado
 * entre chamadas — uma instância pode ser reutilizada.
 */
class HeroScorer {
  #validator;
  #baselineEstimator;
  #tester;
  #assembler;
  #minLot;

  /**
   * @param {object} [deps]
   * @param {HeroRowValidator} [deps.validator]
   * @param {import("./baseline-estimator.js").BaselineEstimator} [deps.baselineEstimator]
   * @param {SignificanceTester} [deps.tester]
   * @param {HeroResultAssembler} [deps.assembler]
   * @param {number} [deps.minLot]  Piso de heróis para tiers/BH (guarda de produto, não amostra).
   */
  constructor({
    validator = new HeroRowValidator(),
    baselineEstimator = new MadBaselineEstimator(),
    tester = new SignificanceTester(),
    assembler = new HeroResultAssembler(),
    minLot = MIN_LOT,
  } = {}) {
    this.#validator = validator;
    this.#baselineEstimator = baselineEstimator;
    this.#tester = tester;
    this.#assembler = assembler;
    this.#minLot = minLot;
  }

  /**
   * @param {object[]} rawHeroes  `[{id, name, win, pick, ban, ...}]` com taxas em [0,1].
   * @param {ScoreOptions} [opts]
   * @returns {{heroes: object[], meta: object}}  Contrato por herói em `HERO_CONTRACT`.
   */
  score(rawHeroes, opts = {}) {
    const c = Number.isFinite(opts.c) && opts.c > 0 ? opts.c : C_REFERENCE;
    const prior = new WalkForwardPrior(opts.prior, opts.gameVersion ?? opts.game_version ?? null);

    const { exposed, noExposure, droppedReasons, duplicatesDropped } = this.#validator.validate(rawHeroes);
    const n = exposed.length;
    const smallSample = n > 0 && n < this.#minLot;
    const meta = BatchMetaBuilder.initial({
      c, prior, nFitted: n, nNoExposure: noExposure.length, droppedReasons, duplicatesDropped, smallSample,
      cohortKey: opts.cohortKey ?? opts.cohort_key ?? null,
    });
    if (n === 0) return { heroes: [], meta };

    const baseline = this.#baselineEstimator.estimate(exposed, c);
    BatchMetaBuilder.applyBaseline(meta, baseline);
    const { mu } = baseline;

    const model = new EmpiricalBayesShrinkage({ c, mu, tau2: baseline.tau2, prior });
    const posteriors = exposed.map((h) => model.posterior(h));
    const q = this.#tester.adjust(posteriors.map((p) => p.p)); // M2: BH sobre o lote completo
    const ranking = new LotRanking(posteriors.map((p) => p.theta), exposed);

    const scored = exposed.map((hero, i) => {
      const posterior = posteriors[i];
      const degenerate = this.#tester.isDegenerate(hero.win, posterior.B);
      const flags = this.#tester.classify({
        q: q[i], theta: posterior.theta, mu, degenerate, smallSample,
        pickQuantile: ranking.pickQuantile(i), banQuantile: ranking.banQuantile(i),
      });
      BatchMetaBuilder.count(meta, { ...flags, degenerate });
      const debug = opts.debug
        ? { z: posterior.z, p: posterior.p, wrAdjBatch: posterior.wrAdjBatch, seBatch: posterior.seBatch,
            posterior_mean: posterior.trioStar.posterior_mean, qPick: ranking.pickQuantile(i), qBan: ranking.banQuantile(i) }
        : null;
      return this.#assembler.scored({
        hero, posterior, q: q[i], flags, degenerate, smallSample,
        tier: ranking.tier(i, smallSample), strengthIndex: ranking.strengthIndex(i, smallSample), debug,
      });
    });

    // Sem-exposição fora do fit: stubs ao final, na ordem de entrada (determinístico).
    const stubs = noExposure.map((h) => this.#assembler.stub(h, smallSample, Boolean(opts.debug)));
    return { heroes: [...scored, ...stubs], meta };
  }
}

// ── hero/score-heroes.js ──
// hero/score-heroes — FACADE fina sobre o pipeline em classes (./scoring/).
// Motivo: testes, apps e web importam scoreBatch/scoreHeroes/HERO_CONTRACT daqui;
// a lógica vive nas classes (SRP/OCP/DIP), este módulo só preserva o contrato público.
// Modelo preservado: y_i | θ_i ~ N(θ_i, s_i²), s_i² = μ(1−μ)/(c·pick_i), θ_i ~ N(μ, τ²).

/** Categorias de campo do contrato por herói (famílias de escala). */
const HeroContractCategory = Object.freeze({
  VISTA: "vista",
  INCERTEZA: "incerteza",
  SIGNIFICANCIA: "significancia",
  GUARDA: "guarda",
});

/**
 * CONTRATO DE SAÍDA POR HERÓI v3 (19 campos do motor + eco do input).
 * Famílias (regra crítica: nunca misturar escalas; vistas usam SÓ θ̂):
 *   vista        — monotônica em θ̂, RELATIVA AO LOTE (rodar só tanks muda tier; θ̂ não muda)
 *   incerteza    — θ̂ + se; PODE discordar de θ̂ (é o ponto)
 *   significancia— θ̂ + se + n + BH (+ quantis de exposição na joia); PODE discordar de θ̂.
 *                  strong/weak/isGem são CANDIDATOS experimentais (nulo não validado, V2 §9).
 *   guarda       — sobre o INPUT bruto/lote; suprime significância, nunca altera θ̂
 * Eco do input (id, name, win, pick, ban e extras da UI) passa por `...h` e NÃO é campo do motor.
 * Metadados de lote (μ, τ, c, versões, prior, contagens) vivem em `meta`, nunca por herói.
 */
export const HERO_CONTRACT = Object.freeze({
  wrAdj: HeroContractCategory.VISTA, //                    θ̂: média posterior (única grandeza absoluta)
  tier: HeroContractCategory.VISTA, //                     S/A/B/C/D por posição de θ̂ no lote ("?" = amostra pequena)
  strength_index: HeroContractCategory.VISTA, //           0–100 pela MESMA posição de θ̂ (100 = mais forte)
  se: HeroContractCategory.INCERTEZA, //                   erro-padrão posterior (se* sob walk-forward)
  B: HeroContractCategory.INCERTEZA, //                    peso do dado τ²/(τ²+s²) do lote; 1 − B = encolhimento
  credible_interval_95: HeroContractCategory.INCERTEZA, // IC 95% de θ (trio)
  posterior_prob_above_threshold: HeroContractCategory.INCERTEZA, // P(θ > limiar prático) (trio)
  uncertainty_status: HeroContractCategory.INCERTEZA, //   rótulo de incerteza (trio do LOTE, nunca mascarado pelo prior)
  q: HeroContractCategory.SIGNIFICANCIA, //                q-valor BH experimental (FDR)
  strong: HeroContractCategory.SIGNIFICANCIA, //           candidato experimental: q ≤ α, θ̂ > μ, sem guarda
  weak: HeroContractCategory.SIGNIFICANCIA, //             candidato experimental: q ≤ α, θ̂ < μ, sem guarda
  isGem: HeroContractCategory.SIGNIFICANCIA, //            strong ∧ pick e ban no quartil inferior (⊂ strong)
  degenerate: HeroContractCategory.GUARDA, //              win 0/1 (ruído)
  smallSample: HeroContractCategory.GUARDA, //             lote < MIN_LOT
  data_status: HeroContractCategory.GUARDA, //             ok | insufficient_exposure (pick≤0) — V2 §6.1/EC-002
  sample_size_method: HeroContractCategory.GUARDA, //     not_provided_by_api — ativa o teto proxy do trust (§8.2)
  inference_status: HeroContractCategory.GUARDA, //        experimental_candidates_only até validar o nulo (P1)
  // DESVIO (a): posterior_mean PERMANECE no topo (o CONTRATO manda p/ debug, mas a
  // ConfiancaSection EXIBE posterior+trio por exigência do PRD — sem ele a aba quebra).
  posterior_mean: HeroContractCategory.INCERTEZA, //       média posterior do trio (m*; = θ̂ sem prior)
  // DESVIO (b): z PERMANECE no topo (computado de graça p/ q; views/semana ordenam por ele).
  z: HeroContractCategory.SIGNIFICANCIA, //                (θ̂ − μ)/se — estatística por trás de q
});

const scorer = new HeroScorer();

/**
 * Pontua um lote (elo + janela). Retorna { heroes, meta }.
 * @param rawHeroes [{id,name,win,pick,ban,...}]
 * @param opts { c, prior, gameVersion|game_version, cohortKey|cohort_key, debug }
 */
export function scoreBatch(rawHeroes, opts = {}) {
  return scorer.score(rawHeroes, opts);
}

/**
 * Assinatura pública histórica: devolve só o array por herói. Use scoreBatch para obter `meta`.
 */
export function scoreHeroes(rawHeroes, opts = {}) {
  return scorer.score(rawHeroes, opts).heroes;
}
