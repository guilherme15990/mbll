// Rotas Fase 1 sem framework (node:http). Zero dependências.
// router(path, searchParams) -> { status, body }
import { arenaGet, rankPath, mapConc, RANKS } from "./arena.js";
import { cacheGet, cacheSet, cacheStats, recordSnapshot, listSnapshots, getSnapshot, historyStats, payloadHash } from "./cache.js";
import { durationCurve, classifyDuration, checkPickSum, makePairKey, evidenceQuality, confidenceTrio, rankDifference, temporalDelta, assessSeries, distortionResidual, blindProxy, buildLift, buildReferences, requireLane, C_REFERENCE, LANES, isValidWalkPrior, walkPriorStamp, summarizeWalkPosterior, median, scoreBatch, classOf, medianPickOf, medianBanOf, STRENGTH_INDEX_VERSION, buildAggregate, normalizeEquipmentCatalog, normalizeEmblemCatalog, normalizeSpellCatalog } from "../../../packages/proprietary-engine/src/index.js";

const startedAt = Date.now();
const layerHealth = { errors: 0, lastOk: null, lastErr: null };
let patchCache = { at: 0, versions: [] };

const WINDOWS = new Set([1, 3, 7, 15, 30]);

function qHeroes(sp) {
  const rank = sp.get("rank") ?? "mythic";
  const window = Number(sp.get("window") ?? 7);
  const sort = sp.get("sort") ?? "d";
  const order = sp.get("order") ?? "desc";
  const size = Math.min(133, Math.max(1, Number(sp.get("size") ?? 50) || 50));
  const index = Math.max(1, Number(sp.get("index") ?? 1) || 1);
  const cls = sp.get("class") ?? undefined;
  if (!RANKS.includes(rank)) return { error: "rank_invalid", message: "Invalid rank", ranks: RANKS };
  if (!WINDOWS.has(window)) return { error: "window_invalid", message: "Invalid window", windows: [...WINDOWS] };
  if (!["d", "win", "pick", "ban", "q"].includes(sort)) return { error: "sort_invalid", message: "Invalid sort" };
  if (!["asc", "desc"].includes(order)) return { error: "order_invalid", message: "Invalid order" };
  return { rank, window, sort, order, size, index, class: cls };
}

function normalize(rec) {
  const d = rec?.data ?? rec;
  if (d == null) return null;
  // EC-002: Number(null)===0 criaria herói fantasma; rejeita nulo/ausente antes de converter
  for (const k of ["main_hero_win_rate", "main_hero_ban_rate"]) {
    if (d[k] == null || d[k] === "") return null;
  }
  if (d.main_hero_appearance_rate == null && d.main_hero_pick_rate == null) return null;
  const id = Number(d.main_heroid ?? d.heroid);
  const win = Number(d.main_hero_win_rate);
  const pick = Number(d.main_hero_appearance_rate ?? d.main_hero_pick_rate);
  const ban = Number(d.main_hero_ban_rate);
  if (!Number.isFinite(id)) return null;
  if ([win, pick, ban].some((v) => !Number.isFinite(v) || v < 0 || v > 1)) return null; // INV-001
  return { id, name: d?.main_hero?.data?.name ?? `Hero ${id}`, head: d?.main_hero?.data?.head ?? null, win, pick, ban };
}

// (helpers median/pctRank/tierOf/pFromZ/bh locais DELETADOS — vivem no motor: utils + strength-index + tierOf.)

// Versão do jogo reaproveitando o cache de patches (sem fetch novo ao upstream).
function currentGameVersion() {
  try {
    const vd = patchCache.versions?.[0]?.data ?? patchCache.versions?.[0] ?? {};
    return String(vd.version ?? vd.versao ?? vd.tag ?? vd.created_at ?? vd.createdAt ?? "desconhecida");
  } catch { return "desconhecida"; }
}

async function fetchRankAll({ days, rank, retries = 3, timeoutMs = 12000 }) {
  const key = `rank:${rank}:${days}`;
  const hit = cacheGet(key, "A");
  if (hit.hit && !hit.stale) {
    // Cache quente: sem nova gravação ⇒ ler o prior da série é seguro (sem auto-prior).
    const vg = currentGameVersion();
    const prior = lastVerifiedPosterior({ fonte: "heroes", rank, janela: days });
    return { rows: hit.body, ageMs: hit.ageMs, stale: false, fromCache: true, pages: 0, truncated: false, totalFonte: hit.body.length, prior, gameVersion: vg };
  }
  const first = await arenaGet(rankPath({ days, rank, size: 50, index: 1 }), { retries, timeoutMs });
  const total = Number(first?.data?.total ?? 0) || 0;
  // SEC M-02/EC-001: total vem da fonte; teto de 6 páginas (~300 registros, cobre os ~133 heróis)
  const pages = Math.min(6, Math.max(1, Math.ceil(total / 50)));
  const truncated = total > pages * 50;
  const rest = await mapConc(Array.from({ length: pages - 1 }, (_, k) => k + 2),
    (idx) => arenaGet(rankPath({ days, rank, size: 50, index: idx }), { retries, timeoutMs }));
  const recs = [first, ...rest].flatMap((p) => p?.data?.records ?? []);
  const rows = recs.map(normalize).filter(Boolean);
  // ADR-021-09 / DDD-V4-05: hook append-only — todo lote válido gravado no histórico (INSERT, nunca REPLACE).
  // L2 (violado ENTRA marcado): snapshot violado entra com status "violado"+motivo para auditoria
  // C-101/C-102 e comparação C-105; consumo analítico (T5) usa só "verificado". Excluir = proibido.
  // O histórico nunca quebra a coleta; versão do jogo reaproveita o cache de patches (sem fetch novo).
  // ADR-023: prior = último VERIFICADO da mesma série (carregado ANTES de inserir o atual,
  // senão o lote viraria prior de si mesmo); o posterior do lote corrente vai como
  // apêndice p/ a rodada seguinte (L2-WF-04). Só "verificado" alimenta o prior; violado
  // entra marcado mas nunca como prior.
  const vg = currentGameVersion();
  const chk = checkPickSum(rows.map((h) => h.pick));
  const prior = chk.ok ? lastVerifiedPosterior({ fonte: "heroes", rank, janela: days }) : null;
  let posterior = null;
  try {
    if (chk.ok) {
      const wins = rows.filter((x) => x && Number.isFinite(x.win)).map((x) => x.win);
      const muB = median(wins);
      const madB = median(wins.map((x) => Math.abs(x - muB)).sort((a, b) => a - b)) || 1e-6;
      const tB = 1.4826 * madB;
      posterior = summarizeWalkPosterior({ muBatch: muB, tau2Batch: tB * tB, nBatch: wins.length, prior, gameVersion: vg });
    }
  } catch { posterior = null; }
  try {
    recordSnapshot({
      fonte: "heroes", rank, janela: days,
      versao_jogo: vg,
      rows, status: chk.ok ? "verificado" : "violado", motivo: chk.ok ? null : `sigma_pick:${chk.sum}`,
      posterior,
    });
  } catch { /* histórico nunca quebra a coleta */ }
  cacheSet(key, rows);
  // EC-010: refetch OK renova a idade; stale só quando servimos dado velho
  return { rows, ageMs: 0, stale: false, fromCache: false, pages, truncated, totalFonte: total, prior, gameVersion: vg, posterior };
}

