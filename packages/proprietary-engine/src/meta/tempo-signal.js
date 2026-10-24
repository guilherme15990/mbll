// Sinal temporal e direção de série — FONTE ÚNICA.
// Movidos/unificados da web (semântica idêntica):
// - getSignalStateBadge ← DUPLICADO em TempoSection + TempoPanel (PRD Temporal
//   §6; canônico = descrições do painel global; ver relatório da migração)
// - isShortSeries/seriesSpanMs/seriesSpanDays ← TempoSection (série curta =
//   <2 pontos ou span <14d → inconclusivo, sem selo Persistente)
// - resolveTemporalSignal ← TempoSection (override de série curta)
// - trendDirectionOf ← TempoSection (dirWord por Δ em logit, limiar ±PRACTICAL_DELTA canônico)
// Puros, sem I/O.

import { PRACTICAL_DELTA } from "../utils/thresholds.js";

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
