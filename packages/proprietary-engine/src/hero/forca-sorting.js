// Ordenação da tabela de força e posição no meta — FONTE ÚNICA. Puros, sem I/O.
// - sortHeroesByMetric (q asc; B desc; demais métricas desc; inválidos por último)
// - medianWrAdj (mediana de θ̂ p/ a ThetaBar; 0.5 sem dado)
// - heroRankPosition / heroRankPositions (posição por θ̂ desc, 1-based)
// Filtros por nome/tier são UI local e ficam na web.
//
// Spec V2 §7: posição é relativa ao lote; heróis sem estimativa (wrAdj null) nunca
// recebem posição numérica comum — ficam por último na ordenação e fora do mapa de
// posições (V2 §5.3: ausência não vira posição mediana).
import { compareById, medianOf } from "./hero-lists.js";

/**
 * Ordenação e posição relativa. Sem estado — reutilizável.
 */
export class HeroSorting {
  /**
   * @param rows heróis
   * @param sort "wrAdj"|"strength_index"|"win"|"pick"|"ban"|"q"|"B" ("d" = alias de "wrAdj")
   * MOTIVO: `d` saiu do motor; era afim crescente de θ̂, então ordenar por d ≡ ordenar por wrAdj.
   * Empates por id → resultado independe da ordem de entrada.
   * P1: política única de inválidos — wrAdj nulo/não-finito sempre por último (nunca diverge).
   */
  sortHeroesByMetric(rows, sort) {
    const key = sort === "d" ? "wrAdj" : sort;
    const val = (h) => (Number.isFinite(h?.[key]) ? h[key] : key === "q" ? 1 : -Infinity);
    const cmp =
      key === "q"
        ? (a, b) => val(a) - val(b)
        : key === "B"
          ? (a, b) => (b.B ?? 0) - (a.B ?? 0)
          : (a, b) => val(b) - val(a);
    return [...(rows ?? [])].sort((a, b) => cmp(a, b) || compareById(a, b));
  }

  /** Mediana de θ̂ (0.5 sem dado). */
  medianWrAdj(rows) {
    return medianOf((rows ?? []).map((h) => h.wrAdj)) ?? 0.5;
  }

  /** Posição 1-based por θ̂ desc (0 se fora da lista; null se o herói não tem estimativa). */
  heroRankPosition(rows, heroId) {
    const list = rows ?? [];
    const id = String(heroId);
    const me = list.find((h) => String(h.id) === id);
    if (!me) return 0;
    if (!Number.isFinite(me.wrAdj)) return null;
    let ahead = 0;
    for (const h of list) if (h !== me && this.#aheadOf(h, me)) ahead++;
    return ahead + 1;
  }

  /**
   * Posição de TODOS de uma vez: Map(String(id) → posição). O(n log n).
   * Heróis sem estimativa ficam FORA do mapa (nunca recebem posição numérica comum).
   * MOTIVO: heroRankPosition dentro de um loop por herói é O(n²) — use esta e consulte o Map.
   */
  heroRankPositions(rows) {
    const valid = (rows ?? []).filter((h) => Number.isFinite(h?.wrAdj));
    const sorted = [...valid].sort((a, b) => b.wrAdj - a.wrAdj || compareById(a, b));
    const pos = new Map();
    sorted.forEach((h, i) => {
      const k = String(h.id);
      if (!pos.has(k)) pos.set(k, i + 1);
    });
    return pos;
  }

  #aheadOf(h, me) {
    if (!Number.isFinite(h?.wrAdj) || !Number.isFinite(me?.wrAdj)) return false;
    return h.wrAdj > me.wrAdj || (h.wrAdj === me.wrAdj && compareById(h, me) < 0);
  }
}

const defaultSorting = new HeroSorting();

/** Shims compatíveis — comportamento idêntico ao anterior. */
export function sortHeroesByMetric(rows, sort) {
  return defaultSorting.sortHeroesByMetric(rows, sort);
}
export function medianWrAdj(rows) {
  return defaultSorting.medianWrAdj(rows);
}
export function heroRankPosition(rows, heroId) {
  return defaultSorting.heroRankPosition(rows, heroId);
}
export function heroRankPositions(rows) {
  return defaultSorting.heroRankPositions(rows);
}
