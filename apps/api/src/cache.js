// Cache SQLite (node:sqlite, stdlib Node 22+) com fallback em memória.
// TTL por camada: A=2h, B=6h, C=24h. SWR: serve stale + revalida em fundo.
// Desligável via SQLITE_CACHE=off (vira só memória volátil).
//
// SnapshotHistory append-only (ADR-021-09, DDD-V4-05 — BC-TEMPO root-série):
// - tabela snapshot_history: INSERT sempre, NUNCA REPLACE/UPDATE/DELETE (excluir = proibido).
//   A API pública deste módulo só expõe insert + select; não existe função de update/delete.
// - L2 (violado ENTRA marcado): lote com contrato violado entra com status="violado"+motivo
//   para auditoria C-101/C-102 e comparação C-105 (recoletar+comparar, "valores revisados").
//   Apagar o violado destruiria a evidência de drift de contrato (RNF-EXP-01). O consumo
//   analítico (T5/temporal, assessSeries) usa SOMENTE snapshots "verificado".
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { config } from "./config.js";

const TTL = { A: 2 * 3600e3, B: 6 * 3600e3, C: 24 * 3600e3 };
const mem = new Map(); // key -> {at, body}
const memHistory = []; // fallback append-only quando SQLite indisponível
let memHistSeq = 0;
let db = null;
let useSqlite = config.cache.sqlite;

const HISTORY_DDL = `CREATE TABLE IF NOT EXISTS snapshot_history(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fonte TEXT NOT NULL, rank TEXT NOT NULL, janela INTEGER NOT NULL,
  versao_jogo TEXT NOT NULL, coletado_em INTEGER NOT NULL,
  payload_hash TEXT NOT NULL, payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'verificado', motivo TEXT
)`;
const HISTORY_IDX = `CREATE INDEX IF NOT EXISTS idx_snapshot_history_serie ON snapshot_history(fonte, rank, janela, coletado_em)`;

function ensureHistory() {
  if (!db) return;
  try { db.exec(HISTORY_DDL); db.exec(HISTORY_IDX); } catch { /* mantém leitura */ }
}

if (useSqlite) {
  try {
    const { DatabaseSync } = await import("node:sqlite").catch(() => ({}));
    if (DatabaseSync) {
      const file = config.cache.file;
      mkdirSync(dirname(file), { recursive: true });
      db = new DatabaseSync(file);
      db.exec(`CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, at INTEGER, body TEXT)`);
      ensureHistory();
    } else useSqlite = false;
  } catch { useSqlite = false; }
}

export function cacheGet(key, layer = "A") {
  const ttl = TTL[layer] ?? TTL.A;
  if (db) {
    try {
      const row = db.prepare("SELECT at, body FROM cache WHERE key=?").get(key);
      if (!row) return { hit: false };
      const ageMs = Date.now() - row.at;
      return { hit: true, stale: ageMs > ttl, ageMs, body: JSON.parse(row.body) };
    } catch { return { hit: false }; }
  }
  const v = mem.get(key);
  if (!v) return { hit: false };
  const ageMs = Date.now() - v.at;
  return { hit: true, stale: ageMs > ttl, ageMs, body: v.body };
}

export function cacheSet(key, body) {
  if (db) {
    try { db.prepare("INSERT OR REPLACE INTO cache(key,at,body) VALUES(?,?,?)").run(key, Date.now(), JSON.stringify(body)); return; }
    catch { /* cai p/ memória */ }
  }
  mem.set(key, { at: Date.now(), body });
  if (mem.size > 500) mem.delete(mem.keys().next().value);
}

export function cacheStats() {
  let rows = mem.size;
  if (db) {
    try { rows = db.prepare("SELECT COUNT(*) c FROM cache").get().c; } catch {}
  }
  return { sqlite: !!db, rows };
}

// ── SnapshotHistory (append-only) ──

