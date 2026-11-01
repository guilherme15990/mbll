/**
 * Build Management — edição por slot do quadro de composição (ADR-047).
 *
 * O quadro edita o MESMO `CombinerPick` do Combinador: aplicar/remover um
 * componente num slot, com a mesma regra que explica o bloqueio antes do
 * clique. Puro por construção: só `import type` de fora do domínio.
 */
import type { AggregateCombinerItem, AggregateCombinerTalent } from "../api";
import type { CombinerPick } from "./combiner";
import { validId } from "./buildCommon.ts";

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
