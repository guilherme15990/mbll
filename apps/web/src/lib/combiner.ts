import type {
  AggregateCombiner,
  AggregateCombinerEmblem,
  AggregateCombinerItem,
  AggregateCombinerSpell,
  AggregateCombinerTalent,
  AggregateTopBuild,
  AggregateValueSource,
} from "./api";
import { signed } from "../shared/format.ts";

/**
 * Combinador (ADR-030/ADR-031) — índice aditivo de efeitos marginais.
 *
 * Cada componente recebe o peso por **contraste dentro do contexto**
 * (mesmo herói+lane+rank): win(builds com c) − win(builds sem c), agregado
 * pela mediana entre contextos e encolhido por n/(n+K). O valor só é
 * `observed` quando há contextos com contraste e trocas pareadas suficientes;
 * abaixo disso aparece como `estimated` (valor encolhido, não zero);
 * `none` = o componente nunca variou no recorte (não é "sem suporte", é
 * "sem contraste"); `descriptive` = emblema, que é constante dentro do herói
 * e por isso nunca recebe peso.
 *
 * O índice é relativo: NÃO é previsão, NÃO é win rate da combinação e NÃO é o
 * "Poder da Build" oficial.
 */

export type CombinerPick = {
  itemIds: number[];
  emblemId: number | null;
  talentIds: number[];
  spellName: string | null;
};

export const EMPTY_PICK: CombinerPick = { itemIds: [], emblemId: null, talentIds: [], spellName: null };

export type CombinerContribution = {
  kind: "item" | "emblem" | "talent" | "spell";
  key: string;
  id: number | string | null;
  label: string;
  icon: string | null;
  /** Valor observado (só quando a evidência é `observed`). */
  valuePp: number | null;
  /** Valor estimado (evidência `estimated`); nunca é 0 no lugar de "sem dado". */
  valuePpEst: number | null;
  /** Valor usado no índice: observado ?? estimado. */
  valueUsed: number | null;
  evidence: AggregateValueSource;
  power: number | null;
  points: number | null;
  hasData: boolean;
  supportStatus: "ok" | "insufficient" | null;
  adoption: number | null;
  builds: number;
  contexts: number;
  pairedContexts: number;
  heroCoverage: number;
  reason: string | null;
};

export type CombinerScore = {
  index: number | null;
  meanPp: number | null;
  withData: number;
  observed: number;
  estimated: number;
  descriptive: number;
  total: number;
  coverage: number;
  pointsPerPp: number;
  base: number;
  contributions: CombinerContribution[];
};

export function validatePick(pick: CombinerPick, combiner?: AggregateCombiner): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const slots = combiner?.scale.slots ?? { items: 6, emblems: 1, talents: 3, spells: 1 };

  if (pick.itemIds.length > slots.items) errors.push(`no máximo ${slots.items} itens`);
  if (new Set(pick.itemIds).size !== pick.itemIds.length) errors.push("item repetido");

  const movement = (combiner?.items ?? []).filter((i) => pick.itemIds.includes(i.id) && i.archetype === "movement");
  if (movement.length > 1) errors.push("só uma bota");

  if (pick.talentIds.length > slots.talents) errors.push(`no máximo ${slots.talents} talentos`);
  const tiers = pick.talentIds.map((id) => (combiner?.talents ?? []).find((t) => t.id === id)?.tier ?? null);
  if (new Set(tiers).size !== tiers.length) errors.push("um talento por tier");

  return { ok: errors.length === 0, errors };
}

export function scoreCombination(pick: CombinerPick, combiner: AggregateCombiner | undefined | null): CombinerScore {
  const base = combiner?.scale.base ?? 100;
  const pointsPerPp = combiner?.scale.points_per_pp ?? 10;
  const contributions: CombinerContribution[] = [];

  if (combiner) {
    for (const id of pick.itemIds) {
      const row: AggregateCombinerItem | undefined = combiner.items.find((i) => i.id === id);
      contributions.push(contributionOf("item", String(id), id, row?.name ?? `#${id}`, row));
    }
    if (pick.emblemId != null) {
      const row: AggregateCombinerEmblem | undefined = combiner.emblems.find((e) => e.emblem_id === pick.emblemId);
      contributions.push(contributionOf("emblem", `e${pick.emblemId}`, pick.emblemId, row?.name ?? `#${pick.emblemId}`, row));
    }
    for (const id of pick.talentIds) {
      const row: AggregateCombinerTalent | undefined = combiner.talents.find((t) => t.id === id);
      contributions.push(contributionOf("talent", `t${id}`, id, row?.label ?? `#${id}`, row));
    }
    if (pick.spellName != null) {
      const row: AggregateCombinerSpell | undefined = combiner.spells.find((s) => s.name === pick.spellName);
      contributions.push(contributionOf("spell", `s${pick.spellName}`, pick.spellName, pick.spellName, row));
    }
  }

  const withData = contributions.filter((c) => c.valueUsed != null);
  const total = contributions.length;
  const meanPp = withData.length ? withData.reduce((s, c) => s + (c.valueUsed ?? 0), 0) / withData.length : null;
  const index = meanPp == null ? null : +(base + pointsPerPp * meanPp).toFixed(1);

  // Os pontos somam o índice: cada componente carrega a sua fatia da média.
  const denominator = withData.length || 1;
  for (const c of contributions) {
    c.points = c.valueUsed != null ? +((pointsPerPp * c.valueUsed) / denominator).toFixed(2) : null;
  }

  return {
    index,
    meanPp: meanPp == null ? null : +meanPp.toFixed(2),
    withData: withData.length,
    observed: contributions.filter((c) => c.evidence === "observed").length,
    estimated: contributions.filter((c) => c.evidence === "estimated").length,
    descriptive: contributions.filter((c) => c.evidence === "descriptive").length,
    total,
    coverage: total ? withData.length / total : 0,
    pointsPerPp,
    base,
    contributions,
  };
}

