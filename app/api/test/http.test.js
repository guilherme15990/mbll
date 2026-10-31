// Servidor HTTP de ponta a ponta (F2), sem navegador e sem rede externa.
//
// POR QUE ARQUIVO PRÓPRIO: cada arquivo de `node --test` roda em um processo, e
// config/cache/router são estado de módulo (env lida no import). Aqui o dist é
// um diretório temporário e as rotas de /v1 são injetadas quando o teste precisa
// de falha/limite — sem tocar no upstream.
//
// Usa `node:http` cru (não fetch) porque `%2e%2e` e `%00` seriam normalizados
// pelo cliente e o teste de contenção de path perderia o sentido.
import "./support/env.mjs";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApiServer, stopServer } from "../src/http/server.js";
import { HttpError } from "../src/http/errors.js";

const ROOT = await mkdtemp(join(tmpdir(), "radar-http-"));
const DIST = join(ROOT, "dist");
const SECRET = "conteudo-que-nao-pode-vazar";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0xfe, 0x7f]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function request(port, path, { method = "GET", headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path, method, headers, agent: false }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}

function json(res) {
  return JSON.parse(res.body.toString("utf8"));
}

/** Sobe um servidor, roda `fn(port)` e sempre fecha. */
async function withServer(opts, fn) {
  const server = createApiServer({ webDist: DIST, logLevel: "silent", rateLimit: { enabled: false }, ...opts });
  const port = await listen(server);
  try {
    return await fn(port, server);
  } finally {
    await stopServer(server, { timeoutMs: 1_000 });
  }
}

before(async () => {
  await mkdir(join(DIST, "assets"), { recursive: true });
  await writeFile(join(DIST, "index.html"), "<!doctype html><title>radar</title>");
  await writeFile(join(DIST, "assets", "app-abc12345.js"), "console.log('oi')");
  await writeFile(join(DIST, "logo.png"), PNG);
  await writeFile(join(ROOT, "secret.txt"), SECRET);
});

after(async () => {
  await rm(ROOT, { recursive: true, force: true });
});

describe("http: request-id e headers de segurança", () => {
  it("ecoa x-request-id válido", async () => {
    await withServer({}, async (port) => {
      const res = await request(port, "/health", { headers: { "x-request-id": "abc-123_DEF:ok" } });
      assert.equal(res.headers["x-request-id"], "abc-123_DEF:ok");
    });
  });

  it("gera request-id quando ausente", async () => {
    await withServer({}, async (port) => {
      const res = await request(port, "/health");
      assert.match(res.headers["x-request-id"], UUID);
    });
  });

  it("substitui request-id inválido em vez de refletir (log injection)", async () => {
    await withServer({}, async (port) => {
      // Header legal para o cliente Node, mas fora de ^[A-Za-z0-9._:-]{1,64}$:
      // espaço/chaves (JSON no log) e tamanho acima de 64.
      for (const bad of ['id com espaço & {"level":"error"}', "a".repeat(65)]) {
        const res = await request(port, "/health", { headers: { "x-request-id": bad } });
        assert.match(res.headers["x-request-id"], UUID);
        assert.notEqual(res.headers["x-request-id"], bad);
      }
    });
  });

  it("aplica nos sniff/referrer-policy em toda resposta", async () => {
    await withServer({}, async (port) => {
      for (const path of ["/health", "/v1/modules", "/nao-existe"]) {
        const res = await request(port, path);
        assert.equal(res.headers["x-content-type-options"], "nosniff", path);
        assert.equal(res.headers["referrer-policy"], "no-referrer", path);
      }
    });
  });

  it("OPTIONS responde 204 sem corpo", async () => {
    await withServer({}, async (port) => {
      const res = await request(port, "/v1/modules", { method: "OPTIONS" });
      assert.equal(res.status, 204);
      assert.equal(res.body.length, 0);
    });
  });
});

describe("http: /health e /v1", () => {
  it("/health responde ok sem cache", async () => {
    await withServer({}, async (port) => {
      const res = await request(port, "/health");
      assert.equal(res.status, 200);
      assert.equal(res.headers["cache-control"], "no-store");
      assert.deepEqual(json(res), { ok: true });
    });
  });

  it("/v1/modules responde o catálogo com no-store", async () => {
    await withServer({}, async (port) => {
      const res = await request(port, "/v1/modules");
      assert.equal(res.status, 200);
      assert.equal(res.headers["cache-control"], "no-store");
      assert.equal(json(res).data.length, 6);
    });
  });

  it("rota /v1 desconhecida devolve 404 JSON do router", async () => {
    await withServer({}, async (port) => {
      const res = await request(port, "/v1/nao-existe");
      assert.equal(res.status, 404);
      assert.equal(res.headers["cache-control"], "no-store");
      assert.equal(json(res).error, "not_found");
    });
  });

  it("exceção vira 500 internal_error (não 502) e não vaza stack", async () => {
    const logged = [];
    const logger = { info() {}, error: (msg, fields) => logged.push({ msg, ...fields }) };
    const router = async () => { throw new Error("boom-secreto"); };
    await withServer({ router, logger }, async (port) => {
      const res = await request(port, "/v1/heroes", { headers: { "x-request-id": "req-erro" } });
      assert.equal(res.status, 500);
      const body = json(res);
      assert.equal(body.error, "internal_error");
      assert.equal(body.requestId, "req-erro");
      assert.doesNotMatch(res.body.toString("utf8"), /boom-secreto|at |stack/);
      assert.equal(logged.length, 1);
      assert.equal(logged[0].msg, "unhandled_error");
      assert.match(logged[0].err, /boom-secreto/);
    });
  });

  it("HttpError preserva status e código da aplicação", async () => {
    const router = async () => { throw new HttpError(422, "lane_required", "lane é obrigatória", { campo: "lane" }); };
    await withServer({ router }, async (port) => {
      const res = await request(port, "/v1/heroes/1/builds");
      assert.equal(res.status, 422);
      const body = json(res);
      assert.equal(body.error, "lane_required");
      assert.equal(body.campo, "lane");
      assert.ok(body.requestId);
    });
  });

  it("rate limit devolve 429 com retry-after e x-ratelimit-*", async () => {
    const router = async () => ({ status: 200, body: { ok: true } });
    const opts = { router, rateLimit: { enabled: true, rps: 1, burst: 2 } };
    await withServer(opts, async (port) => {
      assert.equal((await request(port, "/v1/x")).status, 200);
      assert.equal((await request(port, "/v1/x")).status, 200);
      const res = await request(port, "/v1/x");
      assert.equal(res.status, 429);
      assert.equal(res.headers["x-ratelimit-limit"], "2");
      assert.equal(res.headers["x-ratelimit-remaining"], "0");
      assert.equal(res.headers["retry-after"], "1");
      assert.equal(json(res).error, "rate_limited");
      assert.ok(json(res).retry_after_ms > 0);
    });
  });
});

