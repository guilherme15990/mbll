// Tags de build (PRD Build §10, Camada A) — FONTE ÚNICA.
// Movido de apps/web/src/lib/buildLabel.ts (semântica idêntica).
// Regra de silêncio: lift inconclusivo (|lift| ≤ 0,02 sem frequência que o
// explique, ou sem suporte) NÃO gera tag. "popular" é fato de frequência
// (pick ≥ 5%), nunca identidade de "a mais usada". Puro, sem I/O.
// O mapa tom→classes CSS (BUILD_TAG_CLASS) é presentacional e fica na web.
// Cortes canônicos em ./thresholds.js (popular/raro/lift — mesmos das tags×quadrantes).

import {
  POPULAR_PICK_MIN,
  RARE_PICK_MAX,
  MIN_LIFT_SIGNAL,
  PRACTICAL_DELTA,
} from "../utils/thresholds.js";

/**
 * @param b {{ pick: number|null, lift_vs_most_used?: number|null }}
 * @returns {{ key: string, label: string, tone: string, title: string }[]}
 */
export function getBuildTags(b) {
  const l = b.lift_vs_most_used;
  const pick = (b && b.pick) ?? 0;
  const liftOk = l != null && Number.isFinite(l);
  const tags = [];
  if (pick >= POPULAR_PICK_MIN) {
    tags.push({
      key: "popular",
      label: "popular",
      tone: "popular",
      title: "Frequente no meta (pick ≥ 5%). Frequência não é vantagem — ver lift.",
    });
  }
  if (pick < RARE_PICK_MAX && liftOk && l > MIN_LIFT_SIGNAL) {
    tags.push({
      key: "emergente",
      label: "emergente",
      tone: "edge",
      title: "Pouco usada com sinal favorável. Acompanhar em snapshots seguintes, sem validar precocemente.",
    });
  } else if (liftOk && l > PRACTICAL_DELTA) {
    tags.push({
      key: "situacional",
      label: "situacional",
      tone: "situ",
      title: "Vantagem observada neste contexto de rota/rank. Não generalizar para qualquer partida.",
    });
  } else if (liftOk && l < -PRACTICAL_DELTA) {
    tags.push({
      key: "abaixo-da-ref",
      label: "abaixo da ref",
      tone: "down",
      title: "Desempenho abaixo da referência padrão; pode refletir uso defensivo em partidas desfavoráveis.",
    });
  }
  return tags;
}
