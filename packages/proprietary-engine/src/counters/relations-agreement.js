// Acordo declaração×observado por par — modelo (a) estendido ao `relations`.
// Mapeia `relations.{weak,strong}.target_hero_id` → `expected` (-1|+1|null) e
// alimenta `compareCounterRelation` (dono do veredito; nada duplicado aqui).
// `relations.assist` NUNCA entra: sinergia é categoria errada p/ counter — a
// exclusão é auditável em reasons[] (`assist-ignorado(n=…)`).
// Pura, sem I/O, zero dependências além de ./counter.js e ./thresholds.js.

import {
  COUNTER_MIN_ABS_DELTA,
  COUNTER_MIN_PAIRS,
  compareCounterRelation,
} from "./counter.js";

export const RELATIONS_AGREEMENT_VERSION = "relations-agreement-v1";

function idsOf(bucket) {
  const v = bucket?.target_hero_id;
  if (!Array.isArray(v)) return [];
  return v.map((x) => Number(x)).filter((x) => Number.isFinite(x));
}

/**
 * @param relations {weak?: {target_hero_id?: number[]}, strong?: {...}, assist?: {...}}
 * @param targetId id do herói-alvo avaliado
 * @returns { expected: -1|+1|null, reasons: string[] }
 *   weak contém o alvo → -1 (declarado counter do herói);
 *   strong contém o alvo → +1 (declarado favorável);
 *   ambos → null (declaração conflitante, nunca chute);
 *   nenhum → null (não declarado).
 */
export function expectedForTarget(relations, targetId) {
  const t = Number(targetId);
  const reasons = [];
  const assist = idsOf(relations?.assist);
  if (assist.length) reasons.push(`assist-ignorado(n=${assist.length})`);
  if (!Number.isFinite(t)) return { expected: null, reasons: [...reasons, "alvo-invalido"] };
  const inWeak = idsOf(relations?.weak).includes(t);
  const inStrong = idsOf(relations?.strong).includes(t);
  if (inWeak && inStrong) return { expected: null, reasons: [...reasons, "declaracao-conflitante"] };
  if (inWeak) return { expected: -1, reasons: [...reasons, "declarado-weak"] };
  if (inStrong) return { expected: 1, reasons: [...reasons, "declarado-strong"] };
  return { expected: null, reasons: [...reasons, "sem-declaracao"] };
}

/**
 * @param relations objeto `relations` do herói (weak/strong/assist)
 * @param opts {targetId, delta: δ observado orientado p/ o par | null,
 *   nPairs: nº de pares elegíveis, coverage: "extremes"|"full"|"unknown"}
 * @returns { expected, verdict: gramática de compareCounterRelation,
 *   reasons: mapeamento + veredito, version }
 */
export function agreementForPair(
  relations,
  { targetId, delta = null, nPairs = 0, coverage = "unknown" } = {},
) {
  const { expected, reasons: mapReasons } = expectedForTarget(relations, targetId);
  const r = compareCounterRelation({ expected, delta, nPairs, coverage });
  return {
    expected,
    verdict: r.verdict,
    reasons: [...mapReasons, ...r.reasons],
    minAbs: COUNTER_MIN_ABS_DELTA,
    minPairs: COUNTER_MIN_PAIRS,
    version: RELATIONS_AGREEMENT_VERSION,
  };
}
