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

import { MIN_SUPPORT_N, PRACTICAL_DELTA, SEVERE_COUNTER_DELTA } from "../utils/thresholds.js";

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
