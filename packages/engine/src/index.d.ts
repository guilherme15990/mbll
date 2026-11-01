// Tipagens da fronteira @radar/engine consumidas por web E api.
// Os módulos são JS puro; este arquivo dá as assinaturas para `tsc --noEmit`
// (web), `tsc -p app/api/jsconfig.json` (checkJs) e `vite build`.
// Campos opcionais: os apps passam objetos ricos da API que satisfazem
// estruturalmente estes mínimos.
//
// Cobertura (ADR-064): o contrato público é enxuto — este arquivo declara
// exatamente os mesmos 49 nomes que o barrel `index.js` exporta, mais os TIPOS
// usados pelo app. Todo nome importado de `@radar/engine` pelos apps tem
// declaração aqui; `npm run check:boundaries` falha se faltar (import sem
// declaração) ou se sobrar (declaração de valor sem runtime). Helpers internos
// que nenhum app consome permanecem sem declaração de propósito (o runtime é a
// verdade; declarar assinatura não usada só cria drift).

import type {
  AggregateSupport,
  BuildsAggregateResponse,
  DiscoveryStatus,
  PatternScope,
} from "@radar/contracts";

// ---- itemsets ----
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
  readonly key: string;
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
export type BuildTagKey = "popular" | "emergente" | "situacional";
export type BuildTagTone = "popular" | "edge" | "situ";
export interface BuildTag { key: BuildTagKey; label: string; tone: BuildTagTone; title: string }
export interface BuildTagsInput { pick: number | null; lift_vs_most_used?: number | null }
export declare function getBuildTags(b: BuildTagsInput): BuildTag[];

// ---- counter ----
export type CounterVerdict = "confirmado" | "contestado" | "so-observado" | "desconhecido";
export interface CounterRelationInput {
  expected?: -1 | 1 | 0 | null; delta?: number | null;
  nPairs?: number; coverage?: "extremes" | "full" | "unknown"; minAbs?: number;
}
export interface CounterRelationResult { verdict: CounterVerdict; reasons: string[] }

// ---- relations-agreement ----
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
  minAbs: number; minPairs: number;
}

// ---- lane-timing ----

export type LaneTimingVerdict = "subindo" | "caindo" | "estavel" | "ruptura" | "sem-dado";
export interface TimingWindow { time_min: number; time_max: number; win_rate: number }
export interface TimingSegment extends TimingWindow { move: "ref" | "sobe" | "desce" | "estavel" }
export interface LaneTimingCurve {
  verdict: LaneTimingVerdict; lane: string | null; n: number;
  peak: TimingWindow | null; segments: TimingSegment[];
  slopePerWindow: number | null; reasons: string[];
}

// ---- personal-calibration ----

export type CalibrationVerdict =
  | "acima-do-global" | "na-faixa" | "abaixo-do-global"
  | "incerteza-dominante" | "sem-dado";
export interface CalibrationResult {
  verdict: CalibrationVerdict; diff: number | null; band: number | null;
  n: number | null; win: number | null; theta: number | null;
  reasons: string[];
}

export interface FrequentEntry {
  hid?: number | string | null; hero_id?: number | string | null;
  tc?: number | null; n?: number | null; wc?: number | null;
  role?: string | null; [k: string]: unknown;
}
export interface RolePool { role: string; heroes: number; matches: number; share: number | null }
export interface PoolProfile {
  nHeroes: number; totalMatches: number; totalWins: number; winRate: number | null;
  perRole: RolePool[]; mainRole: string | null; topShare: number | null;
}

// ---- meta-trend ----
export type MetaTrendVerdict = "subindo" | "caindo" | "estavel" | "ruptura" | "sem-dado";

// ---- trust (v3: sem tiers de B, sem Robusto, sem teto) ----
export declare function classOf(h: { smallSample?: boolean; strong?: boolean; weak?: boolean; isGem?: boolean } | null | undefined): string | null;
export interface TrustInput {
  B?: number | null; smallSample?: boolean; degenerate?: boolean;
  confidence?: string | null; class?: string | null;
  uncertainty_status?: string | null;
  [k: string]: unknown;
}

// ---- hero-trend ----

export type TrendDir = "subindo" | "estável" | "caindo" | "sem-dado";

