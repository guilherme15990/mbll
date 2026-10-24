// Retenção LIGADA via env (processo próprio): recordSnapshot arquiva sozinho.
// Só assim o caminho `config.history.retentionDays > 0` é exercitado de verdade.
import "./support/env.mjs";

process.env.HISTORY_RETENTION_DAYS = "1";

const { getDb, prepare } = await import("../src/infra/db.js");
const { recordSnapshot, historyStats, listSnapshots } = await import("../src/infra/snapshotHistory.js");

const { describe, it } = await import("node:test");
const assert = (await import("node:assert/strict")).default;

const FONTE = "f3_auto";
const DAY = 86_400_000;

describe("retenção automática", () => {
  it("recordSnapshot arquiva linhas antigas e mantém a nova", () => {
    const now = Date.now();
    const velho = now - 5 * DAY;
    prepare(`INSERT INTO snapshot_history(fonte,rank,janela,versao_jogo,coletado_em,payload_hash,payload_json,status,motivo)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(
      FONTE, "mythic", 7, "v", velho, "hash-velho",
      JSON.stringify({ rows: [], pick_sum: 0, status: "verificado", motivo: null, posterior: null }),
      "verificado", null,
    );

    const rec = recordSnapshot({ fonte: FONTE, rank: "mythic", janela: 7, versao_jogo: "v2", rows: [] });
    assert.ok(rec.coletado_em > now - 1_000);

    const quente = listSnapshots({ fonte: FONTE, limit: 100 });
    assert.deepEqual(quente.map((s) => s.payload_hash), [rec.payload_hash], "só a coleta nova ficou");
    assert.equal(getDb().prepare("SELECT COUNT(*) c FROM snapshot_history_archive WHERE fonte=?").get(FONTE).c, 1);
    assert.equal(historyStats().archived, 1);
  });
});
