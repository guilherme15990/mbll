// governance/exposure — envelope de exposição + validação do denominador
// (corpo idêntico ao ex-engine, EXP INV-101/D-EXP-01..03, RF-EXP-04).
// Puro, sem I/O, zero dependências.
/** EXP: envelope de exposição — pick é slot_share, nunca contagem (INV-101/D-EXP-01..03). */
export function makeExposure(pick) {
  void pick;
  return { unit: "slot_share", status: "unvalidated" };
}
/** EXP: soma pick_rate por snapshot deve ≈1 (±0.005, RF-EXP-04). Retorna {sum, ok}. */
export function checkPickSum(picks) {
  const sum = (picks ?? []).filter(Number.isFinite).reduce((a, b) => a + b, 0);
  return { sum: +sum.toFixed(4), ok: Math.abs(sum - 1) <= 0.005, expectedApprox: 1 };
}
