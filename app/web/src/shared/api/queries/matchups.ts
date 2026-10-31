/**
 * Domínio: confrontos (counters/sinergias por herói).
 *
 * `matchupsQuery` é a definição única da busca. `useMatchups` (1 herói) e o
 * fan-out da tela de draft (`useQueries`) compartilham a MESMA query key, então
 * cache, deduplicação e retry são os mesmos — sem endpoint novo (ADR-052 D4).
 */
import { useQuery } from "@tanstack/react-query";
import { getJSON } from "../http";

export type Pair = {
  id: number; name: string; head: string | null;
  delta: number | null; win: number | null; pick: number | null;
  pair_key?: string | null; relationship_type?: string;
  effect_raw?: number | null; effect_unit_status?: string; coverage_status?: string;
  evidence_quality?: string; evidence_reasons?: string[];
  curve: { label: string; mid: number; win: number }[];
  profile: "snowball" | "scaling" | "uniforme";
};

export type MatchupsResponse = {
  id: number;
  rank: string;
  days: number;
  hero: { name: string; head: string | null };
  countersUp: Pair[];
  countersDown: Pair[];
  synergiesUp: Pair[];
  synergiesDown: Pair[];
  semanticsNote: string;
};

export type MatchupQueryOptions = { staleTime?: number; retry?: number };

/** Definição única da busca de confrontos (usada por hook e fan-out). */
export const matchupsQuery = (
  id: string | null | undefined,
  rank: string,
  days: string,
  opts: MatchupQueryOptions = {},
) => ({
  queryKey: ["matchups", id, rank, days] as const,
  enabled: !!id,
  ...(opts.staleTime != null ? { staleTime: opts.staleTime } : {}),
  ...(opts.retry != null ? { retry: opts.retry } : {}),
  queryFn: () =>
    getJSON<MatchupsResponse>(
      `/v1/heroes/${id}/matchups?rank=${rank}&days=${days}`,
    ),
});

export const useMatchups = (
  id: string | null | undefined,
  rank: string,
  days: string,
  // Opcionais: chamadas em grade (1 por card) usam staleTime longo e sem retry.
  opts: MatchupQueryOptions = {},
) => useQuery(matchupsQuery(id, rank, days, opts));
