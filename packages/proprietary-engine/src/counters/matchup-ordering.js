// Ordenação e seleção de pares (matchups) por δ — FONTE ÚNICA.
// Movidos da web (semântica idêntica):
// - comparePairsByDeltaAsc/sortPairsByDeltaAsc ← ConfrontosSection (δ asc,
//   ausente por último via ?? Infinity; par ausente = desconhecido, nunca 0)
// - selectTopCountersByDelta/selectTopSynergiesByDelta ← HeroDetails (filtro
//   finito antes de ordenar; corte N)
// - firstPairByDeltaAsc ← ConfrontosSection (anti-sinergia dominante)
// - sortPairsByDeltaDesc ← ConfrontosSection/ConfrontosPreview (grupos "a favor")
// - hasFiniteDelta ← predicado reutilizado pelos dois lados
// Puros, sem I/O.

/** δ asc; δ ausente vai para o fim (desconhecido, nunca 0). */
export function comparePairsByDeltaAsc(a, b) {
  return ((a && a.delta) ?? Infinity) - ((b && b.delta) ?? Infinity);
}

/** Cópia ordenada por δ asc (estável no sentido de cópia, sem mutar entrada). */
export function sortPairsByDeltaAsc(pairs) {
  return [...(pairs ?? [])].sort(comparePairsByDeltaAsc);
}

/** δ desc; δ ausente vai para o fim (desconhecido nunca lidera "a favor"). */
export function comparePairsByDeltaDesc(a, b) {
  return ((b && b.delta) ?? -Infinity) - ((a && a.delta) ?? -Infinity);
}

/** Cópia ordenada por δ desc (não muta a entrada). */
export function sortPairsByDeltaDesc(pairs) {
  return [...(pairs ?? [])].sort(comparePairsByDeltaDesc);
}

/** δ finito? */
export function hasFiniteDelta(p) {
  return Number.isFinite(p && p.delta);
}

/** Top-N counters (δ finito, asc). */
export function selectTopCountersByDelta(pairs, n = 3) {
  return [...(pairs ?? [])].filter(hasFiniteDelta).sort(comparePairsByDeltaAsc).slice(0, n);
}

/** Top-N sinergias (δ finito, desc). */
export function selectTopSynergiesByDelta(pairs, n = 3) {
  return [...(pairs ?? [])]
    .filter(hasFiniteDelta)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, n);
}

/** Par dominante por δ asc (undefined sem pares). */
export function firstPairByDeltaAsc(pairs) {
  return sortPairsByDeltaAsc(pairs)[0];
}
