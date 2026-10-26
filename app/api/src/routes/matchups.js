// Confrontos (counters/sinergias) e o proxy BPS derivado deles.
// O δ é efeito do par, nunca veredito; par ausente = desconhecido, nunca 0.
import { getCounters, getCompatibility, RANKS } from "../providers/arena/index.js";
import { cacheGet, cacheSet } from "../infra/cacheStore.js";
import {
  durationCurve, classifyDuration, makePairKey, evidenceQuality, blindProxy,
} from "@radar/proprietary-engine";
import { isRank, isWindow, WINDOWS } from "../application/validation.js";
import { catalogMap } from "../application/catalogs.js";

function pairRow(s, cat, rel = "counter", heroId = 0) {
  const id = Number(s.heroid);
  if (!Number.isFinite(id)) return null;
  const curve = durationCurve(s);
  const pair_key = makePairKey(heroId, id, rel);
  const ev = evidenceQuality({ coverage: "extremes", stable: null, hetero: null });
  const rawDelta = Number(s.increase_win_rate);
  const delta = Number.isFinite(rawDelta) ? rawDelta : null; // par sem δ = NULL, nunca 0/NaN (INV-102)
  const rawWin = Number(s.hero_win_rate);
  return {
    id, name: cat[id]?.name ?? `Hero ${id}`, head: s?.hero?.data?.head ?? cat[id]?.head ?? null,
    delta, effect_raw: delta,
    effect_unit_status: "pp_hypothesis_strong", effect_direction: rel === "counter" ? "vantagem-do-avaliado" : "vantagem-com-aliado",
    pair_key, relationship_type: rel, coverage_status: "extremes-only",
    win: Number.isFinite(rawWin) ? rawWin : null, pick: Number.isFinite(Number(s.hero_appearance_rate)) ? Number(s.hero_appearance_rate) : null,
    curve, profile: classifyDuration(curve),
    evidence_quality: ev.quality, evidence_reasons: ev.reasons,
    exposure_status: "unvalidated", interval_status: "indisponivel", causal_status: "nao-avaliado",
  };
}

// GET /heroes/:id/matchups — counters + sinergias com δ, retratos e curva de duração
export async function matchupsRoute(sp, id) {
  const rank = sp.get("rank") ?? "mythic", days = Number(sp.get("days") ?? sp.get("window") ?? 7);
  if (!isRank(rank) || !isWindow(days)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank or days", ranks: RANKS, windows: [...WINDOWS] } };
  const key = `matchups:${id}:${rank}:${days}`;
  const hit = cacheGet(key, "C");
  if (hit.hit && !hit.stale) return { status: 200, body: { ...hit.body, stale: false } };
  const [ct, cp, cat] = await Promise.all([
    getCounters({ id, rank, days }).catch(() => null),
    getCompatibility({ id, rank, days }).catch(() => null),
    catalogMap(),
  ]);
  const c0 = ct?.data?.records?.[0]?.data ?? {};
  const p0 = cp?.data?.records?.[0]?.data ?? {};
  const body = {
    id: Number(id), rank, days,
    hero: { name: c0?.main_hero?.data?.name ?? p0?.main_hero?.data?.name ?? `Hero ${id}`, head: c0?.main_hero?.data?.head ?? p0?.main_hero?.data?.head ?? null },
    // Semântica de increase_win_rate em quarentena (Fase 0 item 2): exibido como efeito δ com aviso
    countersUp: (c0.sub_hero ?? []).map((s) => pairRow(s, cat, "counter", Number(id))).filter(Boolean),
    countersDown: (c0.sub_hero_last ?? []).map((s) => pairRow(s, cat, "counter", Number(id))).filter(Boolean),
    synergiesUp: (p0.sub_hero ?? []).map((s) => pairRow(s, cat, "teammate", Number(id))).filter(Boolean),
    synergiesDown: (p0.sub_hero_last ?? []).map((s) => pairRow(s, cat, "teammate", Number(id))).filter(Boolean),
    semanticsNote: "Direção do increase_win_rate em validação (Fase 0). δ = efeito do par, não veredito. Par ausente = desconhecido, nunca 0.",
  };
  if (!body.countersUp.length && !body.synergiesUp.length) return { status: 502, body: { error: "upstream_unavailable", message: "Upstream unavailable, try again" } };
  cacheSet(key, body);
  return { status: 200, body: { ...body, stale: false } };
}

// GET /heroes/:id/blind?rank=&days= — BPS proxy sobre δ elegíveis
export async function blindRoute(sp, id) {
  const rank = sp.get("rank") ?? "mythic", days = Number(sp.get("days") ?? sp.get("window") ?? 7);
  if (!isRank(rank) || !isWindow(days)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank or days", ranks: RANKS, windows: [...WINDOWS] } };
  const key = `matchups:${id}:${rank}:${days}`;
  const hit = cacheGet(key, "C");
  let body = hit.hit ? hit.body : null;
  if (!body) {
    const r = await matchupsRoute(new URLSearchParams({ rank, days: String(days) }), id);
    if (r.status !== 200) return r;
    body = r.body;
  }
  const deltas = [...(body.countersUp ?? []), ...(body.countersDown ?? [])].map((p) => p.delta).filter(Number.isFinite);
  const proxy = blindProxy(deltas);
  const worst = [...(body.countersDown ?? []), ...(body.countersUp ?? [])].filter((p) => Number.isFinite(p.delta)).sort((a, b) => a.delta - b.delta)[0] ?? null;
  return { status: 200, body: { id: Number(id), rank, days, ...proxy, pair_coverage: "extremes-only", worst_counter: worst ? { id: worst.id, name: worst.name, delta: worst.delta, pair_key: worst.pair_key } : null, worst_observed: proxy.worst_observed } };
}
