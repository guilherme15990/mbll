import type {
  AggregateCombiner, AggregateCombinerEmblem, AggregateCombinerItem, AggregateCombinerTalent,
  AggregateValueSource, Build,
} from "../api";
import type { CombinerPick } from "./combiner";

/**
 * Build Management — lógica pura da tela `/build` (ADR-047).
 *
 * Três perguntas, três funções:
 * 1. `coreItems` — o que se repete nas builds observadas deste herói+lane.
 * 2. `pickFromObservedBuild` — a build observada vira o mesmo `CombinerPick`
 *    que o Combinador e o loadout já conhecem.
 * 3. `completionSuggestions` — o que preenche os slots livres com lastro no
 *    recorte, sem transformar peso em recomendação.
 *
 * Puro por construção: só `import type` (apagado no build) e nenhuma chamada
 * de rede. A UI decide como exibir; aqui não há React.
 */

export type CoreItem = {
  id: number;
  name: string | null;
  icon: string | null;
  /** Número de builds observadas que contêm o item (1 por build). */
  builds: number;
  /** Fração das builds observadas que contêm o item (0..1). */
  share: number;
  /** Mediana do win observado entre as builds que contêm o item. */
  winMedian: number | null;
  /** Melhor lift vs build mais usada entre as builds que contêm o item. */
  bestLift: number | null;
};

export type CompletionSuggestion = {
  id: number;
  name: string | null;
  icon: string | null;
  archetype: string;
  archetypeLabel: string;
  /** Valor usado no índice: observado ?? estimado. Nunca 0 no lugar de sem dado. */
  valueUsed: number;
  valuePp: number | null;
  valuePpEst: number | null;
  evidence: "observed" | "estimated" | "descriptive" | "none";
  adoption: number | null;
  builds: number;
  contexts: number;
  reason: string | null;
};

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Itens que mais se repetem nas builds observadas.
 *
 * A contagem é por build (um item repetido na mesma build não conta duas
 * vezes). Ordena por presença; empate usa nome para não depender da ordem do
 * payload. `share` usa o total de builds como denominador, inclusive builds
 * sem id de item — o jogador vê a fração real do recorte.
 */
export function coreItems(builds: readonly Build[], limit = 6): CoreItem[] {
  const totalBuilds = builds.length;
  if (!totalBuilds) return [];

  const acc = new Map<number, { name: string | null; icon: string | null; count: number; wins: number[]; lifts: number[] }>();

  for (const build of builds) {
    const seen = new Set<number>();
    for (const item of build.items ?? []) {
      if (typeof item?.id !== "number" || !Number.isInteger(item.id) || item.id <= 0) continue;
      if (seen.has(item.id)) continue;
      seen.add(item.id);

      const row = acc.get(item.id) ?? { name: item.name ?? null, icon: item.icon ?? null, count: 0, wins: [], lifts: [] };
      row.count += 1;
      if (!row.name && item.name) row.name = item.name;
      if (!row.icon && item.icon) row.icon = item.icon;
      const win = finite(build.win);
      if (win != null) row.wins.push(win);
      const lift = finite(build.lift_vs_most_used);
      if (lift != null) row.lifts.push(lift);
      acc.set(item.id, row);
    }
  }

  return [...acc.entries()]
    .map(([id, row]) => ({
      id,
      name: row.name,
      icon: row.icon,
      builds: row.count,
      share: totalBuilds ? row.count / totalBuilds : 0,
      winMedian: median(row.wins),
      bestLift: row.lifts.length ? Math.max(...row.lifts) : null,
    }))
    .sort((a, b) => b.builds - a.builds || (a.name ?? `#${a.id}`).localeCompare(b.name ?? `#${b.id}`))
    .slice(0, Math.max(0, limit));
}

