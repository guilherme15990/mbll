// Tipagens da fronteira @radar/proprietary-engine consumidas por web E api.
// Os módulos são JS puro; este arquivo dá as assinaturas para `tsc --noEmit`
// (web), `tsc -p app/api/jsconfig.json` (checkJs) e `vite build`.
// Campos opcionais: os apps passam objetos ricos da API que satisfazem
// estruturalmente estes mínimos.
//
// Cobertura: todo nome importado de `@radar/proprietary-engine` pelos apps tem
// declaração aqui — `npm run check:boundaries` falha se faltar. Classes e
// helpers internos que nenhum app consome permanecem sem declaração de propósito
// (o runtime é a verdade; declarar assinatura não usada só cria drift).

// ---- itemsets ----
export declare const ITEMSET_SCORE_VERSION: "itemset-score-v1";
export declare const ITEMSET_M_MIN: number;
export declare const ITEMSET_CUT_K: number;
export declare const ITEMSET_CUT_M: number;
export declare const ITEMSET_MAX_ROWS: number;
export type ItemsetStatus = "ok" | "sem_suporte" | "sem_referencia" | "contexto_misto";
export interface ItemsetBuildItem { id?: number | null; name?: string | null; icon?: string | null; }
export interface ItemsetBuild {
  win?: number | null; pick?: number | null;
  items?: (ItemsetBuildItem | null)[] | null;
  [k: string]: unknown;
}
export interface HeroItemsetContext {
  readonly heroId: number; readonly heroName: string;
  readonly builds: readonly ItemsetBuild[];
  readonly refMostWin: number | null; readonly refMeanWin: number | null;
  readonly rank: string; readonly lane: string;
}
export interface ItemsetAtomic {
  readonly key: string; readonly formula: typeof ITEMSET_SCORE_VERSION;
  readonly itemIds: readonly number[]; readonly itemNames: readonly (string | null)[];
  readonly heroId: number; readonly rank: string; readonly lane: string;
  readonly status: ItemsetStatus; readonly motive: string;
  readonly winDesc: number | null; readonly pickMed: number | null;
  readonly liftMost: number | null; readonly liftMean: number | null;
  readonly refMostWin: number | null; readonly refMeanWin: number | null;
  readonly nBuilds: number; readonly deBuilds: number;
  readonly ajustado: null; readonly causal: null;
}
export interface RouteItemset {
  readonly itemIds: readonly number[]; readonly itemNames: readonly (string | null)[];
  readonly k: number; readonly m: number;
  readonly winMin: number | null; readonly winMax: number | null;
  readonly maxLiftMost: number | null;
  readonly perHero: readonly ItemsetAtomic[]; readonly emergent: boolean;
}
export declare function itemIdsOf(b: ItemsetBuild): number[];
export declare function scoreAtomicItemset(u: readonly number[], ctx: HeroItemsetContext): ItemsetAtomic;
export declare function scoreRouteItemsets(ctxs: readonly HeroItemsetContext[]): RouteItemset[];

// ---- build-tags ----
export type BuildTagKey = "popular" | "emergente" | "situacional" | "abaixo-da-ref";
export type BuildTagTone = "popular" | "edge" | "situ" | "down";
export interface BuildTag { key: BuildTagKey; label: string; tone: BuildTagTone; title: string }
export interface BuildTagsInput { pick: number | null; lift_vs_most_used?: number | null }
export declare function getBuildTags(b: BuildTagsInput): BuildTag[];

// ---- thresholds ----
export declare const THRESHOLDS_VERSION: "thresholds-v1";
export declare const PRACTICAL_DELTA: number;
export declare const MIN_LIFT_SIGNAL: number;
export declare const POPULAR_PICK_MIN: number;
export declare const RARE_PICK_MAX: number;
export declare const MIN_SUPPORT_N: number;
export declare const SEVERE_COUNTER_DELTA: number;

// ---- counter ----
export declare const COUNTER_VERDICT_VERSION: "counter-verdict-v1";
export declare const COUNTER_MIN_ABS_DELTA: number;
export declare const COUNTER_MIN_PAIRS: number;
export type CounterVerdict = "confirmado" | "contestado" | "so-observado" | "desconhecido";
export interface CounterRelationInput {
  expected?: -1 | 1 | 0 | null; delta?: number | null;
  nPairs?: number; coverage?: "extremes" | "full" | "unknown"; minAbs?: number;
}
export interface CounterRelationResult { verdict: CounterVerdict; reasons: string[] }
export declare function compareCounterRelation(i: CounterRelationInput): CounterRelationResult;