describe("http: estático", () => {
  it("serve index.html em / com no-cache", async () => {
    await withServer({}, async (port) => {
      const res = await request(port, "/");
      assert.equal(res.status, 200);
      assert.equal(res.headers["cache-control"], "no-cache");
      assert.match(res.headers["content-type"], /^text\/html; charset=utf-8$/);
      assert.match(res.body.toString("utf8"), /<title>radar<\/title>/);
    });
  });

  it("assets com hash são immutable", async () => {
    await withServer({}, async (port) => {
      const res = await request(port, "/assets/app-abc12345.js");
      assert.equal(res.status, 200);
      assert.match(res.headers["cache-control"], /immutable/);
      assert.match(res.headers["content-type"], /^text\/javascript; charset=utf-8$/);
    });
  });

  it("PNG é entregue byte a byte, sem charset e com content-length", async () => {
    await withServer({}, async (port) => {
      const res = await request(port, "/logo.png");
      assert.equal(res.status, 200);
      assert.equal(res.headers["content-type"], "image/png");
      assert.equal(res.headers["content-length"], String(PNG.length));
      assert.ok(res.body.equals(PNG), "bytes do PNG foram alterados");
    });
  });

  it("ETag fraco responde 304 quando if-none-match bate", async () => {
    await withServer({}, async (port) => {
      const first = await request(port, "/logo.png");
      const etag = first.headers.etag;
      assert.match(etag, /^W\/"[0-9a-f]+-[0-9a-f]+"$/);
      const second = await request(port, "/logo.png", { headers: { "if-none-match": etag } });
      assert.equal(second.status, 304);
      assert.equal(second.body.length, 0);
      assert.equal(second.headers.etag, etag);
      // lista com espaços e curinga também é válida
      const third = await request(port, "/logo.png", { headers: { "if-none-match": `"outro", ${etag}` } });
      assert.equal(third.status, 304);
    });
  });

  it("HEAD devolve headers do arquivo sem corpo", async () => {
    await withServer({}, async (port) => {
      const res = await request(port, "/logo.png", { method: "HEAD" });
      assert.equal(res.status, 200);
      assert.equal(res.headers["content-length"], String(PNG.length));
      assert.equal(res.body.length, 0);
    });
  });

  it("não serve path traversal nem byte nulo (contenção em webDist)", async () => {
    await withServer({}, async (port) => {
      for (const path of ["/%2e%2e/secret.txt", "/..%2fsecret.txt", "/%2e%2e%2f%2e%2e%2fsecret.txt", "/logo.png%00.html", "/%00"]) {
        const res = await request(port, path);
        assert.equal(res.status, 404, path);
        assert.doesNotMatch(res.body.toString("utf8"), new RegExp(SECRET), path);
      }
    });
  });

  it("arquivo inexistente cai no 404 JSON com requestId", async () => {
    await withServer({}, async (port) => {
      const res = await request(port, "/sem-arquivo.json");
      assert.equal(res.status, 404);
      assert.equal(res.headers["cache-control"], "no-store");
      const body = json(res);
      assert.equal(body.error, "not_found");
      assert.ok(body.requestId);
    });
  });

  it("método não-GET em estático não é servido", async () => {
    await withServer({}, async (port) => {
      const res = await request(port, "/logo.png", { method: "POST" });
      assert.equal(res.status, 404);
    });
  });
});

describe("http: shutdown", () => {
  it("stopServer fecha e resolve sem forçar quando ocioso", async () => {
    const server = createApiServer({ webDist: DIST, logLevel: "silent", rateLimit: { enabled: false }, router: async () => ({ status: 200, body: {} }) });
    await listen(server);
    const out = await stopServer(server);
    assert.deepEqual(out, { forced: false });
    await assert.rejects(request(server.address()?.port ?? 1, "/"), /ECONNREFUSED/);
  });

  it("força conexão pendente após o timeout", async () => {
    let started;
    const began = new Promise((resolve) => { started = resolve; });
    const router = () => { started(); return new Promise(() => {}); };
    const server = createApiServer({ webDist: DIST, logLevel: "silent", rateLimit: { enabled: false }, router });
    const port = await listen(server);

    const req = http.request({ host: "127.0.0.1", port, path: "/v1/pendente", agent: false });
    req.on("error", () => {});
    req.end();
    await began;

    const out = await stopServer(server, { timeoutMs: 50 });
    assert.equal(out.forced, true);
    req.destroy();
  });
});
