// Contratos dos 20 endpoints internos (/v1/*) — rede de segurança da F1.
//
// POR QUÊ: antes da refatoração, 14 dos 20 endpoints não tinham nenhum teste
// direto e `routes.js` tinha 47% de cobertura. Este arquivo trava o ENVELOPE de
// cada resposta (chaves de topo) e as semânticas que a UI consome (ordem, null vs
// zero, 400/404/422/410), sem rede e sem banco de dev.
//
// Regra ao evoluir: se um campo de topo mudar de nome/sumir, ESTE teste falha —
// é intencional. Contrato de wire é público para `app/web/src/shared/api/index.ts`.
import "./support/env.mjs";
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { installUpstreamMock, HEROES } from "./support/upstream.mjs";

const mock = installUpstreamMock();
const { router } = await import("../src/http/router.js");
const { recordSnapshot } = await import("../src/infra/snapshotHistory.js");
const { resetArenaCircuit } = await import("../src/providers/arena/index.js");

before(() => { mock.reset(); });
// O breaker é estado de módulo (5 falhas ⇒ 60 s aberto). Um teste que simula
// upstream fora do ar abriria o breaker para TODOS os seguintes; cada teste
// começa com o cliente limpo.
beforeEach(() => { resetArenaCircuit(); });
after(() => { mock.restore(); });

const call = (path, params = {}) => router(path, new URLSearchParams(params));
const keysOf = (obj) => Object.keys(obj ?? {}).sort();

/** Asserção de envelope: todas as chaves esperadas presentes, nenhuma extra. */
function envelope(body, expected, label) {
  assert.deepEqual(keysOf(body), [...expected].sort(), `envelope de ${label}`);
}

// ── /heroes ───────────────────────────────────────────────────────────────────
describe("GET /heroes — lote pontuado", () => {
  it("envelope completo, 12 heróis e ordem default por θ̂ (wrAdj desc)", async () => {
    const r = await call("/heroes", { rank: "mythic", window: "7" });
    assert.equal(r.status, 200);
    envelope(r.body, [
      "data", "total", "rank", "window", "collectedAgoMs", "stale", "truncated",
      "totalFonte", "pickSumCheck", "exposure", "meta", "prior", "index_basis", "postPatch", "latest",
    ], "/heroes");
    assert.equal(r.body.total, HEROES.length);
    assert.equal(r.body.data.length, HEROES.length);
    assert.equal(r.body.rank, "mythic");
    assert.equal(r.body.window, 7);
    assert.equal(r.body.data[0].id, 1, "maior θ̂ primeiro (Alpha, win .56)");
    assert.deepEqual(r.body.exposure, { unit: "slot_share", status: "unvalidated" });
    assert.equal(r.body.pickSumCheck.ok, true, "INV-001: Σ pick ≈ 1");
    assert.equal(typeof r.body.index_basis.method, "string");
  });

  it("paginação no servidor: size/index refletem em data e total", async () => {
    const p2 = await call("/heroes", { rank: "mythic", window: "7", size: "5", index: "2" });
    assert.equal(p2.status, 200);
    assert.equal(p2.body.data.length, 5);
    assert.equal(p2.body.total, HEROES.length);
    assert.equal(p2.body.data[0].id, 6, "página 2 começa no 6º por θ̂");
  });

  it("sorts reais do backend: win(θ̂), pick, ban, q; class filtra", async () => {
    const byPick = await call("/heroes", { rank: "mythic", window: "7", sort: "pick", order: "desc" });
    assert.equal(byPick.body.data[0].id, 1, "maior pick");
    const asc = await call("/heroes", { rank: "mythic", window: "7", sort: "pick", order: "asc" });
    assert.equal(asc.body.data[0].id, 12, "menor pick");
    const cls = await call("/heroes", { rank: "mythic", window: "7", class: "Joia" });
    assert.equal(cls.status, 200);
    assert.ok(Array.isArray(cls.body.data));
  });

  it("validação de query: 400 com o erro específico", async () => {
    for (const [params, error] of [
      [{ rank: "xyz" }, "rank_invalid"],
      [{ rank: "mythic", window: "2" }, "window_invalid"],
      [{ rank: "mythic", sort: "zzz" }, "sort_invalid"],
      [{ rank: "mythic", order: "zzz" }, "order_invalid"],
    ]) {
      const r = await call("/heroes", params);
      assert.equal(r.status, 400, JSON.stringify(params));
      assert.equal(r.body.error, error, JSON.stringify(params));
    }
  });
});

