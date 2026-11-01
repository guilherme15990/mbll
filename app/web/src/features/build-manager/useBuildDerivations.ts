import { useEffect, useMemo } from "react";
import type { SetURLSearchParams } from "react-router-dom";
import { orderBuildsByLift } from "@radar/engine";
import type { AggregateCombiner, Build } from "../../shared/api";
import {
  completionSuggestions,
  coreItems,
  observedRuneCombos,
  pickFromObservedBuild,
  sameAsObserved,
  type CompletionSuggestion,
  type CoreItem,
  type ObservedRuneCombo,
} from "../../shared/domain/buildManager";
import { decodeLoadout, signatureOfPick } from "../../shared/domain/loadout";
import { TOTAL_ITEM_SLOTS, scoreCombination, type CombinerPick, type CombinerScore } from "../../shared/domain/combiner";

/** Item do quadro: a build observada materializada no mesmo pick do Combinador. */
export type BuildRow = {
  build: Build;
  pick: CombinerPick;
  position: number;
  signature: string;
  score: CombinerScore;
};

export type BuildDerivations = {
  rows: BuildRow[];
  core: CoreItem[];
  coreIds: Set<number>;
  totalBuilds: number;
  stableCore: boolean;
  selected: BuildRow | null;
  staleBase: boolean;
  pick: CombinerPick;
  sameAsBase: boolean;
  baseScore: CombinerScore | null;
  score: CombinerScore;
  full: boolean;
  combos: ObservedRuneCombo[];
  suggestions: CompletionSuggestion[];
  contextMismatch: boolean;
};

/**
 * Derivações da tela `/build` (ADR-047): base observada ordenada por lift, o
 * núcleo descritivo, a seleção endereçável (`?build=`) e a composição editada
 * (`?l=`) com validação de contexto (herói/lane/elo/janela).
 *
 * Honestidade: `score` é índice relativo do Combinador, nunca probabilidade; a
 * primeira base assume o endereço quando não há `?build=`. Extraído de
 * `BuildManager.tsx` (ADR-041: teto de 300 linhas).
 */
export function useBuildDerivations({
  builds,
  combiner,
  sp,
  setSp,
  heroId,
  lane,
  rank,
  window,
}: {
  builds: readonly Build[] | undefined;
  combiner: AggregateCombiner | undefined;
  sp: URLSearchParams;
  setSp: SetURLSearchParams;
  heroId: number;
  lane: string;
  rank: string;
  window: string;
}): BuildDerivations {
  const ordered = useMemo(() => orderBuildsByLift([...(builds ?? [])]), [builds]);
  const rows: BuildRow[] = useMemo(
    () =>
      ordered.map((build, position) => {
        const pick = pickFromObservedBuild(build);
        return { build, pick, position, signature: signatureOfPick(pick), score: scoreCombination(pick, combiner) };
      }),
    [ordered, combiner],
  );

  const core = useMemo(() => coreItems(builds ?? [], 6), [builds]);
  const coreIds = useMemo(() => new Set(core.map((item) => item.id)), [core]);
  const totalBuilds = builds?.length ?? 0;
  const stableCore = core.some((item) => item.share >= 0.5);

  const selectedRef = sp.get("build");
  const selected = rows.find((row) => row.signature === selectedRef) ?? rows[0] ?? null;
  const staleBase = !!selectedRef && !rows.some((row) => row.signature === selectedRef);

  // Primeira build assume o endereço quando não há `?build=` (F5 e link compartilhado).
  useEffect(() => {
    if (!selected || sp.get("build")) return;
    const next = new URLSearchParams(sp);
    next.set("build", selected.signature);
    setSp(next, { replace: true });
  }, [selected, sp, setSp]);

  const corePick: CombinerPick = useMemo(
    () => ({
      itemIds: core.map((item) => item.id).slice(0, TOTAL_ITEM_SLOTS),
      emblemId: null,
      talentIds: [],
      spellName: null,
    }),
    [core],
  );
  const basePick = selected?.pick ?? corePick;

  // A composição editada vive na URL (`?l=`), com validação de contexto.
  const loadoutCode = sp.get("l");
  const decodedLoadout = useMemo(() => (loadoutCode ? decodeLoadout(loadoutCode) : null), [loadoutCode]);
  const urlPick = useMemo(() => {
    if (!decodedLoadout?.ok || !Number.isInteger(heroId) || heroId <= 0 || !lane) return null;
    const loadout = decodedLoadout.loadout;
    if (loadout.heroId !== heroId || loadout.lane !== lane || loadout.rank !== rank || loadout.window !== window) return null;
    return loadout.pick;
  }, [decodedLoadout, heroId, lane, rank, window]);
  const contextMismatch = !!loadoutCode && urlPick == null;

  const pick = urlPick ?? basePick;
  const sameAsBase = selected ? sameAsObserved(pick, selected.pick) : false;
  const baseScore = selected ? scoreCombination(selected.pick, combiner) : null;
  const score = scoreCombination(pick, combiner);
  const full = pick.itemIds.length >= TOTAL_ITEM_SLOTS;

  const combos = useMemo(() => observedRuneCombos(builds ?? [], 5), [builds]);
  const suggestions: CompletionSuggestion[] = useMemo(
    () => (combiner ? completionSuggestions(combiner.items, pick, [], 8) : []),
    [combiner, pick],
  );

  return {
    rows,
    core,
    coreIds,
    totalBuilds,
    stableCore,
    selected,
    staleBase,
    pick,
    sameAsBase,
    baseScore,
    score,
    full,
    combos,
    suggestions,
    contextMismatch,
  };
}