// ---- relations-agreement ----
export declare const RELATIONS_AGREEMENT_VERSION: "relations-agreement-v1";
export interface RelationsBuckets {
  weak?: { target_hero_id?: readonly (number | string)[] } | null;
  strong?: { target_hero_id?: readonly (number | string)[] } | null;
  assist?: { target_hero_id?: readonly (number | string)[] } | null;
}
export interface AgreementPairInput {
  targetId: number | string; delta?: number | null;
  nPairs?: number; coverage?: "extremes" | "full" | "unknown";
}
export interface AgreementPairResult {
  expected: -1 | 1 | null; verdict: CounterVerdict; reasons: string[];
  minAbs: number; minPairs: number; version: typeof RELATIONS_AGREEMENT_VERSION;
}
export declare function expectedForTarget(
  relations: RelationsBuckets | null | undefined, targetId: number | string,
): { expected: -1 | 1 | null; reasons: string[] };
export declare function agreementForPair(
  relations: RelationsBuckets | null | undefined, opts?: AgreementPairInput,
): AgreementPairResult;

// ---- lane-timing ----
export declare const LANE_TIMING_VERSION: "lane-timing-v1";
export declare const LANE_TIMING_MIN_WINDOWS: number;
export declare const LANE_TIMING_DELTA: number;
export type LaneTimingVerdict = "subindo" | "caindo" | "estavel" | "ruptura" | "sem-dado";
export interface TimingWindow { time_min: number; time_max: number; win_rate: number }
export interface TimingSegment extends TimingWindow { move: "ref" | "sobe" | "desce" | "estavel" }
export interface LaneTimingCurve {
  verdict: LaneTimingVerdict; lane: string | null; n: number;
  peak: TimingWindow | null; segments: TimingSegment[];
  slopePerWindow: number | null; reasons: string[];
  version: typeof LANE_TIMING_VERSION;
}
export declare function laneTimingCurve(
  windows: readonly TimingWindow[] | null | undefined, lane?: string | null,
): LaneTimingCurve;

// ---- personal-calibration ----
export declare const PERSONAL_CALIBRATION_VERSION: "personal-calibration-v1";
export declare const PERSONAL_MIN_N: number;
export declare const PERSONAL_Z: number;
export type CalibrationVerdict =
  | "acima-do-global" | "na-faixa" | "abaixo-do-global"
  | "incerteza-dominante" | "sem-dado";
export interface CalibrationResult {
  verdict: CalibrationVerdict; diff: number | null; band: number | null;
  n: number | null; win: number | null; theta: number | null;
  reasons: string[]; version: typeof PERSONAL_CALIBRATION_VERSION;
}
export declare function calibrateOwnVsGlobal(i?: {
  own?: { win?: number | null; n?: number | null };
  global?: { theta?: number | null; se?: number | null };
}): CalibrationResult;
export interface FrequentEntry {
  hid?: number | string | null; hero_id?: number | string | null;
  tc?: number | null; n?: number | null; wc?: number | null;
  role?: string | null; [k: string]: unknown;
}
export interface RolePool { role: string; heroes: number; matches: number; share: number | null }
export interface PoolProfile {
  nHeroes: number; totalMatches: number; totalWins: number; winRate: number | null;
  perRole: RolePool[]; mainRole: string | null; topShare: number | null;
  version: typeof PERSONAL_CALIBRATION_VERSION;
}
export declare function poolProfile(
  frequent: readonly FrequentEntry[] | null | undefined,
  roleOf?: ((hid: number) => string | null | undefined) | Record<number | string, string> | null,
): PoolProfile | null;

// ---- meta-trend ----
export declare const META_TREND_VERSION: "meta-trend-v1";
export declare const META_TREND_MIN_POINTS: number;
export type MetaTrendVerdict = "subindo" | "caindo" | "estavel" | "ruptura" | "sem-dado";
export declare function detectMetaTrend(
  points: readonly { date?: string; win?: number | null; pick?: number | null; ban?: number | null }[] | null | undefined,
  metric?: "win" | "pick" | "ban",
): {
  verdict: MetaTrendVerdict; slopePerDay: number | null; r2: number | null;
  corr: number | null; changeDate: string | null;
  forecastNext: { value: number; lo: number; hi: number } | null;
  reasons: string[]; version: typeof META_TREND_VERSION;
};