// ── /heroes/:id ──────────────────────────────────────────────────────────────
describe("GET /heroes/:id — ficha", () => {
  it("envelope data+trends+meta e 404 para herói inexistente", async () => {
    const r = await call("/heroes/1", { rank: "mythic", window: "7" });
    assert.equal(r.status, 200);
    envelope(r.body, ["data", "trends", "rank", "window", "meta"], "/heroes/:id");
    assert.equal(r.body.data.id, 1);
    assert.ok(r.body.data.wrAdj > 0 && r.body.data.wrAdj < 1);
    assert.equal(Array.isArray(r.body.trends), true);
    assert.equal((await call("/heroes/999", { rank: "mythic", window: "7" })).status, 404);
    assert.equal((await call("/heroes/1", { rank: "xyz" })).status, 400);
  });
});

// ── /views ───────────────────────────────────────────────────────────────────
describe("GET /views/:view", () => {
  it("semana: strongest/weakest top-10 ordenados por z", async () => {
    const r = await call("/views/semana", { rank: "mythic", window: "7" });
    assert.equal(r.status, 200);
    envelope(r.body, ["data", "rank", "window"], "/views/semana");
    envelope(r.body.data, ["strongest", "weakest"], "/views/semana.data");
    assert.equal(r.body.data.strongest.length, 10);
    assert.equal(r.body.data.weakest.length, 10);
    assert.ok(r.body.data.strongest[0].z >= r.body.data.strongest.at(-1).z, "z desc");
    assert.ok(r.body.data.weakest[0].z <= r.body.data.weakest.at(-1).z, "z asc");
  });

  it("tier: buckets S..D", async () => {
    const r = await call("/views/tier", { rank: "mythic", window: "7" });
    assert.equal(r.status, 200);
    assert.deepEqual(keysOf(r.body.data), ["A", "B", "C", "D", "S"]);
    const total = Object.values(r.body.data).reduce((a, b) => a + b.length, 0);
    assert.equal(total, HEROES.length, "todo herói cai em exatamente um tier");
  });

  it("elo: 5 ranks (sem 'all') e partial=false", async () => {
    const r = await call("/views/elo", { rank: "mythic", window: "7" });
    assert.equal(r.status, 200);
    envelope(r.body, ["data", "partial"], "/views/elo");
    assert.equal(r.body.partial, false);
    assert.deepEqual(r.body.data.map((x) => x.rank), ["epic", "legend", "mythic", "honor", "glory"]);
  });

  it("view não suportada = 410 (não 404)", async () => {
    const r = await call("/views/x");
    assert.equal(r.status, 410);
    assert.equal(r.body.error, "view_not_supported");
  });
});

// ── /gems, /catalog, /equipment ──────────────────────────────────────────────
describe("catálogos e gems", () => {
  it("/gems devolve array com reason por item", async () => {
    const r = await call("/gems", { rank: "mythic", window: "7" });
    assert.equal(r.status, 200);
    envelope(r.body, ["data", "rank", "window"], "/gems");
    assert.ok(Array.isArray(r.body.data));
    for (const g of r.body.data) assert.equal(typeof g.reason, "string");
  });

  it("/catalog mapeia id → {name, head, smallmap}", async () => {
    const r = await call("/catalog");
    assert.equal(r.status, 200);
    envelope(r.body, ["data", "total", "stale", "ageMs"], "/catalog");
    assert.deepEqual(keysOf(r.body.data["1"]), ["head", "name", "smallmap"]);
    assert.equal(r.body.data["1"].name, "Alpha");
    assert.equal(r.body.total, HEROES.length);
  });

  it("/equipment mapeia equipid → {name, icon} e para na página curta", async () => {
    const r = await call("/equipment");
    assert.equal(r.status, 200);
    envelope(r.body, ["data", "total", "stale", "ageMs"], "/equipment");
    assert.equal(r.body.data["101"].name, "Item 101");
    assert.equal(r.body.total, 6);
  });
});

