/**
 * Draft Management — leitura dos fatores do recomendador (ADR-057).
 *
 * Aritmética pura dos cinco fatores usados por `pickSuggestions`, separada da
 * montagem da lista (`suggestions.ts`) para manter cada arquivo abaixo do teto
 * de linhas da ADR-041. Puro por construção: sem React, sem rede; importa só
 * irmãos.
 *
 * Honestidade (INV-DMP-002..005): direção do par vem da LISTA
 * (`countersUp`/`countersDown`, `synergiesUp`/`synergiesDown`), não do sinal do
 * δ; counter é média por par, nunca soma entre os cinco inimigos. Ausência de
 * par é ausência (`null`), nunca 0 — o fator sai do denominador.
 */
import { clamp, finite, mean } from "./common.ts";
import { deltaOf, type HeroPool, type MatchupBooks, type PairObs } from "./pairs.ts";
import type { Archetype, ArchetypeRead } from "./archetype.ts";

/** Peso do balanceamento de arquétipo: 1 degrau ≈ 25 pontos de bondade. */
export const BALANCE_WEIGHT = 0.25;
/** Pesos declarados dos quatro fatores de sinal, na mesma escala. */
export const META_WEIGHT = 1;
export const COUNTER_WEIGHT = 1;
export const ANTISYNERGY_WEIGHT = 1;
export const EXPOSURE_WEIGHT = 1;
/** Escala de exibição do par (|δ| → bondade). NÃO é calibração de win rate. */
export const PAIR_SCALE = 0.05;

export type BalanceFit = -1 | 0 | 1;

/** Leitura de um fator de par: valor líquido assinado + suporte observado. */
export type PairRead = {
  /** Média por par dos pares observados (|δ| com o sinal da direção). null = sem par. */
  value: number | null;
  /** Pares observados que sustentam o fator. */
  ids: number[];
  /** Pares possíveis no lado oposto — denominador do suporte. */
  total: number;
};

/** |δ| cru dos dois sentidos do par; o primeiro observado vale (é o mesmo par). */
function pairDelta(
  first: readonly PairObs[] | undefined,
  firstId: number,
  second: readonly PairObs[] | undefined,
  secondId: number,
): number | null {
  return deltaOf(first, firstId) ?? deltaOf(second, secondId);
}

/** Fator 1: o herói countera os inimigos (direção vem de `countersUp`/`countersDown`). */
export function counterRead(heroId: number, enemyIds: readonly number[], books: MatchupBooks): PairRead {
  const observations: number[] = [];
  const ids: number[] = [];
  for (const enemy of enemyIds) {
    const value = pairDelta(books[heroId]?.countersUp, enemy, books[enemy]?.countersDown, heroId);
    if (value != null) {
      observations.push(value);
      ids.push(enemy);
    }
  }
  return { value: mean(observations), ids, total: enemyIds.length };
}

/** Fator 2: antisinergia com o nosso time (`synergiesDown`; positivo ajuda, então negamos). */
export function antisynergyRead(heroId: number, allyIds: readonly number[], books: MatchupBooks): PairRead {
  const observations: number[] = [];
  const ids: number[] = [];
  const allies = allyIds.filter((id) => id !== heroId);
  for (const ally of allies) {
    const value = pairDelta(books[heroId]?.synergiesDown, ally, books[ally]?.synergiesDown, heroId);
    if (value != null) {
      observations.push(-value);
      ids.push(ally);
    }
  }
  return { value: mean(observations), ids, total: allies.length };
}

/** Fator 3: exposição aos inimigos (o inimigo countera o herói; negativo para nós). */
export function exposureRead(heroId: number, enemyIds: readonly number[], books: MatchupBooks): PairRead {
  const observations: number[] = [];
  const ids: number[] = [];
  for (const enemy of enemyIds) {
    const value = pairDelta(books[heroId]?.countersDown, enemy, books[enemy]?.countersUp, heroId);
    if (value != null) {
      observations.push(-value);
      ids.push(enemy);
    }
  }
  return { value: mean(observations), ids, total: enemyIds.length };
}

/** Ajuste de tipo: contrabalança o dominante inimigo, repete ou fica neutro. */
export function balanceOf(
  archetype: ArchetypeRead | null,
  target: Archetype | null,
): BalanceFit | null {
  if (target == null || archetype == null) return null;
  if (archetype.top === target) return 1;
  if (archetype.top === "uniforme") return 0;
  return -1;
}

/** |δ| líquido → bondade 0–1 (0,5 = neutro). Positivo ajuda, negativo atrapalha. */
export function goodnessOf(value: number | null): number | null {
  return value == null ? null : clamp(0.5 + 0.5 * Math.tanh(value / PAIR_SCALE), 0, 1);
}

/** Média ponderada só dos fatores presentes; sem nenhum, null. */
export function combinedScore(parts: readonly { value: number | null; weight: number }[]): number | null {
  const present = parts.filter((part): part is { value: number; weight: number } => part.value != null);
  const weightSum = present.reduce((sum, part) => sum + part.weight, 0);
  if (!weightSum) return null;
  return present.reduce((sum, part) => sum + part.value * part.weight, 0) / weightSum;
}

/** Encaixe na lane domina a ordem: herói da lane sempre acima do sem dado. */
export function laneFitRank(value: boolean | null): number {
  return value === true ? 0 : 1;
}

/** Sementes da lista: livros já carregados, pares vizinhos e top θ̂ do pool. */
export function seedIds(
  pool: HeroPool,
  books: MatchupBooks,
  ourIds: readonly number[],
  enemyIds: readonly number[],
): Set<number> {
  const seeds = new Set<number>(Object.keys(books).map(Number));
  for (const id of ourIds) {
    for (const pair of books[id]?.synergiesUp ?? []) seeds.add(pair.id);
    for (const pair of books[id]?.synergiesDown ?? []) seeds.add(pair.id);
  }
  for (const id of enemyIds) {
    for (const pair of books[id]?.countersDown ?? []) seeds.add(pair.id);
    for (const pair of books[id]?.countersUp ?? []) seeds.add(pair.id);
  }
  Object.values(pool)
    .filter((hero) => finite(hero.wrAdj))
    .sort((a, b) => (b.wrAdj as number) - (a.wrAdj as number))
    .slice(0, 18)
    .forEach((hero) => seeds.add(hero.id));
  return seeds;
}
