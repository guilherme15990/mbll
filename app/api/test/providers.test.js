// Camada `providers/` (ADR-045): transporte externo tipado, contratos internos
// e logging estruturado. Este arquivo prova o CONTRATO da camada, não as rotas:
// cada teste chama o provider direto, sem HTTP e sem rede real.
//
// O que quebraria em silêncio sem estes testes:
// - nível de log vazando evento em produção ou sumindo em incidente;
// - `requestId` ausente no log do cliente do upstream (o caso em que ele mais importa);
// - retry/breaker do cliente voltando a engolir HTML de erro como JSON;
// - path/query da fachada divergindo da fonte (a rota "funciona" e recebe outra coisa).
import "./support/env.mjs";
import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createLogger,
  configureLogging,
  getLogger,
  normalizeLogger,
  serializeError,
  LOG_EVENTS,
} from "../src/providers/logging/index.js";
import { withRequestContext } from "../src/providers/logging/context.js";
import {
  ArenaError,
  createArenaClient,
  mapConc,
  rankPath,
  RANKS,
  WINDOWS,
  resetArenaCircuit,
  getRankPage,
  getHeroesPage,
  getEquipmentPage,
  getExpandedEquipment,
  getEmblems,
  getSpells,
  getPositions,
  getHeroLane,
  getHeroBuilds,
  getTrends,
  getCounters,
  getCompatibility,
  getVersion,
  getRaw,
} from "../src/providers/arena/index.js";
import {
  API_PREFIX,
  ContractError,
  assertEnvelope,
  assertErrorBody,
  assertRouteResult,
} from "../src/providers/contracts.js";

// ── helpers ─────────────────────────────────────────────────────────────────

/** Sink que devolve eventos já parseados (uma linha JSON por evento). */
function capture() {
  const events = [];
  const push = (line) => events.push(JSON.parse(line));
  const sink = { log: push, error: push };
  return { events, sink };
}

const resJson = (payload, status = 200) => ({
  ok: status < 400,
  status,
  headers: { get: () => "application/json" },
  text: async () => JSON.stringify(payload),
});

const resHtml = (status = 200) => ({
  ok: status < 400,
  status,
  headers: { get: () => "text/html; charset=utf-8" },
  text: async () => "<html><body>upstream fora</body></html>",
});

const resText = (text, status = 200) => ({
  ok: status < 400,
  status,
  headers: { get: () => "application/json" },
  text: async () => text,
});

/** Cliente de teste: nunca lê `globalThis.fetch`, sem breaker herdado. */
const clientWith = (fetchImpl, opts = {}) =>
  createArenaClient({ base: "https://arena.test", altHosts: [], retries: 0, fetchImpl, ...opts });

beforeEach(() => {
  // Cada teste começa com o logger do processo silencioso: um sink de teste
  // instalado por engano não deve vazar para o próximo caso.
  configureLogging({ info: () => {}, error: () => {} });
  resetArenaCircuit();
});

// ── logging ─────────────────────────────────────────────────────────────────

