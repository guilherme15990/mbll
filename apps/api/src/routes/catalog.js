// Catálogos expostos e mapa de lanes (todos cacheados na camada C).
import { RANKS } from "../arena.js";
import { isRank } from "../application/validation.js";
import { heroCatalog, equipmentCatalog } from "../application/catalogs.js";
import { heroLanesBody } from "../application/heroLanes.js";

// GET /catalog
export async function heroCatalogRoute() {
  return { status: 200, body: await heroCatalog() };
}

// GET /equipment
export async function equipmentRoute() {
  return { status: 200, body: await equipmentCatalog() };
}

// GET /heroes/lanes?rank=
export async function heroLanesRoute(sp) {
  const rank = sp.get("rank") ?? "mythic";
  if (!isRank(rank)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank", ranks: RANKS } };
  return { status: 200, body: await heroLanesBody(rank) };
}