// ── /heroes/lanes ────────────────────────────────────────────────────────────
describe("GET /heroes/lanes — mapa heroId → lanes[]", () => {
  it("agrega por herói; desconhecido nunca inventa lane", async () => {
    mock.reset();
    const r = await call("/heroes/lanes", { rank: "mythic" });
    assert.equal(r.status, 200);
    envelope(r.body, ["data", "total", "stale", "ageMs"], "/heroes/lanes");
    assert.deepEqual(r.body.data["1"], ["mid"]);
    assert.equal(r.body.total, HEROES.length);
    // fan-out esperado: 1 lote de rank + 1 requisição de lane por herói
    assert.ok(mock.calls.filter((c) => c.includes("/lane")).length >= HEROES.length, "uma chamada de lane por herói");
  });

  it("upstream fora: 200 sem lane inventada (nunca 502)", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error("offline"); };
    try {
      // rank novo (glory) força coleta + fan-out de lanes do zero
      const r = await call("/heroes/lanes", { rank: "glory" });
      assert.equal(r.status, 200, "degradação honesta: nunca 502");
      // Pode cair no catálogo em cache (ids conhecidos) ou devolver {} se ele
      // também estiver frio. O invariante é: nenhuma lane inventada.
      for (const [id, lanes] of Object.entries(r.body.data)) {
        assert.ok(Number.isFinite(Number(id)));
        assert.deepEqual(lanes, [], `herói ${id} sem lane quando a fonte cai`);
      }
      assert.ok(Object.keys(r.body.data).length <= HEROES.length);
    } finally { globalThis.fetch = original; resetArenaCircuit(); }
  });
});

// ── /heroes/:id/matchups ─────────────────────────────────────────────────────
describe("GET /heroes/:id/matchups — counters e sinergias", () => {
  it("envelope, δ numérico/null e curva de duração", async () => {
    const r = await call("/heroes/1/matchups", { rank: "mythic", days: "7" });
    assert.equal(r.status, 200);
    envelope(r.body, [
      "id", "rank", "days", "hero", "countersUp", "countersDown",
      "synergiesUp", "synergiesDown", "semanticsNote", "stale",
    ], "/heroes/:id/matchups");
    assert.equal(r.body.countersUp.length, 3);
    assert.equal(r.body.countersDown.length, 2);
    assert.equal(r.body.synergiesUp.length, 3);
    const pair = r.body.countersUp[0];
    envelope(pair, [
      "id", "name", "head", "delta", "effect_raw", "effect_unit_status", "effect_direction",
      "pair_key", "relationship_type", "coverage_status", "win", "pick", "curve", "profile",
      "evidence_quality", "evidence_reasons", "exposure_status", "interval_status", "causal_status",
    ], "pair");
    assert.equal(typeof pair.delta, "number");
    assert.equal(pair.relationship_type, "counter");
    assert.equal(pair.curve.length, 9, "9 faixas de duração");
    // Mock declina a win conforme a duração sobe ⇒ slope negativo = snowball.
    assert.equal(pair.profile, "snowball", "win cai com a duração no mock");
    assert.equal((await call("/heroes/1/matchups", { rank: "xyz" })).status, 400);
    assert.equal((await call("/heroes/1/matchups", { rank: "mythic", days: "5" })).status, 400, "days só aceita as janelas 1/3/7/15/30");
  });
});

