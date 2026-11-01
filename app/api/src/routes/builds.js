// Builds — visão de sistema (/builds/aggregate) e lifts por herói.
// A rota é só borda HTTP: valida a entrada e delega. A orquestração e a
// normalização vivem em `application/` (buildsAggregate/heroBuilds), ligadas
// pelo composition root — a rota não toca cache nem upstream (Problemas 3 e 4).
import { requireLane } from "@radar/engine";
import { isRank, isWindow, RANKS, WINDOWS } from "../application/validation.js";
import { AGG_TOP_ALL, AGG_TOP_VALUES } from "../application/buildsAggregate.js";
import { buildsAggregate, heroBuilds } from "../composition.js";

// GET /builds/aggregate — visão de sistema (B0–B5), 1 lane por carga.
// `top=all` = profundidade máxima (todos os heróis com dados na lane).
// population=pro NÃO entra no MVP (fase 2); o recorte é ranked.
export async function aggregateRoute(sp) {
  const chk = requireLane(sp.get("lane"));
  if (chk.ok === false) {
    return { status: 422, body: { error: "lane_required", message: "Lane query param is required", allowed: chk.allowed, hint: "use ?lane=exp|mid|roam|jungle|gold (no silent default)" } };
  }
  const lane = chk.lane;
  const rank = sp.get("rank") ?? "mythic";
  const window = Number(sp.get("window") ?? 7);
  const topRaw = sp.get("top");
  const top = topRaw == null ? 10 : topRaw === AGG_TOP_ALL ? AGG_TOP_ALL : Number(topRaw);
  const population = sp.get("population") ?? "ranked";
  if (!isRank(rank)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank", ranks: RANKS } };
  if (!isWindow(window)) return { status: 400, body: { error: "window_invalid", message: "Invalid window", windows: [...WINDOWS] } };
  const topOk = top === AGG_TOP_ALL || (Number.isInteger(top) && AGG_TOP_VALUES.has(top));
  if (!topOk) return { status: 400, body: { error: "top_invalid", message: "Invalid top", allowed: [...AGG_TOP_VALUES, AGG_TOP_ALL], hint: "top=10, top=20 or top=all (todos os heróis com dados na lane)" } };
  if (population !== "ranked") {
    return { status: 400, body: {
      error: "population_not_supported",
      message: "Only population=ranked is supported in this MVP",
      phase: 2,
      hint: "Pro MPL ingest (B6) and pair-level synergy (B7) are phase 2; pro and ranked are separate populations",
    } };
  }

  return buildsAggregate.serve({ rank, lane, window, top, population });
}

// GET /heroes/:id/builds — builds com win rate + ícones (lane OBRIGATÓRIA, API 422 sem lane)
export async function heroBuildsRoute(sp, id) {
  const rank = sp.get("rank") ?? "mythic";
  if (!isRank(rank)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank", ranks: RANKS } };
  const chk = requireLane(sp.get("lane"));
  if (chk.ok === false) {
    return { status: 422, body: { error: "lane_required", message: "Lane query param is required", allowed: chk.allowed, hint: "use ?lane=exp|mid|roam|jungle|gold (no silent default)" } };
  }
  return heroBuilds.get(id, rank, chk.lane);
}
