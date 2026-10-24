// Rótulos de perfil rank a×b (PRD Rank §9) — FONTE ÚNICA.
// Unifica os DUPLICADOS `getRankProfileLabel` de
// app/web/src/pages/hero/sections/RanksSection.tsx e
// app/web/src/pages/panels/RanksPanel.tsx (limiares, rótulos e cores idênticos;
// motivos canônicos = versão do painel global; ver relatório da migração).
// Δr default = PRACTICAL_DELTA canônico (./thresholds.js — relevância prática).
// Puro, sem I/O.

import { PRACTICAL_DELTA } from "../utils/thresholds.js";

export const RANK_ORDER = ["epic", "legend", "mythic", "honor", "glory"];

/**
 * @param d {{ diff: number|null, delta_r?: number, prob_above?: number, classification_status?: string }}
 * @param a rank base, @param b rank comparado
 */
export function getRankProfileLabel(d, a, b) {
  const D = d.diff;
  const dr = d.delta_r ?? PRACTICAL_DELTA;
  const prob = d.prob_above ?? 0;
  // "classified" legado + "provisional_model_based" (V2 §8) — ambos descritivos do
  // ponto estimado; o caveat abaixo marca a proveniência proxy.
  const usable = d.classification_status === "classified" || d.classification_status === "provisional_model_based";
  const caveat = d.classification_status === "provisional_model_based" ? " Estimativa model-based (sem contagens validadas)." : "";

  if (!usable || D == null || !Number.isFinite(D)) {
    return {
      label: "Inconclusivo",
      motive: "Diferença imprecisa ou classificação sensível à premissa c — padrão padrão sem evidência suficiente.",
      color: "text-mist border-line bg-abyss",
    };
  }

  if (Math.abs(D) <= dr) {
    return {
      label: "Consistente entre ranks",
      motive: `Variação relativa |D|=${Math.abs(D).toFixed(4)} ≤ Δr (${dr}). Força favorável mantida sem desvios relevantes.${caveat}`,
      color: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
    };
  }

  if (prob < 0.8) {
    return {
      label: "Dependente do rank",
      motive: `Diferença detectada, mas evidência ainda moderada P(D>Δr)=${(prob * 100).toFixed(1)}%. Exige confirmação temporal.${caveat}`,
      color: "text-amber-300 border-amber-400/30 bg-amber-400/10",
    };
  }

  const strongerRank = D > 0 ? a : b;
  const idxA = RANK_ORDER.indexOf(a);
  const idxB = RANK_ORDER.indexOf(b);
  const higherRank = idxA < idxB ? b : a;

  if (strongerRank === higherRank) {
    return {
      label: "Escala com o rank",
      motive: `Vantagem relativa superior no nível mais alto (${strongerRank.toUpperCase()}). Não implica que habilidade ou mecânica seja a causa.${caveat}`,
      color: "text-indigo-300 border-indigo-400/30 bg-indigo-400/10",
    };
  }

  return {
    label: "Mais forte em ranks inferiores",
    motive: `Vantagem relativa diminui nos elos mais altos (${strongerRank.toUpperCase()}). Não equivale a escolha fraca nos elos superiores.${caveat}`,
    color: "text-sky-300 border-sky-400/30 bg-sky-400/10",
  };
}
