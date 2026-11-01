// @radar/engine · core/states — structs dos estados transversais (FONTE ÚNICA dos nomes).
//
// Objetos congelados com os nomes canônicos dos estados possíveis das variáveis.
// Motivo: os mesmos literais ("provisional", "unvalidated", "nao-avaliado",
// "inconclusive", cobertura de amostra) apareciam espalhados por vários módulos;
// aqui cada estado tem UM nome. Puro, sem I/O, zero dependências.

/** Estado de classificação de uma associação/observação. */
export const ClassificationStatus = Object.freeze({
  PROVISIONAL: "provisional",
  INCONCLUSIVE: "inconclusive",
  CLASSIFIED: "classified",
  PROVISIONAL_MODEL_BASED: "provisional_model_based",
});

/** Estado de exposição (pick = slot_share; ainda não validado). */
export const ExposureStatus = Object.freeze({
  UNVALIDATED: "unvalidated",
  OBSERVED: "observed",
  VALIDATED: "validated",
});

/** Unidade de exposição (nunca contagem). */
export const ExposureUnit = Object.freeze({
  SLOT_SHARE: "slot_share",
});

/** Estado da unidade de uma métrica (declarado, nunca adivinhado). */
export const UnitStatus = Object.freeze({
  UNVALIDATED: "unvalidated",
});

/** Estado causal — nunca afirmado sem dados por partida. */
export const CausalStatus = Object.freeze({
  NAO_AVALIADO: "nao-avaliado",
});

/** Cobertura da amostra de um par/observação. */
export const Coverage = Object.freeze({
  EXTREMES: "extremes",
  FULL: "full",
  UNKNOWN: "unknown",
});

/** Estado de evidência de um sinal derivado. */
export const EvidenceStatus = Object.freeze({
  PROVISIONAL: "provisional",
  INCONCLUSIVE: "inconclusive",
  SEM_DADO: "sem-dado",
  UNKNOWN: "unknown",
});

/** Estado da incerteza do estimador. */
export const UncertaintyStatus = Object.freeze({
  PROVISIONAL: "provisional",
  UNAVAILABLE: "unavailable",
  INSUFFICIENT_EXPOSURE: "insufficient_exposure",
});

/** Estado genérico de dado (disponível vs ausente). */
export const DataStatus = Object.freeze({
  OK: "ok",
  INSUFFICIENT_EXPOSURE: "insufficient_exposure",
});

/** Estado de inferência — candidatos experimentais até validar o nulo (P1). */
export const InferenceStatus = Object.freeze({
  EXPERIMENTAL_CANDIDATES_ONLY: "experimental_candidates_only",
});

/** Estado do q-valor BH — experimental até validar o nulo (P1). */
export const QStatus = Object.freeze({
  EXPERIMENTAL_UNVALIDATED_NULL: "experimental_unvalidated_null",
});

/** Estado de calibração do modelo (nunca "calibrado" sem validação). */
export const CalibrationStatus = Object.freeze({
  UNCALIBRATED_MODEL_BASED: "uncalibrated_model_based",
});

/** Estado de uma diferença/delta medida (fração ou pp). */
export const DeltaStatus = Object.freeze({
  INSUFFICIENT: "insufficient",
  NO_PRACTICAL_DIFFERENCE: "no_practical_difference",
  POSITIVE: "positive",
  NEGATIVE: "negative",
});