// Lane-por-herói a partir da fonte viva (verificado contra dado real em 2026-10-10,
// via arenaGet em dev sobre ~40 hero_ids; só estes 5 títulos existem na fonte):
//   'Exp Lane' (road_sort_id 1) -> exp · 'Mid Lane' (2) -> mid · 'Roam' (3) -> roam
//   'Jungle' (4) -> jungle · 'Gold Lane' (5) -> gold
// Forma: GET /api/academy/heroes/{id}/lane -> records[].data.hero.data.roadsort[],
// cada entrada com data {road_sort_id, road_sort_title, road_sort_icon}
// (a lista traz ainda uma entrada "" vazia por herói — ignorada).
// Título fora da tabela = herói SEM lane (aparece sem filtro, nunca sob lane errada).
export const ROAD_SORT_TO_LANE = {
  "exp lane": "exp",
  "mid lane": "mid",
  "roam": "roam",
  "jungle": "jungle",
  "gold lane": "gold",
};

// roadsort[] (bruto da fonte) -> { lanes, unknown }.
// Pura e testável: nunca inventa lane; título desconhecido vai p/ `unknown`.
export function lanesFromRoadsort(roadsort) {
  const lanes = [];
  const unknown = [];
  for (const entry of roadsort ?? []) {
    const title = entry?.data?.road_sort_title;
    if (typeof title !== "string" || !title.trim()) continue;
    const lane = ROAD_SORT_TO_LANE[title.trim().toLowerCase()];
    if (lane) {
      if (!lanes.includes(lane)) lanes.push(lane);
    } else if (!unknown.includes(title)) {
      unknown.push(title);
    }
  }
  return { lanes, unknown };
}

// ADR-023: último posterior VERIFICADO da série (mesmo fonte+rank+janela) vira o prior.
// Leitura local do SnapshotHistory (sem fetch ao upstream). Sem histórico/posterior ⇒ null (flat).
export function lastVerifiedPosterior({ fonte = "heroes", rank, janela } = {}) {
  try {
    const serie = listSnapshots({ fonte, rank, janela, limit: 1000 });
    for (let i = serie.length - 1; i >= 0; i--) {
      const s = serie[i];
      if (s.status !== "verificado") continue; // T5/analítico: só verificado alimenta prior
      if (isValidWalkPrior(s.posterior)) return s.posterior;
      return null; // verificado sem apêndice (pré-023) ⇒ flat honesto, sem herdar adiante
    }
  } catch { /* sem histórico ⇒ flat */ }
  return null;
}

// ── Agregado de builds (sistema) — B0–B5 ──────────────────────────────────
// Cache derivado C 24 h + SWR. Fan-out limitado: 4 catálogos + páginas de rank
// + 1 request por herói do top-N (máx. 20). Computações serializadas para não
// somar rajadas de lanes/ranks diferentes.
const AGG_TOP_VALUES = new Set([10, 20]);
const AGG_INTERACTIVE_LIMIT = 30;
let aggChain = Promise.resolve();
const aggInFlight = new Map();
let emblemsInFlight = null;

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

function withAggCacheMeta(body, hit) {
  const ageMs = hit?.ageMs ?? 0;
  const stale = !!hit?.stale;
  return {
    ...body,
    stale,
    context: { ...(body.context ?? {}), stale, age_ms: ageMs, cache_hit: true },
    sources: { ...(body.sources ?? {}), cache: { hit: true, stale, age_ms: ageMs } },
  };
}

function aggBackgroundRevalidate(key, params) {
  if (aggInFlight.has(key)) return;
  const run = aggEnqueue(() => computeBuildsAggregate(params))
    .then((out) => { cacheSet(key, out.body); return out; })
    .catch(() => null)
    .finally(() => { if (aggInFlight.get(key) === run) aggInFlight.delete(key); });
  aggInFlight.set(key, run);
}

// ── Motor de heróis: delega ao @radar/proprietary-engine (scoreBatch). ──
// A cópia local de score() foi DELETADA; o fio é preservado por arredondamento NA BORDA
// (exatamente os mesmos campos/casas de antes: wrAdj 4, z 2, q 4, B 3 — valores do fio idênticos;
// posterior_mean/IC/prob passam crus, como antes).
// DESVIO (a): posterior_mean PERMANECE no topo (CONTRATO manda p/ debug, mas a ConfiancaSection
// EXIBE posterior+trio por exigência do PRD — sem ele a aba quebra).
// DESVIO (b): z PERMANECE no topo (computado de graça p/ q; views/semana/gems ordenam por ele).
// DESVIO (c): d SAIU do motor (era afim crescente de θ̂; sorts passam a wrAdj — ordem idêntica,
// provada em hero.test.js "DESVIO (c)"). class virou classOf() (trust.js) — a UI deriva; o fio não o carrega mais.
export function scoreLot(rawRows, opts = {}) {  const { heroes, meta } = scoreBatch(rawRows, opts);
  // V2 §5.3/EC-007: nulos do motor (smallSample → q/index null; sem-exposição →
  // wrAdj/z null) atravessam o fio como null — nunca 0, nunca crash (era TypeError).
  const scored = heroes.map((h) => ({
    ...h,
    wrAdj: h.wrAdj == null ? null : +h.wrAdj.toFixed(4),
    z: h.z == null ? null : +h.z.toFixed(2),
    q: h.q == null ? null : +h.q.toFixed(4),
    B: h.B == null ? null : +h.B.toFixed(3),
  }));
  // meta do lote direto do motor (substitui o lotMeta local — deletado); μ/τ arredondados
  // a 4 casas, mesmos valores do lotMeta antigo. Lote vazio: mu/tau null (honesto; antes 0).
  const wireMeta = {
    ...meta,
    mu: meta.mu == null ? meta.mu : +meta.mu.toFixed(4),
    tau: meta.tau == null ? meta.tau : +meta.tau.toFixed(4),
  };
  return { scored, meta: wireMeta };
}

