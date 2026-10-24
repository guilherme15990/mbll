// Classificação de segurança blind (PRD Blind §10) — FONTE ÚNICA.
// Unifica os DUPLICADOS `getSafetyClassification` de
// app/web/src/pages/hero/sections/BlindSection.tsx e
// app/web/src/pages/panels/BlindPanel.tsx (limiares, rótulos e cores idênticos;
// motivos canônicos = versão do painel global; ver relatório da migração).
// `safetyToGuide` (mapeamento fixo §1.3) vem junto. Puros, sem I/O.
// Piso n canônico em ./thresholds.js (MIN_SUPPORT_N — RF-BLND-06).

import { MIN_SUPPORT_N, SEVERE_COUNTER_DELTA } from "../utils/thresholds.js";

/** Rótulos oficiais PRD Blind §10. */
export function getSafetyClassification(b) {
  if (!b || b.classification_status === "inconclusive" || (b.n_pairs ?? 0) < MIN_SUPPORT_N) {
    return {
      label: "Segurança Inconclusiva",
      motive: "Matriz incompleta na fonte (extremes-only) ou pares elegíveis insuficientes (n < 5) — RF-BLND-06.",
      color: "text-mist border-line bg-abyss",
    };
  }

  if (b.robustness_status === "robusto") {
    // V2 §8.2 + §12 (HIGH): distribuição resiliente sem denominador validado tem
    // teto Situacional — nunca "Seguro"/SIM público. Compat: só capa quando a
    // exposição vem declarada (blindProxy sempre declara "unvalidated").
    const exposed = b.exposure_status ?? b.exposureStatus;
    if (exposed != null && exposed !== "observed" && exposed !== "validated") {
      return {
        label: "Seguro, mas Situacional",
        motive: "Distribuição resiliente entre pares, mas sem contagens validadas — teto situacional (proxy, não probabilidade).",
        color: "text-amber-300 border-amber-400/30 bg-amber-400/10",
      };
    }
    return {
      label: "Blind Pick Seguro",
      motive: "Força defensável + cauda adversa resiliente sob a distribuição de adversários deste elo.",
      color: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
    };
  }

  if ((b.worst_observed ?? 0) <= SEVERE_COUNTER_DELTA && (b.n_pairs ?? 0) >= 10) {
    return {
      label: "Counterável",
      motive: "Counters desfavoráveis replicados na matriz de pares; vulnerabilidade tática identificada.",
      color: "text-rose-300 border-rose-400/30 bg-rose-400/10",
    };
  }

  return {
    label: "Seguro, mas Situacional",
    motive: "Defensável no elo, mas com vulnerabilidades específicas que recomendam aguardar informação do draft.",
    color: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  };
}

/** Mapeamento fixo §1.3 (sem sinônimo inventado). */
export function safetyToGuide(label) {
  if (label === "Blind Pick Seguro") return "SIM";
  if (label === "Seguro, mas Situacional") return "CUIDADO";
  if (label === "Counterável") return "NÃO";
  return "SEM DADO";
}