// ---- playstyle ----
export declare const PLAYSTYLE_VERSION: "playstyle-v1";
export declare const PLAYSTYLE_MIN_MATCHES: number;

// ---- trust (v3: sem tiers de B, sem Robusto, sem teto) ----
export declare function classOf(h: { smallSample?: boolean; strong?: boolean; weak?: boolean; isGem?: boolean } | null | undefined): string | null;
export interface TrustInput {
  B?: number | null; smallSample?: boolean; degenerate?: boolean;
  confidence?: string | null; class?: string | null;
  uncertainty_status?: string | null;
  [k: string]: unknown;
}
export declare function verdictShort(h: TrustInput | undefined): string;

// ---- hero-trend ----
export declare const TREND_N: number;
export declare const TREND_DELTA: number;
export declare const TREND_VERSION: string;
export declare const TREND_DELTA_WIN: number;
export declare const TREND_DELTA_PICK: number;
export declare const TREND_DELTA_BAN: number;
export type TrendDir = "subindo" | "estável" | "caindo" | "sem-dado";
export declare function trendOf(
  points: readonly { win?: number | null }[], n?: number,
): { dir: TrendDir; delta: number | null; n: number };
export type DatedDirection = "rising" | "stable" | "falling" | "insufficient_data";
export interface DatedTrendSeries {
  direction: DatedDirection; delta_pp_window: number | null; slope_pp_per_day: number | null;
  n_points: number; window_days: number; robustness: string; coverage_quality: string;
  statistical_evidence: null; duplicate_dates_dropped: number; version: string;
}
export interface DatedTrendRadar {
  win_rate: DatedTrendSeries; pick_rate: DatedTrendSeries; ban_rate: DatedTrendSeries;
  version: string;
}
export declare function trendSeriesDated(
  points: readonly { date?: string; value?: number | null; win?: number | null }[],
  opts?: { valueKey?: string; deltaThreshold?: number },
): DatedTrendSeries;
export declare function trendOfDated(
  points: readonly { date?: string; win?: number | null; win_rate?: number | null; pick?: number | null; app_rate?: number | null; ban?: number | null; ban_rate?: number | null }[],
  opts?: { deltaWin?: number; deltaPick?: number; deltaBan?: number; deltaThreshold?: number },
): DatedTrendRadar;

// ---- hero-profile ----
export interface DominantProfile { top: string; n: number; total: number }
export declare function dominantProfileOf(profiles: readonly string[]): DominantProfile | null;

// ---- rank-profile ----
export declare const RANK_ORDER: readonly string[];
export interface RankDiffInput {
  diff: number | null; delta_r?: number; prob_above?: number;
  classification_status?: string; [k: string]: unknown;
}
export interface RankProfile { label: string; motive: string; color: string }
export declare function getRankProfileLabel(d: RankDiffInput, a: string, b: string): RankProfile;

// ---- blind-safety ----
export interface BlindViewInput {
  classification_status?: string; robustness_status?: string;
  n_pairs?: number; worst_observed?: number; [k: string]: unknown;
}
export interface SafetyClass { label: string; motive: string; color: string }
export declare function getSafetyClassification(b: BlindViewInput | null): SafetyClass;
export declare function safetyToGuide(label: string): "SIM" | "CUIDADO" | "NÃO" | "SEM DADO";

// ---- picks (blind x first pick) ----
export declare const PICK_FAVORABILITY_VERSION: "pick-favorability-v1";
export declare const PICK_BASELINE_WR: number;
export type PickFavorabilityKey = "favoravel" | "situacional" | "desfavoravel" | "sem_dado";
export type PickFavorabilityLabel = "Favorável" | "Situacional" | "Desfavorável" | "Sem dado";
export type PickFavorabilityTone = "emerald" | "amber" | "rose" | "slate";
export interface PickEvidence {
  strength: number | null;
  worstCounter: number | null;
  adverseP10: number | null;
  nPairs: number;
}
export interface PickFavorability {
  key: PickFavorabilityKey;
  label: PickFavorabilityLabel;
  motive: string;
  tone: PickFavorabilityTone;
  evidence: PickEvidence;
  formula: typeof PICK_FAVORABILITY_VERSION;
}
export interface FirstPickHeroInput { wrAdj?: number | null; [k: string]: unknown }
export declare function classifyBlindPick(input?: { blind?: BlindViewInput | null }): PickFavorability;
export declare function classifyFirstPick(input?: {
  hero?: FirstPickHeroInput | null;
  blind?: BlindViewInput | null;
  baseline?: number | null;
}): PickFavorability;

