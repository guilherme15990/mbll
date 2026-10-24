import { keepPreviousData, useQuery } from "@tanstack/react-query";

export type Hero = {
  id: number; name: string; head: string | null;
  win: number; pick: number; ban: number;
  wrAdj: number; z: number; q: number;
  B?: number;
  tier: string;
  // R3 (critic-017): d/class/confidence/prior/strong/weak/se removidos do tipo —
  // zero leitores em web/src (sorts usam wrAdj; classOf() deriva). v3: sensitivity_band
  // removida da engine (grade c podada) — o tipo não a declara mais.
  strength_index?: number | null;
  isGem: boolean; degenerate: boolean; smallSample: boolean;
  uncertainty_status?: string; posterior_mean?: number | null;
  credible_interval_95?: [number, number] | null; posterior_prob_above_threshold?: number | null;
};

export type Pair = {
  id: number; name: string; head: string | null;
  delta: number | null; win: number | null; pick: number | null;
  pair_key?: string | null; relationship_type?: string;
  effect_raw?: number | null; effect_unit_status?: string; coverage_status?: string;
  evidence_quality?: string; evidence_reasons?: string[]; exposure_status?: string;
  curve: { label: string; mid: number; win: number }[];
  profile: "snowball" | "scaling" | "uniforme";
};

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