// ── /heroes/draft-score ──────────────────────────────────────────────────────
describe("GET /heroes/draft-score — Draft Score do herói (número único)", () => {
  it("envelope, uma linha por herói, ordenação pela WR e min–max 0–100 (melhor=100, pior=0)", async () => {
    const r = await call("/heroes/draft-score", { rank: "mythic", window: "7" });
    assert.equal(r.status, 200);
    envelope(r.body, [
      "version", "rows", "meta", "rank", "days", "collectedAgoMs",
      "truncated", "stale", "ageMs",
    ], "/heroes/draft-score");
    assert.equal(r.body.version, "hero-draft-score-v1");
    assert.equal(r.body.meta.calibrated, false);
    assert.equal(r.body.meta.n_heroes, HEROES.length);
    assert.equal(r.body.meta.with_data, HEROES.length);
    assert.equal(r.body.rank, "mythic");
    assert.equal(r.body.days, 7);

    assert.equal(r.body.rows.length, HEROES.length);
    const top = [...r.body.rows].sort((a, b) => b.draft_score - a.draft_score)[0];
    assert.equal(top.id, 1, "maior WR ⇒ 100 (Alpha)");
    assert.equal(top.draft_score, 100, "melhor WR do lote ⇒ 100");
    const bottom = [...r.body.rows].sort((a, b) => a.draft_score - b.draft_score)[0];
    assert.equal(bottom.id, 12);
    assert.equal(bottom.draft_score, 0, "pior WR do lote ⇒ 0");

    for (const row of r.body.rows) {
      for (const k of ["id", "name", "head", "draft_score"]) assert.ok(k in row, `falta ${k} em ${row.id}`);
      assert.ok(row.draft_score === null || (row.draft_score >= 0 && row.draft_score <= 100), "draft_score é 0–100 (ou null)");
    }
    // Escala min–max do recorte: WR 50% cai no meio da faixa (0.44–0.56) ⇒ 50.
    assert.equal(r.body.rows.find((x) => x.id === 7).draft_score, 50, "meio da faixa ⇒ 50");
    // Âncoras da escala expostas no meta (fração 0–1).
    assert.equal(r.body.meta.wr_min, 0.44);
    assert.equal(r.body.meta.wr_max, 0.56);
  });

  it("validação de query: 400 fora de rank/janela conhecidos", async () => {
    assert.equal((await call("/heroes/draft-score", { rank: "xyz" })).status, 400);
    assert.equal((await call("/heroes/draft-score", { rank: "mythic", window: "5" })).status, 400);
    assert.equal((await call("/heroes/draft-score", { rank: "mythic" })).status, 200, "window default = 7");
  });
});

// ── /builds/aggregate ────────────────────────────────────────────────────────
describe("GET /builds/aggregate — visão de sistema", () => {
  it("envelope B0–B5 completo, 200 (partial é corpo, não 206)", async () => {
    const r = await call("/builds/aggregate", { lane: "mid", rank: "mythic", window: "7", top: "10" });
    assert.equal(r.status, 200);
    const expected = [
      "version", "context", "coverage", "packages", "packages_provisional", "packages_total",
      "packages_ok", "packages_provisional_count", "triples", "triples_total", "items",
      "items_total", "items_insufficient", "items_insufficient_count", "sets", "sets_total",
      "sets_counts", "sets_summary", "discovery_summary", "emblems", "emblems_insufficient",
      "emblems_total", "rune_pages", "rune_pages_insufficient", "talents", "spells",
      "combiner", "variants", "variant_summary", "top_builds", "cells", "sources",
      "metrics", "honesty", "note", "partial", "stale",
    ];
    envelope(r.body, expected, "/builds/aggregate");
    assert.equal(r.body.context.lane, "mid");
    assert.equal(r.body.context.rank, "mythic");
    assert.equal(r.body.metrics.difference_unit, "percentage_points");
    assert.equal(r.body.coverage.heroes_with_builds, 10);
    assert.equal(r.body.cells.length, 10);
  });

  it("lane obrigatória (422), population pro (400) e top inválido (400)", async () => {
    const semLane = await call("/builds/aggregate", { rank: "mythic" });
    assert.equal(semLane.status, 422);
    assert.equal(semLane.body.error, "lane_required");
    assert.deepEqual(semLane.body.allowed, ["exp", "mid", "roam", "jungle", "gold"]);
    assert.equal((await call("/builds/aggregate", { lane: "mid", population: "pro" })).status, 400);
    assert.equal((await call("/builds/aggregate", { lane: "mid", top: "50" })).status, 400);
  });

  it("top=all cobre todos os heróis com dados na lane (sem top-N)", async () => {
    const r = await call("/builds/aggregate", { lane: "mid", rank: "mythic", window: "7", top: "all" });
    assert.equal(r.status, 200);
    assert.equal(r.body.context.top, "all");
    assert.equal(r.body.cells.length, HEROES.length);
    assert.equal(r.body.coverage.heroes_with_builds, HEROES.length);
  });
});

