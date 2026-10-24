// SnapshotHistory append-only (ADR-021-09, DDD-V4-05 — BC-TEMPO root-série).
//
// - INSERT sempre; NUNCA REPLACE/UPDATE. A API pública só expõe insert + select.
// - L2 (violado ENTRA marcado): lote com contrato violado entra com
//   status="violado"+motivo para auditoria C-101/C-102 e comparação C-105.
//   Apagar o violado destruiria a evidência de drift (RNF-EXP-01); o consumo
//   analítico (T5/temporal) usa SOMENTE snapshots "verificado".
//
// F3 — retenção por arquivamento (ADR-035):
// - `HISTORY_RETENTION_DAYS=0` (default) = desligado; nada é tocado.
// - >0: `archiveHistory()` copia as linhas antigas para `snapshot_history_archive`
//   (mesmo schema + archived_at) e SÓ ENTÃO remove da tabela quente, na mesma
//   transação. A evidência continua existindo no arquivo frio; a API lê a janela
//   quente. Não há VACUUM automático (o arquivo não devolve espaço sozinho).
//
// F3 — statements preparados via infra/db.js (antes prepare() a cada chamada).
import { config } from "./config.js";
import { getDb, prepare } from "./db.js";
import { canonicalPayload, payloadHash } from "../application/canonical.js";

const COLS = "id,fonte,rank,janela,versao_jogo,coletado_em,payload_hash,payload_json,status,motivo";
// `id` é AUTOINCREMENT: o INSERT não o inclui (senão os valores deslocam uma coluna).
const INSERT_COLS = "fonte,rank,janela,versao_jogo,coletado_em,payload_hash,payload_json,status,motivo";

const SQL_MAX_TS = "SELECT MAX(coletado_em) m FROM snapshot_history";
const SQL_INSERT = `INSERT INTO snapshot_history(${INSERT_COLS}) VALUES(?,?,?,?,?,?,?,?,?)`;
const SQL_COUNT = "SELECT COUNT(*) c FROM snapshot_history";
const SQL_COUNT_OK = "SELECT COUNT(*) c FROM snapshot_history WHERE status='verificado'";
const SQL_ARCHIVE_COUNT = "SELECT COUNT(*) c FROM snapshot_history_archive";
const SQL_ARCHIVE_INSERT = `INSERT OR IGNORE INTO snapshot_history_archive(${COLS},archived_at)
  SELECT ${COLS},? FROM snapshot_history WHERE coletado_em < ?`;
const SQL_ARCHIVE_DELETE = "DELETE FROM snapshot_history WHERE coletado_em < ?";

const memHistory = []; // fallback append-only quando SQLite indisponível
let memHistSeq = 0;

// JSON canônico/hash reexportados aqui porque o histórico é o dono histórico
// desse contrato (o agregado de builds também consome `payloadHash`).
export { canonicalPayload, payloadHash };

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

