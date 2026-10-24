// Tendência da fáscia por herói — FONTE ÚNICA. Puro, sem I/O.
// A geometria SVG `sparkPath` é presentacional e FICA na web.
//
// Spec V2 §11: Theil–Sen com TEMPO REAL `slope = median((yⱼ−yᵢ)/(tⱼ−tᵢ))`,
// séries SEPARADAS win/pick/ban, `direction ∈ rising|stable|falling|insufficient_data`
// + `delta_pp_window, slope_pp_per_day, n_points, window_days, robustness`.
// `robustness` = QUALIDADE DE COBERTURA (nunca evidência estatística da inclinação);
// `statistical_evidence` fica explicitamente null até haver teste/calibração válida.

export const TREND_N = 5;
// Placa anti-unificação: 0.005 NÃO é o PRACTICAL_DELTA (0.02) de thresholds.js.
// Dimensão distinta por decisão: sensibilidade de fáscia em série curta (5 pts) — limiar
// prático de classificação usa PRACTICAL_DELTA; este decide só a seta.
export const TREND_DELTA = 0.005;
export const TREND_VERSION = "theil-sen-date-v2";
export const TREND_PRACTICAL_DELTA_PP = 0.5;
// P1 auditoria (L2 registrada): limiares por métrica — popularidade e eficácia têm
// escalas e ruído distintos. Valores iniciais = ponto de partida, NÃO calibração.
export const TREND_DELTA_WIN = 0.005;
export const TREND_DELTA_PICK = 0.01;
export const TREND_DELTA_BAN = 0.01;

// MOTIVO: Theil–Sen (mediana das inclinações par-a-par) no lugar de último − primeiro.
// Com 5 pontos, um único ponto atípico no extremo decidia sozinho a seta. Sem dependências;
// O(m²) com m = TREND_N (10 pares). `delta` segue na MESMA UNIDADE de antes (variação total
// na janela = inclinação mediana × (m − 1)), então TREND_DELTA continua válido.
function theilSenDelta(ys) {
  const slopes = [];
  for (let i = 0; i < ys.length - 1; i++)
    for (let j = i + 1; j < ys.length; j++) slopes.push((ys[j] - ys[i]) / (j - i));
  slopes.sort((a, b) => a - b);
  const mid = slopes.length >> 1;
  const med = slopes.length % 2 ? slopes[mid] : (slopes[mid - 1] + slopes[mid]) / 2;
  return med * (ys.length - 1);
}

/** Normaliza para o dia UTC de referência — timestamps do mesmo dia deduplicam juntos (P1). */
function toDay(date) {
  const t = Date.parse(date);
  if (!Number.isFinite(t)) return NaN;
  return Math.floor(t / 86400000);
}

/**
 * Tendência de série temporal por herói (V2 §11). Limiares por métrica injetáveis
 * (OCP); o legado uniforme `trendOf` é preservado como shim deprecated.
 */
export class HeroTrendAnalyzer {
  #deltaWin;
  #deltaPick;
  #deltaBan;

  /**
   * @param {object} [opts]
   * @param {number} [opts.deltaWin] Limiar win (fração na janela).
   * @param {number} [opts.deltaPick] Limiar pick/app (fração na janela).
   * @param {number} [opts.deltaBan] Limiar ban (fração na janela).
   */
  constructor({ deltaWin = TREND_DELTA_WIN, deltaPick = TREND_DELTA_PICK, deltaBan = TREND_DELTA_BAN } = {}) {
    this.#deltaWin = deltaWin;
    this.#deltaPick = deltaPick;
    this.#deltaBan = deltaBan;
  }

  /**
   * Direção sobre os últimos `n` pontos com win finito (espaçamento uniforme).
   * LEGADO (EC-003): preservado — prefira `seriesDated`/`radarOfDated` com datas reais.
   * @deprecated use radarOfDated(points com date) — Theil–Sen com tempo real (V2 §11.1)
   */
  trendOf(points, n = TREND_N) {
    const ys = (points ?? []).map((p) => p && p.win).filter(Number.isFinite).slice(-n);
    if (ys.length < 2) return { dir: "sem-dado", delta: null, n: ys.length };
    const delta = theilSenDelta(ys);
    if (delta > TREND_DELTA) return { dir: "subindo", delta, n: ys.length };
    if (delta < -TREND_DELTA) return { dir: "caindo", delta, n: ys.length };
    return { dir: "estável", delta, n: ys.length };
  }

