// Infra SQLite (F3): WAL, pragmas, schema, statements preparados e close.
// Banco em tmp (support/env.mjs). Este arquivo NÃO pode rodar com SQLITE_CACHE=off.
import "./support/env.mjs";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { TEST_SQLITE_FILE } from "./support/env.mjs";
import { getDb, isSqlite, prepare, closeDb, dbInfo } from "../src/infra/db.js";
import { cacheGet, cacheSet, cacheStats } from "../src/infra/cacheStore.js";

after(() => closeDb());

describe("infra/db: conexão", () => {
  it("abre o arquivo de DATA_DIR/SQLITE_FILE e ativa WAL + busy_timeout", () => {
    const db = getDb();
    assert.ok(db, "SQLite deveria estar aberto");
    assert.equal(isSqlite(), true);
    assert.equal(resolve(TEST_SQLITE_FILE), resolve(dbInfo().file));
    assert.equal(db.prepare("PRAGMA journal_mode").get().journal_mode, "wal");
    assert.equal(db.prepare("PRAGMA synchronous").get().synchronous, 1); // NORMAL
    assert.equal(db.prepare("PRAGMA busy_timeout").get().timeout, 5000);
  });

  it("cria cache, histórico e arquivo frio no boot", () => {
    const tables = getDb()
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);
    for (const t of ["cache", "snapshot_history", "snapshot_history_archive"]) {
      assert.ok(tables.includes(t), `falta tabela ${t}`);
    }
    const indexes = getDb()
      .prepare("SELECT name FROM sqlite_master WHERE type='index'")
      .all()
      .map((r) => r.name);
    assert.ok(indexes.includes("idx_snapshot_history_ts"), "índice de retenção ausente");
  });

  it("reaproveita StatementSync por SQL", () => {
    const a = prepare("SELECT COUNT(*) c FROM cache");
    const b = prepare("SELECT COUNT(*) c FROM cache");
    assert.equal(a, b, "prepare() deveria devolver o mesmo statement");
    assert.ok(dbInfo().prepared >= 1);
  });
});

describe("infra/cacheStore: SQLite", () => {
  it("round-trip com TTL e stats", () => {
    const key = `f3:${process.pid}`;
    assert.equal(cacheGet(key).hit, false);
    cacheSet(key, { v: 42 });
    const hit = cacheGet(key, "C");
    assert.equal(hit.hit, true);
    assert.deepEqual(hit.body, { v: 42 });
    assert.equal(hit.stale, false);
    assert.equal(cacheStats().sqlite, true);
    assert.ok(cacheStats().rows >= 1);
  });
});

describe("infra/db: close", () => {
  it("fecha a conexão e cai para memória (shutdown)", () => {
    assert.equal(closeDb(), true);
    assert.equal(getDb(), null);
    assert.equal(isSqlite(), false);
    assert.equal(closeDb(), false); // idempotente
    // cacheStore não pode explodir sem banco: usa memória
    cacheSet("f3:pos-close", { ok: true });
    assert.deepEqual(cacheGet("f3:pos-close").body, { ok: true });
    assert.equal(cacheStats().sqlite, false);
  });
});
