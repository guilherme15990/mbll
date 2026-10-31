// @radar/proprietary-engine — fronteira ÚNICA dos modelos e primitivas do Radar.
// Regra: tudo vive AQUI por CONTEXTO (utils/math, utils/statistics,
// utils/config, hero, counters, meta, etc.). @radar/engine foi REMOVIDO
// (ADR-025, 2026-10-11): nenhum importador externo muda de nome — este
// barrel preserva todos os nomes públicos.
// Mortos removidos e NÃO ressuscitados: theilSen,
// normalizeRankRecord, nullIfNoSupport, CUTS, quadrant.
// Mesmos nomes exportados de antes; barrel preserva
// os caminhos antigos p/ testes/routes/web.

// ── utils: math (dono de mean/medianNull/median/mad/quantile) ──
export { mean, medianNull, median, mad, quantile } from "./utils/math.js";
// ── utils: statistics (dono das primitivas) ──
export {
  ebShrink,
  obsVariance,
  benjaminiHochberg,
  percentileRank,
  pFromZ,
  logit,
  invLogit,
} from "./utils/statistics.js";
// ── utils: config versionada (v3: sem grade c) ──
export {
  C_REFERENCE,
  DELTA_DEFAULT,
  DURATION_BANDS,
  LANES,
  requireLane,
} from "./utils/config.js";
// ── utils: limiares canônicos ──
export {
  THRESHOLDS_VERSION,
  PRACTICAL_DELTA,
  MIN_LIFT_SIGNAL,
  POPULAR_PICK_MIN,
  RARE_PICK_MAX,
  MIN_SUPPORT_N,
  SEVERE_COUNTER_DELTA,
} from "./utils/thresholds.js";

// ── hero (classes; shims funcionais preservados em cada módulo) ──
export { HeroTrustPolicy, classOf, verdictShort } from "./hero/trust.js";
export { TREND_N, TREND_DELTA, TREND_VERSION, TREND_PRACTICAL_DELTA_PP, TREND_DELTA_WIN, TREND_DELTA_PICK, TREND_DELTA_BAN, HeroTrendAnalyzer, trendOf, trendSeriesDated, trendOfDated } from "./hero/hero-trend.js";
export { HeroProfile, dominantProfileOf } from "./hero/hero-profile.js";
export {
  HeroLists,
  averageStrengthOf,
  averageStrengthOfDetailed,
  medianPickOf,
  medianBanOf,
  compareById,
  medianOf,
  topBansByBan,
  topGemsByStrengthLowPick,
  selectConsistentCandidates,
  selectLevelPopularityCandidates,
  selectLaneTopHeroes,
  selectLaneTopHeroesDetailed,
} from "./hero/hero-lists.js";
export { HeroSorting, sortHeroesByMetric, medianWrAdj, heroRankPosition, heroRankPositions } from "./hero/forca-sorting.js";
export { TIER_VERSION, TIER_ORDER, HeroTier, tierOf } from "./hero/tierOf.js";
export {
  STRENGTH_INDEX_VERSION,
  StrengthIndex,
  averageRanks,
  pctFromRank,
  rankQuantiles,
  strengthIndexByRank,
} from "./hero/strength-index.js";
export { HERO_CONTRACT, scoreBatch, scoreHeroes } from "./hero/score-heroes.js";
// ── hero/scoring (pipeline em classes; score-heroes.js é facade compatível) ──
export { HeroScorer } from "./hero/hero-scorer.js";
export { HeroRowValidator } from "./hero/hero-row-validator.js";
export { MadBaselineEstimator } from "./hero/baseline-estimator.js";
export { WalkForwardPrior } from "./hero/walk-forward-prior.js";
export { EmpiricalBayesShrinkage } from "./hero/shrinkage-model.js";
export { SignificanceTester } from "./hero/significance-tester.js";
export { LotRanking } from "./hero/lot-ranking.js";
export { HeroResultAssembler } from "./hero/hero-result-assembler.js";
export { BatchMetaBuilder } from "./hero/batch-meta-builder.js";

// ── walkforward (ADR-023) ──
export {
  WF_VERSION_BREAK_VARIANCE_FACTOR,
  isValidWalkPrior,
  walkPriorStamp,
  summarizeWalkPosterior,
} from "./walkforward/walkforward.js";

// ── confidence ──
export { confidenceTrio } from "./confidence/confidence-trio.js";
export { interpretProbBand } from "./confidence/confidence-bands.js";

// ── ranks ──
export { rankDifference } from "./ranks/rank-difference.js";
export { RANK_ORDER, getRankProfileLabel } from "./ranks/rank-profile.js";

// ── meta ──
export { temporalDelta } from "./meta/temporal-delta.js";
export { assessSeries } from "./meta/assess-series.js";
export {
  META_TREND_VERSION,
  META_TREND_MIN_POINTS,
  detectMetaTrend,
} from "./meta/meta-trend.js";
export {
  LANE_TIMING_VERSION,
  LANE_TIMING_MIN_WINDOWS,
  LANE_TIMING_DELTA,
  laneTimingCurve,
} from "./meta/lane-timing.js";
export {
  getSignalStateBadge,
  seriesSpanMs,
  seriesSpanDays,
  isShortSeries,
  resolveTemporalSignal,
  trendDirectionOf,
} from "./meta/tempo-signal.js";

