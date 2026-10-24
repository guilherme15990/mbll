// Agregado de builds (sistema) — B0–B5.
// Cache derivado C 24 h + SWR. Fan-out limitado: 4 catálogos + páginas de rank
// + 1 request por herói do top-N (máx. 20). Computações serializadas para não
// somar rajadas de lanes/ranks diferentes.
import { arenaGet, mapConc } from "../arena.js";
import { cacheGet, cacheSet, payloadHash } from "../cache.js";
import { scoreLot } from "./scoring.js";
import { fetchRankAll, lastVerifiedPosterior, lanesFromRoadsort } from "./rankLot.js";
import { currentGameVersion } from "./versions.js";
import {
  buildAggregate,
  normalizeEquipmentCatalog,
  normalizeEmblemCatalog,
  normalizeSpellCatalog,
} from "../../../../packages/proprietary-engine/src/index.js";

export const AGG_TOP_VALUES = new Set([10, 20]);
const AGG_INTERACTIVE_LIMIT = 30;
let aggChain = Promise.resolve();
const aggInFlight = new Map();

function aggEnqueue(fn) {
  const run = aggChain.then(fn, fn);
  aggChain = run.catch(() => {});
  return run;
}

async function aggCatalog(key, path, normalize) {
  const hit = cacheGet(key, "C");
  if (hit.hit) return { data: hit.body ?? {}, stale: !!hit.stale, ageMs: hit.ageMs ?? 0, source: "cache" };
  const raw = await arenaGet(path, { retries: 1, timeoutMs: 7000 });
  const data = normalize(raw?.data?.records ?? raw?.data ?? []);
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
  const raw = await arenaGet("/api/heroes/positions?size=200&index=1", { retries: 1, timeoutMs: 7000 });
  const data = aggParsePositions(raw?.data?.records ?? []);
  if (!Object.keys(data).length) throw new Error("positions_empty");
  cacheSet("positions:v1", data);
  return { data, stale: false, ageMs: 0, source: "upstream" };
}

async function aggRankRows(rank, window, top) {
  try {
    const f = await fetchRankAll({
      days: window, rank, retries: 1,
      timeoutMs: top <= 10 ? 6000 : 9000,
    });
    const { scored } = scoreLot(f.rows, { prior: f.prior ?? null, gameVersion: f.gameVersion ?? null });
    return {
      rows: scored,
      stale: !!f.stale,
      ageMs: f.ageMs ?? 0,
      source: f.fromCache ? "cache" : "upstream",
      pages: f.pages ?? 0,
    };
  } catch (e) {
    const hit = cacheGet(`rank:${rank}:${window}`, "A");
    if (hit.hit) {
      const { scored } = scoreLot(hit.body ?? [], {
        prior: lastVerifiedPosterior({ fonte: "heroes", rank, janela: window }),
        gameVersion: currentGameVersion(),
      });
      return { rows: scored, stale: true, ageMs: hit.ageMs ?? 0, source: "stale", pages: 0 };
    }
    throw new Error(`rank_unavailable:${String(e?.message ?? e).slice(0, 120)}`);
  }
}

function aggFlattenBuilds(records) {
  const out = [];
  for (const rec of records ?? []) {
    const builds = rec?.data?.build;
    if (Array.isArray(builds)) {
      for (const b of builds) if (b && typeof b === "object") out.push(b);
    }
  }
  return out;
}

async function aggRawBuilds(id, rank, lane, deadline, timeoutMs) {
  const key = `builds:raw:v1:${id}:${rank}:${lane}`;
  const hit = cacheGet(key, "C");
  if (hit.hit) {
    return { id, records: hit.body?.records ?? [], cached: true, stale: !!hit.stale, ageMs: hit.ageMs ?? 0 };
  }
  if (Date.now() >= deadline) {
    return { id, records: [], cached: false, error: "deadline_exceeded", ageMs: 0 };
  }
  try {
    const raw = await arenaGet(`/api/academy/heroes/${id}/builds?lane=${lane}&rank=${rank}&size=6&index=1`, {
      retries: 1, timeoutMs,
    });
    const records = raw?.data?.records ?? [];
    cacheSet(key, { records });
    return { id, records, cached: false, stale: false, ageMs: 0 };
  } catch (e) {
    return {
      id, records: [], cached: false, ageMs: 0,
      error: "upstream_unavailable",
      detail: String(e?.message ?? e).slice(0, 160),
    };
  }
}