// APPEND-ONLY: INSERT puro. Não há OR REPLACE/UPDATE neste módulo.
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

  if (getDb()) {
    try {
      let ts = Date.now();
      try {
        const mx = prepare(SQL_MAX_TS).get()?.m;
        if (Number.isFinite(mx) && mx >= ts) ts = mx + 1; // ts estritamente crescente (chave do diff)
      } catch { /* segue com Date.now() */ }
      const r = prepare(SQL_INSERT).run(fonte, rank, janela, vg, ts, hash, body, status, motivo);
      // Retenção só roda se explicitamente configurada; nunca quebra a coleta.
      if (config.history.retentionDays > 0) archiveHistory();
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
  } catch { /* payload legado/ inválido: metadados continuam válidos */ }
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
// `limit` coletas o snapshot recém-gravado nunca aparecia. A ordem de saída
// continua ASC — só a janela de seleção mudou.
/**
 * @param {{ fonte?: string, rank?: string, janela?: number, limit?: number }} [serie]
 */
export function listSnapshots({ fonte, rank, janela, limit = 200 } = {}) {
  const lim = Math.min(1000, Math.max(1, Number(limit) || 200));
  if (getDb()) {
    try {
      const w = [], args = [];
      if (fonte !== undefined) { w.push("fonte=?"); args.push(fonte); }
      if (rank !== undefined) { w.push("rank=?"); args.push(rank); }
      if (janela !== undefined) { w.push("janela=?"); args.push(janela); }
      const rows = prepare(
        `SELECT ${COLS} FROM snapshot_history${w.length ? " WHERE " + w.join(" AND ") : ""} ORDER BY coletado_em DESC LIMIT ?`
      ).all(...args, lim);
      return rows.reverse().map(rowMeta);
    } catch { return []; }
  }
  return memHistory
    .filter((r) => (fonte === undefined || r.fonte === fonte) && (rank === undefined || r.rank === rank) && (janela === undefined || r.janela === janela))
    .slice(-lim).map(rowMeta);
}

// Snapshot completo (com payload) para o diff C-105. ts = coletado_em em ms.
/**
 * @param {unknown} coletado_em
 * @param {{ fonte?: string, rank?: string, janela?: number }} [serie]
 */
export function getSnapshot(coletado_em, { fonte, rank, janela } = {}) {
  const ts = Number(coletado_em);
  if (!Number.isInteger(ts) || ts <= 0) return null;
  const withPayload = (r) => {
    if (!r) return null;
    let payload = null;
    try { payload = JSON.parse(r.payload_json); } catch { /* payload ilegível */ }
    return { ...rowMeta(r), payload };
  };
  if (getDb()) {
    try {
      const w = ["coletado_em=?"];
      /** @type {(string | number)[]} */
      const args = [ts];
      if (fonte !== undefined) { w.push("fonte=?"); args.push(fonte); }
      if (rank !== undefined) { w.push("rank=?"); args.push(rank); }
      if (janela !== undefined) { w.push("janela=?"); args.push(janela); }
      const r = prepare(
        `SELECT ${COLS} FROM snapshot_history WHERE ${w.join(" AND ")} ORDER BY id ASC LIMIT 1`
      ).get(...args);
      return withPayload(r ?? null);
    } catch { return null; }
  }
  return withPayload(memHistory.find((r) =>
    r.coletado_em === ts && (fonte === undefined || r.fonte === fonte) &&
    (rank === undefined || r.rank === rank) && (janela === undefined || r.janela === janela)) ?? null);
}

export function historyStats() {
  if (getDb()) {
    try {
      const total = prepare(SQL_COUNT).get()?.c ?? 0;
      const ok = prepare(SQL_COUNT_OK).get()?.c ?? 0;
      const archived = prepare(SQL_ARCHIVE_COUNT).get()?.c ?? 0;
      return { sqlite: true, total, verificados: ok, violados: total - ok, archived };
    } catch { /* cai no fallback */ }
  }
  const verificados = memHistory.filter((r) => r.status !== "violado").length;
  return { sqlite: false, total: memHistory.length, verificados, violados: memHistory.length - verificados, archived: 0 };
}

/**
 * Retenção por arquivamento (F3, ADR-035). Desligada por padrão.
 * Copia para `snapshot_history_archive` e remove da tabela quente na MESMA
 * transação. Devolve `{ archived, cutoff, retentionDays }`; em falha devolve
 * `skipped:true` com `reason` (nunca lança, para não quebrar a coleta).
 */
export function archiveHistory({ retentionDays = config.history.retentionDays, now = Date.now() } = {}) {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return { archived: 0, skipped: true, reason: "disabled", retentionDays };
  }
  if (!getDb()) {
    return { archived: 0, skipped: true, reason: "no_sqlite", retentionDays };
  }
  const cutoff = now - retentionDays * 86_400_000;
  const db = getDb();
  try {
    db.exec("BEGIN IMMEDIATE");
    try {
      prepare(SQL_ARCHIVE_INSERT).run(now, cutoff);
      const res = prepare(SQL_ARCHIVE_DELETE).run(cutoff);
      db.exec("COMMIT");
      return { archived: Number(res.changes ?? 0), cutoff, retentionDays, skipped: false };
    } catch (e) {
      try { db.exec("ROLLBACK"); } catch { /* transação já encerrada */ }
      throw e;
    }
  } catch (e) {
    return { archived: 0, skipped: true, reason: String(e?.message ?? e), retentionDays };
  }
}
