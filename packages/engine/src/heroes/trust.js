// @radar/engine · heroes/trust — políticas de confiança, intervalos e trio de incerteza.
// Consolidado (ADR-061): reúne hero/trust.js, confidence/confidence-bands.js, confidence/confidence-trio.js.
// Barrel público: src/index.js (nenhum nome público muda).

import { C_REFERENCE, DELTA_DEFAULT } from "../core/config.js";
import { makeExposure } from "../matchups/counters.js";

// ── hero/trust.js ──
// Rótulos de confiança — FONTE ÚNICA. Puros, sem I/O.
// - classOf: taxonomia descritiva das flags de significância (experimental).
// - verdictShort ← HeroDetail.tsx (frase curta).
// (confidenceToTrust/trustOf/verdictSentence removidos: sem consumidor.)
// Escasso = smallSample, degenerate ou B abaixo do piso → número encolhido.
const B_FLOOR = 0.25;

/**
 * Política de confiança do herói (V2 §8, sem selo público confirmatório).
 * Sem estado — reutilizável.
 */
export class HeroTrustPolicy {
  /** Leitura puxada à média: amostra pequena, taxa degenerada ou B abaixo do piso. */
  isScarce(h) {
    return Boolean(h == null ? false : h.smallSample || h.degenerate || (h.B ?? 1) < B_FLOOR);
  }

  /** Taxonomia descritiva (rótulos da UI) derivada das flags de significância. */
  classOf(h) {
    if (!h) return null;
    if (h.smallSample) return "Amostra pequena";
    // MOTIVO: Joia ANTES de Forte. isGem ⊂ strong, então na ordem antiga ("Forte" primeiro) o
    // ramo "Joia" era inalcançável.
    if (h.isGem) return "Joia";
    if (h.strong) return "Forte";
    if (h.weak) return "Fraco";
    return "Na media";
  }

  /** L3 curta para o H1 da capa (HeroDetails §1.1). */
  verdictShort(h) {
    if (h == null) return "sem dado neste recorte";
    if (this.isScarce(h)) return "número encolhido à média, desconfie de picos";
    return "não locke cego, veja quem countera";
  }
}

const defaultTrust = new HeroTrustPolicy();

/** Shims compatíveis. */
export function classOf(h) {
  return defaultTrust.classOf(h);
}
export function verdictShort(h) {
  return defaultTrust.verdictShort(h);
}

// ── confidence/confidence-bands.js ──
// Faixas interpretativas da posterior (PRD Confidence §8) — FONTE ÚNICA.
// Unifica os DUPLICADOS `interpretProbBand` de
// app/web/src/pages/hero/sections/ConfiancaSection.tsx ({label,color}) e
// app/web/src/pages/panels/ConfiancaPanel.tsx ({label,color,desc}).
// Canônico = forma do painel (com `desc`); limiares e rótulos idênticos.
// Puro, sem I/O.

/** Faixas interpretativas oficiais PRD Confidence §8 (política de produto). */
export function interpretProbBand(p) {
  // V2 §8.3 (MEDIUM): 0,95/0,80 são pontos de partida, NÃO calibração — cada faixa
  // carrega `calibration_status` para a UI declarar o caráter model-based.
  const CAL = "uncalibrated_model_based";
  if (p == null || !Number.isFinite(p)) return { label: "Indisponível", color: "text-mist", desc: "Sem dados suficientes para calcular posterior.", calibration_status: CAL };
  if (p >= 0.95) return { label: "Evidência posterior forte a favor", color: "text-emerald-300", desc: "95% a 100% de probabilidade posterior condicional ao modelo.", calibration_status: CAL };
  if (p >= 0.8) return { label: "Sinal favorável, ainda incerto", color: "text-cyan-200", desc: "80% a 95% de probabilidade posterior condicional.", calibration_status: CAL };
  if (p > 0.2) return { label: "Inconclusivo para a decisão", color: "text-mist", desc: "20% a 80%: intervalo cruza o limiar de relevância prática (Δ=0.02).", calibration_status: CAL };
  if (p > 0.05) return { label: "Sinal contrário, ainda incerto", color: "text-amber-300", desc: "5% a 20%: probabilidade moderada de ficar abaixo da média.", calibration_status: CAL };
  return { label: "Evidência posterior forte contra", color: "text-rose-300", desc: "0% a 5%: evidência de desempenho abaixo da média.", calibration_status: CAL };
}

// ── confidence/confidence-trio.js ──
// confidence/confidence-trio — trio provisório CNF (D-CONF-01..03).
// Posterior/IC/prob separados, com c_reference declarado. Puro, sem I/O.
// Config via ../utils/config.js (local, sem ciclo);
// exposure via ../governance/exposure.js (local, nunca via engine).
//
// v3: banda de sensibilidade na grade c REMOVIDA — 4 cenários por herói que nunca
// cruzavam no regime proxy (132/132 "provisional" sondado). A premissa é um único
// c declarado; `uncertainty_status` volta a ser provisional|unavailable.



/** CNF: trio provisório — posterior/IC/prob separados, com c_reference declarado. */
export function confidenceTrio({ wrAdj, med, se = 0.02, c = C_REFERENCE, delta = DELTA_DEFAULT } = {}) {
  if (![wrAdj, med, se].every(Number.isFinite) || se <= 0) {
    return { posterior_mean: null, credible_interval_95: null, posterior_prob_above_threshold: null, c_reference: c, uncertainty_status: "unavailable", exposure: makeExposure(NaN) };
  }
  const mean = wrAdj;
  const half = 1.96 * se;
  const lo = mean - half, hi = mean + half;
  const z = (mean - (med + delta)) / (se || 1e-9);
  // P(θ>μ+Δ) = Φ(z) — probabilidade posterior CONDICIONAL ao modelo/proxy (V2 §8.3).
  const prob = 0.5 * (1 + erfApprox(z / Math.SQRT2));
  return {
    posterior_mean: +mean.toFixed(4), credible_interval_95: [+lo.toFixed(4), +hi.toFixed(4)],
    posterior_prob_above_threshold: +prob.toFixed(4), delta_threshold: delta,
    c_reference: c,
    uncertainty_status: "provisional",
    exposure: makeExposure(NaN),
  };
}
function erfApprox(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, pp = 0.3275911;
  const s = Math.sign(x) || 1; const t = Math.abs(x); const tt = 1 / (1 + pp * t);
  const poly = ((((a5 * tt + a4) * tt + a3) * tt + a2) * tt + a1) * tt;
  return s * (1 - poly * Math.exp(-t * t));
}