export type AggregateDeltaStatus = "positive" | "negative" | "no_practical_difference" | "insufficient";
export type PatternScope = "cross_hero" | "two_heroes" | "single_hero";
export type DiscoveryStatus = "consolidated" | "emerging" | "local" | "provisional";
export type WeightingSensitivity = "stable" | "large_shift" | "sign_flip" | "unknown";
export type AggregateSupport = {
  status: "ok" | "insufficient";
  k: number; m: number; h: number;
  min: { contexts: number; builds: number; mode: string };
  reason?: string | null;
};
export type AggregateItemShape = { id: number; name: string | null; icon: string | null; archetype?: string; archetype_label?: string };
export type AggregateDiscoveryMeta = {
  pattern_scope?: PatternScope;
  pattern_label?: string;
  discovery_status?: DiscoveryStatus;
  delta_wr_pp_median?: number | null;
  delta_wr_pp_unweighted_median?: number | null;
  delta_status?: AggregateDeltaStatus;
  weighting_sensitivity?: WeightingSensitivity;
};
export type AggregateItem = AggregateDiscoveryMeta & {
  kind?: "item" | "package";
  item_id?: number;
  package_id?: string;
  name: string | null;
  icon: string | null;
  type?: string | null;
  tips?: string | null;
  archetype: string;
  archetype_label: string;
  contexts: number;
  hero_coverage: number;
  adoption_builds: number | null;
  builds: number;
  delta_wr_pp_median: number | null;
  delta_wr_pp_unweighted_median: number | null;
  win_median: number | null;
  share_positive: number | null;
  delta_status: AggregateDeltaStatus;
  weighting_sensitivity: WeightingSensitivity;
  support: AggregateSupport;
  item_ids?: number[];
  package_size?: number;
  items?: AggregateItemShape[];
  inseparable?: boolean;
  inseparable_observed?: boolean;
  cooccurrence?: { p_both_min: number; n_both_min: number; support_min: { contexts: number; builds: number; mode: string } };
  total_builds?: number;
};
export type AggregateSet = AggregateDiscoveryMeta & {
  set_key: string;
  item_ids: number[];
  items: AggregateItemShape[];
  size: number;
  archetype: string;
  archetype_label: string;
  k_heroes: number;
  contexts: number;
  hero_coverage: number;
  m_builds: number;
  win_median: number | null;
  delta_wr_pp_median: number | null;
  delta_wr_pp_unweighted_median: number | null;
  share_positive: number | null;
  delta_status: AggregateDeltaStatus;
  weighting_sensitivity: WeightingSensitivity;
  support: AggregateSupport;
  label: string;
};
export type AggregateTalent = AggregateDiscoveryMeta & {
  id: number; name: string | null; tier: number | null; desc: string | null; icon: string | null;
  label: string; adoption: number | null; contexts: number; hero_coverage: number; builds: number;
  win_median: number | null;
  delta_wr_pp_median: number | null; delta_wr_pp_unweighted_median: number | null;
  delta_status: AggregateDeltaStatus; weighting_sensitivity: WeightingSensitivity; support: AggregateSupport;
};
export type AggregateSpell = AggregateDiscoveryMeta & {
  name: string | null; icon: string | null; desc: string | null;
  adoption: number | null; contexts: number; hero_coverage: number; builds: number;
  win_median: number | null;
  delta_wr_pp_median: number | null; delta_wr_pp_unweighted_median: number | null;
  delta_status: AggregateDeltaStatus; weighting_sensitivity: WeightingSensitivity; support: AggregateSupport;
};
export type AggregateEmblem = { id: number | null; name: string | null; icon: string | null; attrs: unknown; label: string };
export type AggregateEmblemStat = AggregateDiscoveryMeta & {
  emblem_id: number;
  name: string | null;
  icon: string | null;
  attrs: unknown;
  adoption_builds: number | null;
  contexts: number;
  hero_coverage: number;
  builds: number;
  win_median: number | null;
  delta_wr_pp_median: number | null;
  delta_wr_pp_unweighted_median: number | null;
  share_positive: number | null;
  delta_status: AggregateDeltaStatus;
  weighting_sensitivity: WeightingSensitivity;
  support: AggregateSupport;
};
export type AggregateRunePage = AggregateDiscoveryMeta & {
  rune_page_key: string;
  emblem: AggregateEmblem;
  talents: { id: number; name: string | null; tier: number | null; desc: string | null; icon: string | null }[];
  spell: { name: string; icon: string | null; desc?: string | null; short?: string | null } | null;
  adoption: number | null;
  contexts: number; hero_coverage: number; builds: number;
  win_median: number | null; delta_wr_pp_median: number | null; delta_wr_pp_unweighted_median: number | null;
  share_positive: number | null; delta_status: AggregateDeltaStatus; weighting_sensitivity: WeightingSensitivity;
  support: AggregateSupport;
};
export type AggregateValueSource = "observed" | "estimated" | "descriptive" | "none";
export type AggregateContrast = {
  contexts: number; paired_contexts: number; pairs: number;
  pooled_pp: number | null; shrink: number;
  mode: "paired" | "cohort" | null; status: AggregateDeltaStatus;
};
export type AggregateCombinerComponent = AggregateDiscoveryMeta & {
  contexts: number; builds: number; hero_coverage: number;
  adoption: number | null; win_median: number | null;
  delta_wr_pp_median: number | null; value_pp: number | null; shrinkage: number | null;
  value_pp_est: number | null; value_pp_source: AggregateValueSource;
  power: number | null; contrast: AggregateContrast;
  value_reason?: string | null;
  delta_status: AggregateDeltaStatus; weighting_sensitivity: WeightingSensitivity; support: AggregateSupport;
};
export type AggregateCombinerItem = AggregateCombinerComponent & {
  id: number; name: string | null; icon: string | null; archetype: string; archetype_label: string;
};
export type AggregateCombinerEmblem = AggregateCombinerComponent & {
  emblem_id: number; name: string | null; icon: string | null; attrs: unknown;
};
export type AggregateCombinerTalent = AggregateCombinerComponent & {
  id: number; name: string | null; tier: number | null; desc: string | null; icon: string | null; label: string;
};
export type AggregateCombinerSpell = AggregateCombinerComponent & {
  name: string | null; icon: string | null; desc: string | null;
};
export type AggregateCombinerHero = {
  id: number | null; name: string | null; head: string | null; tier: string | null;
  wrAdj: number | null; win: number | null; ref_win: number | null; hero_mean_win: number | null;
  builds: number;
};
export type AggregateCombiner = {
  scale: {
    base: number; points_per_pp: number; shrink_k: number;
    slots: { items: number; emblems: number; talents: number; spells: number };
    value_unit: string; index_rule: string;
    contrast?: {
      shrink_k: number;
      min: Record<string, { contexts: number; paired: number }>;
      evidence_rule: string;
    };
  };
  items: AggregateCombinerItem[];
  emblems: AggregateCombinerEmblem[];
  talents: AggregateCombinerTalent[];
  spells: AggregateCombinerSpell[];
  heroes: AggregateCombinerHero[];
};
export type AggregateVariant = {
  variant_key: string;
  order: number[];
  items_in_order: AggregateItemShape[];
  item_ids: number[];
  emblem: AggregateEmblem | null;
  talents: { id: number; name: string | null; tier: number | null; desc: string | null; icon: string | null }[];
  spell: { name: string; icon: string | null } | null;
  win: number | null; pick: number | null;
  variant_share: number | null;
  delta_wr_pp_vs_modal: number | null;
  delta_status: AggregateDeltaStatus;
  is_modal: boolean;
};
export type AggregateVariantGroup = AggregateDiscoveryMeta & {
  group_key: string;
  core_key: string;
  hero: { id: number | null; name: string | null; head: string | null; tier: string | null; wrAdj: number | null };
  core: { item_ids: number[]; items: AggregateItemShape[]; label: string };
  variants: AggregateVariant[];
  variant_count: number;
  order_only: boolean;
  total_pick: number | null;
  support: AggregateSupport;
};
export type AggregateTopBuild = {
  win: number | null; pick: number | null;
  delta_wr_pp_vs_most_used: number | null; delta_wr_pp_vs_mean: number | null;
  reference_win: number | null; reference_kind: string;
  references: { most_used_win: number | null; hero_mean_win: number | null };
  hero_strength: number | null;
  build_strength: number | null;
  emblem_strength: number | null;
  combination_strength: number | null;
  combination_strength_index: number | null;
  items: AggregateItemShape[];
  item_ids: number[];
  order: number[];
  emblem: AggregateEmblem | null;
  talents: { id: number; name: string | null; tier: number | null; desc: string | null; icon: string | null }[];
  spell: { name: string; icon: string | null } | null;
  core_key: string;
  variant_key: string;
};
export type AggregateTriple = AggregateDiscoveryMeta & {
  item_ids: number[];
  items: AggregateItemShape[];
  k_heroes: number;
  m_builds: number;
  win_min: number | null;
  win_max: number | null;
  delta_wr_pp_max: number | null;
  emergent: boolean;
  label: string;
  caveat: string;
  support?: AggregateSupport;
};
export type AggregateCell = {
  hero_id: number | null; hero_name: string | null;
  status: "ok" | "empty" | "error" | "stale";
  builds: number; reason: string | null; stale: boolean; age_ms: number | null;
};
export type BuildsAggregateResponse = {
  version: string;
  context: {
    rank: string; lane: string; window: number; top: number; population: string;
    generated_at: string; stale: boolean; age_ms: number; cache_hit?: boolean;
    window_applies_to: string; build_window: null; deadline_ms?: number; elapsed_ms?: number;
  };
  coverage: {
    heroes_in_lane: number | null; heroes_with_rank: number | null; heroes_requested: number;
    heroes_with_builds: number; builds: number; contexts: number;
    items_cataloged: number; items_unclassified: number;
    pick_sum: number | null; pick_sum_per_hero?: number | null; pick_sum_status: string;
    cells_error: number; cells_empty: number; partial: boolean;
    unit: string; exposure_status: string;
    weighting_sensitivity_counts?: Record<WeightingSensitivity, number>;
    positions_source?: string; positions_stale?: boolean; rank_source?: string; rank_stale?: boolean;
    catalog_errors?: { equipment: boolean; emblems: boolean; spells: boolean };
    builds_cached?: number; builds_fetched?: number; builds_error?: number; builds_empty?: number;
  };
  packages: AggregateItem[];
  packages_provisional: AggregateItem[];
  packages_total: number;
  packages_ok: number;
  packages_provisional_count: number;
  triples: AggregateTriple[];
  triples_total: number;
  items: AggregateItem[];
  items_total: number;
  items_insufficient: AggregateItem[];
  items_insufficient_count: number;
  sets: AggregateSet[];
  sets_total: number;
  sets_counts: Record<string, number>;
  sets_summary: {
    total: number; consolidated: number; emerging: number; local: number;
    by_scope: { cross_hero: number; two_heroes: number; single_hero: number };
  };
  discovery_summary: {
    triples: { total: number; consolidated: number; emerging: number; local: number; provisional: number };
    packages: { total: number; consolidated: number; emerging: number; local: number; provisional: number; supported: number };
    sets: BuildsAggregateResponse["sets_summary"];
  };
  emblems: AggregateEmblemStat[];
  emblems_insufficient: {
    emblem_id: number;
    name: string | null;
    icon: string | null;
    contexts: number;
    builds: number;
    support: AggregateSupport;
  }[];
  emblems_total: number;
  rune_pages: AggregateRunePage[];
  rune_pages_insufficient: number;
  talents: AggregateTalent[];
  spells: AggregateSpell[];
  combiner: AggregateCombiner;
  variants: AggregateVariantGroup[];
  variant_summary: { cores: number; cores_with_variants: number; order_only_cores: number };
  top_builds: {
    hero: { id: number | null; name: string | null; head: string | null; tier: string | null; wrAdj: number | null; win: number | null; pick: number | null; ban: number | null };
    cell_status: string; error: string | null; stale: boolean; age_ms: number | null;
    builds: AggregateTopBuild[];
  }[];
  cells: AggregateCell[];
  sources: Record<string, unknown>;
  metrics: {
    difference_unit: "percentage_points";
    difference_field: "delta_wr_pp";
    practical_delta_pp: number;
    lift_semantics: string;
    pick_weighting: string;
    support: Record<string, { contexts: number; builds: number; mode: string }>;
    pattern_scope: Record<PatternScope, string>;
    discovery_status: Record<DiscoveryStatus, string>;
    http_partial: string;
  };
  honesty: string[];
  note: string;
  partial: boolean;
  stale?: boolean;
};

