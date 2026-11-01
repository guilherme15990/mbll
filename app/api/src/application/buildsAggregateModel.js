// Agregado de builds — peças puras da borda.
//
// Chave de cache, metadados de cache-hit e as constantes de profundidade são
// sem estado e sem infraestrutura: a rota e os testes leem daqui, e a fábrica
// (`buildsAggregate.js`) só compõe. Extraído para manter o teto de 300 linhas
// (ADR-041) no arquivo com o fan-out.

export const AGG_TOP_VALUES = new Set([10, 20]);
export const AGG_TOP_ALL = "all";
export const AGG_INTERACTIVE_LIMIT = 30;

export function aggCacheKey({ rank, lane, top, population, window }) {
  return `builds:agg:v5:${rank}:${lane}:${top}:${population}:${window}`;
}

export function withAggCacheMeta(body, hit) {
  const ageMs = hit?.ageMs ?? 0;
  const stale = !!hit?.stale;
  return {
    ...body,
    stale,
    context: { ...(body.context ?? {}), stale, age_ms: ageMs, cache_hit: true },
    sources: { ...(body.sources ?? {}), cache: { hit: true, stale, age_ms: ageMs } },
  };
}