export const TOTAL_ITEM_SLOTS = 6;

/** Configuração de uma build observada + os itens que o usuário acrescentou. */
export function pickFromBuild(build: AggregateTopBuild, extras: number[] = []): CombinerPick {
  return {
    itemIds: [...(build.item_ids ?? []), ...extras.filter((id) => !(build.item_ids ?? []).includes(id))],
    emblemId: build.emblem?.id ?? null,
    talentIds: (build.talents ?? []).map((t) => t.id),
    spellName: build.spell?.name ?? null,
  };
}

/** Slots de item ainda vazios para fechar a build em `total` itens. */
export function freeItemSlots(build: AggregateTopBuild, extras: number[] = [], total = TOTAL_ITEM_SLOTS): number {
  return Math.max(0, total - (build.item_ids?.length ?? 0) - extras.length);
}

type CombinerRow = {
  value_pp?: number | null;
  value_pp_est?: number | null;
  value_pp_source?: AggregateValueSource;
  power?: number | null;
  value_reason?: string | null;
  name?: string | null;
  label?: string | null;
  icon?: string | null;
  adoption?: number | null;
  builds?: number;
  contexts?: number;
  hero_coverage?: number;
  contrast?: { contexts?: number; paired_contexts?: number };
  support?: { status: "ok" | "insufficient" };
};

const EVIDENCE_LABEL: Record<AggregateValueSource, string> = {
  observed: "observado",
  estimated: "estimado",
  descriptive: "descritivo",
  none: "sem contraste",
};

/** Rótulo curto da evidência (obs/est/descritivo/sem contraste). */
export function evidenceLabel(source: AggregateValueSource | undefined | null): string {
  return EVIDENCE_LABEL[source ?? "none"] ?? "sem contraste";
}

/**
 * Texto do peso do componente. `~` marca valor estimado (poucos contrastes),
 * "descritivo" é o emblema e "sem contraste" é componente que nunca variou no
 * recorte — nunca `0` no lugar de "sem dado".
 */
export function valueText(
  source: AggregateValueSource | undefined | null,
  valuePp: number | null | undefined,
  valuePpEst: number | null | undefined,
  digits = 2,
): string {
  const fmt = (v: number) => signed(v, digits, " pp");
  if (source === "observed" && valuePp != null) return fmt(valuePp);
  if (source === "estimated" && valuePpEst != null) return `~${fmt(valuePpEst)}`;
  if (source === "descriptive") return "descritivo";
  return "sem contraste";
}

function contributionOf(
  kind: CombinerContribution["kind"],
  key: string,
  id: number | string | null,
  label: string,
  row: CombinerRow | undefined,
): CombinerContribution {
  const observed = row?.value_pp ?? null;
  const estimated = row?.value_pp_est ?? null;
  const valueUsed = observed ?? estimated;
  const evidence: AggregateValueSource = row?.value_pp_source
    ?? (valueUsed != null ? "observed" : "none");

  return {
    kind,
    key,
    id,
    label,
    icon: row?.icon ?? null,
    valuePp: observed,
    valuePpEst: estimated,
    valueUsed,
    evidence,
    power: row?.power ?? (valueUsed == null ? null : +(100 + 10 * valueUsed).toFixed(1)),
    points: null,
    hasData: valueUsed != null,
    supportStatus: row?.support?.status ?? null,
    adoption: row?.adoption ?? null,
    builds: row?.builds ?? 0,
    contexts: row?.contrast?.contexts ?? row?.contexts ?? 0,
    pairedContexts: row?.contrast?.paired_contexts ?? 0,
    heroCoverage: row?.hero_coverage ?? 0,
    reason: row?.value_reason ?? null,
  };
}
