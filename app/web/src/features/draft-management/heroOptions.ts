import type { DraftHero, HeroPool } from "./model";

/**
 * Lista de heróis do modal (ADR-053 D6).
 *
 * Devolve **todo** o pool disponível (menos os já usados), filtrado pela busca e
 * ordenado por θ̂ (pick) ou taxa de ban (ban). Sem paginação e SEM teto de lote:
 * o lote vem inteiro do `useAllHeroes` e o modal é uma lista rolável, então um
 * herói novo aparece sozinho — nada de constante que esconda o excedente.
 * `total` reflete o disponível já com a busca aplicada.
 */
export type PickerMode = "pick" | "ban";

export type HeroOptions = {
  options: DraftHero[];
  /** Total disponível (já com a busca aplicada). */
  total: number;
};

export function heroOptions(
  pool: HeroPool,
  used: readonly number[],
  query: string,
  mode: PickerMode,
): HeroOptions {
  const needle = query.trim().toLowerCase();
  const value = (hero: DraftHero) => (mode === "ban" ? (hero.ban ?? -Infinity) : (hero.wrAdj ?? -Infinity));

  const available = Object.values(pool)
    .filter((hero) => !used.includes(hero.id))
    .filter((hero) => !needle || (hero.name ?? "").toLowerCase().includes(needle))
    .sort((a, b) => value(b) - value(a) || (a.name ?? "").localeCompare(b.name ?? ""));

  return { options: available, total: available.length };
}
