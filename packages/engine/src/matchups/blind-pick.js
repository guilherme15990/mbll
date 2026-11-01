// @radar/engine · matchups/blind-pick — segurança de first pick e blind pick.
// Consolidado (ADR-061): reúne counters/blind-proxy.js, counters/blind-safety.js, picks/pick-favorability.js.
// Barrel público: src/index.js (nenhum nome público muda).

import { MIN_SUPPORT_N, PRACTICAL_DELTA, SEVERE_COUNTER_DELTA } from "../core/thresholds.js";
import { quantile } from "../core/math.js";

// ── counters/blind-proxy.js ──
// counters/blind-proxy — proxy de blind pick (corpo idêntico ao ex-engine,
// D-BLND-01..06). Distribuição de δ + cauda adversa. Nunca probabilidade.
// Puro, sem I/O. Primitiva quantile via ../utils/math.js.


/** BPS: proxy de blind pick — distribuição de δ + cauda adversa (D-BLND-01..06). Nunca probabilidade. */
export function blindProxy(deltas = []) {
  const xs = (deltas ?? []).filter(Number.isFinite).sort((a, b) => a - b);
  // P0 EC-V2-02 fix: n<5 não sustenta p10/robusto — inconclusivo
  if (xs.length < 5) {
    return { safety_status: "inconclusive", robustness_status: "inconclusive", adverse_p10: null, worst_counter: null, worst_observed: xs.length ? +xs[0].toFixed(4) : null, n_pairs: xs.length, classification_status: "inconclusive", exposure_status: "unvalidated", note: "proxy — n<5, inconclusivo; não é probabilidade" };
  }
  const p10 = quantile(xs, 0.1);
  const worst = xs[0];
  const spread = xs[xs.length - 1] - xs[0];
  const robust = spread < 0.04 && p10 > -0.02;
  return {
    safety_status: "proxy", robustness_status: robust ? "robusto" : "sensivel-a-counter",
    adverse_p10: +p10.toFixed(4), worst_observed: +worst.toFixed(4), spread: +spread.toFixed(4),
    n_pairs: xs.length, classification_status: "provisional", exposure_status: "unvalidated",
    note: "proxy — não é probabilidade de vitória",
  };
}

// ── counters/blind-safety.js ──
// Classificação de segurança blind (PRD Blind §10) — FONTE ÚNICA.
// Unifica os DUPLICADOS `getSafetyClassification` de
// app/web/src/pages/hero/sections/BlindSection.tsx e
// app/web/src/pages/panels/BlindPanel.tsx (limiares, rótulos e cores idênticos;
// motivos canônicos = versão do painel global; ver relatório da migração).
// `safetyToGuide` (mapeamento fixo §1.3) vem junto. Puros, sem I/O.
// Piso n canônico em ./thresholds.js (MIN_SUPPORT_N — RF-BLND-06).



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

// ── picks/pick-favorability.js ──
// picks/pick-favorability — veredito de favorabilidade por tipo de pick.
// FONTE ÚNICA dos rótulos "Favorável / Situacional / Desfavorável / Sem dado"
// exibidos na ficha do herói. Puro, sem I/O.
//
// Dois conceitos SEPARADOS (nunca somados):
// - blind pick: lockar sem ver NENHUM inimigo (modo clássico) → mede cauda adversa.
// - first pick: travar primeiro no draft, inimigo vê e responde → mede força θ̂
//   + exposição ao counter replicado.
//
// Veredito é leitura de sinais, NUNCA probabilidade de vitória. O first pick não
// tem endpoint próprio: reutiliza o proxy blind (mesmos pares/δ) + θ̂ do herói.
// Limiares canônicos em ../utils/thresholds.js.



export const PICK_FAVORABILITY_VERSION = "pick-favorability-v1";

/** Baseline neutro de win rate quando a meta do lote não está disponível. */
export const PICK_BASELINE_WR = 0.5;

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const fmt = (v) => (finite(v) ? v.toFixed(4) : "—");

function evidenceOf(hero, blind) {
  return {
    strength: finite(hero?.wrAdj) ? hero.wrAdj : null,
    worstCounter: finite(blind?.worst_observed) ? blind.worst_observed : null,
    adverseP10: finite(blind?.adverse_p10) ? blind.adverse_p10 : null,
    nPairs: finite(blind?.n_pairs) ? blind.n_pairs : 0,
  };
}

function verdictOf(key, label, motive, tone, evidence) {
  return { key, label, motive, tone, evidence, formula: PICK_FAVORABILITY_VERSION };
}

function insufficient(evidence, detail) {
  return verdictOf("sem_dado", "Sem dado", `Sem base para decidir: ${detail}`, "slate", evidence);
}

