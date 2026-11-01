// @radar/engine · heroes/trends — tendência temporal (Theil–Sen por data) e prior walk-forward.
// Consolidado (ADR-061): reúne walkforward/walkforward.js, hero/walk-forward-prior.js, hero/hero-trend.js, meta/meta-trend.js, meta/tempo-signal.js, meta/lane-timing.js, meta/assess-series.js.
// Barrel público: src/index.js (nenhum nome público muda).

import { PRACTICAL_DELTA } from "../core/thresholds.js";
import { mean } from "../core/math.js";

// ── walkforward/walkforward.js ──
// walkforward/walkforward — ADR-023 walk-forward: posterior de ontem = prior
// de hoje (corpo idêntico ao ex-engine, L2-WF-01..05).
// Funções puras, sem I/O. O prior é a NOSSA própria evidência passada
// (último snapshot VERIFICADO do mesmo rank+janela); priors comunitários seguem vetados.
// FATOR DE DESCONTO (L2-WF-02): WF_VERSION_BREAK_VARIANCE_FACTOR = 4.
// Justificativa: quebra de game_version (patch) = quebra de regime. Inflar a variância
// do prior por 4x ⇔ DP ×2 (o intervalo 95% do prior dobra): desconto honesto e calibrável.
// Nunca zera em silêncio (a história segue pesando via n descontado) nem carrega
// integralmente (o pull encolhe e o se alarga). 4 é inteiro pequeno, testável, e equivale
// a ~2 halvings exponenciais — conservador p/ patches, onde win rates deslocam vários pp.
// É o ÚNICO número novo do módulo; todo o resto reaproveita o M1 (ebShrink/obsVariance).
// Puro, sem I/O, zero dependências.
export const WF_VERSION_BREAK_VARIANCE_FACTOR = 4;

/** Validação na mão (JS puro, sem `any`): prior {mu, tau2, n, game_version}. */
export function isValidWalkPrior(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) return false;
  if (!Number.isFinite(p.mu) || p.mu < 0 || p.mu > 1) return false;
  if (!Number.isFinite(p.tau2) || !(p.tau2 > 0) || p.tau2 > 1) return false;
  if (!Number.isFinite(p.n) || !(p.n >= 1)) return false;
  if (typeof p.game_version !== "string" || !p.game_version) return false;
  return true;
}

/** Selo L2-WF-05: de onde veio a estabilidade. H = n do prior (profundidade de evidência). */
export function walkPriorStamp(prior) {
  if (!isValidWalkPrior(prior)) return "flat";
  return `walk-forward v${prior.n}`;
}

/**
 * Posterior resumido p/ a rodada seguinte (L2-WF-04, apêndice do snapshot).
 * Entradas escalares; nunca lê histórico (sem I/O — a API carrega e grava).
 * - mesma versão: prior pesa com n integral; tau_post = max(batch, prior) (nunca encolhe).
 * - quebra de versão: tau2_prior ×4 e n_prior descontado ⌊n/4⌋ (≥1); se alarga via tau_post.
 */
export function summarizeWalkPosterior({ muBatch, tau2Batch, nBatch, prior = null, gameVersion = null } = {}) {
  const gv = typeof gameVersion === "string" && gameVersion ? gameVersion : "desconhecida";
  const nB = Number.isFinite(nBatch) && nBatch >= 0 ? Math.floor(nBatch) : 0;
  const muB = Number.isFinite(muBatch) ? muBatch : 0.5;
  const t2B = Number.isFinite(tau2Batch) && tau2Batch > 0 ? tau2Batch : 1e-12;
  if (!isValidWalkPrior(prior)) return { mu: muB, tau2: t2B, n: nB, game_version: gv };
  const broken = gameVersion != null && String(prior.game_version) !== String(gameVersion);
  const K = WF_VERSION_BREAK_VARIANCE_FACTOR;
  const tau2eff = prior.tau2 * (broken ? K : 1);
  const nEff = broken ? Math.max(1, Math.floor(prior.n / K)) : Math.floor(prior.n);
  const denom = nEff + nB;
  const muPost = denom > 0 ? (nEff * prior.mu + nB * muB) / denom : muB;
  return { mu: muPost, tau2: Math.max(t2B, tau2eff), n: nEff + nB, game_version: gv };
}

// ── hero/walk-forward-prior.js ──
// hero/scoring/walk-forward-prior — prior walk-forward (ADR-023) como objeto de valor.


/**
 * Prior opcional {mu, tau2, n, game_version}: o último posterior VERIFICADO do mesmo rank+janela.
 *
 * Encapsula as três regras do ADR-023 que antes viviam espalhadas em `scoreBatch`:
 *  1. Prior inválido/ausente ⇒ inativo (fallback "flat", nada muda).
 *  2. Quebra de `game_version` (patch) ⇒ variância do prior × K (desconto honesto, nunca zera).
 *  3. O prior estabiliza SÓ a estimativa pontual; o `se` nunca encolhe (L2-WF-03).
 */
