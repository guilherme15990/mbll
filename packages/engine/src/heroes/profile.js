// @radar/engine · heroes/profile — perfil do herói e do jogador (playstyle, calibração pessoal).
// Consolidado (ADR-061): reúne hero/hero-profile.js, personal/playstyle.js, personal/personal-calibration.js.
// Barrel público: src/index.js (nenhum nome público muda).

import { MIN_SUPPORT_N } from "../core/thresholds.js";

// ── hero/hero-profile.js ──
// Perfil dominante do herói (snowball/scaling/uniforme) — FONTE ÚNICA. Puro, sem I/O.
// Agregado honesto dos pares listados em confrontos; perfil existe por PAR, nunca na lista.
// Sem pares → null (sem selo).
//
// Spec V2 §13: perfis de duração/rota (`early/mid/late/flat`) só com cobertura suficiente
// e sem alegar causalidade; aqui a mesma disciplina vale para o agregado de pares:
// ausência de dado vira null, nunca um perfil "normal" inventado.

// MOTIVO: a ordem desta lista É a regra de desempate (antes: quem aparecesse primeiro no input,
// ou seja, dependia da ordem de iteração).
const VALID_PROFILES = ["snowball", "scaling", "uniforme"];

/**
 * Agregador de perfis por par. Sem estado — reutilizável.
 */
export class HeroProfile {
  /**
   * @param profiles (readonly string[]) perfis por par (brutos, podem vir misturados)
   * @returns {{ top: string, n: number, total: number } | null}
   */
  dominantProfileOf(profiles) {
    const counts = VALID_PROFILES.map(() => 0);
    let total = 0;
    for (const p of profiles ?? []) {
      const i = VALID_PROFILES.indexOf(p);
      if (i >= 0) {
        counts[i]++;
        total++;
      }
    }
    if (!total) return null;
    let best = 0;
    for (let i = 1; i < counts.length; i++) if (counts[i] > counts[best]) best = i; // estrito: empate fica com o primeiro
    return { top: VALID_PROFILES[best], n: counts[best], total };
  }
}

const defaultProfile = new HeroProfile();

/** Shim compatível. */
export function dominantProfileOf(profiles) {
  return defaultProfile.dominantProfileOf(profiles);
}

// ── personal/playstyle.js ──
// Clusterização de playstyle por (op, tfr) — estilo de jogo por herói+lane.
// op = parcela de dano (0–1); tfr = participação em lutas (0–1). Entrada: partidas
// INDIVIDUAIS do jogador (user/matches, exige JWT — fiação atrás de auth, L3).
// Método: k-means determinístico (init por faixas ordenadas, sem semente aleatória).
// Rótulos por quadrante vs medianas do conjunto (descritivos, sem juízo).
// Comparação com padrão EXIGE origem declarada (proveniência por construção).
// Pura, sem I/O, zero dependências.



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

// ── personal/personal-calibration.js ──
// Calibração própria × global — modelo puro, SEM fiação auth.
// `calibrateOwnVsGlobal` compara o win rate PRÓPRIO do jogador ({win, n})
// com o global do herói ({theta, se} do modelo hierárquico): acima / na faixa /
// abaixo do global, ou `incerteza-dominante` quando n é pequeno (piso = piso
// de suporte canônico; n=1 vira reason explícita, nunca veredito de direção).
// Banda = Z·√(se²_próprio + se²_global), Z=2 (mesmo ±2·se da projeção do
// meta-trend). Tudo em proporção 0–1, nunca %; n = partidas informadas, nunca
// inventado; nulo primeiro (sem-dado, nunca chute).
// `poolProfile` agrega a lista `frequent` (hid/tc/wc) em pool por papel —
// contagem honesta do que foi informado (papel via campo, mapa ou fn;
// sem mapa = "sem-papel", nunca chute de papel).
// Pura, sem I/O, zero dependências além de ./thresholds.js.



export const PERSONAL_CALIBRATION_VERSION = "personal-calibration-v1";

// Piso de partidas próprias p/ veredito direcional (menos = incerteza-dominante).
export const PERSONAL_MIN_N = MIN_SUPPORT_N;
// Largura da faixa em desvios (mesmo ±2·se da projeção honesta do meta-trend).
export const PERSONAL_Z = 2;

/**
 * @param own {win: proporção 0–1 | null, n: partidas | null}
 * @param global {theta: win global 0–1 | null, se: erro-padrão ≥0 | null}
 * @returns { verdict: "acima-do-global"|"na-faixa"|"abaixo-do-global"|
 *   "incerteza-dominante"|"sem-dado", diff, band, n, win, theta, reasons[], version }
 */