export type TrendPoint = { date: string; win: number; pick: number; ban: number };

export type CatalogEntry = { name: string; head: string | null; smallmap?: string | null };

export const LANES = ["exp", "mid", "roam", "jungle", "gold"] as const;
export const RANKS = ["all", "epic", "legend", "mythic", "honor", "glory"];

export type Lane = (typeof LANES)[number];
export type LaneFilter = "todas" | Lane;

/** Tamanho de página da lista (espelha o `size` do request). */
export const PAGE_SIZE = 50;

export type GridSort = "theta" | "pick" | "ban" | "win" | "nome";

/**
 * Mapeamento honesto grade → sorts reais do backend (`routes.js` qHeroes:
 * sort=d|win|pick|ban|q). `sort=win` ordena por wrAdj (θ̂); `sort=pick` por
 * pick; `sort=ban` por qBan (posto monotônico do ban — mesma ordem do ban
 * bruto). `win` observado e `nome` NÃO têm sort no servidor (string vazia =
 * ordenação local, só na página atual).
 */
export const GRID_SERVER_SORT: Record<GridSort, string> = {
  theta: "sort=win&order=desc",
  pick: "sort=pick&order=desc",
  ban: "sort=ban&order=desc",
  win: "",
  nome: "",
};

export const isServerSort = (s: GridSort): boolean => GRID_SERVER_SORT[s] !== "";

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export type HeroesResponse = {
  data: Hero[]; total: number; stale?: boolean; collectedAgoMs?: number;
  postPatch?: boolean; truncated?: boolean; totalFonte?: number;
  pickSumCheck?: { sum: number; ok: boolean };
  // ADR-023 walk-forward: "walk-forward v{H}" | "flat" (só leitura).
  prior?: string;
  // ADR-024: base do índice ({method, n do lote}).
  index_basis?: { method: string; n: number };
  // Meta do lote (era repetida por herói): μ, τ + carimbos.
  meta?: LotMeta;
};

