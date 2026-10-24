// Ordenação e seleção de builds por lift — FONTE ÚNICA.
// Movidos da web (semântica idêntica):
// - orderBuildsByLift ← BuildsSection (lift desc, NULL por último, empate win desc)
// - selectTopBuildsByLift ← HeroDetails/LaneBuilds (lift finito desc, corte N)
// - selectBuildsAboveMostUsed ← BuildsSection (lift finito > 0)
// - refWinsOf ← BuildsTab (refs da 1ª build: mais-usada e média)
// Puros, sem I/O.

/** Ordenação client: lift_vs_most_used desc, NULL por último, empate win desc. */
export function orderBuildsByLift(rows) {
  return [...(rows ?? [])].sort((a, b) => {
    const la = a.lift_vs_most_used;
    const lb = b.lift_vs_most_used;
    const aOk = la != null && Number.isFinite(la);
    const bOk = lb != null && Number.isFinite(lb);
    if (aOk && !bOk) return -1;
    if (!aOk && bOk) return 1;
    if (aOk && bOk && la !== lb) return lb - la;
    return (b.win ?? -1) - (a.win ?? -1);
  });
}

/** Top-N builds por lift finito desc. */
export function selectTopBuildsByLift(builds, n = 3) {
  return [...(builds ?? [])]
    .filter((b) => Number.isFinite(b.lift_vs_most_used))
    .sort((a, b) => b.lift_vs_most_used - a.lift_vs_most_used)
    .slice(0, n);
}

/** Builds com lift finito acima da mais-usada. */
export function selectBuildsAboveMostUsed(rows) {
  return [...(rows ?? [])].filter(
    (b) => b.lift_vs_most_used != null && Number.isFinite(b.lift_vs_most_used) && b.lift_vs_most_used > 0,
  );
}

/** Referências de win da rota (1ª build carrega as refs do contexto). */
export function refWinsOf(builds) {
  const r = (builds ?? [])[0] && (builds ?? [])[0].references;
  return {
    most: (r && r.most_used_win) ?? null,
    mean: (r && r.hero_mean_win) ?? null,
  };
}