// ---- confidence-bands ----
export interface ProbBand { label: string; color: string; desc: string; calibration_status: string }
export declare function interpretProbBand(p: number | null | undefined): ProbBand;

// ---- draft-patterns ----
export interface DistortionViewInput {
  strength_class?: string;
  pick?: { residual?: number } | null; ban?: { residual?: number } | null;
  [k: string]: unknown;
}
export interface DraftPattern { caso: string; leitura: string; ativo: boolean; badgeColor: string; evidence_status: string }
export declare function getDraftPatterns(d: DistortionViewInput | undefined): DraftPattern[];

// ---- hero-lists ----
export interface HeroMetric { id: number; wrAdj: number; pick: number; ban: number; [k: string]: unknown }
export declare function compareById(a: { id?: unknown }, b: { id?: unknown }): number;
export declare function medianOf(values: readonly number[] | null | undefined): number | null;
export declare function averageStrengthOf(heroes: readonly HeroMetric[]): number;
export declare function medianPickOf(heroes: readonly HeroMetric[]): number;
export declare function medianBanOf(heroes: readonly HeroMetric[]): number;
export declare function topBansByBan<T extends HeroMetric>(heroes: readonly T[], n?: number): T[];
export declare function topGemsByStrengthLowPick<T extends HeroMetric>(
  heroes: readonly T[], avgStrength: number, medPick: number, n?: number,
): T[];
export declare function selectConsistentCandidates<T extends HeroMetric>(heroes: readonly T[], n?: number): T[];
export declare function selectLevelPopularityCandidates<T extends HeroMetric>(heroes: readonly T[], n?: number): T[];
export declare function selectLaneTopHeroes<T extends HeroMetric>(
  rows: readonly T[], lanesMap: Record<number | string, string[]> | null | undefined,
  lane: string, n?: number,
): T[];
export interface LaneTopHeroesDetailed<T> { rows: T[]; validated: boolean; reason: string }
export declare function selectLaneTopHeroesDetailed<T extends HeroMetric>(
  rows: readonly T[], lanesMap: Record<number | string, string[]> | null | undefined,
  lane: string, n?: number,
): LaneTopHeroesDetailed<T>;

// ---- builds-aggregate ----
export declare const AGGREGATE_VERSION: "builds-aggregate-v3";
export declare const PACKAGE_INSEPARABLE_MIN: number;
export declare const PACKAGE_MIN_BOTH: number;
export declare const PACKAGE_MIN_CONTEXTS: number;
export declare const PACKAGE_MIN_BUILDS: number;
export declare const ITEM_MIN_CONTEXTS: number;
export declare const ITEM_MIN_BUILDS: number;
export declare const SET_MIN_HEROES: number;
export declare const SET_MIN_BUILDS: number;
export declare const SET_MAX_PER_ARCHETYPE: number;
export declare const RUNE_MIN_BUILDS: number;
export declare const RUNE_MIN_CONTEXTS: number;
export declare const EMBLEM_MIN_CONTEXTS: number;
export declare const EMBLEM_MIN_BUILDS: number;
export declare const ITEMS_MAX_ROWS: number;
export declare const EMBLEMS_MAX_ROWS: number;
export declare const PACKAGES_MAX_ROWS: number;
export declare const RUNES_MAX_ROWS: number;
export declare const VARIANTS_MAX_CORES: number;
export declare const PRACTICAL_DELTA_PP: number;
export declare const ARCHETYPE_LABELS: Readonly<Record<string, string>>;
export interface AggregateSupport {
  status: "ok" | "insufficient";
  k: number; m: number; h: number;
  min: { contexts: number; builds: number; mode: "and" | "or" };
  reason: string | null;
}
export type PatternScope = "cross_hero" | "two_heroes" | "single_hero";
export type DiscoveryStatus = "consolidated" | "emerging" | "local" | "provisional";
export interface AggregateDeltaFields {
  delta_wr_pp_median: number | null;
  delta_wr_pp_unweighted_median: number | null;
  delta_status: "positive" | "negative" | "no_practical_difference" | "insufficient";
  weighting_sensitivity: "stable" | "large_shift" | "sign_flip" | "unknown";
  pattern_scope?: PatternScope;
  pattern_label?: string;
  discovery_status?: DiscoveryStatus;
  support: AggregateSupport;
}
export declare function classifyEquipmentItem(raw: unknown): Record<string, unknown> | null;
export declare function normalizeEquipmentCatalog(records: unknown): Record<number, unknown>;
export declare function normalizeEmblemCatalog(records: unknown): Record<number, unknown>;
export declare function normalizeSpellCatalog(records: unknown): Record<string, unknown>;
export declare function archetypeOfItems(ids: readonly number[], equipment: Record<number, unknown>): string;
export declare function parseBuild(
  raw: unknown, hero: unknown, catalogs?: Record<string, unknown>, context?: Record<string, unknown>,
): Record<string, unknown>;
export declare function parseRawBuilds(
  rawBuilds: unknown, hero: unknown, catalogs?: Record<string, unknown>, context?: Record<string, unknown>,
): Record<string, unknown>[];
export declare function detectPackages(
  contexts: readonly Record<string, unknown>[], equipment: Record<number, unknown>,
): Record<string, unknown>[];
export interface AggregateBody {
  /** Metadados da rodada (cache_hit, deadline_ms, prep_ms, ...) — escritos na borda. */
  context: Record<string, any>;
  sources: Record<string, any>;
  [k: string]: any;
}
export declare function buildAggregate(input?: Record<string, any>): AggregateBody;

