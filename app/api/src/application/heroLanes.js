// Mapa heroId -> lanes[] (GET /heroes/lanes).
// Ids = lista do rank pedido (janela 7; lane é estática por herói, o rank só diz
// quem listar). Desconhecido = herói SEM lane (aparece sem filtro). Falha do
// upstream = lista vazia/mapa sem lanes — degradação honesta, nunca 502.
import { getHeroLane, mapConc } from "../providers/arena/index.js";
import { getLogger, LOG_EVENTS } from "../providers/logging/index.js";
import { cacheGet, cacheSet } from "../infra/cacheStore.js";
import { lanesFromRoadsort } from "./rankLot.js";
import { rankLot } from "../composition.js";
import { catalogMap } from "./catalogs.js";
import { createSingleFlight } from "./singleFlight.js";

// F3: uma coleta de lanes por rank, mesmo com várias abas (single-flight).
const flights = createSingleFlight();
const { fetchRankAll } = rankLot;

export function heroLanesBody(rank) {
  return flights.run(`lanes:${rank}`, () => heroLanesBodyImpl(rank));
}

async function heroLanesBodyImpl(rank) {
  const key = `lanes:${rank}`;
  const hit = cacheGet(key, "C");
  if (hit.hit) return { data: hit.body, total: Object.keys(hit.body).length, stale: hit.stale, ageMs: hit.ageMs };
  let ids = [];
  try {
    const fetched = await fetchRankAll({ days: 7, rank });
    ids = fetched.rows.map((h) => h.id);
  } catch { ids = []; }
  if (!ids.length) {
    try {
      const cat = await catalogMap();
      ids = Object.keys(cat).map(Number).filter(Number.isFinite);
    } catch { ids = []; }
  }
  if (!ids.length) {
    return { data: {}, total: 0, stale: true, ageMs: 0, fallback: true, note: "fonte indisponível — lista segue sem filtro de rota" };
  }
  const pairs = await mapConc(ids, async (id) => {
    try {
      const raw = await getHeroLane(id);
      const roadsort = raw?.data?.records?.[0]?.data?.hero?.data?.roadsort ?? [];
      const parsed = lanesFromRoadsort(roadsort);
      for (const u of parsed.unknown) {
        getLogger().warn(LOG_EVENTS.LANE_UNMAPPED, {
          heroId: id,
          title: u,
          outcome: "hero_without_lane",
        });
      }
      return [id, parsed.lanes];
    } catch {
      return [id, []]; // herói sem lane nesta coleta; aparece sem filtro, nunca sob lane errada
    }
  });
  const map = {};
  for (const pair of pairs) map[pair[0]] = pair[1];
  cacheSet(key, map);
  return { data: map, total: Object.keys(map).length, stale: false, ageMs: 0 };
}
