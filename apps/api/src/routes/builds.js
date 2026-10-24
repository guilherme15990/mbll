// Builds — visão de sistema (/builds/aggregate) e lifts por herói.
import { arenaGet, RANKS } from "../infra/arena.js";
import { cacheGet, cacheSet } from "../infra/cacheStore.js";
import { requireLane, buildLift, buildReferences } from "@radar/proprietary-engine";
import { isRank, isWindow, WINDOWS } from "../application/validation.js";
import {
  AGG_TOP_VALUES, aggCacheKey, withAggCacheMeta,
  aggBackgroundRevalidate, runBuildsAggregate,
} from "../application/buildsAggregate.js";
import { equipmentMap, emblemCatalog } from "../application/catalogs.js";

// GET /builds/aggregate — visão de sistema (B0–B5), 1 lane por carga.
// population=pro NÃO entra no MVP (fase 2); o recorte é ranked.
export async function aggregateRoute(sp) {
  const chk = requireLane(sp.get("lane"));
  if (chk.ok === false) {
    return { status: 422, body: { error: "lane_required", message: "Lane query param is required", allowed: chk.allowed, hint: "use ?lane=exp|mid|roam|jungle|gold (no silent default)" } };
  }
  const lane = chk.lane;
  const rank = sp.get("rank") ?? "mythic";
  const window = Number(sp.get("window") ?? 7);
  const top = sp.get("top") == null ? 10 : Number(sp.get("top"));
  const population = sp.get("population") ?? "ranked";
  if (!isRank(rank)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank", ranks: RANKS } };
  if (!isWindow(window)) return { status: 400, body: { error: "window_invalid", message: "Invalid window", windows: [...WINDOWS] } };
  if (!Number.isInteger(top) || !AGG_TOP_VALUES.has(top)) return { status: 400, body: { error: "top_invalid", message: "Invalid top", allowed: [...AGG_TOP_VALUES], hint: "top=10 (deadline 8s) or top=20 (deadline 12s)" } };
  if (population !== "ranked") {
    return { status: 400, body: {
      error: "population_not_supported",
      message: "Only population=ranked is supported in this MVP",
      phase: 2,
      hint: "Pro MPL ingest (B6) and pair-level synergy (B7) are phase 2; pro and ranked are separate populations",
    } };
  }

  const params = { rank, lane, window, top, population };
  const key = aggCacheKey(params);

  // Quente: 0 requests. Stale: serve já e revalida em background (1 lane por ciclo).
  const hit = cacheGet(key, "C");
  if (hit.hit) {
    if (hit.stale) aggBackgroundRevalidate(key, params);
    return { status: 200, body: withAggCacheMeta(hit.body, hit) };
  }

  return runBuildsAggregate(params, key);
}

// GET /heroes/:id/builds — builds com win rate + ícones (lane OBRIGATÓRIA, API 422 sem lane)
export async function heroBuildsRoute(sp, id) {
  const rank = sp.get("rank") ?? "mythic";
  if (!isRank(rank)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank", ranks: RANKS } };
  const laneRaw = sp.get("lane");
  const chk = requireLane(laneRaw);
  if (chk.ok === false) return { status: 422, body: { error: "lane_required", message: "Lane query param is required", allowed: chk.allowed, hint: "use ?lane=exp|mid|roam|jungle|gold (no silent default)" } };
  const lane = chk.lane;
  const key = `builds:v4:${id}:${rank}:${lane}`;
  const hit = cacheGet(key, "C");
  if (hit.hit && !hit.stale) return { status: 200, body: { ...hit.body, stale: false } };
  let raw = null;
  let eqMap = {};
  let emblemMap = {};
  try {
    [raw, eqMap, emblemMap] = await Promise.all([
      arenaGet(`/api/academy/heroes/${id}/builds?lane=${lane}&rank=${rank}&size=6&index=1`),
      equipmentMap(),
      emblemCatalog(),
    ]);
  } catch (e) {
    return { status: 502, body: { error: "upstream_unavailable", message: "Upstream unavailable", detail: String(e?.message ?? e).slice(0, 200) } };
  }
  const recs = raw?.data?.records ?? [];
  if (!recs.length) return { status: 502, body: { error: "upstream_unavailable", message: "Upstream unavailable, try again" } };
  // Forma real da fonte: rec.data.build[] cada um com {build_win_rate, build_pick_rate, equipid[], emblem, battleskill}
  const flat = recs.flatMap((r) => (r?.data?.build ?? []).map((b) => ({ b, heroName: r?.data?.hero_name ?? null })));
  if (!flat.length) return { status: 502, body: { error: "no_builds_for_lane", message: "No builds for this lane" } };
  const base = flat.map(({ b }) => ({ win: Number(b?.build_win_rate), pick: Number(b?.build_pick_rate) }));
  const refs = buildReferences(base);
  const refMost = Number(refs.mostUsed?.win), refMean = Number(refs.heroMean);
  const data = flat.map(({ b }) => {
    const win = Number(b?.build_win_rate), pick = Number(b?.build_pick_rate);
    const liftMost = buildLift({ win, refWin: refMost, hasSupport: Number.isFinite(win) && Number.isFinite(refMost), refKind: "mais-usada" });
    const liftMean = buildLift({ win, refWin: refMean, hasSupport: Number.isFinite(win) && Number.isFinite(refMean), refKind: "media-do-heroi" });
    const eq = Array.isArray(b?.equipid) ? b.equipid : [];
    const talentIds = (Array.isArray(b?.new_rune_skill) ? b.new_rune_skill : Array.isArray(b?.rune_skill) ? b.rune_skill : [])
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v));
    const talents = talentIds.map((tid) => {
      const t = emblemMap[tid];
      return { id: tid, name: t?.name ?? null, tier: t?.tier ?? null, desc: t?.desc ?? null, icon: t?.icon ?? null };
    });
    const emblemData = b?.emblem?.data && typeof b.emblem.data === "object" ? b.emblem.data : {};
    const emblemRawId = emblemData?.emblemid ?? b?.runeid;
    const emblemId = emblemRawId != null && Number.isFinite(Number(emblemRawId)) ? Number(emblemRawId) : null;
    const emblemName = emblemData?.emblemname ?? emblemData?.name ?? null;
    const emblemIcon = emblemData?.attriicon ?? emblemData?.emblemicon ?? null;
    return {
      win: b?.build_win_rate ?? null, pick: b?.build_pick_rate ?? null,
      lift_raw: liftMost.lift_raw, lift_vs_most_used: liftMost.lift_raw, lift_vs_mean: liftMean.lift_raw,
      lift_adjusted: null, adjusted_association: null, causal_build_lift: null,
      reference_win: Number.isFinite(refMost) ? refMost : null, reference_kind: "mais-usada",
      references: { most_used_win: Number.isFinite(refMost) ? refMost : null, hero_mean_win: Number.isFinite(refMean) ? refMean : null },
      uncertainty_method: null, causal_status: "nao-avaliado",
      exposure_status: "unvalidated", classification_status: liftMost.classification_status,
      spell: b?.battleskill?.data ? { name: b.battleskill.data.skillname ?? null, icon: b.battleskill.data.skillicon ?? null } : null,
      emblem: emblemId == null && !emblemName
        ? null
        : { id: emblemId, name: emblemName, icon: emblemIcon },
      talents,
      items: eq.slice(0, 6).map((eid) => ({ id: eid, name: eqMap[eid]?.name ?? null, icon: eqMap[eid]?.icon ?? null })),
    };
  });
  const body = { id: Number(id), rank, lane, data, references: refs, audit_status: "audit_pending", note: "L(b,h,c)=WR−WR_ref. Camada A (bruto) vs mais-usada e média; ajustado/causal NULL sem dados por partida" };
  cacheSet(key, body);
  return { status: 200, body: { ...body, stale: false } };
}