async function computeBuildsAggregate({ rank, lane, window, top, population }) {
  const startedAt = Date.now();
  // Deadline é da FASE DE BUILDS, não da carga inteira. Prep fria (positions + rank
  // + catálogos) pode passar de 6 s; se o deadline nascer no request, todo o
  // fan-out de builds nasce vencido e a página vira 200 com partial=true e 10 células em erro.
  const perReqTimeout = top <= 10 ? 7000 : 9000;
  const buildDeadlineMs = top <= 10 ? 6000 : 9000;
  const requests = { positions: 0, rank: 0, equipment: 0, emblems: 0, spells: 0, builds: 0 };
  const cacheHits = { positions: 0, rank: 0, equipment: 0, emblems: 0, spells: 0, builds: 0 };

  // Posições e rank em paralelo (1 + até 3 requests, teto global 4).
  // Sem isso, a fase de preparação sozinha consumia o deadline dos builds.
  const [pos, rankRes] = await Promise.all([
    aggPositions(),
    aggRankRows(rank, window, top),
  ]);
  requests.positions += pos.source === "cache" ? 0 : 1;
  cacheHits.positions += pos.source === "cache" ? 1 : 0;
  requests.rank += rankRes.source === "cache" ? 0 : (rankRes.pages || 3);
  cacheHits.rank += rankRes.source === "cache" ? 1 : 0;

  // Catálogos em paralelo (3 requests frios). Falha de catálogo degrada o recorte,
  // não derruba a página: nome/arquétipo viram null/unclassified, e o aviso viaja.
  const [eq, em, sp] = await Promise.all([
    aggCatalog("equipment:expanded:v1", "/api/academy/equipment/expanded?size=200&index=1", normalizeEquipmentCatalog).catch(() => null),
    aggCatalog("emblems:v1", "/api/academy/emblems?size=200&index=1", normalizeEmblemCatalog).catch(() => null),
    aggCatalog("spells:v1", "/api/academy/spells?size=200&index=1", normalizeSpellCatalog).catch(() => null),
  ]);
  for (const [name, c] of [["equipment", eq], ["emblems", em], ["spells", sp]]) {
    if (!c) continue;
    requests[name] += c.source === "cache" ? 0 : 1;
    cacheHits[name] += c.source === "cache" ? 1 : 0;
  }

  const positions = pos.data ?? {};
  const laneIds = new Set();
  for (const h of Object.values(positions)) {
    if (Array.isArray(h?.lanes) && h.lanes.includes(lane)) laneIds.add(Number(h.id));
  }

  const ranked = rankRes.rows.filter((h) => laneIds.has(h.id));
  ranked.sort((a, b) =>
    ((b.wrAdj ?? -Infinity) - (a.wrAdj ?? -Infinity)) ||
    ((b.z ?? -Infinity) - (a.z ?? -Infinity)) ||
    a.id - b.id
  );
  const roster = ranked.slice(0, top);

  const prepMs = Date.now() - startedAt;
  const buildStartedAt = Date.now();
  const deadline = buildStartedAt + buildDeadlineMs;
  const fetched = await mapConc(
    roster,
    (h) => aggRawBuilds(h.id, rank, lane, deadline, perReqTimeout),
    4
  );
  for (const f of fetched) {
    if (f.cached) cacheHits.builds++;
    else if (!f.error) requests.builds++;
    else if (f.error === "upstream_unavailable") requests.builds++;
  }

  const contexts = roster.map((h, i) => {
    const f = fetched[i] ?? { records: [], cached: false, ageMs: 0 };
    const rawBuilds = aggFlattenBuilds(f.records);
    const status = f.error ? "error" : rawBuilds.length ? "ok" : "empty";
    return {
      hero: {
        id: h.id, name: h.name, head: h.head, tier: h.tier,
        wrAdj: h.wrAdj ?? null, win: h.win ?? null, pick: h.pick ?? null, ban: h.ban ?? null,
      },
      rawBuilds,
      status,
      error: f.error ?? null,
      detail: f.detail ?? null,
      stale: !!f.stale || !!rankRes.stale || !!pos.stale,
      ageMs: f.ageMs ?? null,
    };
  });

  const equipment = eq?.data ?? {};
  const emblems = em?.data ?? {};
  const spells = sp?.data ?? {};
  const buildsErrors = fetched.filter((f) => f.error).length;
  const buildsEmpty = fetched.filter((f) => !f.error && !aggFlattenBuilds(f.records).length).length;
  const buildsCached = fetched.filter((f) => f.cached).length;

  const coverage = {
    heroes_in_lane: laneIds.size,
    heroes_with_rank: ranked.length,
    heroes_requested: roster.length,
    items_cataloged: Object.keys(equipment).length,
    items_unclassified: Object.values(equipment).filter((i) => i?.archetype === "unclassified").length,
    positions_source: pos.source,
    positions_stale: !!pos.stale,
    rank_source: rankRes.source,
    rank_stale: !!rankRes.stale,
    catalog_errors: { equipment: !eq, emblems: !em, spells: !sp },
    builds_cached: buildsCached,
    builds_fetched: requests.builds,
    builds_error: buildsErrors,
    builds_empty: buildsEmpty,
  };

  const buildHashSource = roster.map((h, i) => ({
    hero_id: h.id,
    records: fetched[i]?.records ?? null,
    error: fetched[i]?.error ?? null,
  }));
  const sources = {
    population,
    endpoints: {
      builds: "/api/academy/heroes/:id/builds?lane=&rank=",
      positions: "/api/heroes/positions?size=200",
      equipment: "/api/academy/equipment/expanded?size=200",
      emblems: "/api/academy/emblems?size=200",
      spells: "/api/academy/spells?size=200",
    },
    requests: {
      ...requests,
      total: Object.values(requests).reduce((s, n) => s + n, 0),
      cache_hits: cacheHits,
      interactive_limit: AGG_INTERACTIVE_LIMIT,
      cold_budget: 4 + 3 + roster.length,
    },
    budget: {
      depth: top <= 10 ? "top10" : "top20",
      deadline_ms: buildDeadlineMs,
      deadline_scope: "build_phase",
      prep_ms: prepMs,
      concurrency: 4,
      retry: 1,
      prefetch: false,
    },
    builds_hash: payloadHash(buildHashSource),
    catalogs_hash: payloadHash({ equipment, emblems, spells, positions }),
    positions_source: pos.source,
    rank_source: rankRes.source,
    catalog_sources: {
      equipment: eq?.source ?? "error",
      emblems: em?.source ?? "error",
      spells: sp?.source ?? "error",
    },
    notes: [
      "Custo frio = 4 catálogos + páginas de rank + 1 request por herói do top-N.",
      "Cache derivado C 24 h; quente = 0 requests.",
      "Deadline de 6 s (top-10) / 9 s (top-20) vale só para o fan-out de builds; prep não o consome.",
      "window afeta apenas a ordem dos heróis; builds não têm janela na fonte.",
    ],
  };

  const body = buildAggregate({
    lane, rank, window, top, population,
    contexts,
    equipment,
    emblems,
    spells,
    coverage,
    sources,
    generatedAt: new Date().toISOString(),
  });

  body.context.cache_hit = false;
  body.context.deadline_ms = buildDeadlineMs;
  body.context.deadline_scope = "build_phase";
  body.context.prep_ms = prepMs;
  body.context.build_ms = Date.now() - buildStartedAt;
  body.context.elapsed_ms = Date.now() - startedAt;
  body.sources.cache = { hit: false, stale: false, age_ms: 0 };
  body.stale = false;

  // Revisão 2026-10-21: partial é sinal de corpo JSON agregado, não 206
  // (206 é para conteúdo parcial HTTP). Falha de uma célula não derruba a página.
  return { status: 200, body };
}

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