/** Materializa a build observada no mesmo pick do Combinador/loadout. */
export function pickFromObservedBuild(build: Build): CombinerPick {
  const itemIds: number[] = [];
  for (const item of build.items ?? []) {
    if (typeof item?.id === "number" && Number.isInteger(item.id) && item.id > 0 && !itemIds.includes(item.id)) {
      itemIds.push(item.id);
    }
  }

  const talentIds: number[] = [];
  for (const talent of build.talents ?? []) {
    if (typeof talent?.id === "number" && Number.isInteger(talent.id) && talent.id > 0 && !talentIds.includes(talent.id)) {
      talentIds.push(talent.id);
    }
  }

  const emblemId =
    typeof build.emblem?.id === "number" && Number.isInteger(build.emblem.id) && build.emblem.id > 0
      ? build.emblem.id
      : null;
  const spellName = build.spell?.name?.trim() ? build.spell.name.trim() : null;

  return { itemIds, emblemId, talentIds, spellName };
}

const EVIDENCE = new Set(["observed", "estimated", "descriptive", "none"]);

/**
 * Itens que podem completar os slots livres, ordenados pelo peso do recorte.
 *
 * Regras:
 * - nunca repete item já escolhido (build ou adição);
 * - no máximo uma bota (`archetype === "movement"`);
 * - componente `none` (nunca variou no recorte) não vira sugestão;
 * - sem valor observado nem estimado, fica de fora — “sem dado” não vira 0.
 */
export function completionSuggestions(
  items: readonly AggregateCombinerItem[],
  pick: CombinerPick,
  extras: readonly number[] = [],
  limit = 6,
): CompletionSuggestion[] {
  const taken = new Set<number>([...pick.itemIds, ...extras]);
  const itemById = new Map(items.map((item) => [item.id, item]));
  const hasMovement = [...taken].some((id) => itemById.get(id)?.archetype === "movement");

  const rows: CompletionSuggestion[] = [];
  for (const item of items) {
    if (!Number.isInteger(item.id) || item.id <= 0 || taken.has(item.id)) continue;
    if (item.archetype === "movement" && hasMovement) continue;

    const observed = finite(item.value_pp);
    const estimated = finite(item.value_pp_est);
    const valueUsed = observed ?? estimated;
    if (valueUsed == null) continue;

    const rawEvidence = item.value_pp_source;
    const evidence = rawEvidence && EVIDENCE.has(rawEvidence) ? rawEvidence : "observed";
    if (evidence === "none" || evidence === "descriptive") continue;

    rows.push({
      id: item.id,
      name: item.name ?? null,
      icon: item.icon ?? null,
      archetype: item.archetype,
      archetypeLabel: item.archetype_label ?? item.archetype,
      valueUsed,
      valuePp: observed,
      valuePpEst: estimated,
      evidence,
      adoption: finite(item.adoption),
      builds: item.builds ?? 0,
      contexts: item.contexts ?? 0,
      reason: item.value_reason ?? null,
    });
  }

  return rows
    .sort(
      (a, b) =>
        b.valueUsed - a.valueUsed ||
        (b.adoption ?? -Infinity) - (a.adoption ?? -Infinity) ||
        b.builds - a.builds ||
        (a.name ?? `#${a.id}`).localeCompare(b.name ?? `#${b.id}`),
    )
    .slice(0, Math.max(0, limit));
}

/**
 * Adiciona um item à composição respeitando os limites do Combinador:
 * 6 slots, sem repetição e uma bota no máximo. Retorna o mesmo array quando a
 * adição é inválida (o chamador pode comparar identidade para saber).
 */
export function addCompletionItem(
  current: readonly number[],
  id: number,
  items: readonly AggregateCombinerItem[],
  maxItems = 6,
): number[] {
  if (!Number.isInteger(id) || id <= 0) return [...current];
  if (current.includes(id) || current.length >= maxItems) return [...current];

  const meta = items.find((item) => item.id === id);
  if (!meta) return [...current];
  if (meta.archetype === "movement") {
    const boots = current.filter((x) => items.find((item) => item.id === x)?.archetype === "movement");
    if (boots.length >= 1) return [...current];
  }

  return [...current, id];
}

// ── edição por slot (quadro de composição) ───────────────────────────────────

export type SlotRef =
  | { kind: "item"; index: number }
  | { kind: "emblem" }
  | { kind: "talent"; tier: number | null }
  | { kind: "spell" };

