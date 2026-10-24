// hero/tierOf — faixas de tier por posição percentílica de θ̂. Puro, sem I/O.
//
// Spec V2 §7.2–§7.3: tier é ORDINAL e RELATIVO ao lote (fatia do ranking
// 8%/17%/50%/17%/8%), nunca força absoluta nem confiança. Sem dados → "?", nunca Tier D.
// `pct` vem de pctFromRank(). tier-v2: pct = (n − posto)/(n − 1).
export const TIER_VERSION = "tier-v2";

/** Ordem crescente de força — útil p/ comparar tiers (índice; "?" não entra). */
export const TIER_ORDER = Object.freeze(["D", "C", "B", "A", "S"]);

/**
 * Faixas de tier com cortes injetáveis (OCP: outro jogo/modo usa outros cortes
 * sem editar a regra; o padrão é o §7.2).
 */
export class HeroTier {
  #cuts;
  #version;

  /**
   * @param {object} [opts]
   * @param {{S:number,A:number,B:number,C:number}} [opts.cuts] Limiares de pct.
   * @param {string} [opts.version] Carimbo de versão (vai para `meta.tier_version`).
   */
  constructor({ cuts = { S: 0.92, A: 0.75, B: 0.25, C: 0.08 }, version = TIER_VERSION } = {}) {
    this.#cuts = cuts;
    this.#version = version;
  }

  get version() {
    return this.#version;
  }

  /** Tier de um percentil — não-finito vira "?" (nunca rebaixa sem dado). */
  tierOf(pct) {
    if (!Number.isFinite(pct)) return "?"; // antes: NaN/undefined caía em "D" (rebaixava sem dado)
    if (pct >= this.#cuts.S) return "S";
    if (pct >= this.#cuts.A) return "A";
    if (pct >= this.#cuts.B) return "B";
    if (pct >= this.#cuts.C) return "C";
    return "D";
  }
}

const defaultTiers = new HeroTier();

/** Shim compatível — tiers padrão V2 §7.2. */
export function tierOf(pct) {
  return defaultTiers.tierOf(pct);
}
