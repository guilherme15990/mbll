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

import { MIN_SUPPORT_N } from "../utils/thresholds.js";

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