export type DatedDirection = "rising" | "stable" | "falling" | "insufficient_data";
export interface DatedTrendSeries {
  direction: DatedDirection; delta_pp_window: number | null; slope_pp_per_day: number | null;
  n_points: number; window_days: number; robustness: string; coverage_quality: string;
  statistical_evidence: null; duplicate_dates_dropped: number;
}
export interface DatedTrendRadar {
  win_rate: DatedTrendSeries; pick_rate: DatedTrendSeries; ban_rate: DatedTrendSeries;
}
export declare function trendOfDated(
  points: readonly { date?: string; win?: number | null; win_rate?: number | null; pick?: number | null; app_rate?: number | null; ban?: number | null; ban_rate?: number | null }[],
  opts?: { deltaWin?: number; deltaPick?: number; deltaBan?: number; deltaThreshold?: number },
): DatedTrendRadar;

// ---- hero-profile ----
export interface DominantProfile { top: string; n: number; total: number }
export declare function dominantProfileOf(profiles: readonly string[]): DominantProfile | null;

// ---- rank-profile ----

export interface RankDiffInput {
  diff: number | null; delta_r?: number; prob_above?: number;
  classification_status?: string; [k: string]: unknown;
}
export interface RankProfile { label: string; motive: string; color: string }

// ---- blind-safety ----
export interface BlindViewInput {
  classification_status?: string; robustness_status?: string;
  n_pairs?: number; worst_observed?: number; [k: string]: unknown;
}
export interface SafetyClass { label: string; motive: string; color: string }

// ---- picks (blind x first pick) ----
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

// ---- draft-patterns ----
export interface DistortionViewInput {
  strength_class?: string;
  pick?: { residual?: number } | null; ban?: { residual?: number } | null;
  [k: string]: unknown;
}
export interface DraftPattern { caso: string; leitura: string; ativo: boolean; badgeColor: string; evidence_status: string }
export declare function getDraftPatterns(d: DistortionViewInput | undefined): DraftPattern[];

// ---- draft-score ----
export interface DraftScorePairObs { id: number; delta?: number | null; [k: string]: unknown }
export interface DraftScoreBook {
  countersUp?: readonly DraftScorePairObs[]; countersDown?: readonly DraftScorePairObs[];
  synergiesUp?: readonly DraftScorePairObs[]; synergiesDown?: readonly DraftScorePairObs[];
}
export interface DraftScoreHero {
  id: number; name?: string | null; head?: string | null;
  /** WR global (fração 0–1). */
  win?: number | null;
  /** WR da lane do recorte (fração 0–1), preferido sobre `win`. */
  laneWin?: number | null;
  pick?: number | null; ban?: number | null;
  lanes?: readonly string[] | null;
  book?: DraftScoreBook | null;
  [k: string]: unknown;
}
export interface DraftScoreTerm {
  kind: "synergy" | "matchup";
  other_id: number; other_name: string | null;
  present: boolean; contested: boolean;
  raw_pp: number | null; effect_pp: number; var_pp2: number;
  exposure_proxy: number; unit_status: "pp_hypothesis_strong";
}
export interface DraftScoreBreakdown {
  base_pp: number; synergy_pp: number; matchup_pp: number; lane_penalty_pp: number;
  coverage: { observed: number; total: number; ratio: number };
  terms: readonly DraftScoreTerm[];
}
export interface DraftScoreRow {
  id: number; name: string | null; head: string | null;
  lane: string | null; lane_fit: boolean | null;
  /** Delta esperado de WR em pp (unidade-hipótese, não validada). */
  expected_pp: number; sigma_pp: number;
  /** `expected_pp - k·sigma_pp - lane_penalty`. Base da ordenação. */
  lower_bound: number;
  mu: number; sigma: number;
  breakdown: DraftScoreBreakdown;
  reasons: readonly string[];
  evidence_status: "provisional" | "inconclusive" | "sem-dado";
  /** Posição relativa do limite inferior no lote (0–100). NUNCA probabilidade. */
  score: number | null;
  dominated: boolean; frontier: boolean;
}
export interface DraftScoreInput {
  candidates: readonly DraftScoreHero[];
  allies?: readonly (DraftScoreHero | number)[];
  enemies?: readonly (DraftScoreHero | number)[];
  bans?: readonly number[];
  lane?: string | null;
  params?: { k?: number; priorVar?: number; damping?: number; offLanePenaltyPp?: number };
}
export interface DraftScoreResult {
  lane: string | null; k: number; priorVar: number; damping: number;
  unit_status: "pp_hypothesis_strong";
  rows: DraftScoreRow[];
  meta: {
    n_candidates: number; n_allies: number; n_enemies: number;
    observed_pairs_total: number; coverage_incomplete: boolean;
    calibrated: false; note: string;
  };
}

