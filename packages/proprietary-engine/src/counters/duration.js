// counters/duration — curva de duração S7 (corpo idêntico ao ex-engine).
// Rótulos em ../utils/config.js (DURATION_BANDS); chaves e pontos médios
// locais (nunca exportados). Puro, sem I/O.
// Primitiva median via ../utils/math.js.
import { median } from "../utils/math.js";
import { DURATION_BANDS } from "../utils/config.js";

const DURATION_KEYS = ["min_win_rate6", "min_win_rate6_8", "min_win_rate8_10", "min_win_rate10_12", "min_win_rate12_14", "min_win_rate14_16", "min_win_rate16_18", "min_win_rate18_20", "min_win_rate20"];
const DURATION_MID = [5, 7, 9, 11, 13, 15, 17, 19, 22];

/** Extrai curva de duração {label, win} descartando 0/1 degenerados (L2). */
export function durationCurve(src) {
  return durationCurveDetailed(src).curve;
}

/** V2: curva + quarentena serializável (HIGH: prop em Array some no JSON). */
export function durationCurveDetailed(src) {
  const curve = [];
  const quarantined = [];
  for (let i = 0; i < DURATION_KEYS.length; i++) {
    const raw = src?.[DURATION_KEYS[i]];
    if (raw == null) continue;
    const v = Number(raw);
    // V2 §5.2/EC-010B: fora de [0,1] (ex: 53) = quarentena, nunca entra na curva.
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      quarantined.push({ key: DURATION_KEYS[i], reason: "rate_out_of_range" });
      continue;
    }
    // V2 §13/EC-010A: 0/1 preserva-se apenas com n validado; sem n, mantém-se a
    // guarda legada (descarta) + documenta — ver durationCurveV2 para modo com evidência.
    if (v === 0 || v === 1) continue;
    curve.push({ label: DURATION_BANDS[i], mid: DURATION_MID[i], win: v });
  }
  return { curve, quarantined };
}

/** V2 §13: curva com evidência explícita — 0/1 preservado como proxy sem n. */
export function durationCurveV2(src) {
  const curve = [];
  const quarantined = [];
  for (let i = 0; i < DURATION_KEYS.length; i++) {
    const raw = src?.[DURATION_KEYS[i]];
    if (raw == null) continue;
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      quarantined.push({ key: DURATION_KEYS[i], reason: "rate_out_of_range" });
      continue;
    }
    curve.push({ label: DURATION_BANDS[i], mid: DURATION_MID[i], win: v, evidence: "proxy_no_n" });
  }
  return { curve, quarantined };
}

/** Classifica perfil S7: snowball (cai com o tempo), scaling (sobe) ou uniforme. */
export function classifyDuration(curve) {
  // V2 §13/EC-011: <3 pontos válidos = sem cobertura → insufficient_data (nunca "uniforme").
  if (!Array.isArray(curve) || curve.length < 3) return "insufficient_data";
  const xs = curve.map((p) => p.mid), ys = curve.map((p) => p.win);
  const slopes = [];
  for (let i = 0; i < xs.length; i++)
    for (let j = i + 1; j < xs.length; j++) slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
  const s = median(slopes);
  if (s > 0.005) return "scaling";
  if (s < -0.005) return "snowball";
  return "uniforme";
}
