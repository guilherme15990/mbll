import type { AggregateValueSource } from "../../api";
import { pp } from "../../format";

/**
 * Compositor de itens e feitiços — modelo puro.
 *
 * Extraído de `ItemComposer.tsx` (ADR-041: teto de 300 linhas). Sem React: só
 * tipos, constantes de categoria e funções puras de leitura que a casca e os
 * subcomponentes compartilham. A ordem de exibição (peso → adoção → builds) é a
 * mesma em todas as listas e nunca transforma peso em recomendação.
 */

export type ComposerItem = {
  id: number;
  name: string | null;
  icon: string | null;
  archetype?: string | null;
  archetypeLabel?: string | null;
  evidence?: AggregateValueSource;
  valuePp?: number | null;
  valuePpEst?: number | null;
  adoption?: number | null;
  builds?: number;
  reason?: string | null;
};

export type ComposerSpell = {
  name: string;
  icon: string | null;
  desc?: string | null;
  evidence?: AggregateValueSource;
  valuePp?: number | null;
  valuePpEst?: number | null;
  adoption?: number | null;
  builds?: number;
  reason?: string | null;
};

export type ComposerPower = {
  /** Desvio em pontos do índice contra a média das builds observadas. */
  delta: number | null;
  /** Quantas builds entraram na média. */
  averageCount?: number;
  /** Nota curta abaixo do número. */
  note?: string;
};

export type ItemComposerProps = {
  items: readonly ComposerItem[];
  value: readonly number[];
  onPick: (id: number, index: number) => void;
  onRemove?: (index: number) => void;
  max?: number;
  blockReason?: (item: ComposerItem, index: number) => string | null;
  /** Feitiços disponíveis no recorte. Sem a prop, a categoria não aparece. */
  spells?: readonly ComposerSpell[];
  /** Feitiço selecionado (nome). `null` = sem feitiço. */
  spell?: string | null;
  onPickSpell?: (name: string | null) => void;
  spellBlockReason?: (spell: ComposerSpell) => string | null;
  /** Número único de poder: seta + desvio vs média. Sem a prop, não aparece. */
  power?: ComposerPower | null;
  /**
   * `inline` (padrão): slots + navbar + catálogo em modal interno.
   * `modal`: o componente é o próprio modal controlado (`open`/`onClose`),
   * usado quando a tela já tem os slots e só precisa do catálogo.
   */
  variant?: "inline" | "modal";
  open?: boolean;
  onClose?: () => void;
  /** Slot que recebe a escolha no variant `modal`. */
  targetIndex?: number;
  /** Candidatos com lastro, mostrados como primeira categoria do modal. */
  recommended?: readonly ComposerItem[];
  title?: string;
  label?: string;
  className?: string;
};

export const CATEGORY_ALL = "all";
export const CATEGORY_SPELL = "__spell__";
export const CATEGORY_RECOMMENDED = "__recommended__";
export const EMPTY_SPELLS: readonly ComposerSpell[] = [];
export const EMPTY_ITEMS: readonly ComposerItem[] = [];

export const CATEGORY_ORDER = [
  "physical_attack",
  "magic_attack",
  "physical_defense",
  "magic_defense",
  "hybrid_defense",
  "generic_defense",
  "movement",
  "roam",
  "jungle",
  "attack_utility",
  "magic_utility",
  "mixed",
  "unclassified",
] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  physical_attack: "Ataque físico",
  magic_attack: "Ataque mágico",
  physical_defense: "Defesa física",
  magic_defense: "Defesa mágica",
  hybrid_defense: "Defesa híbrida",
  generic_defense: "Defesa (HP)",
  movement: "Movimento",
  roam: "Roam",
  jungle: "Jungle",
  attack_utility: "Ataque utilitário",
  magic_utility: "Magia utilitária",
  mixed: "Misto",
  unclassified: "Não classificado",
};

export const EVIDENCE_LABEL: Record<AggregateValueSource, string> = {
  observed: "observado",
  estimated: "estimado",
  descriptive: "descritivo",
  none: "sem contraste",
};

export function categoryOf(item: ComposerItem): string {
  const key = item.archetype?.trim();
  return key ? key : "unclassified";
}

export function categoryName(key: string, items: readonly ComposerItem[]): string {
  if (CATEGORY_LABEL[key]) return CATEGORY_LABEL[key];
  const fromItem = items.find((item) => categoryOf(item) === key && item.archetypeLabel)?.archetypeLabel;
  return fromItem ?? key.replace(/_/g, " ");
}

export function itemName(item: ComposerItem): string {
  return item.name ?? `Item #${item.id}`;
}

export function valueLabel(row: { valuePp?: number | null; valuePpEst?: number | null }): string {
  if (row.valuePp != null && Number.isFinite(row.valuePp)) return pp(row.valuePp);
  if (row.valuePpEst != null && Number.isFinite(row.valuePpEst)) return `${pp(row.valuePpEst)} est.`;
  return "sem contraste";
}

export function spellKey(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

export function spellValueLabel(spell: ComposerSpell): string {
  return valueLabel(spell);
}

export function evidenceClass(evidence: AggregateValueSource | undefined): string {
  if (evidence === "observed") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (evidence === "estimated") return "border-amber-300/30 bg-amber-300/10 text-amber-200";
  if (evidence === "descriptive") return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  return "border-line bg-abyss/60 text-mist";
}

/** Uma linha da navbar de categorias: chave, rótulo legível e contagem. */
export type ComposerCategory = { key: string; label: string; count: number };

/** Agrupa os itens por arquétipo, na ordem declarada + o que sobrar em ordem alfabética. */
export function categoryRows(items: readonly ComposerItem[]): ComposerCategory[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = categoryOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const known = CATEGORY_ORDER.filter((key) => counts.has(key));
  const extra = [...counts.keys()].filter((key) => !(CATEGORY_ORDER as readonly string[]).includes(key)).sort();
  return [...known, ...extra].map((key) => ({
    key,
    label: categoryName(key, items),
    count: counts.get(key) ?? 0,
  }));
}

function byWeight<T extends { valuePp?: number | null; valuePpEst?: number | null; adoption?: number | null }>(
  a: T,
  b: T,
  nameOf: (row: T) => string,
): number {
  return (
    (b.valuePp ?? b.valuePpEst ?? -Infinity) - (a.valuePp ?? a.valuePpEst ?? -Infinity) ||
    (b.adoption ?? -Infinity) - (a.adoption ?? -Infinity) ||
    nameOf(a).localeCompare(nameOf(b))
  );
}

/** Itens visíveis no catálogo: categoria + busca, ordenados por peso/adoção. */
export function visibleItems(
  items: readonly ComposerItem[],
  recommended: readonly ComposerItem[],
  category: string,
  query: string,
): ComposerItem[] {
  const q = query.trim().toLowerCase();
  const source = category === CATEGORY_RECOMMENDED ? recommended : items;
  return source
    .filter(
      (item) => category === CATEGORY_ALL || category === CATEGORY_RECOMMENDED || categoryOf(item) === category,
    )
    .filter((item) => !q || itemName(item).toLowerCase().includes(q))
    .sort((a, b) => byWeight(a, b, itemName));
}

/** Feitiços visíveis: busca por nome ou descrição, mesma ordem de peso/adoção. */
export function visibleSpells(spells: readonly ComposerSpell[], query: string): ComposerSpell[] {
  const q = query.trim().toLowerCase();
  return spells
    .filter((row) => !q || row.name.toLowerCase().includes(q) || (row.desc ?? "").toLowerCase().includes(q))
    .sort((a, b) => byWeight(a, b, (row) => row.name));
}
