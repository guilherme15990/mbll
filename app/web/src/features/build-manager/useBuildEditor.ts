import { useMemo, useState } from "react";
import type { SetURLSearchParams } from "react-router-dom";
import type { AggregateCombiner } from "../../shared/api";
import {
  APPLY_ERROR_TEXT,
  applyCandidate,
  candidateBlockReason,
  removeSlot,
  sameAsObserved,
  type ApplyError,
  type ObservedRuneCombo,
  type PickCandidate,
  type SlotRef,
} from "../../shared/domain/buildManager";
import { LOADOUT_VERSION, encodeLoadout, type Loadout } from "../../shared/domain/loadout";
import { TOTAL_ITEM_SLOTS, type CombinerPick } from "../../shared/domain/combiner";
import type { ComposerItem, ComposerSpell } from "../../shared/ui/patterns/ItemComposer";
import type { BuildRow } from "./useBuildDerivations";

/**
 * Edição do quadro do Build Management (ADR-047): a MESMA regra do domínio
 * (`applyCandidate`/`removeSlot`) aplicada ao `CombinerPick`, mais a escrita na
 * URL.
 *
 * Honestidade estrutural: qualquer peça trocada grava `provenance: "custom"` e
 * `observedItems` conta só o que veio da base — a composição editada NÃO herda
 * win/pick/lift da build observada. Trocar herói/lane/elo ou a base limpa a
 * composição editada (`?l=`) e a seleção de base (`?build=`). Extraído de
 * `BuildManager.tsx` (ADR-041: teto de 300 linhas).
 */