/**
 * Lista paginada no SERVIDOR (`size`/`index` no request; `total` na resposta).
 * `extra` carrega sorts reais do backend (ex. `sort=win&order=desc`); `index`
 * entra na query key. `placeholderData: keepPreviousData` troca de página sem
 * piscar. 1 request de lista por página — trends seguem lazy por card.
 */
export const useHeroes = (rank: string, window: string, extra = "", index = 1, size = PAGE_SIZE, enabled = true) =>
  useQuery({
    queryKey: ["heroes", rank, window, extra, index, size],
    placeholderData: keepPreviousData,
    enabled,
    queryFn: () => getJSON<HeroesResponse>(`/v1/heroes?rank=${rank}&window=${window}&size=${size}&index=${index}&${extra}`),
  });

export type LotMeta = {
  mu: number; tau: number; c_reference: number; c_grade: string | null;
  n?: number; n_dropped?: number; c?: number;
  fdr_alpha?: number; gem_quantile?: number; small_sample?: boolean;
  prior?: string; version_break?: boolean;
  strength_index_version?: string; tier_version?: string;
  counts?: { strong: number; weak: number; gem: number; degenerate: number };
};

export const useHero = (id: string | null | undefined, rank: string, window: string) =>
  useQuery({
    queryKey: ["hero", id, rank, window],
    enabled: !!id,
    queryFn: () => getJSON<{ data: Hero; meta?: LotMeta }>(`/v1/heroes/${id}?rank=${rank}&window=${window}`),
  });

