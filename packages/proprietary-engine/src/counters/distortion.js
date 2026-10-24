// counters/distortion — resíduos de draft (corpo idêntico ao ex-engine,
// D-DIST-01..03). Pick/ban separados, nunca somados.
// Puro, sem I/O, zero dependências.
/** DRF: resíduos pick/ban separados, nunca somados (D-DIST-01..03). */
export function distortionResidual({ observed, expected, kind = "pick" } = {}) {
  if (![observed, expected].every(Number.isFinite)) {
    return { kind, observed: observed ?? null, expected: expected ?? null, residual: null, unit_status: "unvalidated", classification_status: "inconclusive", exposure_status: "unvalidated" };
  }
  return { kind, observed, expected, residual: +(observed - expected).toFixed(4), unit_status: "unvalidated", classification_status: "provisional", exposure_status: "unvalidated" };
}
