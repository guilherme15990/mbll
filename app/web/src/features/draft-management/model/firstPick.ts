/**
 * Draft Management — leitura de primeiro pick (ADR-052 D6).
 *
 * Responde só o que os dados sustentam: quantos counters o 1º lock ainda
 * entrega ao outro lado e quantas respostas o lado do último pick tem no pool.
 * São opções disponíveis, NÃO chance de o oponente escolher.
 */
import { finite, other } from "./common.ts";
import type { DraftSide } from "./common.ts";
import { draftSequence, usedIds, type DraftState } from "./state.ts";
import type { HeroPool, MatchupBooks } from "./pairs.ts";

export type ExposureRead = {
  heroId: number;
  heroName: string | null;
  available: number;
  worst: number | null;
  worstName: string | null;
};

export type CounterOptions = { available: number; worst: number | null; worstName: string | null };

function counterOptions(
  heroIds: readonly number[],
  books: MatchupBooks,
  pool: HeroPool,
  used: readonly number[],
): CounterOptions {
  const usedSet = new Set(used);
  const seen = new Map<number, number>();
  for (const id of heroIds) {
    for (const pair of books[id]?.countersDown ?? []) {
      if (usedSet.has(pair.id) || !finite(pair.delta)) continue;
      const severity = Math.abs(pair.delta);
      const previous = seen.get(pair.id) ?? 0;
      if (severity > previous) seen.set(pair.id, severity);
    }
  }
  let worst: number | null = null;
  let worstId: number | null = null;
  for (const [id, severity] of seen) {
    if (worst == null || severity > worst) {
      worst = severity;
      worstId = id;
    }
  }
  return {
    available: seen.size,
    worst,
    worstName: worstId != null ? (pool[worstId]?.name ?? `Herói #${worstId}`) : null,
  };
}

export type FirstPickRead = {
  side: DraftSide;
  firstTurns: number[];
  secondTurns: number[];
  firstLast: number | null;
  secondLast: number | null;
  exposure: ExposureRead | null;
  leverage: CounterOptions | null;
};

export function readFirstPick(state: DraftState, pool: HeroPool, books: MatchupBooks): FirstPickRead {
  const seq = draftSequence(state.first);
  const firstTurns = seq.filter((step) => step.kind === "pick" && step.side === state.first).map((step) => step.step);
  const secondSide = other(state.first);
  const secondTurns = seq.filter((step) => step.kind === "pick" && step.side === secondSide).map((step) => step.step);
  const used = usedIds(state);

  const firstHeroId = state[state.first][0]?.heroId ?? null;
  const exposure: ExposureRead | null =
    firstHeroId != null
      ? {
          heroId: firstHeroId,
          heroName: pool[firstHeroId]?.name ?? `Herói #${firstHeroId}`,
          ...counterOptions([firstHeroId], books, pool, used),
        }
      : null;

  const firstSideIds = state[state.first].map((slot) => slot.heroId).filter((id): id is number => id != null);
  const leverage = firstSideIds.length ? counterOptions(firstSideIds, books, pool, used) : null;

  return {
    side: state.first,
    firstTurns,
    secondTurns,
    firstLast: firstTurns.length ? firstTurns[firstTurns.length - 1] : null,
    secondLast: secondTurns.length ? secondTurns[secondTurns.length - 1] : null,
    exposure,
    leverage,
  };
}
