// Catálogos estáticos (herói, equipamento, emblema/talento).
// Antes eram closures dentro de router() que se chamavam via `router("/catalog")`
// (auto-recursão). Agora são funções com dono próprio; a rota e os agregados
// consomem a mesma implementação, sem reentrar no dispatcher.
import { arenaGet } from "../infra/arena.js";
import { cacheGet, cacheSet } from "../infra/cacheStore.js";
import { createSingleFlight } from "./singleFlight.js";
import { normalizeEmblemCatalog } from "@radar/proprietary-engine";

// F3: catálogos e emblemas compartilham um único single-flight. Duas abas que
// pedem o catálogo frio ao mesmo tempo fazem UMA chamada ao upstream, não duas.
const flights = createSingleFlight();

// GET /catalog — id -> {name, head, smallmap} (1 página de 133, cache C)
export async function heroCatalog() {
  const hit = cacheGet("catalog", "C");
  if (hit.hit) return { data: hit.body, total: Object.keys(hit.body).length, stale: hit.stale, ageMs: hit.ageMs };
  return flights.run("catalog", async () => {
    const raw = await arenaGet(`/api/heroes?size=133&index=1`);
    const map = {};
    for (const rec of raw?.data?.records ?? []) {
      const d = rec?.data ?? {};
      const id = Number(d.hero_id);
      if (!Number.isFinite(id)) continue;
      map[id] = { name: d?.hero?.data?.name ?? `Hero ${id}`, head: d?.hero?.data?.head ?? null, smallmap: d?.hero?.data?.smallmap ?? null };
    }
    cacheSet("catalog", map);
    return { data: map, total: Object.keys(map).length, stale: false, ageMs: 0 };
  });
}

// Consumidores que só querem o mapa (matchups/lanes). Falha do upstream propaga
// como antes; quem precisa degradar envolve em try/catch.
export async function catalogMap() {
  return (await heroCatalog()).data ?? {};
}

// GET /equipment — equipid -> {name, icon} (páginas de 100 até página curta, cache C)
export async function equipmentCatalog() {
  const hit = cacheGet("equipment", "C");
  if (hit.hit) return { data: hit.body, total: Object.keys(hit.body).length, stale: hit.stale, ageMs: hit.ageMs };
  return flights.run("equipment", async () => {
    const map = {};
    const SIZE = 100;
    for (let index = 1; index <= 50; index++) {
      const raw = await arenaGet(`/api/academy/equipment?size=${SIZE}&index=${index}`);
      const records = raw?.data?.records ?? [];
      for (const rec of records) {
        const d = rec?.data ?? {};
        const eid = Number(d.equipid);
        if (!Number.isFinite(eid)) continue;
        map[eid] = { name: d.equipname ?? null, icon: d.equipicon ?? null };
      }
      if (records.length < SIZE) break;
    }
    cacheSet("equipment", map);
    return { data: map, total: Object.keys(map).length, stale: false, ageMs: 0 };
  });
}

export async function equipmentMap() {
  try { return (await equipmentCatalog()).data ?? {}; } catch { return {}; }
}

// Catálogo de talentos (giftid -> nome/tier/ícone). Cache C; falha = mapa vazio.
export async function emblemCatalog() {
  const hit = cacheGet("emblems:v1", "C");
  if (hit.hit && !hit.stale) return hit.body;
  return flights.run("emblems:v1", async () => {
    try {
      const raw = await arenaGet("/api/academy/emblems?size=200&index=1");
      const map = normalizeEmblemCatalog(raw?.data?.records ?? []);
      cacheSet("emblems:v1", map);
      return map;
    } catch {
      return hit.hit ? hit.body : {};
    }
  });
}
