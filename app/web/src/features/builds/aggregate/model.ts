import type {
  AggregateDeltaStatus, AggregateItem, AggregateSet, AggregateTalent,
} from "../../../shared/api";

/**
 * Derivações puras do agregado de builds.
 *
 * Saíram de dentro do `BuildsAggregatePanel` (E3 da auditoria): o componente
 * tinha 806 linhas misturando apresentação, agrupamento e limiar de status.
 * Aqui não há React — dá para testar sem render.
 */

/** Os quatro blocos principais. O que não for um deles cai em "outros". */
export const ARCHETYPES: { key: string; label: string }[] = [
  { key: "physical_attack", label: "Ataque físico" },
  { key: "magic_attack", label: "Ataque mágico" },
  { key: "physical_defense", label: "Defesa física" },
  { key: "magic_defense", label: "Defesa mágica" },
];

/**
 * Status de uma diferença em pontos percentuais.
 *
 * Limiar de 2 pp: abaixo disso não se afirma direção. Sem número, "insufficient".
 */
export function deltaStatusOfPp(deltapp: number | null | undefined): AggregateDeltaStatus {
  if (deltapp == null || !Number.isFinite(deltapp)) return "insufficient";
  if (Math.abs(deltapp) < 2) return "no_practical_difference";
  return deltapp > 0 ? "positive" : "negative";
}

/**
 * Agrupa itens/pacotes nos quatro arquétipos principais.
 *
 * Híbridos, utilitários e não classificados NÃO entram nos quatro blocos —
 * voltam em `others` e são renderizados à parte (nunca descartados).
 */
export function groupByArchetype<T extends { archetype?: string | null }>(
  rows: readonly T[],
): { groups: { key: string; label: string; rows: T[] }[]; others: T[] } {
  const groups = ARCHETYPES.map((a) => ({
    ...a,
    rows: rows.filter((row) => row.archetype === a.key),
  }));
  const others = rows.filter((row) => !ARCHETYPES.some((a) => a.key === row.archetype));
  return { groups, others };
}

/** Itens por arquétipo (bloco 2). */
export function groupItems(items: readonly AggregateItem[]) {
  return groupByArchetype(items);
}

/** Sets por arquétipo (bloco 4), com teto por bloco — o resto vive em `others`. */
export function groupSets(sets: readonly AggregateSet[], perGroup = 4, maxOthers = 6) {
  const { groups, others } = groupByArchetype(sets);
  return {
    groups: groups.map((g) => ({ ...g, rows: g.rows.slice(0, perGroup) })),
    others: others.slice(0, maxOthers),
  };
}

/** Talentos por tier, tier nulo no fim. */
export function groupTalentsByTier(talents: readonly AggregateTalent[]) {
  const groups = new Map<number | null, AggregateTalent[]>();
  for (const t of talents) {
    const key = t.tier ?? null;
    const rows = groups.get(key) ?? [];
    rows.push(t);
    groups.set(key, rows);
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] ?? 99) - (b[0] ?? 99))
    .map(([tier, rows]) => ({ tier, rows }));
}
