// Detector de tendências do meta — modelo único (spec §2 do pedido).
// Combina em UMA função: médias móveis (cruzamento curta/longa), variação
// percentual ponta-a-ponta, regressão linear OLS (inclinação + R²), correlação
// tempo×métrica e detecção de ruptura CUSUM. Saída: um veredito + motivos.
// Projeção curta ("semana seguinte") com intervalo do resíduo — nunca promessa.
// Pura, sem I/O, zero dependências.

export const META_TREND_VERSION = "meta-trend-v1";

// Mínimo de pontos p/ veredito (menos = sem-dado, nunca chute).
export const META_TREND_MIN_POINTS = 7;

// Dona única em ../utils/math.js (média de finitos; null sem dado). Todos os usos
// abaixo recebem arrays não-vazios (guardas de piso), logo a troca é idêntica.
import { mean } from "../utils/math.js";

function linreg(ys) {
  // OLS y ~ a + b*t, t = 0..n-1. Retorna {slope, r2, se} (se = DP dos resíduos).
  const n = ys.length;
  const tm = (n - 1) / 2;
  let sxx = 0, sxy = 0;
  const ym = mean(ys);
  for (let i = 0; i < n; i++) {
    sxx += (i - tm) * (i - tm);
    sxy += (i - tm) * (ys[i] - ym);
  }
  if (!(sxx > 0)) return { slope: 0, r2: 0, se: NaN };
  const slope = sxy / sxx;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const fit = ym + slope * (i - tm);
    ssRes += (ys[i] - fit) * (ys[i] - fit);
    ssTot += (ys[i] - ym) * (ys[i] - ym);
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  return { slope, r2, se: Math.sqrt(ssRes / Math.max(1, n - 2)) };
}

function cusumBreak(ys) {
  // Ruptura CUSUM sobre os RESÍDUOS do ajuste linear (rampa constante não é
  // ruptura — só quebra de nível dispara). Retorna índice ou -1.
  const n = ys.length;
  if (n < META_TREND_MIN_POINTS) return -1;
  const reg = linreg(ys);
  const tm = (n - 1) / 2;
  const ym = mean(ys);
  const res = ys.map((y, i) => y - (ym + reg.slope * (i - tm)));
  const m = mean(res);
  let acc = 0, best = 0, at = -1;
  for (let i = 0; i < n - 1; i++) {
    acc += res[i] - m;
    const dev = Math.abs(acc);
    if (dev > best) {
      best = dev;
      at = i;
    }
  }
  // Decisão por teste F: o split em `at` precisa explicar bem mais que o ajuste
  // único (rampa limpa tem SSE≈0 e nunca dispara; patamar que vira, sim).
  if (at < 2 || at > n - 4) return -1;
  const sse = (seg) => {
    const r = linreg(seg);
    const mm = mean(seg);
    const t0 = (seg.length - 1) / 2;
    return seg.reduce((a, y, i) => a + (y - (mm + r.slope * (i - t0))) ** 2, 0);
  };
  const sse1 = sse(ys);
  if (sse1 < 1e-12) return -1; // ajuste único perfeito: nada a quebrar
  const sse2 = sse(ys.slice(0, at + 1)) + sse(ys.slice(at + 1));
  const f = ((sse1 - sse2) / 2) / (sse2 / Math.max(1, n - 4) + 1e-12);
  if (!(f > 10)) return -1;
  return at;
}

/**
 * @param points [{date, win, pick, ban}] ordem cronológica (qualquer subconjunto de métricas)
 * @param metric "win" | "pick" | "ban" (default "win")
 * @returns { verdict: "subindo"|"caindo"|"estavel"|"ruptura"|"sem-dado",
 *   slopePerDay, r2, corr, changeDate, forecastNext: {value, lo, hi} | null, reasons[] }
 */
export function detectMetaTrend(points, metric = "win") {
  const base = { verdict: "sem-dado", slopePerDay: null, r2: null, corr: null, changeDate: null, forecastNext: null, reasons: [], version: META_TREND_VERSION };
  const ys = (points ?? []).map((p) => p?.[metric]).filter((v) => typeof v === "number" && Number.isFinite(v));
  const n = ys.length;
  if (n < META_TREND_MIN_POINTS) return { ...base, reasons: [`n=${n}<${META_TREND_MIN_POINTS}`] };
  const reg = linreg(ys);
  const corr = Math.sqrt(reg.r2) * Math.sign(reg.slope || 0);
  // Variação percentual ponta-a-ponta (médias de 3 p/ robustez).
  const head = mean(ys.slice(0, Math.min(3, n)));
  const tail = mean(ys.slice(-Math.min(3, n)));
  const pctVar = head !== 0 ? (tail - head) / Math.abs(head) : 0;
  // Cruzamento de médias: curta (3) vs longa (7 ou n).
  const maS = mean(ys.slice(-3));
  const maL = mean(ys.slice(-Math.min(7, n)));
  const cross = maS - maL;
  const scale = Math.abs(maL) > 1e-9 ? Math.abs(maL) : 1;
  // Ruptura antes do veredito de tendência (mudança de regime manda).
  const at = cusumBreak(ys);
  const dates = (points ?? []).map((p) => p?.date).filter(Boolean);
  if (at >= 0) {
    const before = mean(ys.slice(0, at + 1));
    const after = mean(ys.slice(at + 1));
    return {
      ...base,
      verdict: "ruptura",
      slopePerDay: reg.slope,
      r2: +reg.r2.toFixed(4),
      corr: +corr.toFixed(4),
      changeDate: dates[at + 1] ?? null,
      forecastNext: null,
      reasons: [`ruptura-cusum@${dates[at + 1] ?? at + 1}`, `salto ${(after >= before ? "+" : "")}${((after - before) * 100).toFixed(1)}pp`, "projecao-suspensa-apos-ruptura"],
      version: META_TREND_VERSION,
    };
  }
  // Votos: inclinação com força (R²≥0.35) + cruzamento + variação concordam.
  const up = reg.slope > 0;
  const strong = reg.r2 >= 0.35;
  const agree = (up && cross >= 0 && pctVar >= 0) || (!up && cross <= 0 && pctVar <= 0);
  let verdict = "estavel";
  const reasons = [`r2=${reg.r2.toFixed(2)}`, `inclinacao=${up ? "+" : ""}${reg.slope.toExponential(1)}/dia`, `cruzamento-ma=${cross >= 0 ? "+" : ""}${(cross / scale * 100).toFixed(1)}%`, `variacao=${(pctVar * 100).toFixed(1)}%`];
  if (strong && agree) verdict = up ? "subindo" : "caindo";
  // Projeção curta honesta: extrapola 7d com ±2·se (nunca promessa).
  const last = ys[n - 1];
  const proj = last + reg.slope * 7;
  const band = 2 * (Number.isFinite(reg.se) ? reg.se : 0);
  return {
    ...base,
    verdict,
    slopePerDay: reg.slope,
    r2: +reg.r2.toFixed(4),
    corr: +corr.toFixed(4),
    changeDate: null,
    forecastNext: { value: +proj.toFixed(4), lo: +(proj - band).toFixed(4), hi: +(proj + band).toFixed(4) },
    reasons,
    version: META_TREND_VERSION,
  };
}
