// Cache chave-valor (TTL por camada) com SQLite e fallback em memória.
// TTL: A=2h, B=6h, C=24h. SWR (serve stale + revalida) é decisão do chamador.
//
// F3: statements preparados via infra/db.js (antes cada get/set preparava de novo).
// A tabela `cache` é reconstruível: não é fonte de verdade e pode ser perdida.
import { getDb, prepare } from "./db.js";

const TTL = { A: 2 * 3600e3, B: 6 * 3600e3, C: 24 * 3600e3 };
const MEM_MAX = 500;

const SQL_GET = "SELECT at, body FROM cache WHERE key=?";
const SQL_SET = "INSERT OR REPLACE INTO cache(key,at,body) VALUES(?,?,?)";
const SQL_COUNT = "SELECT COUNT(*) c FROM cache";

const mem = new Map(); // key -> { at, body }

function memGet(key, ttl) {
  const v = mem.get(key);
  if (!v) return { hit: false };
  const ageMs = Date.now() - v.at;
  return { hit: true, stale: ageMs > ttl, ageMs, body: v.body };
}

export function cacheGet(key, layer = "A") {
  const ttl = TTL[layer] ?? TTL.A;
  if (getDb()) {
    try {
      const row = prepare(SQL_GET).get(key);
      if (!row) return { hit: false };
      const ageMs = Date.now() - row.at;
      return { hit: true, stale: ageMs > ttl, ageMs, body: JSON.parse(row.body) };
    } catch {
      // leitura quebrada (JSON corrompido, schema antigo) = miss, nunca 500
      return { hit: false };
    }
  }
  return memGet(key, ttl);
}

export function cacheSet(key, body) {
  if (getDb()) {
    try {
      prepare(SQL_SET).run(key, Date.now(), JSON.stringify(body));
      return;
    } catch { /* cai para memória */ }
  }
  mem.set(key, { at: Date.now(), body });
  // Teto simples: descarta a entrada mais antiga (Map preserva inserção).
  if (mem.size > MEM_MAX) mem.delete(mem.keys().next().value);
}

export function cacheStats() {
  if (getDb()) {
    try { return { sqlite: true, rows: prepare(SQL_COUNT).get().c }; } catch { /* fallback */ }
  }
  return { sqlite: false, rows: mem.size };
}