export function aggBackgroundRevalidate(key, params) {
  if (aggInFlight.has(key)) return;
  const run = aggEnqueue(() => computeBuildsAggregate(params))
    .then((out) => { cacheSet(key, out.body); return out; })
    .catch(() => null)
    .finally(() => { if (aggInFlight.get(key) === run) aggInFlight.delete(key); });
  aggInFlight.set(key, run);
}

// Executa (ou reaproveita) o fan-out do agregado. O dedupe por chave vive aqui,
// não na rota: duas abas na mesma lane não disparam dois fan-outs.
export async function runBuildsAggregate(params, key) {
  const pending = aggInFlight.get(key);
  if (pending) {
    try {
      const out = await pending;
      if (out?.body) {
        const h2 = cacheGet(key, "C");
        return { status: 200, body: withAggCacheMeta(out.body, h2.hit ? h2 : { ageMs: 0, stale: false }) };
      }
    } catch { /* segue para nova tentativa */ }
  }

  const run = aggEnqueue(() => computeBuildsAggregate(params));
  aggInFlight.set(key, run);
  try {
    const out = await run;
    cacheSet(key, out.body);
    return out;
  } catch (e) {
    const stale = cacheGet(key, "C");
    if (stale.hit) return { status: 200, body: withAggCacheMeta(stale.body, stale) };
    return { status: 502, body: { error: "upstream_unavailable", message: "Upstream unavailable, try again", detail: String(e?.message ?? e).slice(0, 200) } };
  } finally {
    if (aggInFlight.get(key) === run) aggInFlight.delete(key);
  }
}