export const useCatalog = () =>
  useQuery({
    queryKey: ["catalog"],
    staleTime: 24 * 3600e3,
    queryFn: () => getJSON<{ data: Record<string, CatalogEntry> }>("/v1/catalog"),
  });

export type HeroLanesResponse = {
  data: Record<string, string[]>;
  total: number;
  stale?: boolean;
  ageMs?: number;
  fallback?: boolean;
  note?: string;
};

/**
 * Mapa heroId -> lanes[] (`GET /heroes/lanes?rank=`, cache C 24h).
 * 1 request extra por elo, `staleTime` 24h (sem tempestade). Chamar com
 * `enabled = filtro ativo` p/ não buscar quando o filtro está em "todas".
 * Mapa vazio = fonte indisponível (a lista segue sem filtro).
 */
export const useHeroLanes = (rank: string, enabled = true) =>
  useQuery({
    queryKey: ["hero-lanes", rank],
    enabled,
    staleTime: 24 * 3600e3,
    queryFn: () => getJSON<HeroLanesResponse>(`/v1/heroes/lanes?rank=${rank}`),
  });

export const useMatchups = (id: string | null | undefined, rank: string, days: string) =>
  useQuery({
    queryKey: ["matchups", id, rank, days],
    enabled: !!id,
    queryFn: () => getJSON<{ id: number; rank: string; days: number; hero: { name: string; head: string | null }; countersUp: Pair[]; countersDown: Pair[]; synergiesUp: Pair[]; synergiesDown: Pair[]; semanticsNote: string }>(`/v1/heroes/${id}/matchups?rank=${rank}&days=${days}`),
  });

export const useBuilds = (id: string | null | undefined, rank: string, lane: string) =>
  useQuery({
    queryKey: ["builds", id, rank, lane],
    enabled: !!id && (LANES as readonly string[]).includes(lane),
    queryFn: () => getJSON<{ data: Build[]; lane: string; audit_status?: string; references?: { mostUsed: { win: number } | null; heroMean: number | null } }>(`/v1/heroes/${id}/builds?rank=${rank}&lane=${lane}`),
  });

/**
 * Agregado de sistema (B0–B5): 1 lane por carga, top-10/20, population=ranked.
 * `retry: false` é deliberado: cada tentativa é um fan-out de até 27 requests.
 * Quente = 0 requests (cache derivado C 24 h no servidor).
 */
