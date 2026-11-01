// @radar/engine · heroes/assembler — montagem do DTO final do herói e validação de linhas.
// Consolidado (ADR-061): reúne hero/hero-result-assembler.js, hero/hero-row-validator.js.
// Barrel público: src/index.js (nenhum nome público muda).

import { Tier } from "./ranking.js";
import { DataStatus, InferenceStatus, UncertaintyStatus } from "../core/states.js";


// ── hero/hero-result-assembler.js ──
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
      data_status: DataStatus.OK,
      // V2 §19: proveniência por herói — ativa o teto proxy do HeroTrustPolicy na UI.
      sample_size_method: "not_provided_by_api",
      inference_status: InferenceStatus.EXPERIMENTAL_CANDIDATES_ONLY,
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
      tier: Tier.UNKNOWN,
      strength_index: null,
      se: null,
      B: 0,
      credible_interval_95: null,
      posterior_prob_above_threshold: null,
      uncertainty_status: UncertaintyStatus.INSUFFICIENT_EXPOSURE,
      q: null,
      strong: false,
      weak: false,
      isGem: false,
      degenerate: false,
      smallSample,
      data_status: DataStatus.INSUFFICIENT_EXPOSURE,
      sample_size_method: "not_provided_by_api",
      inference_status: InferenceStatus.EXPERIMENTAL_CANDIDATES_ONLY,
      posterior_mean: null,
      z: null,
    };
    if (withDebug) out._debug = { z: null, p: null, wrAdjBatch: null, seBatch: null, qPick: null, qBan: null, noExposure: true };
    return out;
  }
}

// ── hero/hero-row-validator.js ──
// hero/scoring/hero-row-validator — validação, deduplicação e separação por exposição.
/**
 * Resultado da validação de um lote bruto.
 * @typedef {Object} ValidationResult
 * @property {object[]} exposed          Linhas válidas com pick > 0 (participam do ajuste).
 * @property {object[]} noExposure       Linhas válidas com pick = 0 (viram stub; não votam em μ/τ/BH).
 * @property {{id: *, reason: string}[]} droppedReasons  Quarentena com motivo (inclui `duplicate_id`).
 * @property {number} duplicatesDropped  Quantas linhas foram descartadas por id repetido.
 */

/**
 * Valida o lote bruto ANTES de qualquer estatística.
 *
 * Responsabilidade única (SRP): decidir quais linhas entram no ajuste. Não calcula nada.
 * Ordem correta (EC-011/EC-001/EC-013, P1 auditoria): VALIDAR → DEDUPAR (só a 1ª ocorrência
 * VÁLIDA vence) → SEPARAR sem-exposição. Taxa fora de [0,1], ausente ou string nunca entra
 * (V2 §5.1-5.3): vai para quarentena com motivo, jamais vira zero.
 */
export class HeroRowValidator {
  /**
   * @param {object[]|null|undefined} rawHeroes  Linhas `{id, win, pick, ban, ...}`.
   * @returns {ValidationResult}
   */
  validate(rawHeroes) {
    const seen = new Set();
    const exposed = [];
    const noExposure = [];
    const droppedReasons = [];
    let duplicatesDropped = 0;
    let rowIdx = 0;
    for (const h of rawHeroes ?? []) {
      rowIdx++;
      const reason = this.#reasonToDrop(h);
      if (reason) {
        droppedReasons.push({ id: h && typeof h === "object" ? (h.id ?? h.hero_id ?? null) : null, reason });
        continue;
      }
      const key = this.#identityKey(h, rowIdx);
      if (seen.has(key)) {
        duplicatesDropped++;
        droppedReasons.push({ id: h.id ?? h.hero_id ?? null, reason: "duplicate_id" });
        continue;
      }
      seen.add(key);
      (h.pick > 0 ? exposed : noExposure).push(h);
    }
    return { exposed, noExposure, droppedReasons, duplicatesDropped };
  }

  /** Chave de identidade; sem id, o índice da linha evita colapsar linhas distintas (MEDIUM). */
  #identityKey(h, rowIdx) {
    const hasId = h.id != null || h.hero_id != null;
    return hasId ? String(h.id ?? h.hero_id) : `__row${rowIdx}:${JSON.stringify([h.win, h.pick, h.ban])}`;
  }

  /** Motivo de quarentena, ou null se a linha é válida. */
  #reasonToDrop(h) {
    if (!h || typeof h !== "object") return "invalid_row";
    for (const k of ["win", "pick", "ban"]) {
      const v = h[k];
      if (v == null || (typeof v === "string" && v !== "") || Number.isNaN(v)) return `rate_missing:${k}`;
      if (!Number.isFinite(v)) return `rate_nonfinite:${k}`;
      if (v < 0 || v > 1) return `rate_out_of_range:${k}`;
    }
    return null;
  }
}