// ---- builds-ordering ----
export interface BuildOrderRow {
  win?: number | null; lift_vs_most_used?: number | null;
  references?: { most_used_win?: number | null; hero_mean_win?: number | null } | null;
  [k: string]: unknown;
}
export declare function orderBuildsByLift<T extends BuildOrderRow>(rows: readonly T[]): T[];
export declare function selectTopBuildsByLift<T extends BuildOrderRow>(builds: readonly T[], n?: number): T[];
export declare function selectBuildsAboveMostUsed<T extends BuildOrderRow>(rows: readonly T[]): T[];
export declare function refWinsOf(builds: readonly BuildOrderRow[]): { most: number | null; mean: number | null };

// ---- matchup-ordering ----
export interface PairDelta { delta?: number | null; [k: string]: unknown }
export declare function comparePairsByDeltaAsc(a: PairDelta, b: PairDelta): number;
export declare function sortPairsByDeltaAsc<T extends PairDelta>(pairs: readonly T[]): T[];
export declare function comparePairsByDeltaDesc(a: PairDelta, b: PairDelta): number;
export declare function sortPairsByDeltaDesc<T extends PairDelta>(pairs: readonly T[]): T[];
export declare function hasFiniteDelta(p: PairDelta): boolean;
export declare function selectTopCountersByDelta<T extends PairDelta>(pairs: readonly T[], n?: number): T[];
export declare function selectTopSynergiesByDelta<T extends PairDelta>(pairs: readonly T[], n?: number): T[];
export declare function firstPairByDeltaAsc<T extends PairDelta>(pairs: readonly T[]): T | undefined;

// ---- forca-sorting ----
export type ForcaSortKey = "d" | "wrAdj" | "win" | "pick" | "ban" | "q" | "B";
export interface ForcaRow {
  id: number | string; wrAdj: number;
  q?: number | null; B?: number | null; d?: number | null;
  win?: number | null; pick?: number | null; ban?: number | null;
  [k: string]: unknown;
}
export declare function sortHeroesByMetric<T extends ForcaRow>(rows: readonly T[], sort: ForcaSortKey): T[];
export declare function medianWrAdj(rows: readonly ForcaRow[]): number;
export declare function heroRankPosition(rows: readonly ForcaRow[], heroId: string | number): number;
export declare function heroRankPositions(rows: readonly ForcaRow[]): Map<string, number>;

// ---- tier ----
export declare const TIER_VERSION: "tier-v2";
export declare const TIER_ORDER: readonly ["D", "C", "B", "A", "S"];
export declare function tierOf(pct: number): string;

// ---- strength-index ----
export declare function pctFromRank(avgRank: number, n: number): number | null;
export declare function rankQuantiles(values: readonly number[]): (number | null)[];