export function useBuildEditor({
  sp,
  setSp,
  pick,
  selected,
  combiner,
  heroId,
  lane,
  rank,
  window,
}: {
  sp: URLSearchParams;
  setSp: SetURLSearchParams;
  pick: CombinerPick;
  selected: BuildRow | null;
  combiner: AggregateCombiner | undefined;
  heroId: number;
  lane: string;
  rank: string;
  window: string;
}) {
  const [pickerTarget, setPickerTarget] = useState<SlotRef | null>(null);
  const [itemTarget, setItemTarget] = useState<number | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const applyCtx = useMemo(
    () => ({ items: combiner?.items ?? [], talents: combiner?.talents ?? [], maxItems: TOTAL_ITEM_SLOTS }),
    [combiner],
  );

  const buildLoadoutFor = (nextPick: CombinerPick): Loadout | null => {
    if (!selected || !Number.isInteger(heroId) || heroId <= 0 || !lane) return null;
    const same = sameAsObserved(nextPick, selected.pick);
    return {
      v: LOADOUT_VERSION,
      heroId,
      lane,
      rank,
      window,
      pick: nextPick,
      provenance: same ? "observed" : "custom",
      observedItems: same
        ? nextPick.itemIds.length
        : nextPick.itemIds.filter((id) => selected.pick.itemIds.includes(id)).length,
      ref: selected.signature,
    };
  };

  const commitPick = (nextPick: CombinerPick) => {
    const next = new URLSearchParams(sp);
    const same = selected ? sameAsObserved(nextPick, selected.pick) : false;
    if (!selected || same) {
      next.delete("l");
    } else {
      const loadout = buildLoadoutFor(nextPick);
      if (loadout) next.set("l", encodeLoadout(loadout));
    }
    setSp(next, { replace: true });
    setPickerError(null);
    setActionError(null);
  };

  const pickHero = (id: string) => {
    const next = new URLSearchParams(sp);
    if (id) next.set("hero", id);
    else next.delete("hero");
    next.delete("lane");
    next.delete("build");
    next.delete("l");
    setSp(next);
    setPickerTarget(null);
  };

  const pickLane = (nextLane: string) => {
    const next = new URLSearchParams(sp);
    next.set("lane", nextLane);
    next.delete("build");
    next.delete("l");
    setSp(next);
    setPickerTarget(null);
  };

  const selectBase = (signature: string) => {
    const next = new URLSearchParams(sp);
    next.set("build", signature);
    next.delete("l");
    setSp(next, { replace: true });
    setPickerTarget(null);
    setActionError(null);
  };

  const resetBase = () => {
    const next = new URLSearchParams(sp);
    next.delete("l");
    setSp(next, { replace: true });
    setActionError(null);
  };

  const openPicker = (target: SlotRef) => {
    if (target.kind === "item") {
      setItemTarget(target.index);
      setPickerTarget(null);
    } else {
      setPickerTarget(target);
      setItemTarget(null);
    }
    setPickerError(null);
    setActionError(null);
  };

  const removeBoardSlot = (target: SlotRef) => commitPick(removeSlot(pick, target, combiner?.talents));

  const applyItemAt = (id: number, index: number) => {
    const outcome = applyCandidate(pick, { kind: "item", index }, { kind: "item", id }, applyCtx);
    if (!outcome.ok) {
      setPickerError(APPLY_ERROR_TEXT[outcome.reason]);
      return;
    }
    commitPick(outcome.pick);
    setItemTarget(null);
  };

  const removeItemAt = (index: number) => {
    commitPick(removeSlot(pick, { kind: "item", index }, combiner?.talents));
    setItemTarget(null);
  };

  const itemBlockReason = (item: ComposerItem, index: number): string | null => {
    const reason = candidateBlockReason(pick, { kind: "item", index }, { kind: "item", id: item.id }, applyCtx);
    return reason ? APPLY_ERROR_TEXT[reason] : null;
  };

  const spellBlockReason = (spell: ComposerSpell): string | null => {
    const reason = candidateBlockReason(pick, { kind: "spell" }, { kind: "spell", name: spell.name }, applyCtx);
    return reason ? APPLY_ERROR_TEXT[reason] : null;
  };

  const applySpell = (name: string | null) => {
    const outcome = applyCandidate(pick, { kind: "spell" }, { kind: "spell", name }, applyCtx);
    if (!outcome.ok) {
      setPickerError(APPLY_ERROR_TEXT[outcome.reason]);
      return;
    }
    commitPick(outcome.pick);
  };

  const applyToSlot = (candidate: PickCandidate) => {
    if (!pickerTarget) return;
    const outcome = applyCandidate(pick, pickerTarget, candidate, applyCtx);
    if (!outcome.ok) {
      setPickerError(APPLY_ERROR_TEXT[outcome.reason]);
      return;
    }
    commitPick(outcome.pick);
    setPickerTarget(null);
  };

  const removeFromSlot = () => {
    if (!pickerTarget) return;
    commitPick(removeSlot(pick, pickerTarget, combiner?.talents));
    setPickerTarget(null);
  };

  const addSuggestion = (id: number) => {
    if (pick.itemIds.length >= TOTAL_ITEM_SLOTS) {
      openPicker({ kind: "item", index: 0 });
      setActionError("A build está cheia. Escolha qual item sai no seletor.");
      return;
    }
    const outcome = applyCandidate(pick, { kind: "item", index: pick.itemIds.length }, { kind: "item", id }, applyCtx);
    if (!outcome.ok) {
      setActionError(APPLY_ERROR_TEXT[outcome.reason]);
      return;
    }
    commitPick(outcome.pick);
  };

  const applyRuneCombo = (combo: ObservedRuneCombo) => {
    commitPick({
      ...pick,
      emblemId: combo.emblemId,
      talentIds: combo.talents.map((talent) => talent.id),
      spellName: combo.spellName,
    });
  };

  const blockedForPicker = (candidate: PickCandidate): ApplyError | null =>
    pickerTarget ? candidateBlockReason(pick, pickerTarget, candidate, applyCtx) : "not_applicable";

  const closePicker = () => {
    setPickerTarget(null);
    setPickerError(null);
  };

  const closeItemComposer = () => {
    setItemTarget(null);
    setPickerError(null);
  };

  return {
    pickerTarget,
    itemTarget,
    pickerError,
    actionError,
    openPicker,
    closePicker,
    closeItemComposer,
    commitPick,
    removeBoardSlot,
    pickHero,
    pickLane,
    selectBase,
    resetBase,
    applyItemAt,
    removeItemAt,
    itemBlockReason,
    spellBlockReason,
    applySpell,
    applyToSlot,
    removeFromSlot,
    addSuggestion,
    applyRuneCombo,
    blockedForPicker,
  };
}
