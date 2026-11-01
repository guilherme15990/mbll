// Contrato de config.js (F2/F3): defaults, DATA_DIR e fail-fast.
//
// O ponto destes testes é a PROMESSA de operação: valor inválido não vira
// NaN/undefined em silêncio, vira exceção com o nome da variável. `parseConfig`
// é pura (recebe env), então nada aqui depende do ambiente da máquina.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAbsolute, join, resolve } from "node:path";
import { parseConfig } from "../src/infra/config.js";

function throwsWith(fn, needle) {
  assert.throws(fn, (e) => {
    assert.match(String(e.message), /config inválida/);
    assert.ok(String(e.message).includes(needle), `mensagem sem "${needle}": ${e.message}`);
    return true;
  });
}

describe("config: defaults", () => {
  const c = parseConfig({});

  it("porta, upstream e concorrência", () => {
    assert.equal(c.port, 3001);
    assert.equal(c.arena.base, "https://arena.fastapicloud.dev");
    assert.deepEqual(c.arena.altHosts, []);
    assert.equal(c.arena.conc, 4);
  });

  it("cache ligado e arquivo ancorado em DATA_DIR (não no CWD)", () => {
    assert.equal(c.cache.sqlite, true);
    assert.ok(isAbsolute(c.dataDir), c.dataDir);
    assert.match(c.dataDir, /data$/);
    assert.equal(c.cache.file, join(c.dataDir, "cache.sqlite"));
    assert.ok(isAbsolute(c.cache.file), c.cache.file);
  });

  it("http: webDist absoluto, log info, proxy off, limite 20/60, shutdown 10s", () => {
    assert.ok(isAbsolute(c.http.webDist), c.http.webDist);
    assert.match(c.http.webDist, /app[\\/]web[\\/]dist$/);
    assert.equal(c.http.logLevel, "info");
    assert.equal(c.http.trustProxy, false);
    assert.deepEqual(c.http.rateLimit, { enabled: true, rps: 20, burst: 60 });
    assert.equal(c.http.shutdownTimeoutMs, 10_000);
  });
});

describe("config: valores válidos", () => {
  it("aceita porta 0 (efêmera) e 65535", () => {
    assert.equal(parseConfig({ PORT: "0" }).port, 0);
    assert.equal(parseConfig({ PORT: "65535" }).port, 65535);
  });

  it("normaliza base sem barra final e alt hosts por origin", () => {
    const c = parseConfig({
      ARENA_BASE: "https://example.com/api/",
      ARENA_ALT_HOSTS: "https://a.example.com/x, http://b.example.com:8080/ ,,",
    });
    assert.equal(c.arena.base, "https://example.com/api");
    assert.deepEqual(c.arena.altHosts, ["https://a.example.com", "http://b.example.com:8080"]);
  });

  it("SQLITE_CACHE: só 'off' desliga (compat com o contrato antigo)", () => {
    assert.equal(parseConfig({ SQLITE_CACHE: "off" }).cache.sqlite, false);
    assert.equal(parseConfig({ SQLITE_CACHE: "on" }).cache.sqlite, true);
    assert.equal(parseConfig({ SQLITE_CACHE: "qualquer" }).cache.sqlite, true);
    assert.equal(parseConfig({ SQLITE_FILE: "C:/tmp/x.sqlite" }).cache.file, resolve("C:/tmp/x.sqlite"));
  });

  it("DATA_DIR: relativo ancora na raiz do repo; absoluto é mantido", () => {
    const rel = parseConfig({ DATA_DIR: "dados-teste" });
    assert.ok(isAbsolute(rel.dataDir), rel.dataDir);
    assert.match(rel.dataDir, /dados-teste$/);
    assert.equal(rel.cache.file, join(rel.dataDir, "cache.sqlite"));
    assert.equal(parseConfig({ DATA_DIR: rel.dataDir }).dataDir, rel.dataDir);
  });

  it("SQLITE_FILE override relativo continua absoluto (sem CWD implícito)", () => {
    const c = parseConfig({ SQLITE_FILE: "meu-cache.sqlite" });
    assert.ok(isAbsolute(c.cache.file), c.cache.file);
    assert.match(c.cache.file, /meu-cache\.sqlite$/);
  });

  it("LOG_LEVEL normaliza caixa", () => {
    assert.equal(parseConfig({ LOG_LEVEL: "DEBUG" }).http.logLevel, "debug");
    assert.equal(parseConfig({ LOG_LEVEL: "silent" }).http.logLevel, "silent");
  });

  it("booleano aceita 1/0, true/false, on/off e descarta espaços", () => {
    for (const v of ["1", "true", "ON", " yes "]) assert.equal(parseConfig({ TRUST_PROXY: v }).http.trustProxy, true);
    for (const v of ["0", "FALSE", "off", "no"]) assert.equal(parseConfig({ TRUST_PROXY: v }).http.trustProxy, false);
  });

  it("RATE_LIMIT_OFF desliga sem apagar rps/burst", () => {
    const c = parseConfig({ RATE_LIMIT_OFF: "1" });
    assert.equal(c.http.rateLimit.enabled, false);
    assert.equal(c.http.rateLimit.rps, 20);
  });

  it("WEB_DIST relativo vira absoluto", () => {
    const c = parseConfig({ WEB_DIST: "dist-custom" });
    assert.ok(isAbsolute(c.http.webDist));
    assert.equal(c.http.webDist, parseConfig({ WEB_DIST: "dist-custom" }).http.webDist);
    assert.match(c.http.webDist, /dist-custom$/);
  });
});

