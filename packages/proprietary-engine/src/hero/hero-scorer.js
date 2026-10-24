// hero/scoring/hero-scorer — orquestrador do pipeline de pontuação de heróis.
import { C_REFERENCE } from "../utils/config.js";
import { MIN_LOT } from "./constants.js";
import { HeroRowValidator } from "./hero-row-validator.js";
import { MadBaselineEstimator } from "./baseline-estimator.js";
import { WalkForwardPrior } from "./walk-forward-prior.js";
import { EmpiricalBayesShrinkage } from "./shrinkage-model.js";
import { SignificanceTester } from "./significance-tester.js";
import { LotRanking } from "./lot-ranking.js";
import { HeroResultAssembler } from "./hero-result-assembler.js";
import { BatchMetaBuilder } from "./batch-meta-builder.js";

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
export class HeroScorer {
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