export class WalkForwardPrior {
  #prior;
  #gameVersion;

  /**
   * @param {object|null|undefined} rawPrior  Prior candidato (validado aqui).
   * @param {string|null} [gameVersion]       Versão do jogo do lote corrente.
   */
  constructor(rawPrior, gameVersion = null) {
    this.#prior = isValidWalkPrior(rawPrior) ? rawPrior : null;
    this.#gameVersion = gameVersion ?? null;
  }

  /** Há prior válido em uso? */
  get active() {
    return this.#prior !== null;
  }

  /** Mudou a versão do jogo? Sem `gameVersion` informado NÃO há quebra (quem chama deve passá-la). */
  get versionBroken() {
    return this.#prior !== null && this.#gameVersion != null && String(this.#prior.game_version) !== String(this.#gameVersion);
  }

  /** Variância efetiva do prior para o pull (0 se inativo). */
  get tau2Effective() {
    if (!this.#prior) return 0;
    return this.#prior.tau2 * (this.versionBroken ? WF_VERSION_BREAK_VARIANCE_FACTOR : 1);
  }

  /** Selo de proveniência: "flat" ou "walk-forward v<n>". */
  get stamp() {
    return walkPriorStamp(this.#prior);
  }

  /**
   * Estabiliza a média posterior: m* = (m·τ²eff + μ_prior·V)/(V + τ²eff).
   * Herói incerto (V grande) puxa mais para o prior; confiante quase não move.
   * @param {number} m  Média posterior do lote.
   * @param {number} V  Variância posterior do lote.
   */
  pullPoint(m, V) {
    const t2 = this.tau2Effective;
    if (this.#prior && Number.isFinite(V) && V > 0 && Number.isFinite(t2) && t2 > 0) {
      return (m * t2 + this.#prior.mu * V) / (V + t2);
    }
    return m;
  }

  /**
   * Erro-padrão final. Sem prior: o do lote. Com prior: mesma versão ⇒ idêntico; quebra ⇒ V × K.
   * @param {number} V       Variância posterior do lote.
   * @param {number} baseSe  Erro-padrão do lote.
   */
  standardError(V, baseSe) {
    if (!this.#prior) return baseSe;
    return Math.sqrt(Math.max(this.versionBroken ? V * WF_VERSION_BREAK_VARIANCE_FACTOR : V, 1e-12));
  }
}

// ── hero/hero-trend.js ──
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
export function trendOfDated(points, opts = {}) {
  return defaultTrend.radarOfDated(points, opts);
}

// ── meta/meta-trend.js ──
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

// ── meta/tempo-signal.js ──
// Sinal temporal e direção de série — FONTE ÚNICA.
// Movidos/unificados da web (semântica idêntica):
// - getSignalStateBadge ← DUPLICADO em TempoSection + TempoPanel (PRD Temporal
//   §6; canônico = descrições do painel global; ver relatório da migração)
// - isShortSeries/seriesSpanMs/seriesSpanDays ← TempoSection (série curta =
//   <2 pontos ou span <14d → inconclusivo, sem selo Persistente)
// - resolveTemporalSignal ← TempoSection (override de série curta)
// - trendDirectionOf ← TempoSection (dirWord por Δ em logit, limiar ±PRACTICAL_DELTA canônico)
// Puros, sem I/O.



const DAY_MS = 86400e3;

/** Mapeamento formal dos estados do sinal (PRD Temporal §6). */
export function getSignalStateBadge(status) {
  const s = (status || "").toLowerCase();
  if (s === "persistent") {
    return {
      label: "Sinal Persistente",
      desc: "A mudança de força continua em snapshots posteriores e resiste a variações de janela. Qualificado como Alerta competitivo.",
      color: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
    };
  }
  if (s === "reverted") {
    return {
      label: "Sinal Revertido",
      desc: "A estimativa voltou à linha de base ou inverteu a direção. Reação passageira ou ruído inicial descartado.",
      color: "text-amber-300 border-amber-400/30 bg-amber-400/10",
    };
  }
  if (s === "initial") {
    return {
      label: "Sinal Inicial",
      desc: "A estimativa mudou na primeira janela pós-patch, sem confirmação temporal independente. Não anunciado como definitivo.",
      color: "text-cyan-300 border-cyan-400/30 bg-cyan-400/10",
    };
  }
  return {
    label: "Inconclusivo",
    desc: "Variação dentro da margem de ruído ou fortemente dependente da premissa c.",
    color: "text-mist border-line bg-abyss",
  };
}

/** Span da série em ms (|primeira − última|; 0 com <2 pontos). */
export function seriesSpanMs(points) {
  const pts = points ?? [];
  if (pts.length < 2) return 0;
  return Math.abs(Date.parse(pts[0].date) - Date.parse(pts[pts.length - 1].date));
}

/** Span da série em dias (arredondado; 0 com <2 pontos). */
export function seriesSpanDays(points) {
  const pts = points ?? [];
  if (pts.length < 2) return 0;
  return Math.round(seriesSpanMs(pts) / DAY_MS);
}

/** Série curta: <2 pontos ou span <14d → sem confirmação temporal. */
export function isShortSeries(points) {
  const pts = points ?? [];
  return pts.length < 2 || seriesSpanMs(pts) < 14 * DAY_MS;
}

/** Estado do sinal com override de série curta (sempre Inconclusivo). */
export function resolveTemporalSignal(status, points) {
  if (isShortSeries(points)) {
    return { label: "Inconclusivo", desc: "Série curta: sem confirmação temporal independente.", color: "text-mist border-line bg-abyss", short: true };
  }
  return { ...getSignalStateBadge(status), short: false };
}

/** Direção por Δ em logit (limiar ±PRACTICAL_DELTA canônico; nulo/não-finito = sem direção). */
export function trendDirectionOf(view) {
  const delta = (view && (view.delta ?? view.delta_logit)) ?? null;
  if (delta == null || !Number.isFinite(delta)) return { word: "sem direção", delta };
  if (delta > PRACTICAL_DELTA) return { word: "subindo", delta };
  if (delta < -PRACTICAL_DELTA) return { word: "caindo", delta };
  return { word: "estável", delta };
}

// ── meta/lane-timing.js ──
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

// ── meta/assess-series.js ──
// meta/assess-series — BC-TEMPO / DDD-V4-05 (corpo idêntico ao ex-engine).
// SnapshotHistory detém ordenação, lacuna, duplicata e "série curta".
// T5 consome a série (INV4-015): persistente|revertido exige ≥2 snapshots VERIFICADOS
// não-sobrepostos com span ≥14d; <14d ou 1 snapshot ⇒ serie_curta; só janelas
// sobrepostas ⇒ inconclusivo (sem replicação independente). Violados entram no histórico
// (auditoria) mas NUNCA contam como replicação. Duplicata (mesmo hash) conta 1.
// Não-sobreposição: intervalos [t-w,t] disjuntos ⇔ gap ≥ janela do posterior.
// Puro, sem I/O, zero dependências.
/**
 * @param snaps [{coletado_em, janela, payload_hash, status}]
 */
export function assessSeries(snaps = []) {
  const base = { n_snapshots: 0, n_distintos: 0, span_dias: 0, nao_sobrepostos: false, lacunas: 0, status: "serie_curta", motivo: "sem snapshots verificados" };
  const ver = (snaps ?? [])
    .filter((s) => s && s.status !== "violado")
    .map((s) => ({ ts: Number(s.coletado_em ?? s.ts), janela: Number(s.janela ?? 7) || 7, hash: String(s.payload_hash ?? s.hash ?? "") }))
    .filter((s) => Number.isFinite(s.ts) && s.ts > 0)
    .sort((a, b) => a.ts - b.ts);
  const distintos = ver.filter((s, i) => i === 0 || s.hash === "" || s.hash !== ver[i - 1].hash);
  const n = distintos.length;
  if (!n) return base;
  const span = (distintos[n - 1].ts - distintos[0].ts) / 86400e3;
  const head = { n_snapshots: ver.length, n_distintos: n, span_dias: +span.toFixed(2) };
  if (n < 2) return { ...head, nao_sobrepostos: false, lacunas: 0, status: "serie_curta", motivo: "1 snapshot verificado — sem replicação (INV4-015)" };
  if (span < 14) return { ...head, nao_sobrepostos: false, lacunas: 0, status: "serie_curta", motivo: `span ${head.span_dias}d < 14d (INV4-015)` };
  let nao = false, lac = 0;
  for (let j = 1; j < n; j++) {
    const gap = distintos[j].ts - distintos[j - 1].ts;
    if (gap >= distintos[j].janela * 86400e3) nao = true;
    if (gap > 2 * Math.max(distintos[j].janela, distintos[j - 1].janela) * 86400e3) lac++;
  }
  if (!nao) return { ...head, nao_sobrepostos: false, lacunas: lac, status: "inconclusivo", motivo: "só janelas sobrepostas — sem replicação independente" };
  return { ...head, nao_sobrepostos: true, lacunas: lac, status: "avaliavel", motivo: "≥2 verificados não-sobrepostos, span ≥14d" };
}
