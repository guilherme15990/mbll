// @radar/engine — fronteira ÚNICA dos modelos e primitivas do Radar.
// Estrutura consolidada (ADR-061) em 4 buckets:
//   core/      fundação matemática e estatística pura
//   heroes/    inferência e classificação de heróis
//   matchups/  confrontos, counters e draft
//   builds/    itens, talentos e emblemas
//
// CONTRATO PÚBLICO ENXUTO (ADR-064): este barrel expõe APENAS os nomes que o
// código do app consome de fato — `app/{api,web}/src` e os testes das apps.
// São 49 nomes. Os demais NÃO entram aqui: os testes internos da engine os
// importam por caminho profundo (`./heroes/ranking.js` etc.). Auditoria:
// AGENTS/artefatos/architecture/engine-codigo-nao-usado-2026-11-01.md.
// (Motivo de o app-test contar como contrato: as regras 2/3 do gate de
// fronteiras proíbem o app de importar o interior do pacote ou escapar por
// caminho relativo — `assessSeries` só é alcançável pelo barrel.)
//
// Mortos removidos e NÃO ressuscitados: theilSen, normalizeRankRecord,
// nullIfNoSupport, CUTS, quadrant, rankDifference, temporalDelta.
// Podados do contrato (2026-11-01): 5 código morto + 53 export morto (nenhum
// consumidor — nem app, nem src, nem teste importava do barrel). Laudo completo
// em AGENTS/artefatos/architecture/engine-legado-2026-11-01.md (ADR-062).
// Sem carimbo de versão (ADR-063): nenhuma constante *_VERSION e nenhum campo
// `version`/`formula`/`tier_version`/`model_version` na saída do motor.
// Estados canônicos em structs (ADR-063): transversais em core/states.js,
// específicos no módulo dono; NÃO entram neste barrel.

// ── core: math ──
export { mean, median } from "./core/math.js";
// ── core: config (referência de c + lanes canônicas) ──
export { C_REFERENCE, LANES, requireLane } from "./core/config.js";

// ── heroes ──
export { classOf } from "./heroes/trust.js";
export { dominantProfileOf } from "./heroes/profile.js";
export { medianPickOf, medianBanOf, selectLaneTopHeroesDetailed } from "./heroes/ranking.js";
export { scoreBatch } from "./heroes/scoring.js";
// trend datado + assess-series (avaliação de série temporal)
export { trendOfDated, assessSeries } from "./heroes/trends.js";
// walkforward (ADR-023)
export {
  isValidWalkPrior,
  walkPriorStamp,
  summarizeWalkPosterior,
} from "./heroes/trends.js";

// ── matchups ──
export { blindProxy, classifyBlindPick, classifyFirstPick } from "./matchups/blind-pick.js";
export {
  distortionResidual,
  durationCurve,
  classifyDuration,
  evidenceQuality,
  makePairKey,
  sortPairsByDeltaAsc,
  sortPairsByDeltaDesc,
  hasFiniteDelta,
  selectTopCountersByDelta,
  selectTopSynergiesByDelta,
  checkPickSum,
} from "./matchups/counters.js";
export { getDraftPatterns } from "./matchups/draft-patterns.js";
export { scoreHeroDraftScore } from "./matchups/draft-score.js";

// ── builds ──
export {
  buildLift,
  buildReferences,
  orderBuildsByLift,
  selectTopBuildsByLift,
  selectBuildsAboveMostUsed,
} from "./builds/lift.js";
export {
  getBuildTags,
  normalizeEquipmentCatalog,
  normalizeEmblemCatalog,
  normalizeSpellCatalog,
  buildAggregate,
} from "./builds/aggregate.js";
export {
  ITEMSET_M_MIN,
  ITEMSET_CUT_K,
  ITEMSET_CUT_M,
  ITEMSET_MAX_ROWS,
  itemIdsOf,
  scoreAtomicItemset,
  scoreRouteItemsets,
} from "./builds/itemsets.js";
