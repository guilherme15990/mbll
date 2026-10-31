/**
 * Draft Management — candidatos ao próximo pick e alvos de ban (ADR-053 D5/D6).
 *
 * Recomendador de DOIS fatores, na rota do slot:
 *   1. meta da lane  → percentil do θ̂ entre os heróis daquela lane (peso 1);
 *   2. tipo adequado → contrabalança o arquétipo dominante inimigo (peso 0,25).
 *
 * `score = Σ w·v / Σ w` só com os fatores DISPONÍVEIS (fator sem dado sai do
 * denominador, como no índice). O score é um rank 0–1, nunca probabilidade, e
 * a UI mostra os dois fatores por extenso em vez do número.
 *
 * Leitura ordenada, nunca recomendação. Sobrevivência é hazard proxy.
 */
import { DRAFT_LANES, clamp, finite, mean } from "./common.ts";
import type { DraftLane } from "./common.ts";
import { actionsUntilNextPick, nextPickStep, usedIds, type DraftState } from "./state.ts";
import { availabilityProxy, deltaOf, type DraftHero, type HeroPool, type MatchupBooks } from "./pairs.ts";
import { laneFitOf } from "./power.ts";
import { laneMetaStats, lanePercentile, laneAbove, type LaneMeta } from "./laneMeta.ts";
import { heroArchetype, type Archetype, type ArchetypeRead } from "./archetype.ts";

/** Peso declarado do ajuste de tipo: 1 degrau ≈ 25 pontos de percentil. */
export const BALANCE_WEIGHT = 0.25;

export type BalanceFit = -1 | 0 | 1;

export type Candidate = {
  heroId: number;
  name: string | null;
  head: string | null;
  lane: DraftLane;
  laneFit: boolean | null;
  percentile: number | null;
  above: number | null;
  archetype: ArchetypeRead | null;
  balance: BalanceFit | null;
  target: Archetype | null;
  /** Rank 0–1 dos fatores disponíveis. Nunca exibido como probabilidade. */
  score: number | null;
  strength: number | null;
  synergy: number | null;
  matchup: number | null;
  observed: number;
  availability: number | null;
  k: number;
  reasons: string[];
};

export type BanTarget = {
  heroId: number;
  name: string | null;
  head: string | null;
  counters: number;
  worst: number | null;
  contested: number | null;
  pressure: number;
};

function candidateStrength(hero: DraftHero, baseline: number | null): number | null {
  if (!finite(hero.wrAdj)) return null;
  const mu = finite(baseline) && baseline > 0.2 && baseline < 0.8 ? baseline : 0.5;
  const weight = hero.smallSample ? 0.25 : clamp(finite(hero.B) ? hero.B : 0.5, 0.05, 1);
  return (hero.wrAdj - mu) * weight;
}

function candidateSynergy(heroId: number, ourIds: readonly number[], books: MatchupBooks): number | null {
  const observations: number[] = [];
  for (const ally of ourIds) {
    if (ally === heroId) continue;
    const up = deltaOf(books[ally]?.synergiesUp, heroId);
    const down = deltaOf(books[ally]?.synergiesDown, heroId);
    if (up != null) observations.push(up);
    if (down != null) observations.push(-down);
  }
  return mean(observations);
}

function candidateMatchup(heroId: number, enemyIds: readonly number[], books: MatchupBooks): number | null {
  const observations: number[] = [];
  for (const enemy of enemyIds) {
    const countersEnemy = deltaOf(books[enemy]?.countersDown, heroId);
    const enemyCounters = deltaOf(books[enemy]?.countersUp, heroId);
    if (countersEnemy != null) observations.push(countersEnemy);
    if (enemyCounters != null) observations.push(-enemyCounters);
  }
  return mean(observations);
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

function combinedScore(percentile: number | null, balance: BalanceFit | null): number | null {
  const parts: { value: number; weight: number }[] = [];
  if (percentile != null) parts.push({ value: percentile, weight: 1 });
  if (balance != null) parts.push({ value: (balance + 1) / 2, weight: BALANCE_WEIGHT });
  const weightSum = parts.reduce((sum, part) => sum + part.weight, 0);
  if (!weightSum) return null;
  return parts.reduce((sum, part) => sum + part.value * part.weight, 0) / weightSum;
}

function availabilityRank(value: boolean | null): number {
  return value === true ? 0 : value == null ? 1 : 2;
}

/** Sementes da lista: livros já carregados, pares vizinhos e top θ̂ do pool. */
function seedIds(
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
  }
  Object.values(pool)
    .filter((hero) => finite(hero.wrAdj))
    .sort((a, b) => (b.wrAdj as number) - (a.wrAdj as number))
    .slice(0, 18)
    .forEach((hero) => seeds.add(hero.id));
  return seeds;
}

