// Hermetismo: banco temporário por processo. PRIMEIRO import (ver support/env.mjs).
import "./support/env.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { score, scoreLot } from "../src/application/scoring.js";
import { classOf } from "@radar/engine";

describe("contratos internos Fase 1 (zero-dep)", () => {
  const rows = [
    { id: 14, name: "Rafaela", win: 0.597, pick: 0.014, ban: 0.24 },
    { id: 88, name: "Masha", win: 0.596, pick: 0.008, ban: 0.46 },
    ...Array.from({ length: 18 }, (_, i) => ({ id: 100 + i, name: `H${i}`, win: 0.5, pick: 0.05, ban: 0.05 })),
  ];
  it("envelope INV-008 em cada herói (contrato enxuto + desvios a/b/c)", () => {
    // MOTIVO: `d` saiu do motor (DESVIO c), `class` virou classOf(), tiers de
    // confiança e selo Robusto podados (v3); `prior` mora em meta; `z`/`posterior_mean`
    // retidos (desvios a/b); `strong`/`weak` no fio.
    const out = score(rows);
    for (const h of out) {
      for (const k of ["wrAdj", "z", "q", "tier", "strong", "weak", "isGem", "posterior_mean", "degenerate", "smallSample"]) assert.ok(k in h, `falta ${k} em ${h.id}`);
      for (const k of ["d", "class", "confidence", "prior"]) assert.ok(!(k in h), `fora do contrato em ${h.id}: ${k}`);
      assert.ok(["S", "A", "B", "C", "D", "?"].includes(h.tier));
      assert.ok(typeof classOf(h) === "string");
    }
  });
  it("fio preservado: wrAdj 4, z 2, q 4, B 3 (mesmas casas de antes)", () => {
    const out = score(rows);
    const dec = (v) => (String(v).split(".")[1] ?? "").length;
    for (const h of out) {
      assert.ok(dec(h.wrAdj) <= 4, `wrAdj ${h.wrAdj}`);
      assert.ok(dec(h.z) <= 2, `z ${h.z}`);
      assert.ok(dec(h.q) <= 4, `q ${h.q}`);
      assert.ok(dec(h.B) <= 3, `B ${h.B}`);
    }
  });
  it("meta do lote vem do scoreBatch (substitui o lotMeta local)", () => {
    const { meta } = scoreLot(rows, {});
    for (const k of ["n", "mu", "tau", "c_reference", "prior", "counts"]) {
      assert.ok(k in meta, `falta ${k} na meta`);
    }
    assert.equal(meta.n, rows.length);
  });
  it("strength-index-v1 ADR-024 em cada herói (0..100, topo=100, empates iguais)", () => {
    const out = score(rows);
    for (const h of out) {
      assert.ok(typeof h.strength_index === "number" && h.strength_index >= 0 && h.strength_index <= 100, `idx fora em ${h.id}`);
      assert.ok(!("strength_index_version" in h), "sem carimbo de versão por herói");
    }
    const top = out.reduce((a, b) => (a.strength_index >= b.strength_index ? a : b));
    assert.equal(top.id, 14, "maior índice = maior θ̂ (Rafaela)");
    assert.equal(top.strength_index, 100);
    const tied = out.filter((h) => h.id !== 14 && h.id !== 88);
    assert.ok(tied.every((h) => h.strength_index === tied[0].strength_index), "18 empatados com índice igual");
  });
  it("EC-003/EC-004: degenerado e amostra pequena nunca viram Forte/Joia", () => {
    const base = Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, name: `H${i}`, win: 0.5, pick: 0.05, ban: 0.05 }));
    const deg = score([...base, { id: 1, name: "X", win: 1, pick: 0.001, ban: 0.01 }]);
    const x = deg.find((h) => h.id === 1);
    assert.equal(x.degenerate, true);
    // MOTIVO: class saiu do fio — deriva via classOf.
    assert.ok(!["Forte", "Joia"].includes(classOf(x)));
    const tiny = score([{ id: 1, name: "A", win: 0.7, pick: 0.2, ban: 0.2 }]);
    assert.equal(tiny[0].smallSample, true);
    assert.equal(classOf(tiny[0]), "Amostra pequena");
    assert.deepEqual(score([{ id: 9, name: "NaN", win: NaN, pick: 0.1, ban: 0.1 }]), []);
  });
  it("query validation: rank/window inválidos rejeitados", async () => {
    const { router } = await import("../src/http/router.js");
    const bad = await router("/heroes", new URLSearchParams({ rank: "xyz", window: "7" }));
    assert.equal(bad.status, 400);
    const unk = await router("/nope", new URLSearchParams());
    assert.equal(unk.status, 404);
    const views = await router("/views/x", new URLSearchParams());
    assert.equal(views.status, 410);
  });
});

