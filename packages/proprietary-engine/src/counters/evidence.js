// counters/evidence — qualidade da evidência M6 (corpo idêntico ao ex-engine,
// D-MTCH-06). Descritiva, sem IC de pseudo-contagem.
// Puro, sem I/O, zero dependências.
/** M6: qualidade da evidência descritiva (sem IC de pseudo-contagem, D-MTCH-06). */
export function evidenceQuality({ coverage = "unknown", stable = null, hetero = null } = {}) {
  const reasons = [];
  if (coverage !== "full") reasons.push("coverage:" + coverage);
  if (stable === false) reasons.push("unstable-temporal");
  if (hetero === true) reasons.push("rank-heterogeneous");
  if (!reasons.length) reasons.push("consistent");
  // LOW (V2 §1/§8.2): valor era "robusto" — colidia com o selo de confiança.
  // Qualidade descritiva de pares passa a "consistente"; reasons preservados.
  let quality = "limitado";
  if (coverage === "full" && stable === true && hetero === false) quality = "consistente";
  else if (coverage === "extremes" || stable === false) quality = "limitado";
  else quality = "dependente-de-contexto";
  return { quality, reasons, exposure_status: "unvalidated", interval_status: "indisponivel", uncertainty_method: null, causal_status: "nao-avaliado" };
}
