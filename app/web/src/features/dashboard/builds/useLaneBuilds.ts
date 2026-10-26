import { useMemo } from "react";
import {
  LANES, useBuilds, useHeroLanes, useHeroes,
  type Build, type Hero,
} from "../../../shared/api";
import { selectLaneTopHeroesDetailed } from "@radar/proprietary-engine";

/**
 * Dados da aba Builds do /dashboard (composição por rota, sem herói fixo).
 *
 * Orçamento fechado: R1 mapa de lanes (cache 24 h) + R2 lista
 * `sort=win&order=desc&size=25` + R3–R5 no máximo 3 GETs de builds, com as
 * mesmas keys da ficha (`["builds", id, rank, lane]`).
 *
 * Sem rota escolhida = 0 requests de builds. A aba nunca ordena builds entre
 * heróis: a ordem dos cards é θ̂ do herói (R2); dentro do card, a ordem é a da
 * fonte. Rota não entra em query key de rede — é filtro client-side.
 */

export const TOP_N = 3;
export const LINES_PER_HERO = 2;
const LIST_EXTRA = "sort=win&order=desc";
const LIST_SIZE = 25;

/** Mapa vazio = fallback explícito do motor: top-N sem validação de rota. */
const EMPTY_LANES: Record<number, string[]> = {};

export type BuildCardState =
  | { kind: "loading"; hero: Hero }
  | { kind: "error"; hero: Hero; onRetry: () => void }
  | { kind: "empty"; hero: Hero; motive: string }
  | { kind: "ready"; hero: Hero; builds: Build[] };

export function useLaneBuilds({
  rank,
  window,
  active,
  lanes,
}: {
  rank: string;
  window: string;
  active: boolean;
  lanes: string[];
}) {
  // Builds é por rota única: com 0 ou 2+ rotas não há recorte (INV4-027).
  const laneKey = lanes.length === 1 ? (lanes[0] ?? "") : "";
  const validLane = laneKey !== "" && (LANES as readonly string[]).includes(laneKey);

  // R1 · mapa heroId -> lanes[] (mesma key da ficha/dashboard, cache 24 h).
  const lanesQuery = useHeroLanes(rank, active);
  // R2 · lista rankeada θ̂ desc (topo da rota é interseção client-side).
  const listQuery = useHeroes(rank, window, LIST_EXTRA, 1, LIST_SIZE, active);

  const lanesMap = lanesQuery.data?.data as Record<number, string[]> | undefined;
  const lanesLoaded = lanesQuery.isSuccess && lanesMap != null;
  const lanesEmpty = lanesLoaded && Object.keys(lanesMap as Record<number, string[]>).length === 0;

  // Mapa indisponível (erro) cai no MESMO fallback do mapa vazio: top-N da
  // lista sem validação de rota, com aviso explícito no cabeçalho. Melhor do
  // que tela vazia com diagnóstico falso de "sem builds".
  const mapForSelection = lanesLoaded ? lanesMap : lanesQuery.isError ? EMPTY_LANES : undefined;

  // Top-3 θ̂ da rota em `@radar/proprietary-engine` (ordem de R2 preservada).
  // `validated:false` só aparece quando o mapa não carregou/está vazio e a
  // seleção vira fallback — o cabeçalho acende "rota não validada".
  const selection = useMemo(() => {
    if (!validLane || mapForSelection == null) {
      return { rows: [] as Hero[], validated: false };
    }
    return selectLaneTopHeroesDetailed(
      listQuery.data?.data ?? [],
      mapForSelection,
      laneKey,
      TOP_N,
    );
  }, [listQuery.data, mapForSelection, validLane, laneKey]);

  const heroes = selection.rows;

  // R3–R5 · um GET builds por herói do top-3, SÓ com aba ativa E rota escolhida.
  // Chamadas estáticas (sem loop/prefetch): teto N=3 enforced por construção.
  const qid0 = active && validLane && heroes[0] != null ? String(heroes[0].id) : null;
  const qid1 = active && validLane && heroes[1] != null ? String(heroes[1].id) : null;
  const qid2 = active && validLane && heroes[2] != null ? String(heroes[2].id) : null;
  const b0 = useBuilds(qid0, rank, laneKey);
  const b1 = useBuilds(qid1, rank, laneKey);
  const b2 = useBuilds(qid2, rank, laneKey);
  const buildQueries = [b0, b1, b2];

  const cards: BuildCardState[] = heroes.map((hero, i) => {
    const q = buildQueries[i];
    if (q == null || q.isLoading) return { kind: "loading", hero };

    // GE-P1-04: stale descartado — só renderiza o conjunto cuja
    // (rank, lane, id) confere com o herói pedido.
    const body = q.data;
    const mismatch =
      body != null && (body.id !== hero.id || body.lane !== laneKey || body.rank !== rank);
    if (q.isError || mismatch) return { kind: "error", hero, onRetry: () => q.refetch() };

    const builds = body?.data ?? [];
    if (!builds.length) {
      return {
        kind: "empty",
        hero,
        motive: body == null
          ? "Fonte indisponível nesta rota — nenhuma build retornada."
          : "Sem builds catalogadas para este herói nesta rota.",
      };
    }
    return { kind: "ready", hero, builds };
  });

  // Fallback só é "não validado" depois que o mapa assentou (erro ou vazio);
  // durante o loading não acendemos aviso falso.
  const routeUnvalidated =
    validLane &&
    !selection.validated &&
    !lanesQuery.isLoading &&
    (lanesEmpty || lanesQuery.isError);

  return {
    laneKey,
    validLane,
    lanesLoading: lanesQuery.isLoading,
    lanesEmpty,
    lanesError: lanesQuery.isError,
    routeUnvalidated,
    listQuery,
    heroes,
    cards,
    total: TOP_N,
  };
}