describe("builds enriquecidos com equipment, emblema, talentos e feitiço (builds:v5)", () => {
  const EQUIP_PAGE1 = { data: { records: [
    { data: { equipid: 101, equipname: "Blade of Despair", equipicon: "https://x/101.png" } },
    { data: { equipid: 102, equipname: "Swift Boots", equipicon: "https://x/102.png" } },
  ], total: 2 } };
  const EQUIP_EMPTY = { data: { records: [], total: 2 } };
  const EMBLEM_PAGE = { data: { records: [
    { data: { giftid: 7, gifttiers: 1, emblemskill: { skillname: "Agility", skillicon: "https://x/t7.png", skilldesc: "movement speed" } } },
    { data: { giftid: 9, gifttiers: 3, emblemskill: { skillname: "Lethal", skillicon: "https://x/t9.png", skilldesc: "extra damage" } } },
  ], total: 2 } };
  const buildsPayload = (equipids) => ({ data: { records: [
    { data: { hero_name: "H", build: [
      { build_win_rate: 0.55, build_pick_rate: 0.2, equipid: equipids, emblem: { data: { emblemid: 42, emblemname: "Support", attriicon: "https://x/42.png" } },
        new_rune_skill: [7, 999, 9],
        battleskill: { data: { skillname: "Flicker", skillicon: "https://x/flicker.png" } } },
    ] } },
  ], total: 1 } });
  function okJson(payload) {
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => payload };
  }
  // Hermético entre runs: o cache SQLite persiste em disco; apaga as chaves do teste
  // (fallback memória é volátil por processo — nada a fazer).
  async function evictCache(keys) {
    const tried = new Set();
    const files = [process.env.SQLITE_FILE, "./data/cache.sqlite"];
    try {
      const { fileURLToPath } = await import("node:url");
      files.push(fileURLToPath(new URL("../data/cache.sqlite", import.meta.url)));
    } catch {}
    for (const f of files) {
      if (!f || tried.has(f)) continue;
      tried.add(f);
      try {
        const { DatabaseSync } = await import("node:sqlite");
        const db = new DatabaseSync(f, { readOnly: false });
        try {
          for (const k of keys) db.prepare("DELETE FROM cache WHERE key=?").run(k);
        } finally { db.close(); }
      } catch {}
    }
  }
  async function cacheHas(key) {
    const files = [process.env.SQLITE_FILE, "./data/cache.sqlite"];
    try {
      const { fileURLToPath } = await import("node:url");
      files.push(fileURLToPath(new URL("../data/cache.sqlite", import.meta.url)));
    } catch {}
    for (const f of files) {
      if (!f) continue;
      try {
        const { DatabaseSync } = await import("node:sqlite");
        const db = new DatabaseSync(f, { readOnly: true });
        try {
          if (db.prepare("SELECT key FROM cache WHERE key=?").get(key)) return true;
        } finally { db.close(); }
      } catch {}
    }
    return false;
  }
  function mockFetch(handler) {
    const orig = globalThis.fetch;
    globalThis.fetch = handler;
    return () => { globalThis.fetch = orig; };
  }
  function equipPage(url) {
    const u = new URL(String(url));
    return okJson(Number(u.searchParams.get("index") ?? 1) === 1 ? EQUIP_PAGE1 : EQUIP_EMPTY);
  }

  it("GET /equipment retorna mapa equipid -> {name, icon} e para na página curta", async () => {
    const { router } = await import("../src/http/router.js");
    await evictCache(["equipment"]);
    let equipCalls = 0;
    const restore = mockFetch(async (url) => {
      if (!String(url).includes("/api/academy/equipment")) throw new Error(`inesperado: ${url}`);
      equipCalls++;
      return equipPage(url);
    });
    try {
      const r = await router("/equipment", new URLSearchParams());
      assert.equal(r.status, 200);
      assert.equal(r.body.data["101"].name, "Blade of Despair");
      assert.equal(r.body.data["101"].icon, "https://x/101.png");
      assert.equal(r.body.data["102"].name, "Swift Boots");
      assert.equal(r.body.total, 2);
      assert.equal(r.body.stale, false);
      assert.equal(equipCalls, 1); // 2 registros < 100 encerra na 1ª página
    } finally { restore(); }
  });
  it("builds resolve nome/ícone; id desconhecido mantém null", async () => {
    const { router } = await import("../src/http/router.js");
    await evictCache(["equipment", "emblems:v1", "builds:v5:9101:mythic:mid"]);
    const restore = mockFetch(async (url) => {
      url = String(url);
      if (url.includes("/api/academy/heroes/9101/builds")) return okJson(buildsPayload([101, 102, 999]));
      if (url.includes("/api/academy/equipment")) return equipPage(url);
      if (url.includes("/api/academy/emblems")) return okJson(EMBLEM_PAGE);
      throw new Error(`inesperado: ${url}`);
    });
    try {
      const r = await router("/heroes/9101/builds", new URLSearchParams({ lane: "mid" }));
      assert.equal(r.status, 200);
      const items = r.body.data[0].items;
      assert.deepEqual(items[0], { id: 101, name: "Blade of Despair", icon: "https://x/101.png" });
      assert.deepEqual(items[1], { id: 102, name: "Swift Boots", icon: "https://x/102.png" });
      assert.deepEqual(items[2], { id: 999, name: null, icon: null }); // honesto: desconhecido = null
      assert.deepEqual(r.body.data[0].emblem, { id: 42, name: "Support", icon: "https://x/42.png" });
      assert.deepEqual(r.body.data[0].talents, [
        { id: 7, name: "Agility", tier: 1, desc: "movement speed", icon: "https://x/t7.png" },
        { id: 999, name: null, tier: null, desc: null, icon: null },
        { id: 9, name: "Lethal", tier: 3, desc: "extra damage", icon: "https://x/t9.png" },
      ]);
      assert.deepEqual(r.body.data[0].spell, { name: "Flicker", icon: "https://x/flicker.png" });
    } finally { restore(); }
  });
  it("sem equipment (falha) mantém ids com null sem quebrar", async () => {
    const { router } = await import("../src/http/router.js");
    await evictCache(["equipment", "builds:v5:9102:mythic:mid"]);
    const restore = mockFetch(async (url) => {
      url = String(url);
      if (url.includes("/api/academy/heroes/9102/builds")) return okJson(buildsPayload([555, 556]));
      if (url.includes("/api/academy/equipment")) throw new Error("arena 500 em /api/academy/equipment");
      throw new Error(`inesperado: ${url}`);
    });
    try {
      const r = await router("/heroes/9102/builds", new URLSearchParams({ lane: "mid" }));
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.data[0].items, [
        { id: 555, name: null, icon: null },
        { id: 556, name: null, icon: null },
      ]);
    } finally { restore(); }
  });
  it("feitiço aninhado em battleskill.data.__data é lido", async () => {
    const { router } = await import("../src/http/router.js");
    await evictCache(["equipment", "emblems:v1", "builds:v5:9103:mythic:mid"]);
    const nested = { data: { records: [
      { data: { hero_name: "H", build: [
        { build_win_rate: 0.5, build_pick_rate: 0.1, equipid: [101],
          battleskill: { data: { __data: { skillname: "Retribution", skillicon: "https://x/retribution.png" } } } },
      ] } },
    ], total: 1 } };
    const restore = mockFetch(async (url) => {
      url = String(url);
      if (url.includes("/api/academy/heroes/9103/builds")) return okJson(nested);
      if (url.includes("/api/academy/equipment")) return equipPage(url);
      if (url.includes("/api/academy/emblems")) return okJson(EMBLEM_PAGE);
      throw new Error(`inesperado: ${url}`);
    });
    try {
      const r = await router("/heroes/9103/builds", new URLSearchParams({ lane: "mid" }));
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.data[0].spell, { name: "Retribution", icon: "https://x/retribution.png" });
    } finally { restore(); }
  });
  it("cache da rota builds usa key builds:v5 (não serve corpo velho)", async () => {
    assert.equal(await cacheHas("builds:v5:9101:mythic:mid"), true);
    assert.equal(await cacheHas("builds:v4:9101:mythic:mid"), false);
  });
});