describe("logging — nível, formato e contexto", () => {
  it("filtra por nível e emite uma linha JSON com ts/level/msg", () => {
    const { events, sink } = capture();
    const log = createLogger("warn", sink);

    log.debug(LOG_EVENTS.ARENA_OK, { x: 1 });
    log.info(LOG_EVENTS.REQUEST, { x: 1 });
    log.warn(LOG_EVENTS.ARENA_FAILURE, { x: 1 });
    log.error(LOG_EVENTS.UNHANDLED_ERROR, { x: 1 });

    assert.deepEqual(events.map((e) => e.level), ["warn", "error"], "debug/info filtrados");
    for (const e of events) {
      assert.equal(typeof e.ts, "string");
      assert.ok(!Number.isNaN(Date.parse(e.ts)), "ts é ISO válido");
      assert.equal(e.x, 1, "campos do chamador preservados");
    }
    assert.equal(log.level, "warn");
  });

  it("silent não emite nada e error não emite warn", () => {
    const a = capture();
    const silent = createLogger("silent", a.sink);
    silent.error("e", {});
    silent.warn("w", {});
    assert.equal(a.events.length, 0);

    const b = capture();
    const onlyError = createLogger("error", b.sink);
    onlyError.warn("w", {});
    onlyError.error("e", {});
    assert.deepEqual(b.events.map((e) => e.level), ["error"]);
  });

  it("child herda nível e acumula campos fixos", () => {
    const { events, sink } = capture();
    const log = createLogger("info", sink).child({ provider: "arena" }).child({ path: "/x" });
    log.info("oi", { attempt: 2 });
    assert.deepEqual(
      { provider: events[0].provider, path: events[0].path, attempt: events[0].attempt, msg: events[0].msg },
      { provider: "arena", path: "/x", attempt: 2, msg: "oi" },
    );
  });

  it("redige campos sensíveis (inclusive aninhados) e serializa Error", () => {
    const { events, sink } = capture();
    createLogger("info", sink).info("falhou", {
      authorization: "Bearer segredo",
      headers: { cookie: "sid=1", accept: "json" },
      token: "abc",
      err: new Error("boom"),
    });

    const e = events[0];
    assert.equal(e.authorization, "[redacted]");
    assert.equal(e.token, "[redacted]");
    assert.equal(e.headers.cookie, "[redacted]");
    assert.equal(e.headers.accept, "json", "campo não sensível preservado");
    assert.equal(e.err.message, "boom");
    assert.equal(e.err.name, "Error");
  });

  it("anexa requestId do contexto (e nada fora de request)", () => {
    const { events, sink } = capture();
    const log = createLogger("info", sink);

    log.info("fora", {});
    withRequestContext({ requestId: "req-1", method: "GET", path: "/v1/heroes" }, () => {
      log.info("dentro", {});
    });

    assert.equal(events[0].requestId, undefined);
    assert.equal(events[1].requestId, "req-1");
  });

  it("não derruba o processo quando o payload não serializa (ciclo/BigInt)", () => {
    const { events, sink } = capture();
    const log = createLogger("info", sink);
    const cyclic = {};
    cyclic.self = cyclic;

    assert.doesNotThrow(() => log.info("ciclo", { cyclic }));
    assert.doesNotThrow(() => log.info("big", { n: 10n }));
    assert.equal(events[0].log_error, "serialization_failed");
    assert.equal(events[0].msg, "ciclo");
  });

  it("serializeError cobre Error e valor não-Error", () => {
    const err = new Error("x");
    err.code = "E_X";
    const out = serializeError(err);
    assert.equal(out.name, "Error");
    assert.equal(out.message, "x");
    assert.equal(out.code, "E_X");

    assert.deepEqual(serializeError("texto"), { name: "NonError", message: "texto" });
  });

  it("configureLogging aceita logger mínimo e getLogger emite nele", () => {
    const calls = [];
    configureLogging({ info: (msg, fields) => calls.push({ msg, ...fields }), error: () => {} });
    withRequestContext({ requestId: "req-2" }, () => {
      getLogger().warn("aviso");
    });
    assert.equal(calls.length, 1, "warn cai em info quando o logger mínimo não tem warn");
    assert.equal(calls[0].msg, "aviso");
    assert.equal(calls[0].requestId, "req-2", "contexto aplicado mesmo em logger injetado");
  });

  it("normalizeLogger completa child/debug sem inventar nível", () => {
    const calls = [];
    const normalized = normalizeLogger({ info: (msg) => calls.push(msg), error: () => {} });
    assert.equal(normalized.level, "info");
    normalized.child({ a: 1 }).info("filho");
    normalized.debug("ignorado");
    assert.deepEqual(calls, ["filho"], "debug ausente vira no-op");
  });
});

// ── cliente da API externa ──────────────────────────────────────────────────

