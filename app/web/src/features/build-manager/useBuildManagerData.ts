import { useEffect, useMemo } from "react";
import type { SetURLSearchParams } from "react-router-dom";
import { LANES, useBuilds, useBuildsAggregate, useHero, useHeroLanes } from "../../shared/api";

/**
 * Dados oficiais do Build Management (ADR-047): ficha, rotas do herói, builds
 * observadas e o agregado de pesos — sempre os MESMOS hooks/keys do resto do
 * app, sem endpoint nem fan-out novos.
 *
 * O agregado só é habilitado com herói+lane (sem isso, nenhum peso é montado).
 * Sem `?lane=`, a primeira rota mapeada do herói assume o endereço. Extraído de
 * `BuildManager.tsx` (ADR-041: teto de 300 linhas).
 */
export function useBuildManagerData({
  hero,
  rank,
  window,
  lane,
  sp,
  setSp,
}: {
  hero: string;
  rank: string;
  window: string;
  lane: string;
  sp: URLSearchParams;
  setSp: SetURLSearchParams;
}) {
  const heroQuery = useHero(hero || null, rank, window);
  const lanesQuery = useHeroLanes(rank);
  const lanesMap = lanesQuery.data?.data as Record<string, string[]> | undefined;
  const heroLanes = useMemo(
    () => (hero && lanesMap ? (lanesMap[hero] ?? []) : []).filter((l) => (LANES as readonly string[]).includes(l)),
    [hero, lanesMap],
  );

  // Sem ?lane=, a primeira rota mapeada do herói assume (visível e trocável).
  useEffect(() => {
    if (!hero || sp.get("lane") != null || !lanesQuery.isSuccess || heroLanes.length === 0) return;
    const next = new URLSearchParams(sp);
    next.set("lane", heroLanes[0]);
    setSp(next, { replace: true });
  }, [hero, sp, setSp, lanesQuery.isSuccess, heroLanes]);

  const buildsQuery = useBuilds(hero || null, rank, lane);
  // O agregado só roda com herói+lane: sem isso, nenhum peso é montado.
  const aggregateQuery = useBuildsAggregate(rank, hero && lane ? lane : "", window, 10);

  return { heroQuery, lanesQuery, heroLanes, buildsQuery, aggregateQuery };
}
