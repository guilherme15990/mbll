/**
 * Draft Management — leitura dos pares (ADR-052).
 *
 * Regras de honestidade (INV-DMP-002..005):
 * - ausência de par = desconhecido, nunca 0;
 * - direção do par vem da LISTA (`countersUp`/`countersDown`,
 *   `synergiesUp`/`synergiesDown`), não do sinal do δ;
 * - counters são média por par, nunca soma entre os cinco inimigos.
 */
import { clamp, finite, mean, median } from "./common.ts";

export type DraftHero = {
  id: number;
  name: string | null;
  head: string | null;
  /** θ̂ (logit). null = sem exposição no recorte. */
  wrAdj: number | null;
  pick: number | null;
  ban: number | null;
  /** Credibilidade do modelo (0–1). */
  B: number | null;
  tier: string | null;
  /** IC 95% na mesma escala de θ̂. */
  credible: [number, number] | null;
  smallSample: boolean;
  lanes: string[];
};

export type HeroPool = Record<number, DraftHero>;

/** Ponto da curva de duração que o fio entrega por par (`Pair.curve`). */
export type CurvePoint = { label: string; mid: number; win: number };

export type PairObs = {
  id: number;
  delta: number | null;
  /** Perfil de duração do par (`classifyDuration` no fio) — base do arquétipo. */
  profile?: string | null;
  /** Curva de duração do par — base do gráfico de evolução. */
  curve?: readonly CurvePoint[];
  /** Identidade estável do par, quando o fio manda. */
  pairKey?: string | null;
};

export type MatchupBook = {
  id: number;
  /** Heróis que ESTE herói countera. */
  countersUp: PairObs[];
  /** Heróis que counteram ESTE herói. */
  countersDown: PairObs[];
  /** Sinergia positiva com os listados. */
  synergiesUp: PairObs[];
  /** Sinergia negativa com os listados. */
  synergiesDown: PairObs[];
};

export type MatchupBooks = Record<number, MatchupBook | undefined>;

/** |δ| do par listado, ou null quando o par não foi observado. */
export function deltaOf(list: readonly PairObs[] | undefined, id: number): number | null {
  const row = list?.find((pair) => pair.id === id);
  return row && finite(row.delta) ? Math.abs(row.delta) : null;
}

export type PairAggregate = { value: number | null; observed: number; total: number; contested: number };

/** Sinergia interna: uma observação por par, mediana das direções disponíveis. */
export function pairSynergy(ids: readonly number[], books: MatchupBooks): PairAggregate {
  const observations: number[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      const values: number[] = [];
      const dAB = deltaOf(books[a]?.synergiesUp, b);
      const dABn = deltaOf(books[a]?.synergiesDown, b);
      const dBA = deltaOf(books[b]?.synergiesUp, a);
      const dBAn = deltaOf(books[b]?.synergiesDown, a);
      if (dAB != null) values.push(dAB);
      if (dABn != null) values.push(-dABn);
      if (dBA != null) values.push(dBA);
      if (dBAn != null) values.push(-dBAn);
      const value = median(values);
      if (value != null) observations.push(value);
    }
  }
  const total = (ids.length * (ids.length - 1)) / 2;
  return { value: mean(observations), observed: observations.length, total, contested: 0 };
}

/**
 * Confronto líquido por par. Direção vem da lista; |δ| é severidade.
 * Par com as duas direções observadas = contestado → 0 (não escolhe lado).
 */
export function pairMatchup(
  ours: readonly number[],
  theirs: readonly number[],
  books: MatchupBooks,
): PairAggregate {
  const observations: number[] = [];
  let contested = 0;
  for (const h of ours) {
    for (const e of theirs) {
      const hCounters = deltaOf(books[h]?.countersUp, e) ?? deltaOf(books[e]?.countersDown, h);
      const eCounters = deltaOf(books[h]?.countersDown, e) ?? deltaOf(books[e]?.countersUp, h);
      if (hCounters != null && eCounters != null) {
        observations.push(0);
        contested += 1;
      } else if (hCounters != null) {
        observations.push(hCounters);
      } else if (eCounters != null) {
        observations.push(-eCounters);
      }
    }
  }
  return {
    value: observations.length ? mean(observations) : null,
    observed: observations.length,
    total: ours.length * theirs.length,
    contested,
  };
}

export type StrengthAggregate = { value: number | null; observed: number; total: number; se: number | null };

/** Força média com peso de credibilidade; se do time derivado do IC 95%. */
export function teamStrength(
  ids: readonly number[],
  pool: HeroPool,
  baseline: number | null,
): StrengthAggregate {
  const rows = ids
    .map((id) => pool[id])
    .filter((hero): hero is DraftHero => hero != null && finite(hero.wrAdj));
  if (!rows.length) return { value: null, observed: 0, total: ids.length, se: null };

  const mu = finite(baseline) && baseline > 0.2 && baseline < 0.8 ? baseline : 0.5;
  const weights = rows.map((hero) => {
    const raw = finite(hero.B) ? hero.B : 0.5;
    return hero.smallSample ? Math.min(0.25, clamp(raw, 0.05, 1)) : clamp(raw, 0.05, 1);
  });
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const value =
    rows.reduce((sum, hero, index) => sum + weights[index] * ((hero.wrAdj as number) - mu), 0) / weightSum;

  const intervals = rows
    .map((hero) => hero.credible)
    .filter(
      (interval): interval is [number, number] =>
        Array.isArray(interval) && interval.length === 2 && finite(interval[0]) && finite(interval[1]),
    );
  const se = intervals.length
    ? Math.sqrt(intervals.reduce((sum, [lo, hi]) => sum + ((hi - lo) / 3.92) ** 2, 0)) / intervals.length
    : null;

  return { value, observed: rows.length, total: ids.length, se };
}

/** q por ação (hazard proxy): 10 pick + 6 ban sobre 16 ações. */
export function contestHazard(hero: DraftHero | undefined | null): number | null {
  if (!hero || !finite(hero.pick) || !finite(hero.ban)) return null;
  return clamp((10 * hero.pick + 6 * hero.ban) / 16, 0, 0.95);
}

/** Sobrevivência proxy até o próximo pick. NÃO é probabilidade. */
export function availabilityProxy(hero: DraftHero | undefined | null, k: number): number | null {
  const q = contestHazard(hero);
  if (q == null) return null;
  return (1 - q) ** Math.max(0, k);
}