export function score(rawRows, opts = {}) {
  return scoreLot(rawRows, opts).scored;
}

// (lotMeta local DELETADO — meta agora vem do scoreBatch, via scoreLot.)

async function versions() {
  if (Date.now() - patchCache.at < 3600e3 && patchCache.versions.length) return patchCache.versions;
  try {
    const v = await arenaGet(`/api/academy/meta/version?size=5&index=1`);
    patchCache = { at: Date.now(), versions: v?.data?.records ?? v?.data ?? [] };
  } catch { /* mantém */ }
  return patchCache.versions;
}

function patchFlag(vers) {  try {
    const dates = (vers ?? []).map((r) => new Date(r?.data?.created_at ?? r?.createdAt ?? r?.date ?? 0).getTime()).filter(Boolean);
    if (!dates.length) return { postPatch: false };
    const latest = Math.max(...dates);
    return { postPatch: Date.now() - latest < 3 * 86400e3, latest: new Date(latest).toISOString() };
  } catch { return { postPatch: false }; }
}

export function paginate(scored, q) {
  let out = scored;
  // class virou classOf(h) (trust.js) — o fio não carrega mais `class`.
  if (q.class) out = out.filter((h) => classOf(h) === q.class || (q.class === "Joia" && h.isGem));
  // sort=d é alias de wrAdj (d era afim crescente de θ̂ — mesma ordem; critic-017).
  // Views que querem significância ordenam por z explicitamente no próprio código.
  const key = q.sort === "win" || q.sort === "d" ? "wrAdj" : q.sort === "pick" ? "pick" : q.sort === "ban" ? "qBan" : q.sort === "q" ? "q" : "z";
  out = [...out].sort((a, b) => (q.order === "asc" ? a[key] - b[key] : b[key] - a[key]));
  return { data: out.slice((q.index - 1) * q.size, q.index * q.size), total: out.length };
}

