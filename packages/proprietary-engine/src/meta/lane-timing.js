// Curva de timing por rota — `time_win_rate[]` → janelas de poder + pico.
// Entrada: segmentos [{time_min, time_max, win_rate}] de UMA lane
// (endpoint win-rate/timeline; win_rate em 0–1, nunca %).
// Saída: movimento por segmento (sobe/desce/estavel, limiar = PRACTICAL_DELTA,
// mesmo conceito do trendDirectionOf), pico (janela de maior win_rate) e um
// veredito NA GRAMÁTICA do meta-trend (subindo|caindo|estavel|ruptura|sem-dado).
// Reuso real, sem duplicar regra: com janelas p/ o piso do detector (n≥7) o
// veredito é DELEGADO a `detectMetaTrend` (eixo de data sintético; data e
// projeção semanal não se aplicam a duração de partida e são nulados). Com
// 3–6 janelas, voto majoritário dos movimentos (piso distinto, documentado).
// Pura, sem I/O, zero dependências além de ./meta-trend.js e ./thresholds.js.

import { META_TREND_MIN_POINTS, detectMetaTrend } from "./meta-trend.js";
import { PRACTICAL_DELTA } from "../utils/thresholds.js";

export const LANE_TIMING_VERSION = "lane-timing-v1";

// Janelas mínimas p/ veredito (menos = sem-dado, nunca chute).
export const LANE_TIMING_MIN_WINDOWS = 3;
// Movimento mínimo entre janelas (mesmo conceito de relevância prática).
export const LANE_TIMING_DELTA = PRACTICAL_DELTA;

function moveOf(delta) {
  if (delta == null || !Number.isFinite(delta)) return "estavel";
  if (delta > LANE_TIMING_DELTA) return "sobe";
  if (delta < -LANE_TIMING_DELTA) return "desce";
  return "estavel";
}

function cleanWindows(windows) {
  const rows = (windows ?? [])
    .filter(
      (w) =>
        w &&
        Number.isFinite(Number(w.time_min)) &&
        Number.isFinite(Number(w.time_max)) &&
        typeof w.win_rate === "number" &&
        Number.isFinite(w.win_rate),
    )
    .map((w) => ({ time_min: Number(w.time_min), time_max: Number(w.time_max), win_rate: w.win_rate }))
    .sort((a, b) => a.time_min - b.time_min || a.time_max - b.time_max);
  return rows;
}

/**
 * @param windows [{time_min, time_max, win_rate}] da lane
 * @param lane "exp"|"mid"|"roam"|"jungle"|"gold"|null (só rotulagem)
 * @returns { verdict, lane, n, peak: {time_min,time_max,win_rate}|null,
 *   segments: [{time_min,time_max,win_rate,move}], slopePerWindow: number|null,
 *   reasons[], version }
 */
export function laneTimingCurve(windows, lane = null) {
  const rows = cleanWindows(windows);
  const n = rows.length;
  const segments = rows.map((w, i) => ({
    ...w,
    move: i === 0 ? "ref" : moveOf(w.win_rate - rows[i - 1].win_rate),
  }));
  const peak =
    n > 0
      ? { ...rows.reduce((a, b) => (b.win_rate > a.win_rate ? b : a)) }
      : null;
  const base = { lane, n, peak, segments, version: LANE_TIMING_VERSION };

  if (n < LANE_TIMING_MIN_WINDOWS) {
    return {
      ...base,
      verdict: "sem-dado",
      slopePerWindow: null,
      reasons: [`janelas=${n}<${LANE_TIMING_MIN_WINDOWS}`, "serie-curta-sem-veredito"],
    };
  }

  // Reuso: janelas suficientes p/ o detector canônico — veredito dele, com
  // reasons RETRADUZIDAS p/ o eixo de duração (o detector fala /dia e @data;
  // aqui a unidade é /janela e o marco é segmento — vazar o original mentiria).
  if (n >= META_TREND_MIN_POINTS) {
    const points = rows.map((w, i) => ({ date: `janela-${i}`, win: w.win_rate }));
    const r = detectMetaTrend(points);
    const reasons = r.reasons.map((x) =>
      String(x)
        .replace(/\/dia\b/g, "/janela")
        .replace(/ruptura-cusum@janela-(\d+)/g, "ruptura-cusum@segmento-$1"),
    );
    return {
      ...base,
      verdict: r.verdict,
      slopePerWindow: r.slopePerDay,
      forecastNext: null,
      changeDate: null,
      reasons: [
        ...reasons,
        `pico=${peak.time_min}-${peak.time_max}min@${peak.win_rate}`,
        "projecao-semanal-nao-aplica-a-duracao",
      ],
    };
  }

  // Piso próprio (3–6 janelas): voto majoritário dos movimentos + rampa ponta-a-ponta.
  const moves = segments.slice(1).map((s) => s.move);
  const up = moves.filter((m) => m === "sobe").length;
  const down = moves.filter((m) => m === "desce").length;
  const flat = moves.filter((m) => m === "estavel").length;
  const slopePerWindow = (rows[n - 1].win_rate - rows[0].win_rate) / Math.max(1, n - 1);
  let verdict = "estavel";
  if (up > down && up > 0) verdict = "subindo";
  else if (down > up && down > 0) verdict = "caindo";
  return {
    ...base,
    verdict,
    slopePerWindow: +slopePerWindow.toFixed(4),
    reasons: [
      `janelas=${n}`,
      `movimentos=sobe:${up}/desce:${down}/estavel:${flat}`,
      `rampa=${slopePerWindow >= 0 ? "+" : ""}${slopePerWindow.toFixed(4)}/janela`,
      `pico=${peak.time_min}-${peak.time_max}min@${peak.win_rate}`,
    ],
  };
}
