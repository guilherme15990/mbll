// Prep do agregado de builds: catálogos e posições.
//
// Fábrica com DI (Problema 3 da auditoria): recebe o gateway (Arena) e o cache
// por parâmetro. Extraído de `buildsAggregate.js` para manter o teto de 300
// linhas (ADR-041) no arquivo com o fan-out.
import { lanesFromRoadsort } from "./rankLot.js";

/**
 * @param {{ arena: { getPositions: Function }, cacheStore: { cacheGet: Function, cacheSet: Function } }} deps
 */
export function createBuildsCatalogPrep({ arena, cacheStore }) {
  const { cacheGet, cacheSet } = cacheStore;

  // Cache C por chave; falha de normalização (catálogo vazio) lança para o
  // chamador degradar — o recorte segue, só perde nome/arquétipo.
  async function aggCatalog(key, load, normalize) {
    const hit = cacheGet(key, "C");
    if (hit.hit) return { data: hit.body ?? {}, stale: !!hit.stale, ageMs: hit.ageMs ?? 0, source: "cache" };
    const page = await load();
    const records = Array.isArray(page?.data) ? page.data : page?.data?.records ?? [];
    const data = normalize(records);
    if (!data || !Object.keys(data).length) throw new Error(`catalog_empty:${key}`);
    cacheSet(key, data);
    return { data, stale: false, ageMs: 0, source: "upstream" };
  }

  function aggParsePositions(records) {
    const map = {};
    for (const rec of records ?? []) {
      const d = rec?.data ?? rec ?? {};
      const id = Number(d.hero_id ?? d.heroid);
      if (!Number.isFinite(id)) continue;
      const roadsort = d?.hero?.data?.roadsort ?? d?.roadsort ?? [];
      const { lanes } = lanesFromRoadsort(roadsort);
      map[id] = {
        id,
        name: d?.hero?.data?.name ?? d?.hero_name ?? `Hero ${id}`,
        head: d?.hero?.data?.head ?? null,
        lanes,
      };
    }
    return map;
  }

  async function aggPositions() {
    const hit = cacheGet("positions:v1", "C");
    if (hit.hit) return { data: hit.body ?? {}, stale: !!hit.stale, ageMs: hit.ageMs ?? 0, source: "cache" };
    const raw = await arena.getPositions({ retries: 1, timeoutMs: 7000 });
    const data = aggParsePositions(raw?.data?.records ?? []);
    if (!Object.keys(data).length) throw new Error("positions_empty");
    cacheSet("positions:v1", data);
    return { data, stale: false, ageMs: 0, source: "upstream" };
  }

  return { aggCatalog, aggPositions };
}