// JSON canônico: chaves ordenadas recursivamente → hash estável independente da ordem.
export function canonicalPayload(v) {
  if (Array.isArray(v)) return `[${v.map(canonicalPayload).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalPayload(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

// sha256 do payload canônico (linhas ordenadas por id em recordSnapshot).
export function payloadHash(obj) {
  return createHash("sha256").update(canonicalPayload(obj), "utf8").digest("hex");
}

// APPEND-ONLY: INSERT puro. Não há OR REPLACE/UPDATE/DELETE neste módulo.
// ADR-023 L2-WF-04: cada snapshot carrega seu posterior resumido {mu, tau2, n,
// game_version} como APÊNDICE dentro do payload_json (sem migração de schema, sem
// REPLACE). Snapshots antigos sem apêndice ⇒ posterior null ⇒ prior "flat".
function sanitizePosterior(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  if (!Number.isFinite(p.mu) || p.mu < 0 || p.mu > 1) return null;
  if (!Number.isFinite(p.tau2) || !(p.tau2 > 0) || p.tau2 > 1) return null;
  if (!Number.isFinite(p.n) || !(p.n >= 0)) return null;
  if (typeof p.game_version !== "string" || !p.game_version) return null;
  return { mu: p.mu, tau2: p.tau2, n: Math.floor(p.n), game_version: p.game_version };
}
export function recordSnapshot({ fonte, rank, janela, versao_jogo, rows, status = "verificado", motivo = null, posterior = null }) {
  if (!fonte || !rank || !Number.isInteger(janela)) throw new Error("snapshot: fonte/rank/janela obrigatórios");
  if (status !== "verificado" && status !== "violado") throw new Error("snapshot: status inválido");
  const sorted = [...(rows ?? [])]
    .map((h) => ({ id: h.id, name: h.name ?? null, win: h.win, pick: h.pick, ban: h.ban }))
    .sort((a, b) => a.id - b.id);
  const hash = payloadHash(sorted);
  const sum = sorted.map((h) => h.pick).filter(Number.isFinite).reduce((a, b) => a + b, 0);
  const body = JSON.stringify({ rows: sorted, pick_sum: +sum.toFixed(4), status, motivo, posterior: sanitizePosterior(posterior) });
  const vg = String(versao_jogo ?? "desconhecida");
  if (db) {
    try {
      ensureHistory();
      let ts = Date.now();
      try {
        const mx = db.prepare("SELECT MAX(coletado_em) m FROM snapshot_history").get()?.m;
        if (Number.isFinite(mx) && mx >= ts) ts = mx + 1; // ts estritamente crescente (chave do diff)
      } catch {}
      const r = db.prepare(
        "INSERT INTO snapshot_history(fonte,rank,janela,versao_jogo,coletado_em,payload_hash,payload_json,status,motivo) VALUES(?,?,?,?,?,?,?,?,?)"
      ).run(fonte, rank, janela, vg, ts, hash, body, status, motivo);
      return { id: Number(r.lastInsertRowid), coletado_em: ts, payload_hash: hash, status };
    } catch { /* cai p/ memória */ }
  }
  let ts = Date.now();
  const last = memHistory.length ? memHistory[memHistory.length - 1].coletado_em : 0;
  if (last >= ts) ts = last + 1;
  const id = ++memHistSeq;
  memHistory.push({ id, fonte, rank, janela, versao_jogo: vg, coletado_em: ts, payload_hash: hash, payload_json: body, status, motivo });
  return { id, coletado_em: ts, payload_hash: hash, status };
}

// Metadados SEM payload (lista do histórico: hash + verificações, nunca o lote).
// O posterior resumido (apêndice ADR-023) viaja junto p/ alimentar o prior seguinte.
function rowMeta(r) {
  let n = 0, sum = null, posterior = null;
  try {
    const p = JSON.parse(r.payload_json);
    n = p?.rows?.length ?? 0; sum = p?.pick_sum ?? null;
    posterior = sanitizePosterior(p?.posterior);
  } catch {}
  return {
    id: r.id, fonte: r.fonte, rank: r.rank, janela: r.janela,
    versao_jogo: r.versao_jogo, coletado_em: r.coletado_em,
    coletado_em_iso: new Date(r.coletado_em).toISOString(),
    payload_hash: r.payload_hash, status: r.status, motivo: r.motivo ?? null,
    n_heroes: n, pick_sum: sum, posterior,
  };
}

// Lista a série em ordem CRESCENTE de coletado_em (contrato consumido por
// lastVerifiedPosterior e /snapshots/:ts/diff, que assumem "último = mais novo").
//
// Seleção = as `limit` coletas MAIS RECENTES (DESC LIMIT n) e depois invertidas.
// Antes era `ASC LIMIT n`, que devolvia as mais ANTIGAS: numa série com mais de
// `limit` coletas o snapshot recém-gravado nunca aparecia (o teste de histórico
// falhava de forma crescente a cada execução, e o diff C-105 comparava o passado
// distante). A ordem de saída continua ASC — só a janela de seleção mudou.
export function listSnapshots({ fonte, rank, janela, limit = 200 } = {}) {
  const lim = Math.min(1000, Math.max(1, Number(limit) || 200));
  if (db) {
    try {
      ensureHistory();
      const w = [], args = [];
      if (fonte !== undefined) { w.push("fonte=?"); args.push(fonte); }
      if (rank !== undefined) { w.push("rank=?"); args.push(rank); }
      if (janela !== undefined) { w.push("janela=?"); args.push(janela); }
      const rows = db.prepare(
        `SELECT id,fonte,rank,janela,versao_jogo,coletado_em,payload_hash,payload_json,status,motivo FROM snapshot_history${w.length ? " WHERE " + w.join(" AND ") : ""} ORDER BY coletado_em DESC LIMIT ?`
      ).all(...args, lim);
      return rows.reverse().map(rowMeta);
    } catch { return []; }
  }
  return memHistory
    .filter((r) => (fonte === undefined || r.fonte === fonte) && (rank === undefined || r.rank === rank) && (janela === undefined || r.janela === janela))
    .slice(-lim).map(rowMeta);
}

// Snapshot completo (com payload) para o diff C-105. ts = coletado_em em ms.
export function getSnapshot(coletado_em, { fonte, rank, janela } = {}) {
  const ts = Number(coletado_em);
  if (!Number.isInteger(ts) || ts <= 0) return null;
  const withPayload = (r) => {
    if (!r) return null;
    let payload = null;
    try { payload = JSON.parse(r.payload_json); } catch {}
    return { ...rowMeta(r), payload };
  };
  if (db) {
    try {
      ensureHistory();
      const w = ["coletado_em=?"], args = [ts];
      if (fonte !== undefined) { w.push("fonte=?"); args.push(fonte); }
      if (rank !== undefined) { w.push("rank=?"); args.push(rank); }
      if (janela !== undefined) { w.push("janela=?"); args.push(janela); }
      const r = db.prepare(
        `SELECT id,fonte,rank,janela,versao_jogo,coletado_em,payload_hash,payload_json,status,motivo FROM snapshot_history WHERE ${w.join(" AND ")} ORDER BY id ASC LIMIT 1`
      ).get(...args);
      return withPayload(r ?? null);
    } catch { return null; }
  }
  return withPayload(memHistory.find((r) =>
    r.coletado_em === ts && (fonte === undefined || r.fonte === fonte) &&
    (rank === undefined || r.rank === rank) && (janela === undefined || r.janela === janela)) ?? null);
}

export function historyStats() {
  if (db) {
    try {
      const total = db.prepare("SELECT COUNT(*) c FROM snapshot_history").get()?.c ?? 0;
      const ok = db.prepare("SELECT COUNT(*) c FROM snapshot_history WHERE status='verificado'").get()?.c ?? 0;
      return { sqlite: true, total, verificados: ok, violados: total - ok };
    } catch {}
  }
  const verificados = memHistory.filter((r) => r.status !== "violado").length;
  return { sqlite: false, total: memHistory.length, verificados, violados: memHistory.length - verificados };
}
