/**
 * Draft Management — meta da lane e candidatos dela (ADR-053 D5).
 *
 * "Mais forte do meta da lane" é um RANK, não uma probabilidade: o percentil
 * do θ̂ do herói entre os heróis daquela lane no recorte. Herói sem θ̂ ou sem
 * a lane fica de fora (null), nunca recebe percentil médio.
 */
import { finite } from "./common.ts";
import type { DraftLane } from "./common.ts";
import type { DraftHero, HeroPool } from "./pairs.ts";

export type LaneMeta = {
  lane: DraftLane;
  /** Heróis da lane com θ̂ no recorte. */
  n: number;
  /** θ̂ ordenados (para o percentil por faixa). */
  values: number[];
};

export function laneMetaStats(pool: HeroPool, lane: DraftLane): LaneMeta {
  const values = Object.values(pool)
    .filter((hero) => hero.lanes.includes(lane) && finite(hero.wrAdj))
    .map((hero) => hero.wrAdj as number)
    .sort((a, b) => a - b);
  return { lane, n: values.length, values };
}

/** Percentil do θ̂ do herói dentro da lane (0–1). null = fora da lane/sem θ̂. */
export function lanePercentile(hero: DraftHero | undefined, meta: LaneMeta): number | null {
  if (!hero || !finite(hero.wrAdj) || !meta.n) return null;
  if (!hero.lanes.includes(meta.lane)) return null;
  const atOrBelow = meta.values.filter((value) => value <= (hero.wrAdj as number)).length;
  return atOrBelow / meta.n;
}

/** Quantos heróis da lane ficaram acima dele (texto de apoio no card). */
export function laneAbove(hero: DraftHero | undefined, meta: LaneMeta): number | null {
  if (!hero || !finite(hero.wrAdj) || !meta.n || !hero.lanes.includes(meta.lane)) return null;
  return meta.values.filter((value) => value > (hero.wrAdj as number)).length;
}

/**
 * Candidatos da lane para o fan-out e para a lista: top θ̂ da lane entre os
 * heróis disponíveis. Nunca varre o pool inteiro (ADR-053 D8).
 */
export function laneCandidates(
  pool: HeroPool,
  lane: DraftLane,
  exclude: readonly number[],
  limit: number,
): DraftHero[] {
  const used = new Set(exclude);
  return Object.values(pool)
    .filter((hero) => !used.has(hero.id) && hero.lanes.includes(lane) && finite(hero.wrAdj))
    .sort((a, b) => (b.wrAdj as number) - (a.wrAdj as number) || (a.name ?? "").localeCompare(b.name ?? ""))
    .slice(0, Math.max(0, limit));
}
