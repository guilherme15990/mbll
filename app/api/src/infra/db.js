// Conexão SQLite única (node:sqlite) + WAL + cache de statements preparados.
//
// Antes: cada chamada de cacheGet/cacheSet fazia `db.prepare(...)` de novo e o
// banco abria sem PRAGMA nenhum (rollback journal, sem busy_timeout). Agora:
// - `prepare(sql)` reaproveita StatementSync por SQL (o driver não prepara de novo);
// - WAL + synchronous=NORMAL: leitura concorrente com escrita, menos fsync;
// - busy_timeout=5s: duas instâncias não falham na hora com SQLITE_BUSY;
// - schema criado no boot (só `cache`; o histórico append-only saiu na ADR-065).
//
// Se `node:sqlite` não existir/falhar, `db` fica null e os módulos caem no
// fallback em memória — comportamento antigo preservado.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.js";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, at INTEGER, body TEXT)`,
];

let db = null;
const statements = new Map(); // sql -> StatementSync

if (config.cache.sqlite) {
  try {
    // `node:sqlite` é experimental e pode não existir: o fallback devolve `{}`.
    // O cast mantém o tipo do módulo real (a guarda abaixo cobre o ausente).
    const { DatabaseSync } = /** @type {{ DatabaseSync?: typeof import("node:sqlite").DatabaseSync }} */ (
      await import("node:sqlite").catch(() => ({}))
    );
    if (DatabaseSync) {
      // DATA_DIR e o diretório do arquivo podem diferir (SQLITE_FILE override).
      mkdirSync(config.dataDir, { recursive: true });
      mkdirSync(dirname(config.cache.file), { recursive: true });
      const conn = new DatabaseSync(config.cache.file);
      // PRAGMAs são otimização: se um falhar, seguimos com o banco (não perdemos dados).
      for (const pragma of [
        "PRAGMA journal_mode=WAL",
        "PRAGMA synchronous=NORMAL",
        "PRAGMA busy_timeout=5000",
        "PRAGMA foreign_keys=ON",
      ]) {
        try { conn.exec(pragma); } catch { /* mantém o default do driver */ }
      }
      for (const ddl of SCHEMA) conn.exec(ddl);
      db = conn;
    }
  } catch {
    // SQLite indisponível/corrompido: memória volátil é melhor que derrubar a API.
    db = null;
    statements.clear();
  }
}

export function getDb() {
  return db;
}

export function isSqlite() {
  return !!db;
}

/** StatementSync reaproveitado por SQL. Lança se não houver banco (chamador decide). */
export function prepare(sql) {
  if (!db) throw new Error("sqlite indisponível");
  let st = statements.get(sql);
  if (!st) {
    st = db.prepare(sql);
    statements.set(sql, st);
  }
  return st;
}

/** Fecha a conexão e limpa o cache de statements (shutdown gracioso). */
export function closeDb() {
  if (!db) return false;
  statements.clear();
  try { db.close(); } finally { db = null; }
  return true;
}

/** Diagnóstico para /meta/status e testes. */
export function dbInfo() {
  return {
    sqlite: !!db,
    file: config.cache.file,
    data_dir: config.dataDir,
    prepared: statements.size,
  };
}