describe("lanes por herói (road_sort_title -> LANES)", () => {
  async function evictKeys(keys) {
    const tried = new Set();
    const files = [process.env.SQLITE_FILE, "./data/cache.sqlite"];
    try {
      const { fileURLToPath } = await import("node:url");
      files.push(fileURLToPath(new URL("../data/cache.sqlite", import.meta.url)));
    } catch {}
    for (const f of files) {
      if (!f || tried.has(f)) continue;
      tried.add(f);
      try {
        const { DatabaseSync } = await import("node:sqlite");
        const db = new DatabaseSync(f, { readOnly: false });
        try {
          for (const k of keys) db.prepare("DELETE FROM cache WHERE key=?").run(k);
        } finally { db.close(); }
      } catch {}
    }
  }
  function okJson(payload) {
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => payload };
  }
  function mockFetch(handler) {
    const orig = globalThis.fetch;
    globalThis.fetch = handler;
    return () => { globalThis.fetch = orig; };
  }
  const lanePayload = (titles) => ({ data: { records: [
    { data: { hero_id: 1, hero: { data: { roadsort: titles.map((t) => ({ data: { road_sort_title: t } })) } } } },
  ], total: 1 } });

  it("mapeia títulos reais da fonte (Jungle/Exp Lane/Mid Lane/Roam/Gold Lane)", async () => {
    const { lanesFromRoadsort } = await import("../src/application/rankLot.js");
    assert.deepEqual(lanesFromRoadsort([{ data: { road_sort_title: "Jungle" } }]).lanes, ["jungle"]);
    assert.deepEqual(lanesFromRoadsort([{ data: { road_sort_title: "Exp Lane" } }]).lanes, ["exp"]);
    assert.deepEqual(lanesFromRoadsort([{ data: { road_sort_title: "Mid Lane" } }]).lanes, ["mid"]);
    assert.deepEqual(lanesFromRoadsort([{ data: { road_sort_title: "Roam" } }]).lanes, ["roam"]);
    assert.deepEqual(lanesFromRoadsort([{ data: { road_sort_title: "Gold Lane" } }]).lanes, ["gold"]);
    // entrada "" vazia que a fonte anexa por herói é ignorada; duplicada não repete
    const multi = lanesFromRoadsort([
      { data: { road_sort_title: "Jungle" } },
      { data: { road_sort_title: "Exp Lane" } },
      "",
      null,
      { data: { road_sort_title: "Jungle" } },
    ]);
    assert.deepEqual(multi.lanes, ["jungle", "exp"]);
    assert.deepEqual(multi.unknown, []);
  });
  it("título desconhecido -> herói SEM lane (registrado em unknown, nunca inventada)", async () => {
    const { lanesFromRoadsort } = await import("../src/application/rankLot.js");
    const r = lanesFromRoadsort([
      { data: { road_sort_title: "Mid Lane" } },
      { data: { road_sort_title: "Super Lane" } },
    ]);
    assert.deepEqual(r.lanes, ["mid"]); // só a conhecida
    assert.deepEqual(r.unknown, ["Super Lane"]); // desconhecida sinalizada p/ log, sem lane
    assert.deepEqual(lanesFromRoadsort([{ data: { road_sort_title: "X" } }]).lanes, []);
  });
  it("GET /heroes/lanes agrega por herói via mapConc e responde {data,total,stale,ageMs}", async () => {
    const { router } = await import("../src/http/router.js");
    await evictKeys(["lanes:epic", "rank:epic:7"]);
    const rankPayload = { data: { total: 2, records: [
      { data: { main_heroid: 11, main_hero: { data: { name: "H11" } }, main_hero_win_rate: 0.55, main_hero_appearance_rate: 0.1, main_hero_ban_rate: 0.1 } },
      { data: { main_heroid: 12, main_hero: { data: { name: "H12" } }, main_hero_win_rate: 0.5, main_hero_appearance_rate: 0.2, main_hero_ban_rate: 0.2 } },
    ] } };
    const restore = mockFetch(async (url) => {
      url = String(url);
      if (url.includes("/api/heroes/rank")) return okJson(rankPayload);
      if (url.includes("/api/academy/heroes/11/lane")) return okJson(lanePayload(["Jungle", "Exp Lane"]));
      if (url.includes("/api/academy/heroes/12/lane")) return okJson(lanePayload(["Mid Lane", "X Lane"]));
      throw new Error(`inesperado: ${url}`);
    });
    try {
      const r = await router("/heroes/lanes", new URLSearchParams({ rank: "epic" }));
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.data["11"], ["jungle", "exp"]);
      assert.deepEqual(r.body.data["12"], ["mid"]); // X Lane desconhecida não vira lane
      assert.equal(r.body.total, 2);
      assert.equal(r.body.stale, false);
      assert.equal(typeof r.body.ageMs, "number");
      // rank inválido rejeitado
      assert.equal((await router("/heroes/lanes", new URLSearchParams({ rank: "xyz" }))).status, 400);
    } finally { restore(); }
  });
  it("falha do upstream -> mapa vazio 200 (lista segue sem filtro, nunca quebra)", async () => {
    const { router } = await import("../src/http/router.js");
    await evictKeys(["lanes:honor", "rank:honor:7", "catalog"]);
    const restore = mockFetch(async (url) => { throw new Error(`arena 500 em ${url}`); });
    try {
      const r = await router("/heroes/lanes", new URLSearchParams({ rank: "honor" }));
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.data, {});
      assert.equal(r.body.total, 0);
    } finally { restore(); }
  });
});

