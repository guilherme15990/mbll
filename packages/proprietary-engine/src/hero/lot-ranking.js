// hero/scoring/lot-ranking — vistas RELATIVAS AO LOTE: índice de força, tier e quantis de exposição.
import { averageRanks, pctFromRank, rankQuantiles, strengthIndexByRank } from "./strength-index.js";
import { tierOf } from "./tierOf.js";

/**
 * Posição relativa de cada herói dentro do lote.
 *
 * Responsabilidade única: ordenar. Uma só primitiva de posto (`averageRanks`) alimenta
 * `strength_index`, `tier` e os quantis de pick/ban, então as vistas não podem divergir:
 * θ̂_A > θ̂_B ⇒ tier_A ≥ tier_B e índice_A > índice_B.
 * Tier é ORDINAL e RELATIVO: muda quando o conjunto comparado muda, sem θ̂ mudar.
 */
export class LotRanking {
  #n;
  #thetaRank;
  #pickQuantile;
  #banQuantile;

  /**
   * @param {number[]} thetas  θ̂ por herói (mesma ordem de `heroes`).
   * @param {{pick: number, ban: number}[]} heroes
   */
  constructor(thetas, heroes) {
    this.#n = heroes.length;
    this.#thetaRank = averageRanks(thetas);
    this.#pickQuantile = rankQuantiles(heroes.map((h) => h.pick)); // 0 = menor pick
    this.#banQuantile = rankQuantiles(heroes.map((h) => h.ban));
  }

  /** Tier S/A/B/C/D (ou "?" em lote pequeno). */
  tier(i, smallSample) {
    return smallSample ? "?" : tierOf(pctFromRank(this.#thetaRank[i], this.#n));
  }

  /** Índice 0–100 (100 = mais forte); null em lote pequeno (nunca número ao lado de "?"). */
  strengthIndex(i, smallSample) {
    return smallSample ? null : strengthIndexByRank(this.#thetaRank[i], this.#n);
  }

  pickQuantile(i) {
    return this.#pickQuantile[i];
  }

  banQuantile(i) {
    return this.#banQuantile[i];
  }
}
