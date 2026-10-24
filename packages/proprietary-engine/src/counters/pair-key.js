// counters/pair-key — chave canônica do par M6 (corpo idêntico ao ex-engine,
// D-MTCH-01). Counter direcional, teammate ordenado.
// Puro, sem I/O, zero dependências.
/** Chave canônica do par M6 (D-MTCH-01): counter direcional, teammate ordenado. */
export function makePairKey(a, b, type) {
  const x = Number(a), y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (type === "teammate") {
    const [lo, hi] = x <= y ? [x, y] : [y, x];
    return `${lo}-${hi}:teammate`;
  }
  return `${x}-${y}:counter`;
}
