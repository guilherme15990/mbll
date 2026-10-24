// Clusterização de playstyle por (op, tfr) — estilo de jogo por herói+lane.
// op = parcela de dano (0–1); tfr = participação em lutas (0–1). Entrada: partidas
// INDIVIDUAIS do jogador (user/matches, exige JWT — fiação atrás de auth, L3).
// Método: k-means determinístico (init por faixas ordenadas, sem semente aleatória).
// Rótulos por quadrante vs medianas do conjunto (descritivos, sem juízo).
// Comparação com padrão EXIGE origem declarada (proveniência por construção).
// Pura, sem I/O, zero dependências.

import { MIN_SUPPORT_N } from "../utils/thresholds.js";

export const PLAYSTYLE_VERSION = "playstyle-v1";
export const PLAYSTYLE_MIN_MATCHES = MIN_SUPPORT_N;

const clamp01 = (v) => (typeof v !== "number" || !Number.isFinite(v) ? null : Math.min(1, Math.max(0, v)));

function centroidOf(pts) {
  if (!pts.length) return null;
  return {
    op: pts.reduce((s, p) => s + p.op, 0) / pts.length,
    tfr: pts.reduce((s, p) => s + p.tfr, 0) / pts.length,
  };
}

function dist2(a, b) {
  const dx = a.op - b.op;
  const dy = a.tfr - b.tfr;
  return dx * dx + dy * dy;
}

function labelOf(c, medOp, medTfr) {
  const hiD = c.op >= medOp;
  const hiF = c.tfr >= medTfr;
  if (hiD && hiF) return { key: "teamfight", label: "teamfight", desc: "dano alto em lutas — decide teamfight" };
  if (hiD && !hiF) return { key: "pickoff", label: "pickoff", desc: "dano alto fora de lutas — split, pickoff, farm lateral" };
  if (!hiD && hiF) return { key: "frontline", label: "frontline", desc: "muita luta, pouco dano — engage, front, utilidade" };
  return { key: "transicao", label: "transição", desc: "baixo dano e pouca luta — rotação, farm ou amostra ruim" };
}

/**
 * @param matches [{op, tfr}] partidas do jogador (ideal: mesmo herói+lane)
 * @param k nº de estilos (default 4)
 * @returns null (n < 5) ou {clusters: [{centroid, n, ...label}], assignments, version}
 */
export function clusterPlaystyle(matches, k = 4) {
  const pts = (matches ?? [])
    .map((m) => ({ op: clamp01(m?.op), tfr: clamp01(m?.tfr) }))
    .filter((p) => p.op != null && p.tfr != null);
  if (pts.length < PLAYSTYLE_MIN_MATCHES) return null;
  const kk = Math.max(2, Math.min(k || 4, pts.length));
  // Init determinístico: ordena por op, fatia em kk faixas, centroides das faixas.
  const sorted = [...pts].sort((a, b) => a.op - b.op);
  let centroids = [];
  for (let c = 0; c < kk; c++) {
    const lo = Math.floor((c * pts.length) / kk);
    const hi = Math.max(lo + 1, Math.floor(((c + 1) * pts.length) / kk));
    centroids.push(centroidOf(sorted.slice(lo, hi)));
  }
  let assign = new Array(pts.length).fill(0);
  for (let iter = 0; iter < 50; iter++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      let best = 0;
      for (let c = 1; c < kk; c++) {
        if (dist2(pts[i], centroids[c]) < dist2(pts[i], centroids[best])) best = c;
      }
      if (best !== assign[i]) {
        assign[i] = best;
        moved = true;
      }
    }
    const next = [];
    for (let c = 0; c < kk; c++) {
      const members = pts.filter((_, i) => assign[i] === c);
      next.push(members.length ? centroidOf(members) : centroids[c]);
    }
    centroids = next;
    if (!moved) break;
  }
  const ops = pts.map((p) => p.op).sort((a, b) => a - b);
  const tfrs = pts.map((p) => p.tfr).sort((a, b) => a - b);
  const medOp = ops[Math.floor(ops.length / 2)];
  const medTfr = tfrs[Math.floor(tfrs.length / 2)];
  const clusters = centroids.map((c, i) => ({
    centroid: { op: +c.op.toFixed(4), tfr: +c.tfr.toFixed(4) },
    n: assign.filter((a) => a === i).length,
    ...labelOf(c, medOp, medTfr),
  }));
  return { clusters, assignments: assign, n: pts.length, version: PLAYSTYLE_VERSION };
}

/**
 * Compara vetor do jogador com um padrão EXPLÍCITO (origem obrigatória).
 * @param vec {op, tfr} — ex.: centroide do cluster dominante do jogador
 * @param pattern {op, tfr, label} + origin: "pool-propria" | "papel" | outra string declarada
 * @returns {distance, patternLabel, origin} — distância euclidiana no quadrado [0,1]²
 */
export function compareToPattern(vec, pattern) {
  const v = { op: clamp01(vec?.op), tfr: clamp01(vec?.tfr) };
  const p = { op: clamp01(pattern?.op), tfr: clamp01(pattern?.tfr) };
  if (v.op == null || v.tfr == null || p.op == null || p.tfr == null) return null;
  if (typeof pattern?.origin !== "string" || !pattern.origin) return null;
  const distance = Math.sqrt((v.op - p.op) ** 2 + (v.tfr - p.tfr) ** 2);
  return {
    distance: +distance.toFixed(4),
    patternLabel: pattern.label ?? "padrão",
    origin: pattern.origin,
    version: PLAYSTYLE_VERSION,
  };
}