export function calibrateOwnVsGlobal({ own = {}, global = {} } = {}) {
  const win = own?.win;
  const n = own?.n;
  const theta = global?.theta;
  const se = global?.se;
  const base = { diff: null, band: null, n: null, win: null, theta: null, version: PERSONAL_CALIBRATION_VERSION,
    // LOW (V2 §16): banda normal ±2·se com n real — aproximação honesta, não posterior Beta.
    method: "normal_band_n_observed" };

  const winOk = typeof win === "number" && Number.isFinite(win) && win >= 0 && win <= 1;
  const thetaOk = typeof theta === "number" && Number.isFinite(theta) && theta >= 0 && theta <= 1;
  const seOk = typeof se === "number" && Number.isFinite(se) && se >= 0;
  const nOk = typeof n === "number" && Number.isFinite(n) && n >= 1;
  if (!winOk || !thetaOk || !seOk || !nOk) {
    const missing = [
      !winOk ? "win-proprio" : null,
      !nOk ? "n-proprio" : null,
      !thetaOk ? "theta-global" : null,
      !seOk ? "se-global" : null,
    ].filter(Boolean);
    return { ...base, verdict: "sem-dado", reasons: [`sem-dado:${missing.join("+")}`] };
  }

  const nn = Math.floor(n);
  const seOwn = Math.sqrt((win * (1 - win)) / nn);
  const band = PERSONAL_Z * Math.sqrt(seOwn * seOwn + se * se);
  const diff = win - theta;
  const out = {
    ...base,
    diff: +diff.toFixed(4),
    band: +band.toFixed(4),
    n: nn,
    win,
    theta,
  };
  if (nn < PERSONAL_MIN_N) {
    return {
      ...out,
      verdict: "incerteza-dominante",
      reasons: [
        nn === 1 ? "n=1" : `n=${nn}<${PERSONAL_MIN_N}`,
        "incerteza-amostral-domina",
        `faixa=±${band.toFixed(4)}`,
      ],
    };
  }
  if (diff > band) {
    return { ...out, verdict: "acima-do-global", reasons: [`diff=+${diff.toFixed(4)}>faixa=±${band.toFixed(4)}`] };
  }
  if (diff < -band) {
    return { ...out, verdict: "abaixo-do-global", reasons: [`diff=${diff.toFixed(4)}<faixa=-${band.toFixed(4)}`] };
  }
  return { ...out, verdict: "na-faixa", reasons: [`|diff|=${Math.abs(diff).toFixed(4)}≤faixa=±${band.toFixed(4)}`] };
}

function hidOf(e) {
  const v = e?.hid ?? e?.hero_id ?? e?.heroId ?? e?.id;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function tcWcOf(e) {
  const tc = Number(e?.tc ?? e?.n ?? e?.matches ?? e?.total);
  const wc = Number(e?.wc ?? e?.win ?? e?.wins);
  return {
    tc: Number.isFinite(tc) && tc >= 0 ? Math.floor(tc) : 0,
    wc: Number.isFinite(wc) && wc >= 0 ? Math.floor(wc) : 0,
  };
}

/**
 * @param frequent [{hid|hero_id, tc|n (partidas), wc|win (vitórias), role?}] (campos tolerantes)
 * @param roleOf fn(hid)=>papel | mapa {hid: papel} | null (origem do papel)
 * @returns null (lista vazia) ou { nHeroes, totalMatches, totalWins, winRate,
 *   perRole: [{role, heroes, matches, share}], mainRole, topShare, version }
 *   share/topShare em proporção 0–1, nunca %.
 */
export function poolProfile(frequent, roleOf = null) {
  const rows = (frequent ?? [])
    .map((e) => ({ hid: hidOf(e), ...tcWcOf(e), declared: typeof e?.role === "string" ? e.role : null }))
    .filter((r) => r.hid != null);
  if (!rows.length) return null;
  const resolve =
    typeof roleOf === "function"
      ? (hid) => roleOf(hid)
      : roleOf && typeof roleOf === "object"
        ? (hid) => roleOf[hid] ?? roleOf[String(hid)]
        : () => undefined;
  const byRole = new Map();
  let totalMatches = 0;
  let totalWins = 0;
  let topMatches = 0;
  for (const r of rows) {
    const role = r.declared ?? resolve(r.hid) ?? "sem-papel";
    if (!byRole.has(role)) byRole.set(role, { role, heroes: 0, matches: 0 });
    const g = byRole.get(role);
    g.heroes += 1;
    g.matches += r.tc;
    totalMatches += r.tc;
    totalWins += Math.min(r.wc, r.tc);
    if (r.tc > topMatches) topMatches = r.tc;
  }
  const perRole = [...byRole.values()]
    .map((g) => ({ ...g, share: totalMatches > 0 ? +(g.matches / totalMatches).toFixed(4) : null }))
    .sort((a, b) => b.matches - a.matches);
  return {
    nHeroes: rows.length,
    totalMatches,
    totalWins,
    winRate: totalMatches > 0 ? +(totalWins / totalMatches).toFixed(4) : null,
    perRole,
    mainRole: perRole[0]?.role ?? null,
    topShare: totalMatches > 0 ? +(topMatches / totalMatches).toFixed(4) : null,
    version: PERSONAL_CALIBRATION_VERSION,
  };
}