describe("arena client — transporte e taxonomia de erro", () => {
  it("devolve o JSON e zera falhas consecutivas", async () => {
    const calls = [];
    const client = clientWith(async (url) => {
      calls.push(String(url));
      return resJson({ data: { records: [] } });
    });

    assert.deepEqual(await client.get("/api/heroes"), { data: { records: [] } });
    assert.deepEqual(calls, ["https://arena.test/api/heroes"]);
    assert.deepEqual(client.circuitState(), { consecutive_failures: 0, open: false, open_until: null });
  });

  it("500 vira ArenaError upstream_status com status e tentativas", async () => {
    const client = clientWith(async () => resJson({}, 500), { retries: 2 });
    await assert.rejects(client.get("/x"), (e) => {
      assert.ok(e instanceof ArenaError);
      assert.equal(e.kind, "upstream_status");
      assert.equal(e.status, 500);
      assert.equal(e.path, "/x");
      assert.equal(e.attempts, 3, "1 tentativa + 2 retries");
      return true;
    });
  });

  it("HTML no lugar de JSON não é parseado (kind non_json)", async () => {
    const client = clientWith(async () => resHtml(200));
    await assert.rejects(client.get("/x"), (e) => {
      assert.equal(e.kind, "non_json");
      return true;
    });
  });

  it("JSON inválido vira invalid_json", async () => {
    const client = clientWith(async () => resText("{quebrado"));
    await assert.rejects(client.get("/x"), (e) => {
      assert.equal(e.kind, "invalid_json");
      return true;
    });
  });

  it("timeout aborta o fetch e reporta kind timeout", async () => {
    const client = clientWith((url, { signal }) => new Promise((_, reject) => {
      signal.addEventListener("abort", () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
    }), { timeoutMs: 10 });
    await assert.rejects(client.get("/x"), (e) => {
      assert.equal(e.kind, "timeout");
      return true;
    });
  });

  it("falha de rede vira kind network", async () => {
    const client = clientWith(async () => { throw new TypeError("fetch failed"); });
    await assert.rejects(client.get("/x"), (e) => {
      assert.equal(e.kind, "network");
      assert.equal(e.message, "fetch failed");
      return true;
    });
  });

  it("segue 1 hop para host alternativo permitido", async () => {
    const seen = [];
    const client = clientWith(async (url) => {
      seen.push(String(url));
      if (seen.length === 1) {
        return {
          ok: false,
          status: 503,
          headers: { get: (h) => (h === "x-alt-host" ? "https://alt.test" : null) },
          text: async () => "{}",
        };
      }
      return resJson({ ok: true });
    }, { altHosts: ["https://alt.test"], retries: 1 });

    assert.deepEqual(await client.get("/x"), { ok: true });
    assert.deepEqual(seen, ["https://arena.test/x", "https://alt.test/x"]);
  });

  it("host alternativo fora da allowlist é ignorado", async () => {
    const seen = [];
    const client = clientWith(async (url) => {
      seen.push(String(url));
      return {
        ok: false,
        status: 503,
        headers: { get: (h) => (h === "x-alt-host" ? "https://evil.test" : null) },
        text: async () => "{}",
      };
    }, { retries: 0 });

    await assert.rejects(client.get("/x"));
    assert.deepEqual(seen, ["https://arena.test/x"], "nenhum hop para host não permitido");
  });

  it("abre o breaker após 5 falhas e recusa sem ir à rede", async () => {
    let calls = 0;
    const client = clientWith(async () => { calls++; throw new TypeError("fora"); });

    for (let i = 0; i < 5; i++) await assert.rejects(client.get("/x"));
    assert.equal(calls, 5);
    assert.equal(client.circuitState().consecutive_failures, 5);
    assert.equal(client.circuitState().open, true);

    await assert.rejects(client.get("/x"), (e) => {
      assert.equal(e.kind, "circuit_open");
      assert.equal(e.attempts, 0);
      return true;
    });
    assert.equal(calls, 5, "breaker evitou a 6ª chamada de rede");
  });

  it("sucesso no meio do caminho zera as falhas consecutivas", async () => {
    let calls = 0;
    const client = clientWith(async () => {
      calls++;
      if (calls <= 4) throw new TypeError("fora");
      return resJson({ ok: true });
    });

    for (let i = 0; i < 4; i++) await assert.rejects(client.get("/x"));
    await client.get("/x");
    assert.equal(client.circuitState().consecutive_failures, 0);
  });

  it("emite arena_failure estruturado com kind/status", async () => {
    const { events, sink } = capture();
    configureLogging(createLogger("warn", sink));
    const client = clientWith(async () => resJson({}, 502));
    await assert.rejects(client.get("/x"));
    const e = events.find((ev) => ev.msg === LOG_EVENTS.ARENA_FAILURE);
    assert.ok(e, "evento de falha emitido");
    assert.equal(e.kind, "upstream_status");
    assert.equal(e.status, 502);
    assert.equal(e.provider, "arena");
  });

  it("mapConc preserva ordem e respeita o limite de concorrência", async () => {
    let active = 0;
    let peak = 0;
    const out = await mapConc([1, 2, 3, 4, 5], async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 2));
      active--;
      return n * 10;
    }, 2);

    assert.deepEqual(out, [10, 20, 30, 40, 50]);
    assert.ok(peak <= 2, `concorrência estourou o limite: ${peak}`);
  });

  it("rankPath codifica a query e usa defaults", () => {
    assert.equal(rankPath(), "/api/heroes/rank?days=7&rank=mythic&size=50&index=1");
    assert.equal(rankPath({ days: 30, rank: "glory", size: 10, index: 2 }),
      "/api/heroes/rank?days=30&rank=glory&size=10&index=2");
    assert.deepEqual(RANKS, ["all", "epic", "legend", "mythic", "honor", "glory"]);
    assert.deepEqual(WINDOWS, [1, 3, 7, 15, 30]);
  });
});

// ── fachada tipada (paths/query) ────────────────────────────────────────────

