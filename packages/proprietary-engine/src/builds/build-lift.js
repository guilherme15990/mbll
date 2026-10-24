// builds/build-lift — lift bruto de build Camada A (corpo idêntico ao ex-engine,
// PRD build §4, D-BLD-01..08). L(b,h,c)=WR(b,h,c)−WR_ref(h,c), 3 referências.
// Camada A (bruto) entregável; B ajustado e C causal = NULL sem dados por partida.
// Puro, sem I/O, zero dependências.
/** BDL: L(b,h,c)=WR(b,h,c)−WR_ref(h,c) (PRD build §4). 3 referências (mais usada, média do herói, comparável→mesma que mais usada sem covariável).
 * Camada A (bruto) entregável; B ajustado e C causal = NULL sem dados por partida (D-BLD-01..08). */
export function buildLift({ win, refWin, hasSupport = true, refKind = "mais-usada" } = {}) {
  if (!hasSupport || ![win, refWin].every(Number.isFinite)) {
    return { lift_raw: null, lift_adjusted: null, adjusted_association: null, causal_build_lift: null, reference_kind: refKind, uncertainty_method: null, causal_status: "nao-avaliado", exposure_status: "unvalidated", classification_status: "inconclusive" };
  }
  // V2 §5.2/EC-012: fora de [0,1] (ex: 53) = unidade inválida → null + inconclusive, nunca lift espúrio.
  if (win < 0 || win > 1 || refWin < 0 || refWin > 1) {
    return { lift_raw: null, lift_adjusted: null, adjusted_association: null, causal_build_lift: null, reference_kind: refKind, unit: "unknown", reference_semantics_validated: false, sample_size_available: false, uncertainty_method: null, causal_status: "nao-avaliado", exposure_status: "unvalidated", classification_status: "inconclusive" };
  }
  return { lift_raw: +(win - refWin).toFixed(4), lift_adjusted: null, adjusted_association: null, causal_build_lift: null, reference_kind: refKind, unit: "fraction_0_1", reference_semantics_validated: false, sample_size_available: false, uncertainty_method: null, causal_status: "nao-avaliado", exposure_status: "unvalidated", classification_status: "provisional" };
}
/** Referências de build: mais usada (max pick), média do herói, e rótulo de suporte. */
export function buildReferences(builds = []) {
  // HIGH EC-012 irmão: mesmo guard [0,1] do buildLift — 53 nunca vira referência.
  const rows = (builds ?? []).filter((b) => Number.isFinite(b?.win) && Number.isFinite(b?.pick) && b.win >= 0 && b.win <= 1 && b.pick >= 0 && b.pick <= 1);
  if (!rows.length) return { mostUsed: null, heroMean: null };
  const mostUsed = rows.reduce((a, b) => (b.pick > a.pick ? b : a), rows[0]);
  const heroMean = rows.reduce((s, b) => s + b.win, 0) / rows.length;
  return { mostUsed, heroMean: +heroMean.toFixed(4) };
}