// ── counters ──
export { blindProxy } from "./counters/blind-proxy.js";
export { distortionResidual } from "./counters/distortion.js";
export { durationCurve, durationCurveDetailed, durationCurveV2, classifyDuration } from "./counters/duration.js";
export { evidenceQuality } from "./counters/evidence.js";
export { makePairKey } from "./counters/pair-key.js";
export {
  COUNTER_VERDICT_VERSION,
  COUNTER_MIN_ABS_DELTA,
  COUNTER_MIN_PAIRS,
  compareCounterRelation,
} from "./counters/counter.js";
export {
  RELATIONS_AGREEMENT_VERSION,
  expectedForTarget,
  agreementForPair,
} from "./counters/relations-agreement.js";
export {
  comparePairsByDeltaAsc,
  sortPairsByDeltaAsc,
  comparePairsByDeltaDesc,
  sortPairsByDeltaDesc,
  hasFiniteDelta,
  selectTopCountersByDelta,
  selectTopSynergiesByDelta,
  firstPairByDeltaAsc,
} from "./counters/matchup-ordering.js";
export { getSafetyClassification, safetyToGuide } from "./counters/blind-safety.js";

// ── picks (blind x first pick) ──
export {
  PICK_FAVORABILITY_VERSION,
  PICK_BASELINE_WR,
  classifyBlindPick,
  classifyFirstPick,
} from "./picks/pick-favorability.js";

// ── draft ──
export { getDraftPatterns } from "./draft/draft-patterns.js";
export {
  DRAFT_SCORE_VERSION,
  DS_K,
  DS_PRIOR_VAR,
  DS_PAIR_DAMPING,
  DS_OFFLANE_PENALTY_PP,
  DS_FALLBACK_PICK,
  DS_UNIT_STATUS,
  scoreDraftCandidates,
} from "./draft/draft-score.js";
export {
  HERO_DRAFT_SCORE_VERSION,
  scoreHeroDraftScore,
} from "./draft/hero-draft-score.js";

// ── builds ──
export { buildLift, buildReferences } from "./builds/build-lift.js";
export {
  BUILD_ADJUSTED_VERSION,
  BUILD_ADJUST_K,
  adjustedLiftByAttr,
} from "./builds/build-adjusted.js";
export {
  BUILD_QUADRANT_VERSION,
  BUILD_QUADRANT_POPULAR_PICK,
  BUILD_QUADRANT_HIGH_LIFT,
  buildQuadrant,
} from "./builds/build-quadrant.js";
export { getBuildTags } from "./builds/build-tags.js";
export {
  ITEMSET_SCORE_VERSION,
  ITEMSET_M_MIN,
  ITEMSET_CUT_K,
  ITEMSET_CUT_M,
  ITEMSET_MAX_ROWS,
  itemIdsOf,
  scoreAtomicItemset,
  scoreRouteItemsets,
} from "./builds/itemsets.js";
export {
  orderBuildsByLift,
  selectTopBuildsByLift,
  selectBuildsAboveMostUsed,
  refWinsOf,
} from "./builds/builds-ordering.js";
export {
  AGGREGATE_VERSION,
  PACKAGE_INSEPARABLE_MIN,
  PACKAGE_MIN_BOTH,
  PACKAGE_MIN_CONTEXTS,
  PACKAGE_MIN_BUILDS,
  ITEM_MIN_CONTEXTS,
  ITEM_MIN_BUILDS,
  SET_MIN_HEROES,
  SET_MIN_BUILDS,
  SET_MAX_PER_ARCHETYPE,
  RUNE_MIN_BUILDS,
  RUNE_MIN_CONTEXTS,
  EMBLEM_MIN_CONTEXTS,
  EMBLEM_MIN_BUILDS,
  ITEMS_MAX_ROWS,
  EMBLEMS_MAX_ROWS,
  PACKAGES_MAX_ROWS,
  RUNES_MAX_ROWS,
  VARIANTS_MAX_CORES,
  PRACTICAL_DELTA_PP,
  ARCHETYPE_LABELS,
  classifyEquipmentItem,
  normalizeEquipmentCatalog,
  normalizeEmblemCatalog,
  normalizeSpellCatalog,
  archetypeOfItems,
  parseBuild,
  parseRawBuilds,
  detectPackages,
  buildAggregate,
} from "./builds/builds-aggregate.js";
export {
  CONTRAST_SHRINK_K,
  CONTRAST_MIN,
  CONTRAST_EVIDENCE_RULE,
  componentsOfBuild,
  contextContrasts,
  contrastEstimates,
  valueFieldsOf,
} from "./builds/component-contrast.js";

// ── governance ──
export { makeExposure, checkPickSum } from "./governance/exposure.js";

// ── personal ──
export {
  PLAYSTYLE_VERSION,
  PLAYSTYLE_MIN_MATCHES,
  clusterPlaystyle,
  compareToPattern,
} from "./personal/playstyle.js";
export {
  PERSONAL_CALIBRATION_VERSION,
  PERSONAL_MIN_N,
  PERSONAL_Z,
  calibrateOwnVsGlobal,
  poolProfile,
} from "./personal/personal-calibration.js";