describe("arena facade — paths e query da fonte", () => {
  /** Executa `fn` com `globalThis.fetch` trocado e o breaker limpo. */
  async function withFetch(fn) {
    const orig = globalThis.fetch;
    const urls = [];
    globalThis.fetch = async (url) => {
      urls.push(String(url));
      return resJson({ data: { records: [] } });
    };
    resetArenaCircuit();
    try {
      await fn(urls);
    } finally {
      globalThis.fetch = orig;
      resetArenaCircuit();
    }
  }

  it("monta os paths de rank/catálogo/ficha", async () => {
    await withFetch(async (urls) => {
      await getRankPage({ days: 3, rank: "legend", size: 50, index: 2 });
      await getHeroesPage();
      await getEquipmentPage({ size: 50, index: 1 });
      await getExpandedEquipment();
      await getEmblems();
      await getSpells();
      await getPositions();
      await getHeroLane(7);
      await getHeroBuilds({ id: 7, lane: "exp", rank: "mythic" });
      await getTrends({ id: 7, rank: "mythic", days: 30 });
      await getCounters({ id: 7, rank: "glory", days: 7 });
      await getCompatibility({ id: 7, rank: "glory", days: 7 });
      await getVersion();
      await getRaw("/api/qualquer");

      const paths = urls.map((u) => u.replace("https://api.rone.dev", ""));
      assert.ok(urls.every((u) => u.startsWith("http")), "base configurada aplicada");
      assert.equal(paths.length, 14);
      assert.match(paths[0], /\/api\/heroes\/rank\?days=3&rank=legend&size=50&index=2/);
      assert.match(paths[1], /\/api\/heroes\?size=133&index=1/);
      assert.match(paths[2], /\/api\/academy\/equipment\?size=50&index=1/);
      assert.match(paths[3], /\/api\/academy\/equipment\/expanded\?size=200&index=1/);
      assert.match(paths[4], /\/api\/academy\/emblems\?size=200&index=1/);
      assert.match(paths[5], /\/api\/academy\/spells\?size=200&index=1/);
      assert.match(paths[6], /\/api\/heroes\/positions\?size=200&index=1/);
      assert.match(paths[7], /\/api\/academy\/heroes\/7\/lane/);
      assert.match(paths[8], /\/api\/academy\/heroes\/7\/builds\?lane=exp&rank=mythic&size=6&index=1/);
      assert.match(paths[9], /\/api\/heroes\/7\/trends\?rank=mythic&past-days=30&size=30&index=1/);
      assert.match(paths[10], /\/api\/heroes\/7\/counters\?days=7&rank=glory&size=20&index=1/);
      assert.match(paths[11], /\/api\/heroes\/7\/compatibility\?days=7&rank=glory&size=20&index=1/);
      assert.match(paths[12], /\/api\/academy\/meta\/version\?size=5&index=1/);
      assert.match(paths[13], /\/api\/qualquer$/);
    });
  });
});

// ── contratos da API interna ───────────────────────────────────────────────

describe("contracts — guardas da API interna", () => {
  it("API_PREFIX é /v1 (o web depende disto)", () => {
    assert.equal(API_PREFIX, "/v1");
  });

  it("assertRouteResult aceita {status, body} e rejeita status fora de faixa", () => {
    assert.doesNotThrow(() => assertRouteResult({ status: 200, body: {} }));
    assert.doesNotThrow(() => assertRouteResult({ status: 204, body: null }));
    assert.throws(() => assertRouteResult({ body: {} }), ContractError);
    assert.throws(() => assertRouteResult({ status: 99, body: {} }), /status inválido/);
    assert.throws(() => assertRouteResult({ status: 600, body: {} }), /status inválido/);
    assert.throws(() => assertRouteResult({ status: 200 }), /body ausente/);
    assert.throws(() => assertRouteResult(null), /não é objeto/);
  });

  it("assertErrorBody exige error e message não vazios", () => {
    assert.doesNotThrow(() => assertErrorBody({ error: "x", message: "y" }));
    assert.throws(() => assertErrorBody({ error: "x" }), /message/);
    assert.throws(() => assertErrorBody({ error: "", message: "y" }), /error/);
    assert.throws(() => assertErrorBody({ error: 1, message: "y" }), /error/);
  });

  it("assertEnvelope exige data e valida metadados quando presentes", () => {
    assert.doesNotThrow(() => assertEnvelope({ data: [] }));
    assert.doesNotThrow(() => assertEnvelope({ data: {}, total: 1, stale: false, ageMs: 0 }));
    assert.throws(() => assertEnvelope({}), /data ausente/);
    assert.throws(() => assertEnvelope({ data: undefined }), /data ausente/);
    assert.throws(() => assertEnvelope({ data: {}, total: "1" }), /total/);
    assert.throws(() => assertEnvelope({ data: {}, stale: "no" }), /stale/);
    assert.throws(() => assertEnvelope({ data: {}, ageMs: NaN }), /ageMs/);
  });

  it("ContractError carrega detalhe do campo que falhou", () => {
    try {
      assertEnvelope({ data: {}, total: "1" }, "GET /x");
      assert.fail("deveria lançar");
    } catch (e) {
      assert.ok(e instanceof ContractError);
      assert.equal(e.name, "ContractError");
      assert.equal(e.detail.total, "1");
      assert.match(e.message, /GET \/x/);
    }
  });
});
