// hero/strength-index — vistas de θ̂ baseadas em POSTO. Puro, sem I/O, zero dependências.
//
// Spec V2 §7.1: `strength_index = 100 × (n − posto)/(n − 1)`, postos médios em empates.
// MOTIVO: uma única primitiva de posto alimenta strength_index, tier e os quantis de
// exposição (pick/ban). Assim as vistas de θ̂ não podem divergir entre si:
// θ̂_A > θ̂_B  ⇒  posto_A < posto_B  ⇒  pct_A > pct_B  ⇒  tier_A ≥ tier_B e índice_A > índice_B.
// O índice é ordinal e relativo ao lote — não é chance de vitória (§7.1/§18).
export const STRENGTH_INDEX_VERSION = "strength-index-v1";

/**
 * Postos e índices relativos ao lote. Sem estado entre chamadas — reutilizável.
 * Valores não-finitos (null/NaN de heróis sem estimativa) recebem posto null e nunca
 * ganham posição numérica comum (V2 §5.3: ausência não vira posição mediana).
 */
export class StrengthIndex {
  /**
   * Posto médio 1-based, DECRESCENTE (1 = maior valor). Empates dividem o posto médio
   * (nunca zeram nem coroam um grupo empatado). O(n log n). Independe da ordem de entrada.
   */
  averageRanks(values) {
    const out = new Array(values.length).fill(null);
    const idx = values.map((_, i) => i).filter((i) => Number.isFinite(values[i])).sort((a, b) => values[b] - values[a]);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && values[idx[j + 1]] === values[idx[i]]) j++;
      const avg = (i + 1 + j + 1) / 2; // posto médio do grupo empatado
      for (let k = i; k <= j; k++) out[idx[k]] = avg;
      i = j + 1;
    }
    return out;
  }

  /** Posição normalizada em [0,1] a partir do posto médio (1 = maior, 0 = menor). n<=1 = null. */
  pctFromRank(avgRank, n) {
    if (!Number.isFinite(avgRank) || !Number.isFinite(n) || n <= 1) return null;
    return Math.min(1, Math.max(0, (n - avgRank) / (n - 1)));
  }

  /** Quantis por posto de um vetor (1 = maior valor). Substitui percentileRank O(n) por item. */
  rankQuantiles(values) {
    const n = values.length;
    return this.averageRanks(values).map((r) => this.pctFromRank(r, n));
  }

  /**
   * ADR-024 L2-IDX-01: índice 0–100 = pct do θ̂ no lote × 100 (100 = mais forte). Expressão
   * numérica idêntica à versão anterior (mesmo arredondamento). N<=1 ou inválido = null.
   */
  strengthIndexByRank(avgRank, n) {
    if (!Number.isFinite(avgRank) || !Number.isFinite(n) || n <= 1) return null;
    return +Math.min(100, Math.max(0, (100 * (n - avgRank)) / (n - 1))).toFixed(1);
  }
}

const defaultIndex = new StrengthIndex();

/** Shims compatíveis — comportamento byte-idêntico ao anterior. */
export function averageRanks(values) {
  return defaultIndex.averageRanks(values);
}
export function pctFromRank(avgRank, n) {
  return defaultIndex.pctFromRank(avgRank, n);
}
export function rankQuantiles(values) {
  return defaultIndex.rankQuantiles(values);
}
export function strengthIndexByRank(avgRank, n) {
  return defaultIndex.strengthIndexByRank(avgRank, n);
}