export type SuggestionOptions = { lane?: DraftLane; target?: Archetype | null; limit?: number };

export function pickSuggestions(
  state: DraftState,
  pool: HeroPool,
  books: MatchupBooks,
  baseline: number | null,
  opts: SuggestionOptions = {},
): Candidate[] {
  const ourNext = nextPickStep(state, "us");
  if (!ourNext) return [];

  const lane = opts.lane ?? ourNext.lane ?? DRAFT_LANES[0];
  const target = opts.target ?? null;
  const meta: LaneMeta = laneMetaStats(pool, lane);
  const used = usedIds(state);
  const ourIds = state.us.map((slot) => slot.heroId).filter((id): id is number => id != null);
  const enemyIds = state.them.map((slot) => slot.heroId).filter((id): id is number => id != null);
  const k = actionsUntilNextPick(state).k;

  const candidates: Candidate[] = [];
  for (const heroId of seedIds(pool, books, ourIds, enemyIds)) {
    if (used.includes(heroId)) continue;
    const hero = pool[heroId];
    if (!hero) continue;

    const fit = laneFitOf(hero, lane);
    const percentile = lanePercentile(hero, meta);
    const archetype = heroArchetype(heroId, books);
    const balance = balanceOf(archetype, target);
    const strength = candidateStrength(hero, baseline);
    const synergy = candidateSynergy(heroId, ourIds, books);
    const matchup = candidateMatchup(heroId, enemyIds, books);
    const parts = [strength, synergy, matchup].filter(finite);

    const reasons: string[] = [];
    if (percentile != null) reasons.push(`meta da lane: ${Math.round(percentile * 100)}º percentil`);
    if (archetype) reasons.push(`tipo: ${archetype.top} (${archetype.n}/${archetype.total})`);
    if (strength != null) reasons.push(`força ${strength >= 0 ? "+" : ""}${strength.toFixed(3)}`);
    if (synergy != null) reasons.push(`sinergia ${synergy >= 0 ? "+" : ""}${synergy.toFixed(3)}`);
    if (matchup != null) reasons.push(`confronto ${matchup >= 0 ? "+" : ""}${matchup.toFixed(3)}`);
    if (!reasons.length) reasons.push("sem par observado neste recorte");

    candidates.push({
      heroId,
      name: hero.name,
      head: hero.head,
      lane,
      laneFit: fit,
      percentile,
      above: laneAbove(hero, meta),
      archetype,
      balance,
      target,
      score: combinedScore(percentile, balance),
      strength,
      synergy,
      matchup,
      observed: parts.length,
      availability: availabilityProxy(hero, k),
      k,
      reasons,
    });
  }

  return candidates
    .sort(
      (a, b) =>
        availabilityRank(a.laneFit) - availabilityRank(b.laneFit) ||
        (b.score ?? -Infinity) - (a.score ?? -Infinity) ||
        (b.percentile ?? -Infinity) - (a.percentile ?? -Infinity) ||
        (b.strength ?? -Infinity) - (a.strength ?? -Infinity) ||
        (a.name ?? "").localeCompare(b.name ?? ""),
    )
    .slice(0, Math.max(0, opts.limit ?? 8));
}

export function banTargets(state: DraftState, pool: HeroPool, books: MatchupBooks, limit = 6): BanTarget[] {
  const used = usedIds(state);
  const ourIds = state.us.map((slot) => slot.heroId).filter((id): id is number => id != null);
  const acc = new Map<number, { counters: number; worst: number; pressure: number }>();

  for (const id of ourIds) {
    for (const pair of books[id]?.countersDown ?? []) {
      if (used.includes(pair.id) || !finite(pair.delta)) continue;
      const severity = Math.abs(pair.delta);
      const row = acc.get(pair.id) ?? { counters: 0, worst: 0, pressure: 0 };
      row.counters += 1;
      row.worst = Math.max(row.worst, severity);
      row.pressure += severity;
      acc.set(pair.id, row);
    }
  }

  return [...acc.entries()]
    .map(([heroId, row]) => {
      const hero = pool[heroId];
      const pick = finite(hero?.pick) ? (hero?.pick as number) : 0;
      const ban = finite(hero?.ban) ? (hero?.ban as number) : 0;
      return {
        heroId,
        name: hero?.name ?? `Herói #${heroId}`,
        head: hero?.head ?? null,
        counters: row.counters,
        worst: row.worst,
        contested: hero && (finite(hero.pick) || finite(hero.ban)) ? pick + ban : null,
        pressure: row.pressure,
      };
    })
    .sort(
      (a, b) =>
        b.counters - a.counters ||
        (b.worst ?? -Infinity) - (a.worst ?? -Infinity) ||
        (b.contested ?? -Infinity) - (a.contested ?? -Infinity),
    )
    .slice(0, Math.max(0, limit));
}