export async function router(path, sp) {
  // GET /heroes
  if (path === "/heroes") {
    const q = qHeroes(sp);
    if (q.error) return { status: 400, body: q };
    try {
      const fetched = await fetchRankAll({ days: q.window, rank: q.rank });
      layerHealth.lastOk = new Date().toISOString();
      // ADR-023 L2-WF-01/WF-05: pontua com o prior da série; carimbo no payload.
      const { scored, meta } = scoreLot(fetched.rows, { prior: fetched.prior ?? null, gameVersion: fetched.gameVersion ?? null });
      const pickSum = checkPickSum(fetched.rows.map((h) => h.pick));
      const page = paginate(scored, q);
      const vers = await versions();
      return { status: 200, body: { data: page.data, total: page.total, rank: q.rank, window: q.window, collectedAgoMs: fetched.ageMs, stale: fetched.stale, truncated: !!fetched.truncated, totalFonte: fetched.totalFonte ?? page.total, pickSumCheck: pickSum, exposure: { unit: "slot_share", status: "unvalidated" }, meta, prior: walkPriorStamp(fetched.prior ?? null), index_basis: { method: STRENGTH_INDEX_VERSION, n: page.total }, ...patchFlag(vers) } };
    } catch (e) {
      layerHealth.errors++; layerHealth.lastErr = String(e?.message ?? e);
      const hit = cacheGet(`rank:${q.rank}:${q.window}`, "A");
      // EC-009: fallback aplica o mesmo filtro/ordem/página sobre o último dado válido
      if (hit.hit) {
        const fbPrior = lastVerifiedPosterior({ fonte: "heroes", rank: q.rank, janela: q.window });
        const fbGv = currentGameVersion();
        const fb = scoreLot(hit.body, { prior: fbPrior, gameVersion: fbGv });
        const page = paginate(fb.scored, q);
        return { status: 200, body: { data: page.data, total: page.total, stale: true, fallback: true, collectedAgoMs: hit.ageMs, rank: q.rank, window: q.window, pickSumCheck: checkPickSum((hit.body ?? []).map((h) => h.pick)), exposure: { unit: "slot_share", status: "unvalidated" }, meta: fb.meta, prior: walkPriorStamp(fbPrior), index_basis: { method: STRENGTH_INDEX_VERSION, n: page.total } } };
      }
      return { status: 502, body: { error: "upstream_unavailable", message: "Upstream unavailable, try again" } };
    }
  }
  // GET /heroes/:id
  let m = /^\/heroes\/(\d+)$/.exec(path);
  if (m) {
    const rank = sp.get("rank") ?? "mythic", window = Number(sp.get("window") ?? 7);
    if (!RANKS.includes(rank) || !WINDOWS.has(window)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank or window" } };
    const fetchedHero = await fetchRankAll({ days: window, rank });
    const lotH = scoreLot(fetchedHero.rows, { prior: fetchedHero.prior ?? null, gameVersion: fetchedHero.gameVersion ?? null });
    const hero = lotH.scored.find((h) => h.id === Number(m[1]));
    if (!hero) return { status: 404, body: { error: "hero_not_found", message: "Hero not found in this rank/window" } };
    let trends = [];
    try {
      const t = await arenaGet(`/api/heroes/${m[1]}/trends?rank=${rank}&past-days=30&size=30&index=1`);
      trends = t?.data?.records ?? t?.data ?? [];
    } catch { trends = []; }
    return { status: 200, body: { data: hero, trends, rank, window, meta: lotH.meta } };
  }
  // GET /views/:view
  m = /^\/views\/(semana|elo|tier)$/.exec(path);
  if (m) {
    const view = m[1];
    const rank = sp.get("rank") ?? "mythic", window = Number(sp.get("window") ?? 7);
    if (view === "elo") {
      // EC-007: um elo falho não derruba os outros — marca parcial
      const perRank = await mapConc(RANKS.filter((r) => r !== "all"), async (r) => {
        try {
          const fetchedR = await fetchRankAll({ days: window, rank: r });
          return { rank: r, top: score(fetchedR.rows, { prior: fetchedR.prior ?? null, gameVersion: fetchedR.gameVersion ?? null }).sort((a, b) => b.z - a.z).slice(0, 10) };
        } catch (e) {
          return { rank: r, error: "upstream_unavailable", top: [] };
        }
      });
      const partial = perRank.some((r) => r.error);
      return { status: partial ? 206 : 200, body: { data: perRank, partial } };
    }
    const fetchedV = await fetchRankAll({ days: window, rank });
    const s = score(fetchedV.rows, { prior: fetchedV.prior ?? null, gameVersion: fetchedV.gameVersion ?? null });
    if (view === "semana") return { status: 200, body: { data: { strongest: [...s].sort((a, b) => b.z - a.z).slice(0, 10), weakest: [...s].sort((a, b) => a.z - b.z).slice(0, 10) }, rank, window } };
    const byTier = { S: [], A: [], B: [], C: [], D: [] };
    s.forEach((h) => byTier[h.tier].push(h));
    return { status: 200, body: { data: byTier, rank, window } };
  }
  if (/^\/views\//.test(path)) return { status: 410, body: { error: "view_not_supported", message: "View not supported in Phase 1" } };
  // GET /gems
  if (path === "/gems") {
    const rank = sp.get("rank") ?? "mythic", window = Number(sp.get("window") ?? 7);
    const fetchedG = await fetchRankAll({ days: window, rank });
    const gems = score(fetchedG.rows, { prior: fetchedG.prior ?? null, gameVersion: fetchedG.gameVersion ?? null }).filter((h) => h.isGem).sort((a, b) => b.z - a.z);
    return { status: 200, body: { data: gems.map((g) => ({ ...g, reason: `win ${g.win} acima da mediana, pick ${g.pick} e ban baixos` })), rank, window } };
  }
  // GET /catalog — id -> {name, head} (1 página de 133, cache C)
  if (path === "/catalog") {
    const hit = cacheGet("catalog", "C");
    if (hit.hit) return { status: 200, body: { data: hit.body, total: Object.keys(hit.body).length, stale: hit.stale, ageMs: hit.ageMs } };
    const raw = await arenaGet(`/api/heroes?size=133&index=1`);
    const map = {};
    for (const rec of raw?.data?.records ?? []) {
      const d = rec?.data ?? {};
      const id = Number(d.hero_id);
      if (!Number.isFinite(id)) continue;
      map[id] = { name: d?.hero?.data?.name ?? `Hero ${id}`, head: d?.hero?.data?.head ?? null, smallmap: d?.hero?.data?.smallmap ?? null };
    }
    cacheSet("catalog", map);
    return { status: 200, body: { data: map, total: Object.keys(map).length, stale: false, ageMs: 0 } };
  }
  async function catalog() {
    const r = await router("/catalog", new URLSearchParams());
    return r.body.data ?? {};
  }
  // GET /equipment — equipid -> {name, icon} (páginas de 100 até página curta, cache C)
  if (path === "/equipment") {
    const hit = cacheGet("equipment", "C");
    if (hit.hit) return { status: 200, body: { data: hit.body, total: Object.keys(hit.body).length, stale: hit.stale, ageMs: hit.ageMs } };
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
    return { status: 200, body: { data: map, total: Object.keys(map).length, stale: false, ageMs: 0 } };
  }
  async function equipment() {
    try {
      const r = await router("/equipment", new URLSearchParams());
      if (r?.status !== 200) return {};
      return r.body?.data ?? {};
    } catch { return {}; }
  }
  /** Catálogo de talentos (giftid -> nome/tier/ícone). Cache C; falha = mapa vazio. */
  async function emblems() {
    const hit = cacheGet("emblems:v1", "C");
    if (hit.hit && !hit.stale) return hit.body;
    if (emblemsInFlight) return emblemsInFlight;
    emblemsInFlight = (async () => {
      try {
        const raw = await arenaGet("/api/academy/emblems?size=200&index=1");
        const map = normalizeEmblemCatalog(raw?.data?.records ?? []);
        cacheSet("emblems:v1", map);
        return map;
      } catch {
        return hit.hit ? hit.body : {};
      } finally {
        emblemsInFlight = null;
      }
    })();
    return emblemsInFlight;
  }
  // GET /heroes/lanes?rank= — mapa heroId -> lanes[] (cache C 24h, espelha catalog()).
  // Ids = lista do rank pedido (janela 7; lane é estática por herói, o rank só diz quem listar).
  // Desconhecido = herói SEM lane (aparece sem filtro). Falha do upstream = mapa vazio
  // (a lista segue sem filtro — degradação honesta, nunca quebra, nunca 502).
  if (path === "/heroes/lanes") {
    const rank = sp.get("rank") ?? "mythic";
    if (!RANKS.includes(rank)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank", ranks: RANKS } };
    const key = `lanes:${rank}`;
    const hit = cacheGet(key, "C");
    if (hit.hit) return { status: 200, body: { data: hit.body, total: Object.keys(hit.body).length, stale: hit.stale, ageMs: hit.ageMs } };
    let ids = [];
    try {
      const fetched = await fetchRankAll({ days: 7, rank });
      ids = fetched.rows.map((h) => h.id);
    } catch { ids = []; }
    if (!ids.length) {
      try {
        const cat = await catalog();
        ids = Object.keys(cat).map(Number).filter(Number.isFinite);
      } catch { ids = []; }
    }
    if (!ids.length) {
      return { status: 200, body: { data: {}, total: 0, stale: true, ageMs: 0, fallback: true, note: "fonte indisponível — lista segue sem filtro de rota" } };
    }
    const pairs = await mapConc(ids, async (id) => {
      try {
        const raw = await arenaGet(`/api/academy/heroes/${id}/lane`);
        const roadsort = raw?.data?.records?.[0]?.data?.hero?.data?.roadsort ?? [];
        const parsed = lanesFromRoadsort(roadsort);
        for (const u of parsed.unknown) console.warn(`[lanes] título não-mapeado ${JSON.stringify(u)} no herói ${id} — herói sem lane`);
        return [id, parsed.lanes];
      } catch {
        return [id, []]; // herói sem lane nesta coleta; aparece sem filtro, nunca sob lane errada
      }
    });
    const map = {};
    for (const pair of pairs) map[pair[0]] = pair[1];
    cacheSet(key, map);
    return { status: 200, body: { data: map, total: Object.keys(map).length, stale: false, ageMs: 0 } };
  }
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
  m = /^\/heroes\/(\d+)\/matchups$/.exec(path);
  if (m) {
    const id = m[1];
    const rank = sp.get("rank") ?? "mythic", days = Number(sp.get("days") ?? sp.get("window") ?? 7);
    if (!RANKS.includes(rank) || !WINDOWS.has(days)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank or days", ranks: RANKS, windows: [...WINDOWS] } };
    const key = `matchups:${id}:${rank}:${days}`;
    const hit = cacheGet(key, "C");
    if (hit.hit && !hit.stale) return { status: 200, body: { ...hit.body, stale: false } };
    const [ct, cp, cat] = await Promise.all([
      arenaGet(`/api/heroes/${id}/counters?days=${days}&rank=${rank}&size=20&index=1`).catch(() => null),
      arenaGet(`/api/heroes/${id}/compatibility?days=${days}&rank=${rank}&size=20&index=1`).catch(() => null),
      catalog(),
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
  // GET /builds/aggregate — visão de sistema (B0–B5), 1 lane por carga.
  // population=pro NÃO entra no MVP (fase 2); o recorte é ranked.
  if (path === "/builds/aggregate") {
    const chk = requireLane(sp.get("lane"));
    if (!chk.ok) {
      return { status: 422, body: { error: "lane_required", message: "Lane query param is required", allowed: chk.allowed, hint: "use ?lane=exp|mid|roam|jungle|gold (no silent default)" } };
    }
    const lane = chk.lane;
    const rank = sp.get("rank") ?? "mythic";
    const window = Number(sp.get("window") ?? 7);
    const top = sp.get("top") == null ? 10 : Number(sp.get("top"));
    const population = sp.get("population") ?? "ranked";
    if (!RANKS.includes(rank)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank", ranks: RANKS } };
    if (!WINDOWS.has(window)) return { status: 400, body: { error: "window_invalid", message: "Invalid window", windows: [...WINDOWS] } };
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

    // Dedupe: duas abas na mesma lane não disparam dois fan-outs.
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
  // GET /heroes/:id/builds — builds com win rate + ícones (lane OBRIGATÓRIA, API 422 sem lane)
  m = /^\/heroes\/(\d+)\/builds$/.exec(path);
  if (m) {
    const id = m[1];
    const rank = sp.get("rank") ?? "mythic";
    if (!RANKS.includes(rank)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank", ranks: RANKS } };
    const laneRaw = sp.get("lane");
    const chk = requireLane(laneRaw);
    if (!chk.ok) return { status: 422, body: { error: "lane_required", message: "Lane query param is required", allowed: chk.allowed, hint: "use ?lane=exp|mid|roam|jungle|gold (no silent default)" } };
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
        equipment(),
        emblems(),
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
  // ── v2: módulos derivados (puros, sem nova coleta) ──
  // GET /heroes/:id/confidence — trio CNF provisório
  m = /^\/heroes\/(\d+)\/confidence$/.exec(path);
  if (m) {
    const rank = sp.get("rank") ?? "mythic", window = Number(sp.get("window") ?? 7);
    if (!RANKS.includes(rank) || !WINDOWS.has(window)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank or window" } };
    const fetchedC = await fetchRankAll({ days: window, rank });
    const lotC = scoreLot(fetchedC.rows, { prior: fetchedC.prior ?? null, gameVersion: fetchedC.gameVersion ?? null });
    const hero = lotC.scored.find((h) => h.id === Number(m[1]));
    if (!hero) return { status: 404, body: { error: "hero_not_found", message: "Hero not found in this rank/window" } };
    // μ do lote vem da meta (antes: hero.mu, que o score nunca preenchia — caía no fallback).
    const trio = confidenceTrio({ wrAdj: hero.wrAdj, med: lotC.meta.mu ?? 0.5, se: hero.se ?? 0.02, c: C_REFERENCE });
    return { status: 200, body: { id: hero.id, rank, window, observed_win: hero.win, shrinkage_B: hero.B, ...trio, note: "M1 normal-normal: V=(1/s²+1/τ²)⁻¹, m=V(y/s²+μ/τ²), s²=μ(1−μ)/(c·pick). Probabilidade posterior ≠ chance de vitória" } };
  }
  // GET /heroes/:id/rank-diff?a=mythic&b=glory — diferença RNK
  m = /^\/heroes\/(\d+)\/rank-diff$/.exec(path);
  if (m) {
    const a = sp.get("a") ?? "mythic", b = sp.get("b") ?? "glory";
    const window = Number(sp.get("window") ?? 7);
    if (!RANKS.includes(a) || !RANKS.includes(b) || !WINDOWS.has(window)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank a/b or window" } };
    const [ra, rb] = await Promise.all([fetchRankAll({ days: window, rank: a }), fetchRankAll({ days: window, rank: b })]);
    const ha = score(ra.rows, { prior: ra.prior ?? null, gameVersion: ra.gameVersion ?? null }).find((h) => h.id === Number(m[1]));
    const hb = score(rb.rows, { prior: rb.prior ?? null, gameVersion: rb.gameVersion ?? null }).find((h) => h.id === Number(m[1]));
    if (!ha || !hb) return { status: 404, body: { error: "hero_not_found", message: "Hero missing in one of the ranks", classification_status: "unavailable" } };
    const diff = rankDifference({ thetaA: ha.wrAdj, thetaB: hb.wrAdj, seA: ha.se ?? 0.02, seB: hb.se ?? 0.02 });
    return { status: 200, body: { id: Number(m[1]), a, b, window, thetaA: ha.wrAdj, thetaB: hb.wrAdj, seA: ha.se, seB: hb.se, s_ref: "s=θ−μ_rank; D=s_a−s_b (força relativa, não bruta)", ...diff, note: "sem atribuição causal" } };
  }
  // GET /heroes/:id/temporal?rank=&base=30 — delta TMP (janelas sobrepostas não são replicação)
  m = /^\/heroes\/(\d+)\/temporal$/.exec(path);
  if (m) {
    const rank = sp.get("rank") ?? "mythic";
    const nowW = Number(sp.get("window") ?? 7), baseW = Number(sp.get("base") ?? 30);
    if (!RANKS.includes(rank) || !WINDOWS.has(nowW) || !WINDOWS.has(baseW)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank, window or base" } };
    const [rn, rb] = await Promise.all([fetchRankAll({ days: nowW, rank }), fetchRankAll({ days: baseW, rank })]);
    const hn = score(rn.rows, { prior: rn.prior ?? null, gameVersion: rn.gameVersion ?? null }).find((h) => h.id === Number(m[1]));
    const hb = score(rb.rows, { prior: rb.prior ?? null, gameVersion: rb.gameVersion ?? null }).find((h) => h.id === Number(m[1]));
    if (!hn || !hb) return { status: 404, body: { error: "hero_not_found", message: "Hero missing in one of the windows" } };
    const seC = Math.sqrt((hn.se ?? 0.02) ** 2 + (hb.se ?? 0.02) ** 2);
    const t = temporalDelta({ thetaNow: hn.wrAdj, thetaBase: hb.wrAdj, se: seC, confirmed: false });
    // T5 consome a SnapshotHistory (INV4-015): ≥2 verificados não-sobrepostos + span ≥14d.
    // Com <14d ou 1 snapshot → serie_curta/inconclusivo; o delta segue visível p/ inspeção, sem veredito.
    // Contrato p/ o frontend: chamar /snapshots?fonte=heroes&rank=&janela= p/ a série e
    // /snapshots/:ts/diff p/ C-105; nunca inferir persistência de janelas sobrepostas.
    let serie = { n_snapshots: 0, n_distintos: 0, span_dias: 0, nao_sobrepostos: false, lacunas: 0, status: "serie_curta", motivo: "sem histórico próprio ainda" };
    try {
      serie = assessSeries(listSnapshots({ fonte: "heroes", rank, limit: 1000 })
        .map((s) => ({ coletado_em: s.coletado_em, janela: s.janela, payload_hash: s.payload_hash, status: s.status })));
    } catch { /* série indisponível ⇒ mantém serie_curta */ }
    const base = {
      id: Number(m[1]), rank, nowW, baseW, thetaNow: hn.wrAdj, thetaBase: hb.wrAdj, ...t,
      serie, serie_contrato: "T5: persistente|revertido exige ≥2 snapshots verificados não-sobrepostos, span ≥14d (INV4-015); <14d ou 1 snapshot = serie_curta/inconclusivo",
    };
    if (serie.status !== "avaliavel") {
      return { status: 200, body: { ...base, temporal_status: "inconclusive", patch_association_status: "not_evaluated", motivo_serie: serie.motivo, note: "série curta/sobreposta — T5 inconclusivo (INV4-015); delta exibido p/ inspeção, sem veredito; série própria em /snapshots" } };
    }
    return { status: 200, body: { ...base, note: "associação temporal — não causal; janelas sobrepostas não são independentes; veredito T5 exige a série própria (/snapshots)" } };
  }
  // GET /heroes/:id/distortion?rank=&window= — DRF pick/ban separados
  m = /^\/heroes\/(\d+)\/distortion$/.exec(path);
  if (m) {
    const rank = sp.get("rank") ?? "mythic", window = Number(sp.get("window") ?? 7);
    if (!RANKS.includes(rank) || !WINDOWS.has(window)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank or window" } };
    const fetchedD = await fetchRankAll({ days: window, rank });
    const rows = fetchedD.rows;
    const lotD = scoreLot(rows, { prior: fetchedD.prior ?? null, gameVersion: fetchedD.gameVersion ?? null });
    const s = lotD.scored;
    const hero = s.find((h) => h.id === Number(m[1]));
    if (!hero) return { status: 404, body: { error: "hero_not_found", message: "Hero not found" } };
    // Medianas verdadeiras do motor (MIGRACAO §3: antes elemento superior em n par — pode
    // trocar ~meio degrau; mesmo corte de produto). μ/τ da meta (antes: s[0].mu/s[0].tau,
    // que o score nunca preenchia — sempre 0).
    const medPick = medianPickOf(rows), medBan = medianBanOf(rows);
    const muS = lotD.meta.mu ?? 0, tauS = lotD.meta.tau ?? 0; // μ/τ do M1 (score), não das linhas brutas
    const pick = distortionResidual({ observed: hero.pick, expected: medPick, kind: "pick" });
    const ban = distortionResidual({ observed: hero.ban, expected: medBan, kind: "ban" });
    // strength_d derivado NA BORDA ((θ̂−μ)/τ, 2 casas — mesmas casas de antes; d saiu do motor,
    // DESVIO (c)) p/ o fio não mudar de forma; strength_class via classOf (trust.js).
    const strengthD = tauS > 0 ? +((hero.wrAdj - muS) / tauS).toFixed(2) : 0;
    return { status: 200, body: { id: hero.id, rank, window, estimated_strength: hero.wrAdj, observed_win: hero.win, strength_q: hero.q, strength_d: strengthD, strength_class: classOf(hero), mu: muS, tau: tauS, pick, ban, classification_status: "provisional", note: "resíduo é discrepância, nunca erro da comunidade; pick e ban nunca somados" } };
  }
  // GET /heroes/:id/blind?rank=&days= — BPS proxy sobre δ elegíveis
  m = /^\/heroes\/(\d+)\/blind$/.exec(path);
  if (m) {
    const id = m[1];
    const rank = sp.get("rank") ?? "mythic", days = Number(sp.get("days") ?? sp.get("window") ?? 7);
    if (!RANKS.includes(rank) || !WINDOWS.has(days)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank or days", ranks: RANKS, windows: [...WINDOWS] } };
    const key = `matchups:${id}:${rank}:${days}`;
    const hit = cacheGet(key, "C");
    let body = hit.hit ? hit.body : null;
    if (!body) {
      const r = await router(`/heroes/${id}/matchups?rank=${rank}&days=${days}`, new URLSearchParams(`rank=${rank}&days=${days}`));
      if (r.status !== 200) return r;
      body = r.body;
    }
    const deltas = [...(body.countersUp ?? []), ...(body.countersDown ?? [])].map((p) => p.delta).filter(Number.isFinite);
    const proxy = blindProxy(deltas);
    const worst = [...(body.countersDown ?? []), ...(body.countersUp ?? [])].filter((p) => Number.isFinite(p.delta)).sort((a, b) => a.delta - b.delta)[0] ?? null;
    return { status: 200, body: { id: Number(id), rank, days, ...proxy, pair_coverage: "extremes-only", worst_counter: worst ? { id: worst.id, name: worst.name, delta: worst.delta, pair_key: worst.pair_key } : null, worst_observed: proxy.worst_observed } };
  }
  // GET /heroes/:id/trends — série diária normalizada
  m = /^\/heroes\/(\d+)\/trends$/.exec(path);
  if (m) {
    const id = m[1];
    const rank = sp.get("rank") ?? "mythic", days = Number(sp.get("days") ?? 30);
    if (!RANKS.includes(rank) || !Number.isInteger(days) || days < 1 || days > 90) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank or days" } };
    const key = `trends:${id}:${rank}:${days}`;
    const hit = cacheGet(key, "B");
    if (hit.hit && !hit.stale) return { status: 200, body: { ...hit.body, stale: false } };
    const raw = await arenaGet(`/api/heroes/${id}/trends?rank=${rank}&past-days=${days}&size=${days}&index=1`).catch(() => null);
    const series = raw?.data?.records?.[0]?.data?.win_rate ?? [];
    if (!series.length) return { status: 502, body: { error: "upstream_unavailable", message: "Upstream unavailable, try again" } };
    const data = series.map((p) => ({ date: p.date, win: p.win_rate, pick: p.app_rate, ban: p.ban_rate })).filter((p) => p.date && [p.win, p.pick, p.ban].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)); // INV-001 em trends
    if (!data.length) return { status: 502, body: { error: "upstream_unavailable", message: "Upstream unavailable, no valid series point" } };
    const body = { id: Number(id), rank, days, data };
    cacheSet(key, body);
    return { status: 200, body: { ...body, stale: false } };
  }
  // ── SnapshotHistory append-only (ADR-021-09, C-103/C-105) ──
  // GET /snapshots?fonte=&rank=&janela= — lista snapshots SEM payload (hash + verificações).
  if (path === "/snapshots") {
    const fonte = sp.get("fonte") ?? undefined;
    const rank = sp.get("rank") ?? undefined;
    const janelaRaw = sp.get("janela") ?? undefined;
    if (fonte !== undefined && !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(fonte)) return { status: 400, body: { error: "source_invalid", message: "Invalid source" } };
    if (rank !== undefined && !RANKS.includes(rank)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank", ranks: RANKS } };
    let janela = undefined;
    if (janelaRaw !== undefined) {
      janela = Number(janelaRaw);
      if (!Number.isInteger(janela) || !WINDOWS.has(janela)) return { status: 400, body: { error: "window_invalid", message: "Invalid window", windows: [...WINDOWS] } };
    }
    const data = listSnapshots({ fonte, rank, janela, limit: 200 });
    return { status: 200, body: { data, total: data.length, serie_contrato: "T5 consome a série com ≥2 snapshots verificados não-sobrepostos, span ≥14d; senão serie_curta/inconclusivo (INV4-015)", nota: "sem payload (hash + verificações); diff resumido em /snapshots/:ts/diff (C-105)" } };
  }
  // GET /snapshots/:ts/diff?contra= — diff resumido entre coletas p/ C-105 (sem despejar payload).
  m = /^\/snapshots\/(\d+)\/diff$/.exec(path);
  if (m) {
    const ts = Number(m[1]);
    const contraRaw = sp.get("contra") ?? undefined;
    if (!Number.isInteger(ts) || ts <= 0) return { status: 400, body: { error: "timestamp_invalid", message: "Invalid ts (coletado_em in ms)" } };
    let contra = undefined;
    if (contraRaw !== undefined) {
      contra = Number(contraRaw);
      if (!Number.isInteger(contra) || contra <= 0) return { status: 400, body: { error: "timestamp_invalid", message: "Invalid contra (coletado_em in ms)" } };
      if (contra === ts) return { status: 400, body: { error: "invalid_comparison", message: "Contra is the same snapshot" } };
    }
    const base = getSnapshot(ts);
    if (!base) return { status: 404, body: { error: "snapshot_not_found", message: "Snapshot not found", coletado_em: ts } };
    const serie = listSnapshots({ fonte: base.fonte, rank: base.rank, janela: base.janela, limit: 1000 });
    let other = null;
    if (contra !== undefined) {
      other = serie.find((s) => s.coletado_em === contra) ?? null;
      if (!other) return { status: 404, body: { error: "snapshot_not_found", message: "Contra snapshot not found in series", contra } };
    } else {
      const prev = serie.filter((s) => s.coletado_em < ts).pop() ?? null;
      const next = serie.find((s) => s.coletado_em > ts) ?? null;
      other = prev ?? next;
      if (!other) return { status: 404, body: { error: "no_comparison_snapshot", message: "No other snapshot to compare (single-snapshot series)", coletado_em: ts } };
    }
    const fullA = getSnapshot(Math.min(ts, other.coletado_em));
    const fullB = getSnapshot(Math.max(ts, other.coletado_em));
    const rowsA = new Map((fullA?.payload?.rows ?? []).map((h) => [h.id, h]));
    const rowsB = new Map((fullB?.payload?.rows ?? []).map((h) => [h.id, h]));
    const mudancas = [];
    let iguais = 0;
    for (const [id, a] of rowsA) {
      const b = rowsB.get(id);
      if (!b) continue;
      const campos = ["win", "pick", "ban"].filter((k) => a[k] !== b[k]);
      if (!campos.length) { iguais++; continue; }
      if (mudancas.length < 50) {
        mudancas.push({ id, name: b.name ?? a.name ?? null, campos,
          antes: { win: a.win, pick: a.pick, ban: a.ban }, depois: { win: b.win, pick: b.pick, ban: b.ban } });
      }
    }
    let adicionados = 0, removidos = 0;
    for (const id of rowsB.keys()) if (!rowsA.has(id)) adicionados++;
    for (const id of rowsA.keys()) if (!rowsB.has(id)) removidos++;
    const nMudados = rowsA.size + adicionados - iguais - removidos; // heróis presentes nos dois com campo mudado
    const depoisTs = Math.max(ts, other.coletado_em);
    return { status: 200, body: {
      base_ts: ts, contra_ts: other.coletado_em, antes_ts: Math.min(ts, other.coletado_em), depois_ts: depoisTs,
      fonte: base.fonte, rank: base.rank, janela: base.janela,
      versao: { antes: fullA?.versao_jogo ?? null, depois: fullB?.versao_jogo ?? null },
      status_coletas: { antes: fullA?.status ?? null, depois: fullB?.status ?? null },
      pick_sum: { antes: fullA?.pick_sum ?? null, depois: fullB?.pick_sum ?? null },
      n_antes: rowsA.size, n_depois: rowsB.size, n_iguais: iguais,
      n_adicionados: adicionados, n_removidos: removidos, n_mudados: nMudados,
      mudancas, truncado: nMudados > mudancas.length,
      aviso_revisado: nMudados > 0 || adicionados > 0 || removidos > 0,
      aviso: (nMudados > 0 || adicionados > 0 || removidos > 0) ? `valores revisados desde a coleta ${Math.min(ts, other.coletado_em)}` : null,
      nota: "C-105: recoletar+comparar; resumo sem payload (id + campos mudados + antes/depois)",
    } };
  }
  // GET /modules — catálogo dos 9 módulos (fórmula, status, endpoint) p/ UI reimaginada
  if (path === "/modules") {
    return { status: 200, body: { data: [
      { id: "EXP", name: "Exposição", en: "Exposure", question: "Quanto observamos de cada herói?", aggregate: "HeroRate + SigmaSums", status: "validado", formula: "pick = slot_share; Σ≈1 (±0.005); ban Σ 7.6–8.9; sem N·p (Beta-Binomial descartada)", endpoint: "/v1/heroes (pickSumCheck)", doc: "PRD Exposure" },
      { id: "SHR", name: "Força e Shrinkage", en: "Strength + Shrinkage (M1)", question: "Quão forte o herói é de verdade?", aggregate: "HeroStrength (θ̂,B,V)", status: "validado", formula: "s²=μ(1−μ)/(c·pick); θ~N(μ,τ²); V=(1/s²+1/τ²)⁻¹; m=V(y/s²+μ/τ²); B=τ²/(τ²+s²); μ≈0.499 τ≈0.031; c único declarado (sem grade)", endpoint: "/v1/heroes (θ̂,B,se,V)", doc: "PRD Shrinkage §3" },
      { id: "CNF", name: "Confiança e Incerteza", en: "Confidence Trio", question: "O sinal é confiável ou sensível à premissa?", aggregate: "Confidence (posterior, IC, P)", status: "provisório", formula: "m±1.96·se; P(θ>μ+Δ)=Φ((m−μ−Δ)/se), Δ=0.02; faixas 95/80/20/5 ponto de partida; sem selo confirmatório sem n real", endpoint: "/v1/heroes/:id/confidence", doc: "PRD Confidence §4–5" },
      { id: "RNK", name: "Força por Rank", en: "Rank Strength Difference", question: "O herói é forte em todo rank?", aggregate: "RankStrength + RankPair", status: "proposta", formula: "s=θ−μ_rank; D=s_a−s_b; P(D>Δr); pares Epic×Legend…Epic×Glory; sem causa", endpoint: "/v1/heroes/:id/rank-diff?a=&b=", doc: "PRD Rank §5–6" },
      { id: "TMP", name: "Tempo e Patches", en: "Temporal + Patch Response", question: "O sinal persiste? E após patch?", aggregate: "TemporalDelta (Δ, Δlogit)", status: "experimental", formula: "Δ=θ(t2)−θ(t1) em logit (log-odds≠pp); sinal→alerta→causal; T0/T1/T2 walk-forward", endpoint: "/v1/heroes/:id/temporal", doc: "PRD Temporal §5–8" },
      { id: "M6", name: "Confrontos e Sinergias", en: "Matchup Effect (M6)", question: "Quais pares ajudam ou atrapalham?", aggregate: "PairEffect (δ, evidence)", status: "descritivo", formula: "δ bruto, counter antissimétrico / teammate simétrico; 125 pares 0 violações; evidence consistente/contexto/limitado/inconclusivo; sem soma", endpoint: "/v1/heroes/:id/matchups", doc: "PRD M6 §7–8" },
      { id: "DRF", name: "Distorção de Draft", en: "Draft Distortion", question: "Pressão de pick/ban acompanha a força?", aggregate: "DistortionResidual (pick, ban)", status: "proposta", formula: "pick e ban separados (nunca somados); resíduo=obs−esperado; pressão fora do M1", endpoint: "/v1/heroes/:id/distortion", doc: "PRD Distortion" },
      { id: "BPS", name: "Blind Pick", en: "Blind Pick Safety", question: "Dá para escolher sem ver o inimigo?", aggregate: "BlindProxy (p10, pior counter)", status: "proxy", formula: "distribuição δ elegíveis; p10 adverso + pior counter; n<5 inconclusivo; nunca probabilidade", endpoint: "/v1/heroes/:id/blind", doc: "PRD Blind" },
      { id: "BDL", name: "Builds e Lift", en: "Build Lift", question: "Qual build rende mais — e contra qual referência?", aggregate: "BuildLift (L vs refs)", status: "camada-A", formula: "L=WR−WR_ref (mais-usada/média); ajustado/causal NULL; lane obrigatória; audit_pending", endpoint: "/v1/heroes/:id/builds?lane=", doc: "PRD Build §4/§8" },
    ], c_reference: C_REFERENCE, impossibilities: ["ratings 10407 offline", "sem N por partida", "sem draft completo"] } };
  }
  // GET /meta/status
  if (path === "/meta/status") {
    const vers = await versions();
    return { status: 200, body: { startedAt: new Date(startedAt).toISOString(), health: layerHealth, cache: cacheStats(), history: historyStats(), versions: vers?.slice?.(0, 3) ?? vers, impossibilities: ["academy/ratings offline (10407)", "builds e win-rate/timeline exigem ?lane (422 sem lane)", "sem dados por partida/draft completo — sem causal, sem IC de pseudo-contagem", "pick_rate é slot_share unvalidated, sem contagem absoluta", "janelas sobrepostas não são replicação independente"], lanes: LANES } };
  }
  return { status: 404, body: { error: "not_found", message: "Not found" } };
}
