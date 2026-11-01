/**
 * Scoring de itemsets.
 *
 * Re-export da FONTE ÚNICA em `@radar/engine` (workspace local).
 * A implementação vive em `packages/engine/src/builds/itemsets.js`;
 * este módulo é só o caminho estável de import da web + tipos.
 * (Antes: função pura local sem dependências; agora depende do workspace.)
 */
export {
  ITEMSET_M_MIN,
  ITEMSET_CUT_K,
  ITEMSET_CUT_M,
  ITEMSET_MAX_ROWS,
  itemIdsOf,
  scoreAtomicItemset,
  scoreRouteItemsets,
} from "@radar/engine";
export type {
  ItemsetStatus,
  HeroItemsetContext,
  ItemsetAtomic,
  RouteItemset,
} from "@radar/engine";
