// @radar/engine — fronteira ÚNICA dos modelos e primitivas do Radar.
// Estrutura consolidada (ADR-061) em 4 buckets:
//   core/      fundação matemática e estatística pura
//   heroes/    inferência e classificação de heróis
//   matchups/  confrontos, counters e draft
//   builds/    itens, talentos e emblemas
// O pacote entrou pela raiz `@radar/engine` desde a ADR-059 (nome) e a
// ADR-025 (fronteira única): nenhum importador externo muda de nome — este
// barrel preserva todos os nomes públicos consumidos por app e testes.
// Mortos removidos e NÃO ressuscitados: theilSen, normalizeRankRecord,
// nullIfNoSupport, CUTS, quadrant, rankDifference, temporalDelta.
// Podados do contrato (2026-11-01): 5 código morto + 53 export morto (nenhum
// consumidor — nem app, nem src, nem teste importava do barrel). Laudo completo
// em AGENTS/artefatos/architecture/engine-legado-2026-11-01.md (ADR-062).

// ── utils: math (dono de mean/medianNull/median/mad/quantile) ──
export { mean, medianNull, median, mad, quantile } from "./core/math.js";
// ── utils: statistics (dono das primitivas) ──
export {
  ebShrink,
  obsVariance,
  benjaminiHochberg,
  percentileRank,
  pFromZ,
  logit,
  invLogit,
} from "./core/statistics.js";
// ── utils: config versionada (v3: sem grade c) ──
export {
  C_REFERENCE,
  DELTA_DEFAULT,
  DURATION_BANDS,
  LANES,
  requireLane,
} from "./core/config.js";
// ── utils: limiares canônicos ──
export {
  PRACTICAL_DELTA,
  MIN_LIFT_SIGNAL,
  POPULAR_PICK_MIN,
  RARE_PICK_MAX,
  MIN_SUPPORT_N,
  SEVERE_COUNTER_DELTA,
} from "./core/thresholds.js";

// ── hero (classes; shims funcionais preservados em cada módulo) ──
export { classOf, verdictShort } from "./heroes/trust.js";
export { TREND_N, TREND_DELTA, trendOf, trendOfDated } from "./heroes/trends.js";
export { dominantProfileOf } from "./heroes/profile.js";
export {
  averageStrengthOf,
  medianPickOf,
  medianBanOf,
  medianOf,
  topBansByBan,
  topGemsByStrengthLowPick,
  selectConsistentCandidates,
  selectLaneTopHeroes,
  selectLaneTopHeroesDetailed,
} from "./heroes/ranking.js";
export { sortHeroesByMetric, medianWrAdj, heroRankPosition, heroRankPositions } from "./heroes/ranking.js";
export { TIER_VERSION, TIER_ORDER, tierOf } from "./heroes/ranking.js";
export {
  STRENGTH_INDEX_VERSION,
  strengthIndexByRank,
} from "./heroes/ranking.js";
export { HERO_CONTRACT, scoreBatch, scoreHeroes } from "./heroes/scoring.js";
// ── hero/scoring (pipeline em classes; score-heroes.js é facade compatível) ──
export { HeroRowValidator } from "./heroes/assembler.js";
export { WalkForwardPrior } from "./heroes/trends.js";
export { LotRanking } from "./heroes/ranking.js";
export { HeroResultAssembler } from "./heroes/assembler.js";

// ── walkforward (ADR-023) ──
export {
  isValidWalkPrior,
  walkPriorStamp,
  summarizeWalkPosterior,
} from "./heroes/trends.js";

// ── confidence ──
export { confidenceTrio } from "./heroes/trust.js";
export { interpretProbBand } from "./heroes/trust.js";

// ── ranks ──
export { RANK_ORDER, getRankProfileLabel } from "./heroes/ranking.js";

// ── meta ──
export { assessSeries } from "./heroes/trends.js";
export {
  META_TREND_VERSION,
  META_TREND_MIN_POINTS,
  detectMetaTrend,
} from "./heroes/trends.js";
export {
  LANE_TIMING_VERSION,
  LANE_TIMING_MIN_WINDOWS,
  LANE_TIMING_DELTA,
  laneTimingCurve,
} from "./heroes/trends.js";
export {
  getSignalStateBadge,
  seriesSpanMs,
  seriesSpanDays,
  isShortSeries,
  resolveTemporalSignal,
  trendDirectionOf,
} from "./heroes/trends.js";

// ── counters ──
export { blindProxy } from "./matchups/blind-pick.js";
export { distortionResidual } from "./matchups/counters.js";
export { durationCurve, classifyDuration } from "./matchups/counters.js";
export { evidenceQuality } from "./matchups/counters.js";
export { makePairKey } from "./matchups/counters.js";
export {
  COUNTER_VERDICT_VERSION,
  COUNTER_MIN_ABS_DELTA,
  COUNTER_MIN_PAIRS,
  compareCounterRelation,
} from "./matchups/counters.js";
export {
  RELATIONS_AGREEMENT_VERSION,
  expectedForTarget,
  agreementForPair,
} from "./matchups/counters.js";
export {
  comparePairsByDeltaAsc,
  sortPairsByDeltaAsc,
  comparePairsByDeltaDesc,
  sortPairsByDeltaDesc,
  hasFiniteDelta,
  selectTopCountersByDelta,
  selectTopSynergiesByDelta,
  firstPairByDeltaAsc,
} from "./matchups/counters.js";
export { getSafetyClassification, safetyToGuide } from "./matchups/blind-pick.js";

// ── picks (blind x first pick) ──
export {
  classifyBlindPick,
  classifyFirstPick,
} from "./matchups/blind-pick.js";

// ── draft ──
export { getDraftPatterns } from "./matchups/draft-patterns.js";
export {
  DRAFT_SCORE_VERSION,
  DS_PRIOR_VAR,
  DS_OFFLANE_PENALTY_PP,
  DS_UNIT_STATUS,
  scoreDraftCandidates,
} from "./matchups/draft-score.js";
export {
  HERO_DRAFT_SCORE_VERSION,
  scoreHeroDraftScore,
} from "./matchups/draft-score.js";

// ── builds ──
export { buildLift, buildReferences } from "./builds/lift.js";
export {
  BUILD_ADJUSTED_VERSION,
  adjustedLiftByAttr,
} from "./builds/lift.js";
export {
  BUILD_QUADRANT_VERSION,
  buildQuadrant,
} from "./builds/contrast.js";
export { getBuildTags } from "./builds/aggregate.js";
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
} from "./builds/lift.js";
export {
  PRACTICAL_DELTA_PP,
  classifyEquipmentItem,
  normalizeEquipmentCatalog,
  normalizeEmblemCatalog,
  normalizeSpellCatalog,
  parseBuild,
  detectPackages,
  buildAggregate,
} from "./builds/aggregate.js";
export {
  CONTRAST_SHRINK_K,
  CONTRAST_MIN,
  CONTRAST_EVIDENCE_RULE,
  componentsOfBuild,
  contextContrasts,
  contrastEstimates,
  valueFieldsOf,
} from "./builds/contrast.js";

// ── governance ──
export { makeExposure, checkPickSum } from "./matchups/counters.js";

// ── personal ──
export {
  PLAYSTYLE_VERSION,
  PLAYSTYLE_MIN_MATCHES,
  clusterPlaystyle,
  compareToPattern,
} from "./heroes/profile.js";
export {
  PERSONAL_CALIBRATION_VERSION,
  PERSONAL_MIN_N,
  PERSONAL_Z,
  calibrateOwnVsGlobal,
  poolProfile,
} from "./heroes/profile.js";
