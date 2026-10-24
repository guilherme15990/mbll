// Quadrantes popularidade × desempenho — nomes fixos do autor, sem ML.
// Eixos: popular = pick ≥ 0.05 (mesmo corte das tags); alta = lift_vs_most_used
// > 0.02 (mesmo corte). Lift nulo = sem leitura (silêncio, como nas tags).
// Pura, sem I/O, zero dependências.

import { POPULAR_PICK_MIN, PRACTICAL_DELTA } from "../utils/thresholds.js";

export const BUILD_QUADRANT_VERSION = "build-quadrant-v1";
export const BUILD_QUADRANT_POPULAR_PICK = POPULAR_PICK_MIN;
export const BUILD_QUADRANT_HIGH_LIFT = PRACTICAL_DELTA;

/**
 * @param b {pick, lift_vs_most_used}
 * @returns { key, label, leitura } | null (null = sem leitura)
 *   "popular-alta"        → "popular + alta"      (candidata principal, se atual+comparável)
 *   "impopular-alta"      → "pouco popular + alta" (descoberta; exige amostra)
 *   "popular-baixa"       → "popular + baixa"      (investigar contexto de uso)
 *   "impopular-baixa"     → "pouco popular + baixa" (prioridade menor, sem concluir que é ruim)
 */
export function buildQuadrant(b) {
  const pick = b?.pick;
  const lift = b?.lift_vs_most_used;
  if (!Number.isFinite(pick) || !Number.isFinite(lift)) return null;
  const popular = pick >= BUILD_QUADRANT_POPULAR_PICK;
  const alta = lift > BUILD_QUADRANT_HIGH_LIFT;
  if (popular && alta) {
    return { key: "popular-alta", label: "popular + alta", leitura: "Candidata a recomendação principal, se os dados forem atuais e comparáveis." };
  }
  if (!popular && alta) {
    return { key: "impopular-alta", label: "pouco popular + alta", leitura: "Candidata a descoberta promissora; precisa de validação de amostra." };
  }
  if (popular && !alta) {
    return { key: "popular-baixa", label: "popular + baixa", leitura: "Vale investigar se está sendo usada fora do contexto adequado." };
  }
  return { key: "impopular-baixa", label: "pouco popular + baixa", leitura: "Prioridade menor, sem concluir que seja uma configuração ruim." };
}