export const useBuildsAggregate = (rank: string, lane: string, window: string, top: number) =>
  useQuery({
    queryKey: ["builds-aggregate", rank, lane, window, top],
    enabled: (LANES as readonly string[]).includes(lane),
    staleTime: 5 * 60e3,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => getJSON<BuildsAggregateResponse>(`/v1/builds/aggregate?rank=${rank}&lane=${lane}&window=${window}&top=${top}&population=ranked`),
  });

export const useTrends = (id: string | null | undefined, rank: string, days = "30") =>
  useQuery({
    queryKey: ["trends", id, rank, days],
    enabled: !!id,
    queryFn: () => getJSON<{ data: TrendPoint[] }>(`/v1/heroes/${id}/trends?rank=${rank}&days=${days}`),
  });

export const useViews = (view: string, rank: string, window: string) =>
  useQuery({
    queryKey: ["views", view, rank, window],
    queryFn: () => getJSON<any>(`/v1/views/${view}?rank=${rank}&window=${window}`),
  });

export const useGems = (rank: string, window: string) =>
  useQuery({
    queryKey: ["gems", rank, window],
    queryFn: () => getJSON<{ data: (Hero & { reason: string })[] }>(`/v1/gems?rank=${rank}&window=${window}`),
  });

export const useMeta = () =>
  useQuery({ queryKey: ["meta"], queryFn: () => getJSON<any>("/v1/meta/status") });

export const useModules = () =>
  useQuery({ queryKey: ["modules"], queryFn: () => getJSON<{ data: any[]; c_reference: number; c_grade: string; impossibilities: string[] }>("/v1/modules"), staleTime: 3600e3 });

export const useConfidence = (id: string | null | undefined, rank: string, window: string) =>
  useQuery({
    queryKey: ["confidence", id, rank, window],
    enabled: !!id,
    queryFn: () => getJSON<any>(`/v1/heroes/${id}/confidence?rank=${rank}&window=${window}`),
  });

export const useRankDiff = (id: string | null | undefined, a: string, b: string, window: string) =>
  useQuery({
    queryKey: ["rankdiff", id, a, b, window],
    enabled: !!id && a !== b,
    queryFn: () => getJSON<any>(`/v1/heroes/${id}/rank-diff?a=${a}&b=${b}&window=${window}`),
  });

export const useTemporal = (id: string | null | undefined, rank: string, window: string) =>
  useQuery({
    queryKey: ["temporal", id, rank, window],
    enabled: !!id,
    queryFn: () => getJSON<any>(`/v1/heroes/${id}/temporal?rank=${rank}&window=${window}&base=30`),
  });

export const useDistortion = (id: string | null | undefined, rank: string, window: string) =>
  useQuery({
    queryKey: ["distortion", id, rank, window],
    enabled: !!id,
    queryFn: () => getJSON<any>(`/v1/heroes/${id}/distortion?rank=${rank}&window=${window}`),
  });

export const useBlind = (id: string | null | undefined, rank: string, days: string) =>
  useQuery({
    queryKey: ["blind", id, rank, days],
    enabled: !!id && rank !== "all",
    queryFn: () => getJSON<any>(`/v1/heroes/${id}/blind?rank=${rank}&days=${days}`),
  });

// formatação defensiva: nunca quebra com undefined/NaN
export const pct = (v: unknown, d = 1) => (typeof v === "number" && Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : "—");
export const num = (v: unknown, d = 2) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—");
export const dir = (z: unknown) => (typeof z !== "number" || !Number.isFinite(z) ? "■" : z > 0.5 ? "▲" : z < -0.5 ? "▼" : "■");
export const dirWord = (z: unknown) => (typeof z !== "number" || !Number.isFinite(z) ? "estável" : z > 0.5 ? "sobe" : z < -0.5 ? "cai" : "estável");
export function ago(ms?: number) {
  if (ms == null) return "agora";
  const h = ms / 3600e3;
  if (h < 1) return `há ${Math.max(1, Math.round(ms / 60e3))} min`;
  return `há ${h.toFixed(h < 10 ? 1 : 0)} h`;
}
export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");