export type PickCandidate =
  | { kind: "item"; id: number }
  | { kind: "emblem"; id: number | null }
  | { kind: "talent"; id: number; tier: number | null }
  | { kind: "spell"; name: string | null };

export type ApplyError =
  | "duplicate"
  | "full"
  | "second_boot"
  | "tier_conflict"
  | "unknown_component"
  | "not_applicable";

export const APPLY_ERROR_TEXT: Record<ApplyError, string> = {
  duplicate: "este componente já está na composição",
  full: "os slots estão cheios",
  second_boot: "só uma bota por composição",
  tier_conflict: "este talento é de outro tier",
  unknown_component: "componente sem dados no recorte",
  not_applicable: "slot incompatível",
};

export type ApplyOutcome =
  | { ok: true; pick: CombinerPick }
  | { ok: false; pick: CombinerPick; reason: ApplyError };

export type ApplyContext = {
  items?: readonly AggregateCombinerItem[];
  talents?: readonly AggregateCombinerTalent[];
  maxItems?: number;
};

function validId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function sameIdSet(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length) return false;
  const a = [...new Set(left)].sort((x, y) => x - y);
  const b = [...new Set(right)].sort((x, y) => x - y);
  return a.every((value, index) => value === b[index]);
}

/** A composição ainda é exatamente a build observada? Não herda evidência se mudou. */
export function sameAsObserved(pick: CombinerPick, observed: CombinerPick): boolean {
  return (
    sameIdSet(pick.itemIds, observed.itemIds) &&
    pick.emblemId === observed.emblemId &&
    sameIdSet(pick.talentIds, observed.talentIds) &&
    (pick.spellName ?? "").trim().toLowerCase() === (observed.spellName ?? "").trim().toLowerCase()
  );
}

function tierOfTalent(id: number, talents?: readonly AggregateCombinerTalent[]): number | null {
  return talents?.find((talent) => talent.id === id)?.tier ?? null;
}

/**
 * Por que este candidato não entra neste slot? A UI usa a mesma regra do
 * aplicador para explicar o bloqueio antes do clique.
 */
export function candidateBlockReason(
  pick: CombinerPick,
  target: SlotRef,
  candidate: PickCandidate,
  ctx: ApplyContext = {},
): ApplyError | null {
  const maxItems = ctx.maxItems ?? 6;

  if (candidate.kind === "item") {
    if (!validId(candidate.id)) return "unknown_component";
    if (target.kind !== "item" || !Number.isInteger(target.index) || target.index < 0 || target.index > maxItems) {
      return "not_applicable";
    }
    const replacing = target.index < pick.itemIds.length ? target.index : -1;
    const existing = pick.itemIds.indexOf(candidate.id);
    if (existing >= 0 && existing !== replacing) return "duplicate";
    if (replacing < 0 && pick.itemIds.length >= maxItems) return "full";

    const meta = ctx.items?.find((item) => item.id === candidate.id);
    if (meta?.archetype === "movement") {
      const otherBoot = pick.itemIds.some(
        (id, index) => index !== replacing && ctx.items?.find((item) => item.id === id)?.archetype === "movement",
      );
      if (otherBoot) return "second_boot";
    }
    return null;
  }

  if (candidate.kind === "emblem") {
    if (target.kind !== "emblem") return "not_applicable";
    if (candidate.id != null && !validId(candidate.id)) return "unknown_component";
    return null;
  }

  if (candidate.kind === "talent") {
    if (!validId(candidate.id)) return "unknown_component";
    if (target.kind !== "talent") return "not_applicable";
    const candidateTier = candidate.tier ?? tierOfTalent(candidate.id, ctx.talents);
    if (target.tier != null && candidateTier != null && candidateTier !== target.tier) return "tier_conflict";

    const existingTier = target.tier ?? candidateTier;
    const existingIndex = existingTier == null
      ? -1
      : pick.talentIds.findIndex((id) => tierOfTalent(id, ctx.talents) === existingTier);

    if (pick.talentIds.includes(candidate.id)) {
      return existingIndex >= 0 || target.tier == null ? null : "duplicate";
    }
    if (existingIndex < 0 && pick.talentIds.length >= 3) return "full";
    return null;
  }

  if (target.kind !== "spell") return "not_applicable";
  return null;
}