describe("config: fail-fast", () => {
  it("PORT não numérica ou fora da faixa", () => {
    throwsWith(() => parseConfig({ PORT: "abc" }), "PORT");
    throwsWith(() => parseConfig({ PORT: "70000" }), "PORT");
    throwsWith(() => parseConfig({ PORT: "3001.5" }), "PORT");
  });

  it("ARENA_BASE precisa ser URL http(s)", () => {
    throwsWith(() => parseConfig({ ARENA_BASE: "nao-e-url" }), "ARENA_BASE");
    throwsWith(() => parseConfig({ ARENA_BASE: "ftp://example.com" }), "ARENA_BASE");
  });

  it("ARENA_ALT_HOSTS inválido cita o item problemático", () => {
    throwsWith(() => parseConfig({ ARENA_ALT_HOSTS: "https://ok.com, lixo" }), "ARENA_ALT_HOSTS");
    throwsWith(() => parseConfig({ ARENA_ALT_HOSTS: "ftp://ok.com" }), "ARENA_ALT_HOSTS");
  });

  it("ARENA_CONC fora de 1..32", () => {
    throwsWith(() => parseConfig({ ARENA_CONC: "0" }), "ARENA_CONC");
    throwsWith(() => parseConfig({ ARENA_CONC: "33" }), "ARENA_CONC");
    throwsWith(() => parseConfig({ ARENA_CONC: "4x" }), "ARENA_CONC");
  });

  it("LOG_LEVEL desconhecido", () => {
    throwsWith(() => parseConfig({ LOG_LEVEL: "verbose" }), "LOG_LEVEL");
  });

  it("TRUST_PROXY ambíguo não é aceito", () => {
    throwsWith(() => parseConfig({ TRUST_PROXY: "sim" }), "TRUST_PROXY");
  });

  it("limites de rate limit e shutdown fora de faixa", () => {
    throwsWith(() => parseConfig({ RATE_LIMIT_RPS: "0" }), "RATE_LIMIT_RPS");
    throwsWith(() => parseConfig({ RATE_LIMIT_BURST: "0" }), "RATE_LIMIT_BURST");
    throwsWith(() => parseConfig({ SHUTDOWN_TIMEOUT_MS: "50" }), "SHUTDOWN_TIMEOUT_MS");
    throwsWith(() => parseConfig({ SHUTDOWN_TIMEOUT_MS: "abc" }), "SHUTDOWN_TIMEOUT_MS");
  });

  it("vazio explícito usa o default (não vira 0/NaN)", () => {
    assert.equal(parseConfig({ PORT: "", ARENA_CONC: "" }).port, 3001);
    assert.equal(parseConfig({ PORT: "", ARENA_CONC: "" }).arena.conc, 4);
  });
});