/**
 * Blind pick: dá para escolher sem ver a composição inimiga?
 * Favorável = cauda resiliente (robusto, ou p10 > -2pp e pior δ > -3pp).
 * Desfavorável = pior δ ≤ -3pp replicado (n ≥ 10).
 * Situacional = o resto (defensável, mas sem resiliência de cauda).
 */
export function classifyBlindPick({ blind } = {}) {
  const ev = evidenceOf(null, blind);
  const n = ev.nPairs;
  if (!blind || blind.classification_status === "inconclusive" || n < MIN_SUPPORT_N) {
    return insufficient(ev, `pares elegíveis insuficientes (n=${n} < ${MIN_SUPPORT_N}) — matriz extremes-only não sustenta veredito.`);
  }
  const robust =
    blind.robustness_status === "robusto" ||
    (ev.adverseP10 != null && ev.adverseP10 > -PRACTICAL_DELTA && ev.worstCounter != null && ev.worstCounter > SEVERE_COUNTER_DELTA);
  if (robust) {
    return verdictOf(
      "favoravel",
      "Favorável",
      `Cauda adversa resiliente (p10 ${fmt(ev.adverseP10)}; pior δ ${fmt(ev.worstCounter)} em n=${n}) — dá para lockar cego. Proxy, não probabilidade.`,
      "emerald",
      ev,
    );
  }
  if (ev.worstCounter != null && ev.worstCounter <= SEVERE_COUNTER_DELTA && n >= 10) {
    return verdictOf(
      "desfavoravel",
      "Desfavorável",
      `Counter replicado (pior δ ${fmt(ev.worstCounter)} em n=${n}) — lockar cego entrega o pior par ao inimigo.`,
      "rose",
      ev,
    );
  }
  return verdictOf(
    "situacional",
    "Situacional",
    `Defensável no elo, mas a cauda não é resiliente (p10 ${fmt(ev.adverseP10)}; pior δ ${fmt(ev.worstCounter)}) — lockar cego pede plano B.`,
    "amber",
    ev,
  );
}

/**
 * First pick: vale travar primeiro sabendo que o inimigo responde?
 * Favorável = θ̂ ≥ referência e sem counter duro replicado, com cauda não frágil.
 * Desfavorável = counter duro replicado, ou θ̂ fraca + cauda frágil.
 * Situacional = força sem cauda limpa, ou cauda limpa sem vantagem de força.
 */
export function classifyFirstPick({ hero, blind, baseline } = {}) {
  const ev = evidenceOf(hero, blind);
  const n = ev.nPairs;
  if (!blind || blind.classification_status === "inconclusive" || n < MIN_SUPPORT_N) {
    return insufficient(ev, `matriz de counters insuficiente (n=${n} < ${MIN_SUPPORT_N}).`);
  }
  if (ev.strength == null) {
    return insufficient(ev, "força θ̂ do herói indisponível neste recorte.");
  }
  const ref = finite(baseline) && baseline > 0.2 && baseline < 0.8 ? baseline : PICK_BASELINE_WR;
  const strong = ev.strength >= ref;
  const hardCountered = ev.worstCounter != null && ev.worstCounter <= SEVERE_COUNTER_DELTA && n >= 10;
  const fragileTail = ev.adverseP10 != null && ev.adverseP10 <= -PRACTICAL_DELTA;

  if (hardCountered) {
    return verdictOf(
      "desfavoravel",
      "Desfavorável",
      `First pick exposto: pior counter ${fmt(ev.worstCounter)} replicado em n=${n} — o inimigo responde depois de ver o lock.`,
      "rose",
      ev,
    );
  }
  if (strong && !fragileTail) {
    return verdictOf(
      "favoravel",
      "Favorável",
      `Força θ̂ ${fmt(ev.strength)} ≥ referência ${fmt(ref)} e sem counter duro replicado — bom primeiro lock. Proxy, não probabilidade.`,
      "emerald",
      ev,
    );
  }
  if (!strong && fragileTail) {
    return verdictOf(
      "desfavoravel",
      "Desfavorável",
      `Força θ̂ ${fmt(ev.strength)} abaixo da referência ${fmt(ref)} e cauda frágil (p10 ${fmt(ev.adverseP10)}) — revelar primeiro sem vantagem.`,
      "rose",
      ev,
    );
  }
  return verdictOf(
    "situacional",
    "Situacional",
    strong
      ? `Força θ̂ ${fmt(ev.strength)} sustenta o lock, mas a cauda pede cuidado (p10 ${fmt(ev.adverseP10)}).`
      : `Sem vantagem de força (θ̂ ${fmt(ev.strength)} vs ${fmt(ref)}), mas sem counter duro replicado — first pick neutro.`,
    "amber",
    ev,
  );
}
