/**
 * Scoring de itemsets — fórmula `itemset-score-v1`.
 *
 * Re-export da FONTE ÚNICA em `@radar/proprietary-engine` (workspace local).
 * A implementação vive em `packages/proprietary-engine/src/itemsets.js`;
 * este módulo é só o caminho estável de import da web + tipos.
 * (Antes: função pura local sem dependências; agora depende do workspace.)
 */
export {
  ITEMSET_SCORE_VERSION,
  ITEMSET_M_MIN,
  ITEMSET_CUT_K,
  ITEMSET_CUT_M,
  ITEMSET_MAX_ROWS,
  itemIdsOf,
  scoreAtomicItemset,
  scoreRouteItemsets,
} from "@radar/proprietary-engine";
export type {
  ItemsetStatus,
  HeroItemsetContext,
  ItemsetAtomic,
  RouteItemset,
} from "@radar/proprietary-engine";