// ---- score-heroes ----
export declare const HERO_CONTRACT: Readonly<Record<string, string>>;
export interface HeroScore {
  id: number; name: string; win: number; pick: number; ban: number;
  wrAdj: number; tier: string; strength_index: number | null;
  se: number; B: number;
  credible_interval_95: [number, number] | null; posterior_prob_above_threshold: number | null;
  uncertainty_status: string;
  q: number; strong: boolean; weak: boolean; isGem: boolean;
  degenerate: boolean; smallSample: boolean;
  posterior_mean: number | null; z: number;
  // Eco do input: o motor repassa os campos extras da API (head, class, etc.).
  // `any` (não `unknown`) porque o checkJs da API faz aritmética/indexação neles.
  [k: string]: any;
}
export interface HeroLotMeta {
  n: number; n_dropped: number; mu: number | null; tau: number | null;
  c: number; c_reference: number; c_grade: string | null;
  fdr_alpha: number; gem_quantile: number; small_sample: boolean;
  prior: string; version_break: boolean;
  strength_index_version: string; tier_version: string;
  counts: { strong: number; weak: number; gem: number; degenerate: number };
}
export declare function scoreBatch(
  rawHeroes: readonly Record<string, unknown>[] | null | undefined,
  opts?: { c?: number; prior?: unknown; gameVersion?: string; game_version?: string; debug?: boolean },
): { heroes: HeroScore[]; meta: HeroLotMeta };
export declare function scoreHeroes(
  rawHeroes: readonly Record<string, unknown>[] | null | undefined,
  opts?: { c?: number; prior?: unknown; gameVersion?: string; game_version?: string; debug?: boolean },
): HeroScore[];

// ---- tempo-signal ----
export interface SignalBadge { label: string; desc: string; color: string }
export interface TemporalSignal extends SignalBadge { short: boolean }
export declare function getSignalStateBadge(status: string | undefined): SignalBadge;
export declare function seriesSpanMs(points: readonly { date: string }[]): number;
export declare function seriesSpanDays(points: readonly { date: string }[]): number;
export declare function isShortSeries(points: readonly { date: string }[]): boolean;
export declare function resolveTemporalSignal(
  status: string | undefined, points: readonly { date: string }[],
): TemporalSignal;
export declare function trendDirectionOf(view: { delta?: number | null; delta_logit?: number | null } | undefined | null): {
  word: "subindo" | "caindo" | "estável" | "sem direção"; delta: number | null;
};

// ---- utils: math (primitivas usadas pela api) ----
export declare function mean(xs: readonly number[]): number | null;
export declare function median(xs: readonly number[]): number;
export declare function medianNull(xs: readonly number[]): number | null;
export declare function mad(xs: readonly number[], med?: number): number;
export declare function quantile(sortedAsc: readonly number[], q: number): number;

// ---- utils: config ----
export declare const C_REFERENCE: number;
export declare const DELTA_DEFAULT: number;
export declare const DURATION_BANDS: readonly string[];
export declare const LANES: readonly ["exp", "mid", "roam", "jungle", "gold"];

export type LaneCheck = { ok: true; lane: string } | { ok: false; allowed: readonly string[] };
export declare function requireLane(lane: unknown): LaneCheck;

// ---- governance: exposure ----
export declare function makeExposure(pick: number): { unit: "slot_share"; status: "unvalidated" };
export declare function checkPickSum(picks: readonly number[] | null | undefined): {
  sum: number; ok: boolean; expectedApprox: number;
};

// ---- walkforward ----
export declare const WF_VERSION_BREAK_VARIANCE_FACTOR: number;
export interface WalkPrior { mu: number; tau2: number; n: number; game_version: string }
export declare function isValidWalkPrior(p: unknown): p is WalkPrior;
export declare function walkPriorStamp(prior: unknown): string;
export declare function summarizeWalkPosterior(input?: {
  muBatch?: number; tau2Batch?: number; nBatch?: number;
  prior?: WalkPrior | null; gameVersion?: string | null;
}): WalkPrior;

// ---- confidence: trio ----
export interface ConfidenceTrio {
  posterior_mean: number | null;
  credible_interval_95: [number, number] | null;
  posterior_prob_above_threshold: number | null;
  delta_threshold?: number;
  c_reference: number;
  uncertainty_status: "provisional" | "unavailable";
  exposure: { unit: "slot_share"; status: "unvalidated" };
}
export declare function confidenceTrio(input?: {
  wrAdj?: number; med?: number; se?: number; c?: number; delta?: number;
}): ConfidenceTrio;