  /**
   * Theil–Sen datado sobre uma série: points [{date, value}].
   * Retorna {direction, delta_pp_window, slope_pp_per_day, n_points, window_days,
   *  robustness, coverage_quality, statistical_evidence: null, version}.
   */
  seriesDated(points, { valueKey = "win", deltaThreshold = TREND_DELTA } = {}) {
    const byDate = new Map();
    let duplicates = 0;
    for (const p of points ?? []) {
      if (!p || typeof p !== "object") continue;
      const day = toDay(p.date);
      const v = Number(p[valueKey] ?? p.win ?? p.value);
      if (!Number.isFinite(day) || !Number.isFinite(v)) continue;
      if (v < 0 || v > 1) continue; // EC-001: fora de [0,1] quarentena, nunca zero
      if (byDate.has(day)) duplicates++;
      byDate.set(day, v); // regra versionada: last-wins por data
    }
    const days = [...byDate.keys()].sort((a, b) => a - b);
    const n_points = days.length;
    if (n_points < 2) {
      return { direction: "insufficient_data", delta_pp_window: null, slope_pp_per_day: null, n_points, window_days: 0, robustness: "low", coverage_quality: "low", duplicate_dates_dropped: duplicates, version: TREND_VERSION };
    }
    const slopes = [];
    for (let i = 0; i < days.length - 1; i++) {
      for (let j = i + 1; j < days.length; j++) {
        const dt = days[j] - days[i];
        if (dt <= 0) continue;
        slopes.push((byDate.get(days[j]) - byDate.get(days[i])) / dt);
      }
    }
    if (!slopes.length) {
      return { direction: "insufficient_data", delta_pp_window: null, slope_pp_per_day: null, n_points, window_days: 0, robustness: "low", coverage_quality: "low", duplicate_dates_dropped: duplicates, version: TREND_VERSION };
    }
    slopes.sort((a, b) => a - b);
    const mid = slopes.length >> 1;
    const slope = slopes.length % 2 ? slopes[mid] : (slopes[mid - 1] + slopes[mid]) / 2;
    const window_days = days[days.length - 1] - days[0];
    const delta = slope * window_days;
    const direction = delta > deltaThreshold ? "rising" : delta < -deltaThreshold ? "falling" : "stable";
    // robustness = cobertura + lacunas (V2 §11.2), nunca prova estatística.
    const expectedSpan = n_points - 1;
    const gaps = window_days > 0 ? window_days / Math.max(1, expectedSpan) : 1;
    const robustness = n_points >= 5 && gaps <= 1.5 ? "high" : n_points >= 3 && gaps <= 3 ? "medium" : "low";
    return {
      direction, delta_pp_window: +(delta * 100).toFixed(3), slope_pp_per_day: +(slope * 100).toFixed(4),
      n_points, window_days: +window_days.toFixed(2), robustness,
      coverage_quality: robustness, // alias explícito: cobertura, não prova estatística
      statistical_evidence: null, duplicate_dates_dropped: duplicates, version: TREND_VERSION,
    };
  }

  /** Radar win/pick/ban separados (V2 §11.2–11.3). Aceita {date, win_rate|win, app_rate|pick, ban_rate|ban}. */
  radarOfDated(points, opts = {}) {
    const norm = (points ?? []).map((p) => ({
      date: p?.date,
      win: p?.win ?? p?.win_rate, pick: p?.pick ?? p?.app_rate, ban: p?.ban ?? p?.ban_rate,
    }));
    const base = opts.deltaThreshold; // compat: limiar único legado
    const win = this.seriesDated(norm.map((p) => ({ date: p.date, value: p.win })), { valueKey: "value", ...opts, deltaThreshold: opts.deltaWin ?? base ?? this.#deltaWin });
    const pick = this.seriesDated(norm.map((p) => ({ date: p.date, value: p.pick })), { valueKey: "value", ...opts, deltaThreshold: opts.deltaPick ?? base ?? this.#deltaPick });
    const ban = this.seriesDated(norm.map((p) => ({ date: p.date, value: p.ban })), { valueKey: "value", ...opts, deltaThreshold: opts.deltaBan ?? base ?? this.#deltaBan });
    return { win_rate: win, pick_rate: pick, ban_rate: ban, version: TREND_VERSION };
  }
}

const defaultTrend = new HeroTrendAnalyzer();

/** Shims compatíveis — comportamento idêntico ao anterior. */
export function trendOf(points, n = TREND_N) {
  return defaultTrend.trendOf(points, n);
}
export function trendSeriesDated(points, opts) {
  return defaultTrend.seriesDated(points, opts);
}
export function trendOfDated(points, opts = {}) {
  return defaultTrend.radarOfDated(points, opts);
}
