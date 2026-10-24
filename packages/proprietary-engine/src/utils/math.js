// utils/math — dono único de mean/medianNull/median/mad/quantile.
// Puro, sem I/O.
export function median(xs) {
  const a = [...xs].filter(Number.isFinite).sort((p, q) => p - q);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export function mad(xs, med = median(xs)) {
  return median(xs.map((x) => Math.abs(x - med)));
}

export function quantile(sortedAsc, q) {
  if (!sortedAsc.length) return 0;
  const a = [...sortedAsc].sort((p, z) => p - z);
  const pos = (a.length - 1) * Math.min(1, Math.max(0, q));
  const base = Math.floor(pos);
  const rest = pos - base;
  return a[base] + (a[base + 1] !== undefined ? rest * (a[base + 1] - a[base]) : 0);
}

/** Média de finitos; null sem dado (nunca 0 inventado — difere de median, que retorna 0). */
export function mean(xs) {
  const f = (xs ?? []).filter(Number.isFinite);
  if (!f.length) return null;
  return f.reduce((a, b) => a + b, 0) / f.length;
}

/** Mediana de finitos; null sem dado (par de `mean`; difere de median, que retorna 0). */
export function medianNull(xs) {
  const f = (xs ?? []).filter(Number.isFinite).sort((a, b) => a - b);
  if (!f.length) return null;
  const m = Math.floor(f.length / 2);
  return f.length % 2 ? f[m] : (f[m - 1] + f[m]) / 2;
}