describe("prior flat na API (walk-forward removido — ADR-065)", () => {
  const mkRows = (bump = 0) => [
    ...Array.from({ length: 12 }, (_, i) => ({ id: 200 + i, name: `W${i}`, win: +(0.46 + i * 0.004).toFixed(4), pick: 0.05, ban: 0.05 })),
    { id: 1, name: "Spike", win: 0.60 + bump, pick: 0.008, ban: 0.05 },
  ];

  it("sem histórico o lote é flat (selo em meta + sem `prior` por herói)", () => {
    const out = score(mkRows());
    assert.ok(out.length > 10);
    // MOTIVO: prior por herói → meta.prior (MIGRACAO §2); o fio não carrega mais `prior`.
    for (const h of out) assert.ok(!("prior" in h));
    assert.equal(scoreLot(mkRows(), {}).meta.prior, "flat");
  });

  it("GET /heroes carimba prior no payload (L2-WF-05, só o carimbo)", async () => {
    const { router } = await import("../src/http/router.js");
    function okJson(payload) {
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => payload };
    }
    const rankPayload = { data: { total: 13, records: mkRows().map((h) => ({ data: {
      main_heroid: h.id, main_hero: { data: { name: h.name } },
      main_hero_win_rate: h.win, main_hero_appearance_rate: h.pick, main_hero_ban_rate: h.ban,
    } })) } };
    const orig = globalThis.fetch;
    globalThis.fetch = async (url) => {
      url = String(url);
      if (url.includes("/api/heroes/rank")) return okJson(rankPayload);
      if (url.includes("/api/academy/meta/version")) return okJson({ data: { records: [] } });
      throw new Error(`inesperado: ${url}`);
    };
    try {
      // evita cache quente de outra suite p/ este rank+janela? usa legend/3 (só forma, sem fetch novo)
      const r = await router("/heroes", new URLSearchParams({ rank: "legend", window: "3", size: "50", index: "1" }));
      assert.equal(r.status, 200);
      assert.match(r.body.prior, /^(flat|walk-forward v\d+)$/);
      assert.ok(r.body.data.length > 10);
      // MOTIVO: carimbo no payload + meta (não mais por herói); meta veio do scoreBatch.
      for (const h of r.body.data) assert.ok(!("prior" in h));
      assert.equal(r.body.meta.prior, r.body.prior);
    } finally { globalThis.fetch = orig; }
  });

  it("golden do fio: sort default 'd' = ordem θ̂ + casas decimais congeladas (critic-017)", async () => {
    const { router } = await import("../src/http/router.js");
    function okJson(payload) {
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => payload };
    }
    const mk = (id, win, pick = 0.05) => ({
      data: {
        main_heroid: id, main_hero: { data: { name: `G${id}` } },
        main_hero_win_rate: win, main_hero_appearance_rate: pick, main_hero_ban_rate: 0.05,
      },
    });
    const wins = [0.62, 0.55, 0.51, 0.48, 0.44, 0.6, 0.53, 0.49, 0.57, 0.46, 0.52, 0.5];
    // picks variados DE PROPÓSITO: 705 (win 0.60/pick 0.5) tem z MAIOR que 700
    // (win 0.62/pick 0.02) mas θ̂ MENOR — fixture que discrimina sort=θ̂ de sort=z.
    const picks = [0.02, 0.1, 0.05, 0.05, 0.05, 0.5, 0.1, 0.05, 0.05, 0.05, 0.1, 0.05];
    const rankPayload = { data: { total: wins.length, records: wins.map((w, i) => mk(700 + i, w, picks[i])) } };
    const orig = globalThis.fetch;
    globalThis.fetch = async (url) => {
      url = String(url);
      if (url.includes("/api/heroes/rank")) return okJson(rankPayload);
      if (url.includes("/api/academy/meta/version")) return okJson({ data: { records: [] } });
      throw new Error(`inesperado: ${url}`);
    };
    try {
      const dec = (v) => String(v).split(".")[1]?.length ?? 0;
      // glory/30: chave de cache virgem (epic/7 está quente pelo teste de lanes)
      const r = await router("/heroes", new URLSearchParams({ rank: "glory", window: "30", size: "50", index: "1" }));
      assert.equal(r.status, 200);
      const rows = r.body.data;
      assert.equal(rows.length, wins.length);
      // default sort=d ordena por θ̂ desc (não por z) — mesma ordem do alias da engine
      const thetas = rows.map((h) => h.wrAdj);
      assert.deepEqual([...thetas].sort((a, b) => b - a), thetas);
      for (const h of rows) {
        assert.ok(dec(h.wrAdj) <= 4, `wrAdj 4 casas em ${h.id}`);
        assert.ok(dec(h.z) <= 2, `z 2 casas em ${h.id}`);
        assert.ok(dec(h.q) <= 4, `q 4 casas em ${h.id}`);
        assert.ok(dec(h.B) <= 3, `B 3 casas em ${h.id}`);
      }
      // Ordem default acompanha θ̂ na fixture (com o prior ambiente, z pode
      // embaralhar — a prova forte anti-regressão sort=d→z está no teste
      // "paginate: sort=d é alias de wrAdj" abaixo, determinístico e sem DB).
      const thetasDesc = rows.map((h) => h.wrAdj);
      assert.deepEqual([...thetasDesc].sort((a, b) => b - a), thetasDesc);
      // Golden (R1): ordem prova sort=θ̂ (top θ̂ é 700; top z seria 705 — mutação
      // sort=d→z falha aqui). Sem valores exatos de herói: o DB de teste é
      // compartilhado com o dev e o prior walk-forward desloca pontuais;
      // mu/tau (do lote cru) e o topo são imunes e travados abaixo.
      const g700 = rows.find((h) => h.id === 700);
      assert.equal(g700.tier, "S");
      assert.equal(g700.strength_index, 100);
      assert.ok(r.body.meta && typeof r.body.meta.mu === "number", "meta do lote presente");
      assert.deepEqual(
        { mu: r.body.meta.mu, tau: r.body.meta.tau, c: r.body.meta.c, prior: r.body.meta.prior },
        { mu: 0.515, tau: 0.0519, c: 100000, prior: "flat" },
      );
    } finally { globalThis.fetch = orig; }
  });

  it("paginate: sort=d é alias de wrAdj (mutação d→z falha aqui) — R1", async () => {
    const { paginate } = await import("../src/application/scoring.js");
    // Fixture discriminante: top θ̂ (id 1) ≠ top z (id 2). Sem DB, sem prior.
    const scored = [
      { id: 1, wrAdj: 0.62, z: 2.1 },
      { id: 2, wrAdj: 0.60, z: 9.4 },
      { id: 3, wrAdj: 0.55, z: 1.2 },
    ];
    const byD = paginate(scored, { sort: "d", order: "desc", size: 50, index: 1 });
    assert.deepEqual(byD.data.map((h) => h.id), [1, 2, 3]);
    const byDAsc = paginate(scored, { sort: "d", order: "asc", size: 50, index: 1 });
    assert.deepEqual(byDAsc.data.map((h) => h.id), [3, 2, 1]);
    const byWin = paginate(scored, { sort: "win", order: "desc", size: 50, index: 1 });
    assert.deepEqual(byWin.data.map((h) => h.id), [1, 2, 3]);
  });
});
