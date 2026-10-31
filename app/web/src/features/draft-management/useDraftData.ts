import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  matchupsQuery,
  useCatalog,
  useHeroLanes,
  useHeroes,
  type CatalogEntry,
  type Hero,
  type LotMeta,
  type MatchupsResponse,
} from "../../shared/api";
import {
  laneCandidates,
  type DraftHero,
  type DraftLane,
  type HeroPool,
  type MatchupBooks,
  type PairObs,
} from "./model";

/**
 * Dados da tela de draft (ADR-052 D4 + ADR-053 D8).
 *
 * - `/heroes` (lote do recorte) → θ̂, pick, ban, B, IC.
 * - `/catalog` → nome/avatar de todo herói, mesmo sem dado no recorte.
 * - `/heroes/lanes` → rota por herói.
 * - `/heroes/:id/matchups` → pares, via `useQueries` sobre a MESMA query key
 *   do hook oficial: os heróis do draft (≤10) + os candidatos da lane (≤8).
 *   Teto de 18 requests, nunca o pool inteiro.
 *
 * Nenhum endpoint novo: o fan-out é limitado pelo draft e pela lane alvo.
 */
export type DraftData = {
  pool: HeroPool;
  books: MatchupBooks;
  baseline: number | null;
  meta: LotMeta | undefined;
  loading: boolean;
  error: boolean;
  bookErrors: number;
  /** Heróis com livro pedido nesta renderização (draft + candidatos). */
  bookCount: number;
  stale: boolean;
  truncated: boolean;
  refetch: () => void;
};

const EMPTY_POOL: HeroPool = {};
const EMPTY_BOOKS: MatchupBooks = {};

/** Candidatos buscados por lane. Teto declarado na ADR-053 D8. */
export const CANDIDATE_BOOK_LIMIT = 8;
/** Teto absoluto do fan-out: 10 escolhidos + 8 candidatos. */
export const BOOK_LIMIT = 18;

function toHero(hero: Hero | undefined, id: number, name: string | null, head: string | null, lanes: string[]): DraftHero {
  return {
    id,
    name: hero?.name ?? name ?? `Herói #${id}`,
    head: hero?.head ?? head ?? null,
    wrAdj: hero?.wrAdj ?? null,
    pick: hero?.pick ?? null,
    ban: hero?.ban ?? null,
    B: hero?.B ?? null,
    tier: hero?.tier ?? null,
    credible: hero?.credible_interval_95 ?? null,
    smallSample: Boolean(hero?.smallSample),
    lanes,
  };
}

/**
 * Pool do recorte (`/catalog` + `/heroes` + `/heroes/lanes`): nome/avatar de
 * todo herói, θ̂/pick/ban quando há dado e a rota conhecida. Herói sem dado
 * entra com os campos em `null` (ausência, nunca zero). Puro e reusável.
 */
export function buildHeroPool(
  heroes: Hero[] | undefined,
  catalog: Record<string, CatalogEntry> | undefined,
  lanes: Record<string, string[]> | undefined,
): HeroPool {
  if (!heroes && !catalog) return EMPTY_POOL;
  const byId = new Map<number, Hero>((heroes ?? []).map((hero) => [hero.id, hero]));
  const out: HeroPool = {};

  for (const [rawId, entry] of Object.entries(catalog ?? {})) {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) continue;
    out[id] = toHero(byId.get(id), id, entry.name ?? null, entry.head ?? null, lanes?.[rawId] ?? []);
  }
  for (const hero of heroes ?? []) {
    if (out[hero.id]) continue;
    out[hero.id] = toHero(hero, hero.id, hero.name, hero.head, lanes?.[String(hero.id)] ?? []);
  }
  return out;
}

function pairs(list: MatchupsResponse["countersUp"] | undefined): PairObs[] {
  return (list ?? []).map((pair) => ({
    id: pair.id,
    delta: pair.delta,
    profile: pair.profile ?? null,
    curve: pair.curve ?? [],
    pairKey: pair.pair_key ?? null,
  }));
}

export function useDraftData(rank: string, window: string, ids: number[], lane: DraftLane): DraftData {
  const enabled = rank !== "all";
  const heroesQ = useHeroes(rank, window, "", 1, 133, enabled);
  const catalogQ = useCatalog();
  const lanesQ = useHeroLanes(rank, enabled);

  const heroes = heroesQ.data?.data;
  const catalog = catalogQ.data?.data;
  const lanes = lanesQ.data?.data;

  const pool = useMemo<HeroPool>(
    () => buildHeroPool(heroes, catalog, lanes),
    [heroes, catalog, lanes],
  );

  // Draft + candidatos da lane: o livro dos candidatos é o que permite pontuar
  // arquétipo e contrapeso (ADR-053 D4/D5).
  const bookIds = useMemo<number[]>(() => {
    const picked = ids.filter((id) => Number.isInteger(id) && id > 0);
    const candidates = laneCandidates(pool, lane, picked, CANDIDATE_BOOK_LIMIT).map((hero) => hero.id);
    return [...new Set([...picked, ...candidates])].slice(0, BOOK_LIMIT);
  }, [ids, lane, pool]);

  const matchupQueries = useQueries({
    queries: (enabled ? bookIds : []).map((id) =>
      matchupsQuery(String(id), rank, window, { staleTime: 10 * 60_000, retry: 1 }),
    ),
  });

  const bookStamp = matchupQueries.map((query) => `${query.dataUpdatedAt ?? 0}:${query.status}`).join("|");
  const books = useMemo<MatchupBooks>(() => {
    if (!bookStamp) return EMPTY_BOOKS;
    const out: MatchupBooks = {};
    for (const query of matchupQueries) {
      const data = query.data as MatchupsResponse | undefined;
      if (!data) continue;
      out[data.id] = {
        id: data.id,
        countersUp: pairs(data.countersUp),
        countersDown: pairs(data.countersDown),
        synergiesUp: pairs(data.synergiesUp),
        synergiesDown: pairs(data.synergiesDown),
      };
    }
    return out;
    // bookStamp muda sempre que qualquer request de par muda de estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookStamp]);

  const refetch = () => {
    void heroesQ.refetch();
    void lanesQ.refetch();
    for (const query of matchupQueries) void query.refetch();
  };

  return {
    pool,
    books,
    baseline: heroesQ.data?.meta?.mu ?? null,
    meta: heroesQ.data?.meta,
    loading: enabled && (heroesQ.isLoading || catalogQ.isLoading || lanesQ.isLoading),
    error: heroesQ.isError || catalogQ.isError,
    bookErrors: matchupQueries.filter((query) => query.isError).length,
    bookCount: bookIds.length,
    stale: Boolean(heroesQ.data?.stale || lanesQ.data?.stale),
    truncated: Boolean(heroesQ.data?.truncated),
    refetch,
  };
}
