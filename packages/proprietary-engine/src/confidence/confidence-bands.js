// Faixas interpretativas da posterior (PRD Confidence §8) — FONTE ÚNICA.
// Unifica os DUPLICADOS `interpretProbBand` de
// app/web/src/pages/hero/sections/ConfiancaSection.tsx ({label,color}) e
// app/web/src/pages/panels/ConfiancaPanel.tsx ({label,color,desc}).
// Canônico = forma do painel (com `desc`); limiares e rótulos idênticos.
// Puro, sem I/O.

/** Faixas interpretativas oficiais PRD Confidence §8 (política de produto). */
export function interpretProbBand(p) {
  // V2 §8.3 (MEDIUM): 0,95/0,80 são pontos de partida, NÃO calibração — cada faixa
  // carrega `calibration_status` para a UI declarar o caráter model-based.
  const CAL = "uncalibrated_model_based";
  if (p == null || !Number.isFinite(p)) return { label: "Indisponível", color: "text-mist", desc: "Sem dados suficientes para calcular posterior.", calibration_status: CAL };
  if (p >= 0.95) return { label: "Evidência posterior forte a favor", color: "text-emerald-300", desc: "95% a 100% de probabilidade posterior condicional ao modelo.", calibration_status: CAL };
  if (p >= 0.8) return { label: "Sinal favorável, ainda incerto", color: "text-cyan-200", desc: "80% a 95% de probabilidade posterior condicional.", calibration_status: CAL };
  if (p > 0.2) return { label: "Inconclusivo para a decisão", color: "text-mist", desc: "20% a 80%: intervalo cruza o limiar de relevância prática (Δ=0.02).", calibration_status: CAL };
  if (p > 0.05) return { label: "Sinal contrário, ainda incerto", color: "text-amber-300", desc: "5% a 20%: probabilidade moderada de ficar abaixo da média.", calibration_status: CAL };
  return { label: "Evidência posterior forte contra", color: "text-rose-300", desc: "0% a 5%: evidência de desempenho abaixo da média.", calibration_status: CAL };
}