/** Aplica um candidato no slot escolhido, sem mutar o pick recebido. */
export function applyCandidate(
  pick: CombinerPick,
  target: SlotRef,
  candidate: PickCandidate,
  ctx: ApplyContext = {},
): ApplyOutcome {
  const reason = candidateBlockReason(pick, target, candidate, ctx);
  if (reason) return { ok: false, pick, reason };

  const next: CombinerPick = {
    itemIds: [...pick.itemIds],
    emblemId: pick.emblemId,
    talentIds: [...pick.talentIds],
    spellName: pick.spellName,
  };

  if (candidate.kind === "item" && target.kind === "item") {
    const index = Math.min(target.index, next.itemIds.length);
    if (index < next.itemIds.length) next.itemIds[index] = candidate.id;
    else next.itemIds.push(candidate.id);
    return { ok: true, pick: next };
  }

  if (candidate.kind === "emblem") {
    next.emblemId = candidate.id;
    return { ok: true, pick: next };
  }

  if (candidate.kind === "talent" && target.kind === "talent") {
    const wantedTier = target.tier ?? candidate.tier ?? tierOfTalent(candidate.id, ctx.talents);
    const index = wantedTier == null
      ? next.talentIds.findIndex((id) => id === candidate.id)
      : next.talentIds.findIndex((id) => tierOfTalent(id, ctx.talents) === wantedTier);
    if (index >= 0) next.talentIds[index] = candidate.id;
    else next.talentIds.push(candidate.id);
    return { ok: true, pick: next };
  }

  next.spellName = candidate.kind === "spell" && candidate.name?.trim() ? candidate.name.trim() : null;
  return { ok: true, pick: next };
}

/** Remove o componente do slot, preservando os demais. */
export function removeSlot(
  pick: CombinerPick,
  target: SlotRef,
  talents?: readonly AggregateCombinerTalent[],
): CombinerPick {
  const next: CombinerPick = {
    itemIds: [...pick.itemIds],
    emblemId: pick.emblemId,
    talentIds: [...pick.talentIds],
    spellName: pick.spellName,
  };

  if (target.kind === "item") {
    if (target.index >= 0 && target.index < next.itemIds.length) next.itemIds.splice(target.index, 1);
    return next;
  }
  if (target.kind === "emblem") {
    next.emblemId = null;
    return next;
  }
  if (target.kind === "spell") {
    next.spellName = null;
    return next;
  }
  if (target.tier == null) {
    next.talentIds = [];
    return next;
  }
  next.talentIds = next.talentIds.filter((id) => tierOfTalent(id, talents) !== target.tier);
  return next;
}

// ── combinações observadas de emblema + talentos + feitiço ───────────────────

export type ObservedRuneTalent = { id: number; name: string | null; tier: number | null; icon: string | null };
export type ObservedRuneCombo = {
  key: string;
  emblemId: number | null;
  emblemName: string | null;
  emblemIcon: string | null;
  talents: ObservedRuneTalent[];
  spellName: string | null;
  spellIcon: string | null;
  builds: number;
  share: number;
};

/**
 * Agrupa o conjunto EXATO de emblema + talentos + feitiço que aparece nas
 * builds observadas. Não combina peças de builds diferentes: uma combinação
 * só é chamada de observada quando apareceu junta.
 */