// ---- ranks: difference ----
export interface RankDifference {
  diff: number | null;
  interval_95: [number, number] | null;
  prob_above: number | null;
  delta_r?: number;
  c_reference: number;
  classification_status: "provisional_model_based" | "unavailable";
  uncertainty_method: "model_based_proxy";
  exposure_status: "unvalidated";
}
export declare function rankDifference(input?: {
  thetaA?: number; thetaB?: number; seA?: number; seB?: number; c?: number; deltaR?: number;
}): RankDifference;

// ---- meta: temporal ----
export interface TemporalDelta {
  delta: number | null;
  delta_logit: number | null;
  delta_unit?: string;
  interval_95: [number, number] | null;
  delta_threshold?: number;
  c_reference?: number;
  temporal_status: "initial" | "persistent" | "inconclusive";
  patch_association_status: "temporal_association" | "not_evaluated";
  exposure_status: "unvalidated";
}
export declare function temporalDelta(input?: {
  thetaNow?: number; thetaBase?: number; se?: number;
  threshold?: number; c?: number; confirmed?: boolean;
}): TemporalDelta;

// ---- meta: assess-series ----
export interface SeriesSnapshot {
  coletado_em?: number; ts?: number; janela?: number;
  payload_hash?: string; hash?: string; status?: string;
}
export interface SeriesAssessment {
  n_snapshots: number; n_distintos: number; span_dias: number;
  nao_sobrepostos: boolean; lacunas: number;
  status: "serie_curta" | "inconclusivo" | "avaliavel";
  motivo: string;
}
export declare function assessSeries(snaps?: readonly SeriesSnapshot[]): SeriesAssessment;

// ---- counters: distortion ----
export interface DistortionResidual {
  kind: string;
  observed: number | null;
  expected: number | null;
  residual: number | null;
  unit_status?: "unvalidated";
  classification_status: "provisional" | "inconclusive";
  exposure_status: "unvalidated";
}
export declare function distortionResidual(input?: {
  observed?: number; expected?: number; kind?: "pick" | "ban";
}): DistortionResidual;

// ---- counters: duration ----
export interface DurationPoint { label: string; mid: number; win: number }
export declare function durationCurve(src: unknown): DurationPoint[];
export declare function durationCurveDetailed(src: unknown): {
  curve: DurationPoint[]; quarantined: { key: string; reason: string }[];
};
export declare function durationCurveV2(src: unknown): {
  curve: (DurationPoint & { evidence: "proxy_no_n" })[]; quarantined: { key: string; reason: string }[];
};
export declare function classifyDuration(curve: readonly DurationPoint[] | null | undefined): string;

// ---- counters: pair key / evidence / blind proxy ----
export declare function makePairKey(a: unknown, b: unknown, type?: string): string | null;
export interface EvidenceQuality {
  quality: string; reasons: string[];
  exposure_status: "unvalidated"; interval_status: "indisponivel";
  uncertainty_method: null; causal_status: "nao-avaliado";
}
export declare function evidenceQuality(input?: {
  coverage?: string; stable?: boolean | null; hetero?: boolean | null;
}): EvidenceQuality;
export interface BlindProxy {
  safety_status: "proxy" | "inconclusive";
  robustness_status: string;
  adverse_p10: number | null;
  worst_counter?: unknown;
  worst_observed: number | null;
  spread?: number;
  n_pairs: number;
  classification_status: "provisional" | "inconclusive";
  exposure_status: "unvalidated";
  note: string;
}
export declare function blindProxy(deltas?: readonly number[]): BlindProxy;

// ---- builds: lift ----
export interface BuildLift {
  lift_raw: number | null;
  lift_adjusted: number | null;
  adjusted_association: number | null;
  causal_build_lift: number | null;
  reference_kind: string;
  unit?: string;
  reference_semantics_validated?: boolean;
  sample_size_available?: boolean;
  uncertainty_method: string | null;
  causal_status: string;
  exposure_status: "unvalidated";
  classification_status: string;
}
export declare function buildLift(input?: {
  win?: number; refWin?: number; hasSupport?: boolean; refKind?: string;
}): BuildLift;
export interface BuildReferenceRow { win?: number | null; pick?: number | null; [k: string]: unknown }
export declare function buildReferences<T extends BuildReferenceRow>(builds?: readonly T[]): {
  mostUsed: T | null; heroMean: number | null;
};

// ---- hero: strength index ----
export declare const STRENGTH_INDEX_VERSION: "strength-index-v1";

