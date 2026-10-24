// SnapshotHistory append-only (ADR-021-09, C-103/C-105).
// Lista sem payload; diff resumido entre coletas, também sem despejar payload.
import { listSnapshots, getSnapshot } from "../cache.js";
import { RANKS } from "../arena.js";
import { isRank, WINDOWS } from "../application/validation.js";

// GET /snapshots?fonte=&rank=&janela= — lista snapshots SEM payload (hash + verificações).
export async function snapshotsRoute(sp) {
  const fonte = sp.get("fonte") ?? undefined;
  const rank = sp.get("rank") ?? undefined;
  const janelaRaw = sp.get("janela") ?? undefined;
  if (fonte !== undefined && !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(fonte)) return { status: 400, body: { error: "source_invalid", message: "Invalid source" } };
  if (rank !== undefined && !isRank(rank)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank", ranks: RANKS } };
  let janela = undefined;
  if (janelaRaw !== undefined) {
    janela = Number(janelaRaw);
    if (!Number.isInteger(janela) || !WINDOWS.has(janela)) return { status: 400, body: { error: "window_invalid", message: "Invalid window", windows: [...WINDOWS] } };
  }
  const data = listSnapshots({ fonte, rank, janela, limit: 200 });
  return { status: 200, body: { data, total: data.length, serie_contrato: "T5 consome a série com ≥2 snapshots verificados não-sobrepostos, span ≥14d; senão serie_curta/inconclusivo (INV4-015)", nota: "sem payload (hash + verificações); diff resumido em /snapshots/:ts/diff (C-105)" } };
}

// GET /snapshots/:ts/diff?contra= — diff resumido entre coletas p/ C-105 (sem despejar payload).
export async function snapshotDiffRoute(sp, ts) {
  const contraRaw = sp.get("contra") ?? undefined;
  if (!Number.isInteger(ts) || ts <= 0) return { status: 400, body: { error: "timestamp_invalid", message: "Invalid ts (coletado_em in ms)" } };
  let contra = undefined;
  if (contraRaw !== undefined) {
    contra = Number(contraRaw);
    if (!Number.isInteger(contra) || contra <= 0) return { status: 400, body: { error: "timestamp_invalid", message: "Invalid contra (coletado_em in ms)" } };
    if (contra === ts) return { status: 400, body: { error: "invalid_comparison", message: "Contra is the same snapshot" } };
  }
  const base = getSnapshot(ts);
  if (!base) return { status: 404, body: { error: "snapshot_not_found", message: "Snapshot not found", coletado_em: ts } };
  const serie = listSnapshots({ fonte: base.fonte, rank: base.rank, janela: base.janela, limit: 1000 });
  let other = null;
  if (contra !== undefined) {
    other = serie.find((s) => s.coletado_em === contra) ?? null;
    if (!other) return { status: 404, body: { error: "snapshot_not_found", message: "Contra snapshot not found in series", contra } };
  } else {
    const prev = serie.filter((s) => s.coletado_em < ts).pop() ?? null;
    const next = serie.find((s) => s.coletado_em > ts) ?? null;
    other = prev ?? next;
    if (!other) return { status: 404, body: { error: "no_comparison_snapshot", message: "No other snapshot to compare (single-snapshot series)", coletado_em: ts } };
  }
  const fullA = getSnapshot(Math.min(ts, other.coletado_em));
  const fullB = getSnapshot(Math.max(ts, other.coletado_em));
  const rowsA = new Map((fullA?.payload?.rows ?? []).map((h) => [h.id, h]));
  const rowsB = new Map((fullB?.payload?.rows ?? []).map((h) => [h.id, h]));
  const mudancas = [];
  let iguais = 0;
  for (const [id, a] of rowsA) {
    const b = rowsB.get(id);
    if (!b) continue;
    const campos = ["win", "pick", "ban"].filter((k) => a[k] !== b[k]);
    if (!campos.length) { iguais++; continue; }
    if (mudancas.length < 50) {
      mudancas.push({ id, name: b.name ?? a.name ?? null, campos,
        antes: { win: a.win, pick: a.pick, ban: a.ban }, depois: { win: b.win, pick: b.pick, ban: b.ban } });
    }
  }
  let adicionados = 0, removidos = 0;
  for (const id of rowsB.keys()) if (!rowsA.has(id)) adicionados++;
  for (const id of rowsA.keys()) if (!rowsB.has(id)) removidos++;
  const nMudados = rowsA.size + adicionados - iguais - removidos; // heróis presentes nos dois com campo mudado
  const depoisTs = Math.max(ts, other.coletado_em);
  return { status: 200, body: {
    base_ts: ts, contra_ts: other.coletado_em, antes_ts: Math.min(ts, other.coletado_em), depois_ts: depoisTs,
    fonte: base.fonte, rank: base.rank, janela: base.janela,
    versao: { antes: fullA?.versao_jogo ?? null, depois: fullB?.versao_jogo ?? null },
    status_coletas: { antes: fullA?.status ?? null, depois: fullB?.status ?? null },
    pick_sum: { antes: fullA?.pick_sum ?? null, depois: fullB?.pick_sum ?? null },
    n_antes: rowsA.size, n_depois: rowsB.size, n_iguais: iguais,
    n_adicionados: adicionados, n_removidos: removidos, n_mudados: nMudados,
    mudancas, truncado: nMudados > mudancas.length,
    aviso_revisado: nMudados > 0 || adicionados > 0 || removidos > 0,
    aviso: (nMudados > 0 || adicionados > 0 || removidos > 0) ? `valores revisados desde a coleta ${Math.min(ts, other.coletado_em)}` : null,
    nota: "C-105: recoletar+comparar; resumo sem payload (id + campos mudados + antes/depois)",
  } };
}
