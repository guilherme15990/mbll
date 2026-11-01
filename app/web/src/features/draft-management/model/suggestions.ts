/**
 * Draft Management — candidatos ao próximo pick e alvos de ban (ADR-053 D5/D6 +
 * ADR-057).
 *
 * Recomendador de CINCO fatores declarados, todos lidos do recorte atual:
 *   1. counter      → herói countera alguém do time inimigo (peso 1);
 *   2. antisinergia → herói tem antisinergia com alguém do meu time (peso 1);
 *   3. exposição    → herói é counterado por alguém do time inimigo (peso 1);
 *   4. meta         → percentil do θ̂ do herói no recorte (peso 1);
 *   5. balanceamento→ arquétipo que contrabalança o dominante inimigo (peso 0,25).
 *
 * Cada fator vira uma bondade 0–1 (0,5 = neutro) e o `score` é a média
 * ponderada SÓ dos fatores disponíveis: fator sem par observado sai do
 * denominador, como no índice — nunca vira 0. O score é um rank 0–1, nunca
 * probabilidade, e a UI mostra os cinco fatores por extenso em vez do número.
 *
 * A LANE ALVO manda na lista: herói de outra lane não é candidato e o encaixe
 * na lane vem antes do score na ordem (`laneFitRank`). Herói sem dado de lane
 * fica, mas atrás de quem encaixa.
 *
 * Honestidade (INV-DMP-002..005): direção do par vem da LISTA
 * (`countersUp`/`countersDown`, `synergiesUp`/`synergiesDown`), não do sinal do
 * δ; counter é média por par, nunca soma entre os cinco inimigos. Leitura
 * ordenada, nunca recomendação. Sobrevivência é hazard proxy.
 */
import { DRAFT_LANES, clamp, finite, mean } from "./common.ts";
import type { DraftLane } from "./common.ts";
import { actionsUntilNextPick, nextPickStep, usedIds, type DraftState } from "./state.ts";
import { availabilityProxy, deltaOf, type HeroPool, type MatchupBooks, type PairObs } from "./pairs.ts";
import { laneFitOf } from "./power.ts";
import { laneMetaStats, lanePercentile, type LaneMeta } from "./laneMeta.ts";
import { heroArchetype, type Archetype, type ArchetypeRead } from "./archetype.ts";

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

export type Candidate = {
  heroId: number;
  name: string | null;
  head: string | null;
  /** Encaixe na lane alvo. false = outra lane (fica fora da lista); null = sem dado. */
  laneFit: boolean | null;
  /** Percentil do θ̂ do herói no recorte (0–1). null = fora das lanes/sem θ̂. */
  meta: number | null;
  counter: PairRead;
  antisynergy: PairRead;
  exposure: PairRead;
  archetype: ArchetypeRead | null;
  balance: BalanceFit | null;
  target: Archetype | null;
  /** Média ponderada dos fatores disponíveis (0–1). Nunca exibido como probabilidade. */
  score: number | null;
  /** Quantos dos cinco fatores têm sinal observado (0–5). */
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
function counterRead(heroId: number, enemyIds: readonly number[], books: MatchupBooks): PairRead {
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
function antisynergyRead(heroId: number, allyIds: readonly number[], books: MatchupBooks): PairRead {
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
function exposureRead(heroId: number, enemyIds: readonly number[], books: MatchupBooks): PairRead {
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
function goodnessOf(value: number | null): number | null {
  return value == null ? null : clamp(0.5 + 0.5 * Math.tanh(value / PAIR_SCALE), 0, 1);
}

/** Média ponderada só dos fatores presentes; sem nenhum, null. */
function combinedScore(parts: readonly { value: number | null; weight: number }[]): number | null {
  const present = parts.filter((part): part is { value: number; weight: number } => part.value != null);
  const weightSum = present.reduce((sum, part) => sum + part.weight, 0);
  if (!weightSum) return null;
  return present.reduce((sum, part) => sum + part.value * part.weight, 0) / weightSum;
}

/** Encaixe na lane domina a ordem: herói da lane sempre acima do sem dado. */
function laneFitRank(value: boolean | null): number {
  return value === true ? 0 : 1;
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
    for (const pair of books[id]?.countersUp ?? []) seeds.add(pair.id);
  }
  Object.values(pool)
    .filter((hero) => finite(hero.wrAdj))
    .sort((a, b) => (b.wrAdj as number) - (a.wrAdj as number))
    .slice(0, 18)
    .forEach((hero) => seeds.add(hero.id));
  return seeds;
}

export type SuggestionOptions = { lane?: DraftLane; target?: Archetype | null; limit?: number };

/**
 * `baseline` fica na assinatura por compatibilidade com o índice (a força média
 * já é lida em `power.ts`), mas o fator de meta aqui é o percentil do θ̂.
 */
export function pickSuggestions(
  state: DraftState,
  pool: HeroPool,
  books: MatchupBooks,
  _baseline: number | null,
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

    // Respeita a lane alvo: herói de OUTRA lane não é candidato (ADR-057 D2).
    const fit = laneFitOf(hero, lane);
    if (fit === false) continue;

    const metaValue = lanePercentile(hero, meta);
    const counter = counterRead(heroId, enemyIds, books);
    const antisynergy = antisynergyRead(heroId, ourIds, books);
    const exposure = exposureRead(heroId, enemyIds, books);
    const archetype = heroArchetype(heroId, books);
    const balance = balanceOf(archetype, target);
    const balanceGoodness = balance == null ? null : (balance + 1) / 2;

    const score = combinedScore([
      { value: metaValue, weight: META_WEIGHT },
      { value: goodnessOf(counter.value), weight: COUNTER_WEIGHT },
      { value: goodnessOf(antisynergy.value), weight: ANTISYNERGY_WEIGHT },
      { value: goodnessOf(exposure.value), weight: EXPOSURE_WEIGHT },
      { value: balanceGoodness, weight: BALANCE_WEIGHT },
    ]);

    const reasons: string[] = [];
    if (metaValue != null) reasons.push(`meta: ${Math.round(metaValue * 100)}º percentil`);
    if (counter.value != null) reasons.push(`countera ${counter.ids.length} inimigo(s)`);
    if (antisynergy.value != null) reasons.push(`antisinergia com ${antisynergy.ids.length} aliado(s)`);
    if (exposure.value != null) reasons.push(`exposto a ${exposure.ids.length} inimigo(s)`);
    if (balance != null) {
      reasons.push(balance > 0 ? "balanceia o dominante inimigo" : balance < 0 ? "repete a janela inimiga" : "neutro no tipo");
    }
    if (!reasons.length) reasons.push("sem par observado neste recorte");

    const factorValues = [metaValue, counter.value, antisynergy.value, exposure.value, balanceGoodness];

    candidates.push({
      heroId,
      name: hero.name,
      head: hero.head,
      laneFit: fit,
      meta: metaValue,
      counter,
      antisynergy,
      exposure,
      archetype,
      balance,
      target,
      score,
      observed: factorValues.filter((value) => value != null).length,
      availability: availabilityProxy(hero, k),
      k,
      reasons,
    });
  }

  return candidates
    .sort(
      (a, b) =>
        laneFitRank(a.laneFit) - laneFitRank(b.laneFit) ||
        (b.score ?? -Infinity) - (a.score ?? -Infinity) ||
        b.observed - a.observed ||
        (b.meta ?? -Infinity) - (a.meta ?? -Infinity) ||
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
