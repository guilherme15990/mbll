// utils/statistics — dono único das primitivas estatísticas genéricas.
// Puro, sem I/O.
import { C_REFERENCE } from "./config.js";

// Posto percentílico empírico de v dentro de xs (M3). 0..1
export function percentileRank(v, xs) {
  const a = xs.filter(Number.isFinite);
  if (!a.length) return 0.5;
  const le = a.filter((x) => x <= v).length;
  return le / a.length;
}

// BH-FDR sobre p-valores -> q-valores (M2). Retorna array alinhado à entrada.
export function benjaminiHochberg(pvals) {
  const m = pvals.length;
  const order = pvals.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const q = new Array(m);
  let prev = 1;
  for (let k = m; k >= 1; k--) {
    const { p, i } = order[k - 1];
    prev = Math.min(prev, (p * m) / k);
    q[i] = Math.min(1, prev);
  }
  return q;
}

// p bicaudal aproximado a partir de z robusto (normal). Evita dependência.
export function pFromZ(z) {
  const t = Math.abs(z);
  // erf approx (Abramowitz-Stegun 7.1.26)
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, pp = 0.3275911;
  const x = t / Math.SQRT2;
  const tt = 1 / (1 + pp * x);
  const poly = ((((a5 * tt + a4) * tt + a3) * tt + a2) * tt + a1) * tt;
  const erf = 1 - poly * Math.exp(-x * x);
  const phi = 0.5 * (1 + erf);
  return Math.min(1, 2 * (1 - phi));
}

/** Logit com clip (evita ±Inf em 0/1); inversa invLogit. PRD shrinkage §3.2: escala logit por princípio. */
export function logit(p, eps = 1e-6) {
  const c = Math.min(1 - eps, Math.max(eps, p));
  return Math.log(c / (1 - c));
}
export function invLogit(z) {
  return 1 / (1 + Math.exp(-z));
}
/**
 * M1 fiel (spec §16 + PRD shrinkage §3.1/§3.3): efeitos aleatórios por elo.
 * yᵢ|θᵢ ~ N(θᵢ, sᵢ²), sᵢ² = μ(1−μ)/(c·pickᵢ) · θᵢ ~ N(μ, τ²)
 * Posterior: Vᵢ=(1/sᵢ²+1/τ²)⁻¹, mᵢ=Vᵢ(yᵢ/sᵢ²+μ/τ²) · Bᵢ=τ²/(τ²+sᵢ²) (shrinkage, peso do dado)
 * μ̂=mediana (robusta, ≈0.499 empírico), τ̂=1.4826·MAD (robusto, ≈0.031 empírico).
 * d=(mᵢ−μ)/τ (tamanho de efeito), z=(mᵢ−μ)/√Vᵢ (teste M1), p bicaudal, q BH (M2).
 */
export function ebShrink(y, s2, mu, tau2) {
  if (![y, s2, mu, tau2].every(Number.isFinite) || s2 === Infinity) return { m: mu, V: tau2, B: 0, se: Math.sqrt(tau2) };
  if (!(s2 > 0) || !(tau2 > 0)) return { m: mu, V: tau2, B: 0, se: Math.sqrt(Math.max(tau2, 1e-12)) };
  const V = 1 / (1 / s2 + 1 / tau2);
  const m = V * (y / s2 + mu / tau2);
  const B = tau2 / (tau2 + s2);
  return { m, V, B, se: Math.sqrt(V) };
}
export function obsVariance(mu, pick, c = C_REFERENCE) {
  if (![mu, pick, c].every(Number.isFinite) || pick <= 0 || c <= 0) return Infinity;
  return (mu * (1 - mu)) / (c * pick);
}
