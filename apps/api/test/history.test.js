// Retenção por arquivamento (F3, ADR-035) contra SQLite real.
//
// A regra: nada é apagado sem estar em snapshot_history_archive. A poda da tabela
// quente é opt-in (retentionDays > 0), na mesma transação da cópia.
import "./support/env.mjs";
import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDb, prepare } from "../src/infra/db.js";
import {
  archiveHistory, historyStats, listSnapshots, getSnapshot,
} from "../src/infra/snapshotHistory.js";

const FONTE = "f3_archive";
const DAY = 86_400_000;

// Fixture direta: controla coletado_em (recordSnapshot usa Date.now()).
// payload mínimo válido para os metadados (n_heroes/pick_sum/posterior).
const INSERT = `INSERT INTO snapshot_history(fonte,rank,janela,versao_jogo,coletado_em,payload_hash,payload_json,status,motivo)
  VALUES(?,?,?,?,?,?,?,?,?)`;

function insertAt(ts, { status = "verificado", motivo = null, janela = 7, hash = `h${ts}` } = {}) {
  const payload = JSON.stringify({
    rows: [{ id: 1, name: "A", win: 0.5, pick: 0.1, ban: 0.1 }],
    pick_sum: 0.1, status, motivo, posterior: null,
  });
  const r = prepare(INSERT).run(FONTE, "mythic", janela, "v", ts, hash, payload, status, motivo);
  return Number(r.lastInsertRowid);
}

function archiveRows() {
  return getDb().prepare("SELECT * FROM snapshot_history_archive WHERE fonte=? ORDER BY coletado_em").all(FONTE);
}

beforeEach(() => {
  const db = getDb();
  db.prepare("DELETE FROM snapshot_history WHERE fonte=?").run(FONTE);
  db.prepare("DELETE FROM snapshot_history_archive WHERE fonte=?").run(FONTE);
});

describe("archiveHistory", () => {
  it("copia para o arquivo e só então poda a tabela quente", () => {
    const now = Date.now();
    insertAt(now - 3 * DAY, { hash: "velho1" });
    insertAt(now - 2 * DAY, { hash: "velho2", status: "violado", motivo: "sigma_pick:0.9" });
    insertAt(now - 60_000, { hash: "novo" });

    const out = archiveHistory({ retentionDays: 1, now });
    assert.equal(out.archived, 2);
    assert.equal(out.skipped, false);
    assert.equal(out.cutoff, now - DAY);

    const quente = listSnapshots({ fonte: FONTE, limit: 100 });
    assert.deepEqual(quente.map((s) => s.payload_hash), ["novo"]);
    assert.equal(getSnapshot(now - 3 * DAY, { fonte: FONTE }), null, "saiu da janela quente");

    const frio = archiveRows();
    assert.deepEqual(frio.map((r) => r.payload_hash), ["velho1", "velho2"]);
    assert.equal(frio[1].status, "violado");
    assert.equal(frio[1].motivo, "sigma_pick:0.9");
    assert.equal(frio[1].archived_at, now);
    assert.equal(historyStats().archived, 2);
  });

  it("é idempotente: segunda passada não arquiva nada", () => {
    const now = Date.now();
    insertAt(now - 2 * DAY);
    assert.equal(archiveHistory({ retentionDays: 1, now }).archived, 1);
    assert.deepEqual(archiveHistory({ retentionDays: 1, now }), {
      archived: 0, cutoff: now - DAY, retentionDays: 1, skipped: false,
    });
    assert.equal(archiveRows().length, 1);
  });

  it("desligada (0) não toca em nada", () => {
    const now = Date.now();
    insertAt(now - 10 * DAY);
    const out = archiveHistory({ retentionDays: 0, now });
    assert.equal(out.archived, 0);
    assert.equal(out.skipped, true);
    assert.equal(out.reason, "disabled");
    assert.equal(listSnapshots({ fonte: FONTE }).length, 1);
    assert.equal(archiveRows().length, 0);
  });

  it("não arquiva linha mais nova que o corte", () => {
    const now = Date.now();
    insertAt(now - DAY + 1_000); // 1s dentro da janela
    assert.equal(archiveHistory({ retentionDays: 1, now }).archived, 0);
    assert.equal(listSnapshots({ fonte: FONTE }).length, 1);
  });
});
