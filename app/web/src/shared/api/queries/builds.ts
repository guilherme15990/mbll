/**
 * Domínio: builds e o agregado de sistema (B0–B5).
 *
 * O agregado é o maior contrato do produto: dezenas de campos derivados do
 * fan-out por lane. Ele mora sozinho aqui justamente para não arrastar 300
 * linhas de tipo para dentro do módulo de heróis ou de insights.
 */
import { useQuery } from "@tanstack/react-query";
import { getJSON } from "../http";
import { LANES } from "./filters";

export type BuildTalent = {
  id: number;
  name: string | null;
  tier: number | null;
  desc?: string | null;
  icon: string | null;
};

export type Build = {
  win: number | null; pick: number | null;
  lift_raw?: number | null; lift_vs_most_used?: number | null; lift_vs_mean?: number | null;
  lift_adjusted?: null; adjusted_association?: null; causal_build_lift?: null;
  reference_win?: number | null; reference_kind?: string; references?: { most_used_win: number | null; hero_mean_win: number | null };
  exposure_status?: string; classification_status?: string;
  spell: { name: string | null; icon: string | null } | null;
  emblem: { id?: number | null; name: string | null; icon: string | null } | null;
  talents?: BuildTalent[];
  items: { id?: number; name: string | null; icon: string | null }[];
};

// ── contrato do agregado (fonte única: @radar/contracts) ──────────────────
//
// Os DTOs do agregado moravam aqui, escritos à mão, e o mesmo contrato era
// montado em JS na API. Agora a fonte é `@radar/contracts`: a API anota a saída
// de `buildAggregate` e a web importa estes nomes. O barrel continua exportando
// tudo, então nenhum call site mudou.

export type {
  AggregateCell,
  AggregateCombiner,
  AggregateCombinerComponent,
  AggregateCombinerEmblem,
  AggregateCombinerHero,
  AggregateCombinerItem,
  AggregateCombinerSpell,
  AggregateCombinerTalent,
  AggregateContrast,
  AggregateDeltaStatus,
  AggregateDiscoveryMeta,
  AggregateEmblem,
  AggregateEmblemStat,
  AggregateItem,
  AggregateItemShape,
  AggregateRunePage,
  AggregateSet,
  AggregateSpell,
  AggregateSupport,
  AggregateTalent,
  AggregateTopBuild,
  AggregateTriple,
  AggregateValueSource,
  AggregateVariant,
  AggregateVariantGroup,
  BuildsAggregateResponse,
  DiscoveryStatus,
  PatternScope,
  WeightingSensitivity,
} from "@radar/contracts";

import type { BuildsAggregateResponse } from "@radar/contracts";

// ── hooks ───────────────────────────────────────────────────────────────────

/** Resposta de `/v1/heroes/:id/builds` — o eco de `id/rank/lane` valida cache. */
export type HeroBuildsResponse = {
  id: number;
  rank: string;
  lane: string;
  data: Build[];
  audit_status?: string;
  references?: { mostUsed: { win: number } | null; heroMean: number | null };
};

export const useBuilds = (id: string | null | undefined, rank: string, lane: string) =>
  useQuery({
    queryKey: ["builds", id, rank, lane],
    enabled: !!id && (LANES as readonly string[]).includes(lane),
    queryFn: () => getJSON<HeroBuildsResponse>(`/v1/heroes/${id}/builds?rank=${rank}&lane=${lane}`),
  });

/**
 * Agregado de sistema (B0–B5): 1 lane por carga, profundidade `10`/`20` ou
 * `"all"` (todos os heróis com dados na lane), population=ranked.
 * `retry: false` é deliberado: cada tentativa é um fan-out de até 27 requests
 * (ou ~1 por herói com dados, em `all`). Quente = 0 requests (cache C 24 h).
 */
export const useBuildsAggregate = (rank: string, lane: string, window: string, top: number | "all") =>
  useQuery({
    queryKey: ["builds-aggregate", rank, lane, window, top],
    enabled: (LANES as readonly string[]).includes(lane),
    staleTime: 5 * 60e3,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => getJSON<BuildsAggregateResponse>(`/v1/builds/aggregate?rank=${rank}&lane=${lane}&window=${window}&top=${top}&population=ranked`),
  });