export function observedRuneCombos(builds: readonly Build[], limit = 4): ObservedRuneCombo[] {
  const total = builds.length;
  if (!total) return [];

  const acc = new Map<string, ObservedRuneCombo>();
  for (const build of builds) {
    const talents: ObservedRuneTalent[] = [];
    for (const talent of build.talents ?? []) {
      if (!validId(talent?.id)) continue;
      if (talents.some((row) => row.id === talent.id)) continue;
      talents.push({
        id: talent.id,
        name: talent.name ?? null,
        tier: talent.tier ?? null,
        icon: talent.icon ?? null,
      });
    }
    talents.sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99) || a.id - b.id);

    const emblemId = validId(build.emblem?.id) ? build.emblem.id : null;
    const spellName = build.spell?.name?.trim() ? build.spell.name.trim() : null;
    const spellIcon = build.spell?.icon ?? null;

    if (emblemId == null && talents.length === 0 && spellName == null) continue;

    const key = `${emblemId ?? ""}|${talents.map((t) => t.id).join("-")}|${(spellName ?? "").toLowerCase()}`;
    const previous = acc.get(key);
    if (previous) {
      previous.builds += 1;
      previous.share = previous.builds / total;
    } else {
      acc.set(key, {
        key,
        emblemId,
        emblemName: build.emblem?.name ?? null,
        emblemIcon: build.emblem?.icon ?? null,
        talents,
        spellName,
        spellIcon,
        builds: 1,
        share: 1 / total,
      });
    }
  }

  return [...acc.values()]
    .sort((a, b) => b.builds - a.builds || b.talents.length - a.talents.length || a.key.localeCompare(b.key))
    .slice(0, Math.max(0, limit));
}

// ── composição montada pelo maior índice relativo ───────────────────────────

function componentValue(row: { value_pp?: number | null; value_pp_est?: number | null }): number {
  const value = row.value_pp ?? row.value_pp_est;
  return value != null && Number.isFinite(value) ? value : -Infinity;
}

/**
 * Monta uma composição escolhendo os componentes de maior valor no recorte.
 * É uma ação explícita do sistema, não uma build observada: o chamador deve
 * gravar `provenance: "custom"` e dizer que é índice relativo, não recomendação.
 */
export function maxIndexPick(
  combiner: AggregateCombiner | null | undefined,
  seed?: CombinerPick | null,
): CombinerPick {
  if (!combiner) {
    return seed
      ? { ...seed, itemIds: [...seed.itemIds], talentIds: [...seed.talentIds] }
      : { itemIds: [], emblemId: null, talentIds: [], spellName: null };
  }

  const items: number[] = [];
  const itemRows = [...combiner.items]
    .filter((row) => validId(row.id))
    .sort(
      (a, b) =>
        componentValue(b) - componentValue(a) ||
        (b.adoption ?? -Infinity) - (a.adoption ?? -Infinity) ||
        (a.name ?? "").localeCompare(b.name ?? ""),
    );

  for (const row of itemRows) {
    if (items.length >= 6) break;
    if (items.includes(row.id)) continue;
    if (row.archetype === "movement") {
      const hasBoot = items.some((id) => combiner.items.find((item) => item.id === id)?.archetype === "movement");
      if (hasBoot) continue;
    }
    items.push(row.id);
  }

  const tiers = [...new Set(combiner.talents.map((talent) => talent.tier).filter((tier): tier is number => tier != null))]
    .sort((a, b) => a - b);
  const talentIds: number[] = [];
  for (const tier of tiers.slice(0, 3)) {
    const best = [...combiner.talents]
      .filter((talent) => talent.tier === tier && validId(talent.id))
      .sort((a, b) => componentValue(b) - componentValue(a) || (b.adoption ?? -Infinity) - (a.adoption ?? -Infinity))[0];
    if (best) talentIds.push(best.id);
  }

  const bestSpell = [...combiner.spells]
    .filter((spell) => spell.name?.trim())
    .sort((a, b) => componentValue(b) - componentValue(a) || (b.adoption ?? -Infinity) - (a.adoption ?? -Infinity))[0];

  const seedEmblem = seed?.emblemId != null && validId(seed.emblemId) ? seed.emblemId : null;
  const bestEmblem = [...combiner.emblems]
    .filter((emblem: AggregateCombinerEmblem) => validId(emblem.emblem_id))
    .sort((a, b) => (b.adoption ?? -Infinity) - (a.adoption ?? -Infinity))[0];

  return {
    itemIds: items,
    emblemId: seedEmblem ?? bestEmblem?.emblem_id ?? null,
    talentIds,
    spellName: bestSpell?.name?.trim() ?? seed?.spellName ?? null,
  };
}

/** Rótulo de evidência para componentes que vêm do catálogo observado. */
export function optionEvidence(source: AggregateValueSource | undefined | null): AggregateValueSource {
  return source ?? "none";
}