// ---- hero-draft-score ----
export interface HeroDraftScoreHero {
  id: number | string; name?: string | null; head?: string | null;
  /** WR do recorte em fração 0–1. */
  win?: number | null;
  [k: string]: unknown;
}
export interface HeroDraftScoreEntry {
  id: number; name: string | null; head: string | null;
  /** Min–max da WR no recorte (0–100): melhor WR = 100, pior WR = 0; `null` sem WR. */
  draft_score: number | null;
}
export interface HeroDraftScoreResult {
  rows: HeroDraftScoreEntry[];
  meta: {
    n_heroes: number; with_data: number;
    wr_min: number | null; wr_max: number | null;
    calibrated: false; note: string;
  };
}
export declare function scoreHeroDraftScore(input?: { heroes?: readonly HeroDraftScoreHero[] }): HeroDraftScoreResult;

// ---- hero-lists ----
export interface HeroMetric { id: number; wrAdj: number; pick: number; ban: number; [k: string]: unknown }

export declare function medianPickOf(heroes: readonly HeroMetric[]): number;
export declare function medianBanOf(heroes: readonly HeroMetric[]): number;

export interface LaneTopHeroesDetailed<T> { rows: T[]; validated: boolean; reason: string }
export declare function selectLaneTopHeroesDetailed<T extends HeroMetric>(
  rows: readonly T[], lanesMap: Record<number | string, string[]> | null | undefined,
  lane: string, n?: number,
): LaneTopHeroesDetailed<T>;

// ---- builds-aggregate ----

// Estes três eram declarados aqui E na web (cópia à mão do mesmo DTO). Agora
// vêm de `@radar/contracts` e são reexportados: um lugar, dois consumidores.
// `AggregateSupport.min.mode` fica `string` no contrato; o runtime continua
// emitindo "and"/"or".
export type { AggregateSupport, PatternScope, DiscoveryStatus };
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

export declare function normalizeEquipmentCatalog(records: unknown): Record<number, unknown>;
export declare function normalizeEmblemCatalog(records: unknown): Record<number, unknown>;
export declare function normalizeSpellCatalog(records: unknown): Record<string, unknown>;

/**
 * Corpo de `/v1/builds/aggregate`.
 *
 * Era `Record<string, any>` aqui e um tipo escrito à mão na web — duas
 * descrições que podiam divergir sem o `tsc` acusar. Agora é o contrato de
 * `@radar/contracts`: o motor, a borda da API e a web falam a mesma forma.
 */
export type AggregateBody = BuildsAggregateResponse;
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

// ---- matchup-ordering ----
export interface PairDelta { delta?: number | null; [k: string]: unknown }

export declare function sortPairsByDeltaAsc<T extends PairDelta>(pairs: readonly T[]): T[];

export declare function sortPairsByDeltaDesc<T extends PairDelta>(pairs: readonly T[]): T[];
export declare function hasFiniteDelta(p: PairDelta): boolean;
export declare function selectTopCountersByDelta<T extends PairDelta>(pairs: readonly T[], n?: number): T[];
export declare function selectTopSynergiesByDelta<T extends PairDelta>(pairs: readonly T[], n?: number): T[];

// ---- forca-sorting ----
export type ForcaSortKey = "d" | "wrAdj" | "win" | "pick" | "ban" | "q" | "B";
export interface ForcaRow {
  id: number | string; wrAdj: number;
  q?: number | null; B?: number | null; d?: number | null;
  win?: number | null; pick?: number | null; ban?: number | null;
  [k: string]: unknown;
}

// ---- score-heroes ----
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
  counts: { strong: number; weak: number; gem: number; degenerate: number };
}
export declare function scoreBatch(
  rawHeroes: readonly Record<string, unknown>[] | null | undefined,
  opts?: { c?: number; prior?: unknown; gameVersion?: string; game_version?: string; debug?: boolean },
): { heroes: HeroScore[]; meta: HeroLotMeta };

// ---- tempo-signal ----
export interface SignalBadge { label: string; desc: string; color: string }
export interface TemporalSignal extends SignalBadge { short: boolean }

// ---- utils: math (primitivas usadas pela api) ----
export declare function mean(xs: readonly number[]): number | null;
export declare function median(xs: readonly number[]): number;

// ---- utils: config ----
export declare const C_REFERENCE: number;

export declare const LANES: readonly ["exp", "mid", "roam", "jungle", "gold"];

export type LaneCheck = { ok: true; lane: string } | { ok: false; allowed: readonly string[] };
export declare function requireLane(lane: unknown): LaneCheck;

// ---- governance: exposure ----

export declare function checkPickSum(picks: readonly number[] | null | undefined): {
  sum: number; ok: boolean; expectedApprox: number;
};

// ---- walkforward ----
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

