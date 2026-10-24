/**
 * Domínio: confrontos (counters/sinergias por herói).
 */
import { useQuery } from "@tanstack/react-query";
import { getJSON } from "../http";

export type Pair = {
  id: number; name: string; head: string | null;
  delta: number | null; win: number | null; pick: number | null;
  pair_key?: string | null; relationship_type?: string;
  effect_raw?: number | null; effect_unit_status?: string; coverage_status?: string;
  evidence_quality?: string; evidence_reasons?: string[]; exposure_status?: string;
  curve: { label: string; mid: number; win: number }[];
  profile: "snowball" | "scaling" | "uniforme";
};

export const useMatchups = (id: string | null | undefined, rank: string, days: string) =>
  useQuery({
    queryKey: ["matchups", id, rank, days],
    enabled: !!id,
    queryFn: () => getJSON<{ id: number; rank: string; days: number; hero: { name: string; head: string | null }; countersUp: Pair[]; countersDown: Pair[]; synergiesUp: Pair[]; synergiesDown: Pair[]; semanticsNote: string }>(`/v1/heroes/${id}/matchups?rank=${rank}&days=${days}`),
  });