// ── /heroes/:id/builds ───────────────────────────────────────────────────────
describe("GET /heroes/:id/builds — lifts por build", () => {
  it("envelope, referências e camada A (ajustado/causal NULL)", async () => {
    const r = await call("/heroes/1/builds", { rank: "mythic", lane: "mid" });
    assert.equal(r.status, 200);
    envelope(r.body, ["id", "rank", "lane", "data", "references", "audit_status", "note", "stale"], "/heroes/:id/builds");
    assert.equal(r.body.data.length, 3);
    const b = r.body.data[0];
    assert.equal(b.lift_adjusted, null);
    assert.equal(b.causal_build_lift, null);
    assert.equal(b.audit_status ?? r.body.audit_status, "audit_pending");
    assert.equal(b.items.length, 6);
    assert.equal(b.talents.length, 2);
    assert.equal(b.spell.name, "Flicker");
    assert.equal(b.emblem.id, 42);
    assert.equal(r.body.references.mostUsed.win, 0.6);
  });

  it("lane obrigatória = 422 (sem default silencioso)", async () => {
    const r = await call("/heroes/1/builds", { rank: "mythic" });
    assert.equal(r.status, 422);
    assert.equal(r.body.error, "lane_required");
  });
});

// ── módulos derivados (v2) ───────────────────────────────────────────────────
describe("módulos derivados por herói", () => {
  it("/distortion — pick e ban separados, nunca somados", async () => {
    const r = await call("/heroes/1/distortion", { rank: "mythic", window: "7" });
    assert.equal(r.status, 200);
    for (const k of ["id", "rank", "window", "estimated_strength", "observed_win", "strength_q", "strength_d", "strength_class", "mu", "tau", "pick", "ban", "classification_status", "note"]) {
      assert.ok(k in r.body, `falta ${k}`);
    }
    assert.ok("residual" in r.body.pick && "residual" in r.body.ban);
  });

  it("/blind — proxy BPS com n pares e pior counter", async () => {
    const r = await call("/heroes/1/blind", { rank: "mythic", days: "7" });
    assert.equal(r.status, 200);
    for (const k of ["id", "rank", "days", "safety_status", "robustness_status", "adverse_p10", "worst_observed", "n_pairs", "pair_coverage", "worst_counter", "note"]) {
      assert.ok(k in r.body, `falta ${k}`);
    }
    assert.equal(r.body.n_pairs, 5, "3 countersUp + 2 countersDown");
    assert.equal(r.body.pair_coverage, "extremes-only");
    assert.equal(r.body.note.includes("não é probabilidade"), true);
    assert.equal((await call("/heroes/1/blind", { rank: "mythic", days: "5" })).status, 400);
  });

  it("/trends — série diária validada (INV-001)", async () => {
    const r = await call("/heroes/1/trends", { rank: "mythic", days: "30" });
    assert.equal(r.status, 200);
    envelope(r.body, ["id", "rank", "days", "data", "stale"], "/heroes/:id/trends");
    assert.equal(r.body.data.length, 30);
    for (const p of r.body.data) {
      assert.deepEqual(keysOf(p), ["ban", "date", "pick", "win"]);
      for (const k of ["win", "pick", "ban"]) assert.ok(p[k] >= 0 && p[k] <= 1, `${k} fora de [0,1]`);
    }
    assert.equal((await call("/heroes/1/trends", { rank: "mythic", days: "0" })).status, 400);
    assert.equal((await call("/heroes/1/trends", { rank: "mythic", days: "91" })).status, 400);
  });
});

