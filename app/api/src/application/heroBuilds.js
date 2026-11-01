// Builds de um herói por lane/rank — orquestração + normalização do payload.
//
// Extraído de `routes/builds.js` (Problema 4 da auditoria): a rota passa a ser
// só borda HTTP e a transformação de payload (66+ linhas) ganha dono em
// `application/`. Fábrica com DI (Problema 3): gateway e cache entram por
// parâmetro. `normalizeHeroBuilds` é pura e testável.
import { buildLift, buildReferences } from "@radar/engine";

// Forma real da fonte: rec.data.build[] cada um com
// {build_win_rate, build_pick_rate, equipid[], emblem, battleskill}.
// Devolve `{ data, references }` ou `null` quando não há builds para a lane.
export function normalizeHeroBuilds(recs, { eqMap = {}, emblemMap = {} } = {}) {
  const flat = recs.flatMap((r) => (r?.data?.build ?? []).map((b) => ({ b, heroName: r?.data?.hero_name ?? null })));
  if (!flat.length) return null;
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
    // Feitiço: a fonte entrega ora plano (data.skillname), ora aninhado (data.__data.skillname).
    const spellData = b?.battleskill?.data && typeof b.battleskill.data === "object" ? b.battleskill.data : {};
    const spellInner = spellData.__data && typeof spellData.__data === "object" ? spellData.__data : {};
    const spellName = spellData.skillname ?? spellInner.skillname ?? null;
    const spellIcon = spellData.skillicon ?? spellInner.skillicon ?? null;
    const spell = spellName || spellIcon ? { name: spellName, icon: spellIcon } : null;
    return {
      win: b?.build_win_rate ?? null, pick: b?.build_pick_rate ?? null,
      lift_raw: liftMost.lift_raw, lift_vs_most_used: liftMost.lift_raw, lift_vs_mean: liftMean.lift_raw,
      lift_adjusted: null, adjusted_association: null, causal_build_lift: null,
      reference_win: Number.isFinite(refMost) ? refMost : null, reference_kind: "mais-usada",
      references: { most_used_win: Number.isFinite(refMost) ? refMost : null, hero_mean_win: Number.isFinite(refMean) ? refMean : null },
      uncertainty_method: null, causal_status: "nao-avaliado",
      exposure_status: "unvalidated", classification_status: liftMost.classification_status,
      spell,
      emblem: emblemId == null && !emblemName
        ? null
        : { id: emblemId, name: emblemName, icon: emblemIcon },
      talents,
      items: eq.slice(0, 6).map((eid) => ({ id: eid, name: eqMap[eid]?.name ?? null, icon: eqMap[eid]?.icon ?? null })),
    };
  });
  return { data, references: refs };
}

/**
 * @param {{ arena: { getHeroBuilds: Function }, cacheStore: { cacheGet: Function, cacheSet: Function }, catalogs: { equipmentMap: Function, emblemCatalog: Function } }} deps
 */
export function createHeroBuilds({ arena, cacheStore, catalogs }) {
  const { cacheGet, cacheSet } = cacheStore;

  // GET /heroes/:id/builds — builds com win rate + ícones (lane já validada pela rota).
  async function get(id, rank, lane) {
    const key = `builds:v5:${id}:${rank}:${lane}`;
    const hit = cacheGet(key, "C");
    if (hit.hit && !hit.stale) return { status: 200, body: { ...hit.body, stale: false } };

    let raw = null;
    let eqMap = {};
    let emblemMap = {};
    try {
      [raw, eqMap, emblemMap] = await Promise.all([
        arena.getHeroBuilds({ id, lane, rank }),
        catalogs.equipmentMap(),
        catalogs.emblemCatalog(),
      ]);
    } catch (e) {
      return { status: 502, body: { error: "upstream_unavailable", message: "Upstream unavailable", detail: String(e?.message ?? e).slice(0, 200) } };
    }
    const recs = raw?.data?.records ?? [];
    if (!recs.length) return { status: 502, body: { error: "upstream_unavailable", message: "Upstream unavailable, try again" } };
    const normalized = normalizeHeroBuilds(recs, { eqMap, emblemMap });
    if (!normalized) return { status: 502, body: { error: "no_builds_for_lane", message: "No builds for this lane" } };

    const body = {
      id: Number(id), rank, lane,
      data: normalized.data,
      references: normalized.references,
      audit_status: "audit_pending",
      note: "L(b,h,c)=WR−WR_ref. Camada A (bruto) vs mais-usada e média; ajustado/causal NULL sem dados por partida",
    };
    cacheSet(key, body);
    return { status: 200, body: { ...body, stale: false } };
  }

  return { get };
}