// ── /snapshots ───────────────────────────────────────────────────────────────
describe("GET /snapshots — histórico append-only", () => {
  it("lista ASC sem payload, com hash e verificações", async () => {
    const r = await call("/snapshots", { fonte: "heroes", rank: "mythic" });
    assert.equal(r.status, 200);
    envelope(r.body, ["data", "total", "serie_contrato", "nota"], "/snapshots");
    assert.ok(r.body.data.length >= 1);
    const s = r.body.data[0];
    for (const k of ["id", "fonte", "rank", "janela", "versao_jogo", "coletado_em", "coletado_em_iso", "payload_hash", "status", "n_heroes", "pick_sum"]) {
      assert.ok(k in s, `falta ${k}`);
    }
    assert.equal("payload" in s, false, "lista nunca despeja payload");
    assert.equal(s.payload_hash.length, 64);
    assert.ok(r.body.data.every((x, i, a) => i === 0 || a[i - 1].coletado_em <= x.coletado_em), "ordem ASC");
  });

  it("diff entre duas coletas (C-105): resumo, contagens e aviso", async () => {
    // Série isolada (rank/janela próprios) para não depender da ordem dos
    // testes: duas coletas com win deslocado em todos os heróis.
    const rowsAt = (win) => HEROES.map((h) => ({ id: h.id, name: h.name, win, pick: h.pick, ban: h.ban }));
    const antes = recordSnapshot({ fonte: "heroes", rank: "epic", janela: 1, versao_jogo: "mock-1", rows: rowsAt(0.5) });
    const depois = recordSnapshot({ fonte: "heroes", rank: "epic", janela: 1, versao_jogo: "mock-2", rows: rowsAt(0.51) });

    const r = await call(`/snapshots/${depois.coletado_em}/diff`, {});
    assert.equal(r.status, 200);
    for (const k of ["base_ts", "contra_ts", "antes_ts", "depois_ts", "fonte", "rank", "janela", "versao", "status_coletas", "pick_sum", "n_antes", "n_depois", "n_iguais", "n_adicionados", "n_removidos", "n_mudados", "mudancas", "truncado", "aviso_revisado", "aviso", "nota"]) {
      assert.ok(k in r.body, `falta ${k}`);
    }
    assert.equal(r.body.contra_ts, antes.coletado_em, "default = coleta anterior");
    assert.equal(r.body.base_ts, depois.coletado_em);
    assert.equal(r.body.n_antes, HEROES.length);
    assert.equal(r.body.n_depois, HEROES.length);
    assert.equal(r.body.n_iguais, 0);
    assert.equal(r.body.n_mudados, HEROES.length);
    assert.equal(r.body.n_adicionados, 0);
    assert.equal(r.body.n_removidos, 0);
    assert.equal(r.body.truncado, false);
    assert.equal(r.body.aviso_revisado, true);
    assert.equal(typeof r.body.aviso, "string");
    assert.deepEqual(r.body.versao, { antes: "mock-1", depois: "mock-2" });
    assert.equal(r.body.mudancas[0].campos.includes("win"), true);
    assert.equal("payload" in r.body, false);
    assert.equal((await call(`/snapshots/${antes.coletado_em}/diff`, { contra: String(antes.coletado_em) })).status, 400);
    assert.equal((await call("/snapshots/1/diff", {})).status, 404);
  });

  it("validação de filtros do histórico", async () => {
    assert.equal((await call("/snapshots", { rank: "xyz" })).status, 400);
    assert.equal((await call("/snapshots", { janela: "99" })).status, 400);
    assert.equal((await call("/snapshots", { fonte: "!!!" })).status, 400);
  });
});

// ── /modules e /meta/status ──────────────────────────────────────────────────
describe("metadados do sistema", () => {
  it("/modules — 6 contextos ativos com status e endpoint", async () => {
    const r = await call("/modules");
    assert.equal(r.status, 200);
    envelope(r.body, ["data", "c_reference", "impossibilities"], "/modules");
    assert.equal(r.body.data.length, 6);
    assert.deepEqual(r.body.data.map((m) => m.id), ["EXP", "SHR", "M6", "DRF", "BPS", "BDL"]);
    assert.equal(r.body.c_reference, 1e5);
  });

  it("/meta/status — saúde, cache, histórico e versões", async () => {
    const r = await call("/meta/status");
    assert.equal(r.status, 200);
    envelope(r.body, ["startedAt", "health", "cache", "history", "versions", "impossibilities", "lanes"], "/meta/status");
    assert.equal(typeof r.body.cache.sqlite, "boolean");
    assert.equal(typeof r.body.history.total, "number");
    assert.deepEqual(r.body.lanes, ["exp", "mid", "roam", "jungle", "gold"]);
    assert.ok(r.body.impossibilities.length >= 3);
  });

  it("rota desconhecida = 404 (não 500)", async () => {
    const r = await call("/nao-existe");
    assert.equal(r.status, 404);
    assert.equal(r.body.error, "not_found");
  });
});
