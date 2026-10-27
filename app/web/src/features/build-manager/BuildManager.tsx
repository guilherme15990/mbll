import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, Crosshair, Info, RotateCcw, Sparkles, Swords,
} from "lucide-react";
import { orderBuildsByLift } from "@radar/proprietary-engine";
import {
  LANES, cx, num, pct, useBuilds, useBuildsAggregate, useHero, useHeroLanes,
  type AggregateCombiner, type AggregateValueSource, type Build,
} from "../../shared/api";
import {
  APPLY_ERROR_TEXT, applyCandidate, candidateBlockReason, completionSuggestions, coreItems,
  observedRuneCombos, pickFromObservedBuild, removeSlot, sameAsObserved,
  type ApplyError, type CompletionSuggestion, type CoreItem, type ObservedRuneCombo,
  type PickCandidate, type SlotRef,
} from "../../shared/domain/buildManager";
import {
  LOADOUT_VERSION, decodeLoadout, encodeLoadout, loadoutHref, signatureOfPick, type Loadout,
} from "../../shared/domain/loadout";
import {
  TOTAL_ITEM_SLOTS, scoreCombination, type CombinerPick, type CombinerScore,
} from "../../shared/domain/combiner";
import {
  Avatar, CtxBar, Empty, ErrBox, FreshLine, GhostNote, Loading, SectionTitle, TierBadge,
} from "../../shared/ui";
import HeroPicker from "../../shared/ui/patterns/HeroPicker";
import ItemComposer, {
  type ComposerItem, type ComposerSpell,
} from "../../shared/ui/patterns/ItemComposer";
import { NeedsLane } from "../../shared/ui/patterns/NeedsRankLane";
import { liftPp, liftTone } from "../../shared/format";
import BuildBoard from "./BuildBoard";
import CandidateRail from "./CandidateRail";
import CompositionPower from "./CompositionPower";
import RuneCombos from "./RuneCombos";
import SlotPicker, {
  type PickerEmblem, type PickerItem, type PickerSpell, type PickerTalent,
} from "./SlotPicker";

/**
 * Build Management (ADR-047) — `/build` e `/build/:id`.
 *
 * A tela é uma superfície de DECISÃO:
 * 1. núcleo observado (descritivo, não ordem de compra);
 * 2. quadro editável de 6 itens + emblema + 3 talentos + feitiço, com o
 *    índice relativo acima das combinações exatas observadas;
 * 3. biblioteca de equipamentos (candidatos com lastro) abaixo do quadro;
 * 4. catálogo de equipamentos em modal: recomendados → categorias → feitiços.
 *
 * Honestidade estrutural:
 * - build observada, núcleo e combinações vêm de `useBuilds`;
 * - pesos e índice vêm de `useBuildsAggregate` → `scoreCombination`;
 * - qualquer peça trocada torna a composição `custom`; win/pick/lift da base
 *   não são herdados;
 * - lift da fonte é fração 0–1 e só aparece em pp via `liftPp`.
 */

type BuildRow = {
  build: Build;
  pick: CombinerPick;
  position: number;
  signature: string;
  score: CombinerScore;
};

function CoreCard({ item, total }: { item: CoreItem; total: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-line bg-abyss/30 p-2.5">
      {item.icon ? (
        <img src={item.icon} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-line bg-panel2 object-cover" loading="lazy" />
      ) : (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-abyss text-[9px] num text-mist">
          #{item.id}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foam">{item.name ?? `Item #${item.id}`}</p>
        <p className="text-[10px] text-mist">
          {item.builds} de {total} builds · {pct(item.share, 0)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="num text-xs font-bold text-foam">{pct(item.winMedian)}</p>
        <p className="text-[9px] text-mist">win mediano</p>
      </div>
    </div>
  );
}

function BaseChip({ row, selected, onSelect }: { row: BuildRow; selected: boolean; onSelect: () => void }) {
  const lift = row.build.lift_vs_most_used;
  const tone = liftTone(lift);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title="Usar esta build observada como ponto de partida do quadro"
      className={cx(
        "min-w-[148px] shrink-0 rounded-xl border px-2.5 py-2 text-left transition-colors",
        selected ? "border-gold/60 bg-gold/10" : "border-line bg-abyss/35 hover:border-gold/35",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={cx(
          "grid h-5 w-5 place-items-center rounded border text-[9px] font-bold",
          selected ? "border-gold/40 bg-gold/15 text-gold" : "border-line bg-panel2 text-mist",
        )}>
          B{row.position + 1}
        </span>
        <span className="num text-sm font-black text-foam">{row.score.index == null ? "—" : row.score.index.toFixed(1)}</span>
      </span>
      <span className="mt-1 flex items-center gap-2 text-[10px] text-mist">
        <span>win {pct(row.build.win)}</span>
        <span>·</span>
        <span>pick {pct(row.build.pick, 1)}</span>
      </span>
      <span className={cx(
        "mt-0.5 block text-[10px] font-semibold",
        tone === "positive" ? "text-emerald-300" : tone === "negative" ? "text-rose-300" : "text-mist",
      )}>
        {tone === "unknown"
          ? "lift em aberto"
          : tone === "neutral"
            ? `sem diferença relevante (${liftPp(lift)})`
            : `${liftPp(lift)} vs mais usada`}
      </span>
    </button>
  );
}

export default function BuildManager() {
  const params = useParams();
  const [sp, setSp] = useSearchParams();

  const hero = params.id ?? sp.get("hero") ?? "";
  const rank = sp.get("rank") ?? "mythic";
  const window = sp.get("window") ?? "7";
  const laneParam = sp.get("lane");
  const lane = laneParam && (LANES as readonly string[]).includes(laneParam) ? laneParam : "";
  const heroId = Number.parseInt(hero, 10);

  const heroQuery = useHero(hero || null, rank, window);
  const lanesQuery = useHeroLanes(rank);
  const lanesMap = lanesQuery.data?.data as Record<string, string[]> | undefined;
  const heroLanes = useMemo(
    () => (hero && lanesMap ? (lanesMap[hero] ?? []) : []).filter((l) => (LANES as readonly string[]).includes(l)),
    [hero, lanesMap],
  );

  // Sem ?lane=, a primeira rota mapeada do herói assume (visível e trocável).
  useEffect(() => {
    if (!hero || sp.get("lane") != null || !lanesQuery.isSuccess || heroLanes.length === 0) return;
    const next = new URLSearchParams(sp);
    next.set("lane", heroLanes[0]);
    setSp(next, { replace: true });
  }, [hero, sp, setSp, lanesQuery.isSuccess, heroLanes]);

  const buildsQuery = useBuilds(hero || null, rank, lane);
  // O agregado só roda com herói+lane: sem isso, nenhum peso é montado.
  const aggregateQuery = useBuildsAggregate(rank, hero && lane ? lane : "", window, 10);

  const builds = buildsQuery.data?.data;
  const combiner = aggregateQuery.data?.combiner;
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

  // Catálogo do modal: pesos do agregado primeiro; o que só apareceu nas
  // builds entra com evidência `none` (nunca com valor 0).
  const pickerItems = useMemo<PickerItem[]>(() => {
    const map = new Map<number, PickerItem>();
    for (const item of combiner?.items ?? []) {
      map.set(item.id, {
        id: item.id,
        name: item.name,
        icon: item.icon,
        archetype: item.archetype,
        archetypeLabel: item.archetype_label,
        evidence: item.value_pp_source,
        valuePp: item.value_pp,
        valuePpEst: item.value_pp_est,
        adoption: item.adoption,
        builds: item.builds,
        reason: item.value_reason,
      });
    }

    const observed = new Map<number, { name: string | null; icon: string | null; builds: number }>();
    for (const build of builds ?? []) {
      const seen = new Set<number>();
      for (const item of build.items ?? []) {
        if (typeof item.id !== "number" || !Number.isInteger(item.id) || item.id <= 0 || seen.has(item.id)) continue;
        seen.add(item.id);
        const previous = observed.get(item.id);
        observed.set(item.id, {
          name: previous?.name ?? item.name ?? null,
          icon: previous?.icon ?? item.icon ?? null,
          builds: (previous?.builds ?? 0) + 1,
        });
      }
    }
    for (const [id, row] of observed) {
      const existing = map.get(id);
      if (existing) {
        map.set(id, {
          ...existing,
          name: existing.name ?? row.name,
          icon: existing.icon ?? row.icon,
          builds: Math.max(existing.builds, row.builds),
        });
      } else {
        map.set(id, {
          id,
          name: row.name,
          icon: row.icon,
          evidence: "none",
          valuePp: null,
          valuePpEst: null,
          adoption: totalBuilds ? row.builds / totalBuilds : null,
          builds: row.builds,
          reason: null,
        });
      }
    }
    return [...map.values()];
  }, [combiner, builds, totalBuilds]);

  const pickerEmblems = useMemo<PickerEmblem[]>(() => {
    const map = new Map<number, PickerEmblem>();
    for (const emblem of combiner?.emblems ?? []) {
      map.set(emblem.emblem_id, {
        id: emblem.emblem_id,
        name: emblem.name,
        icon: emblem.icon,
        evidence: emblem.value_pp_source ?? "descriptive",
        adoption: emblem.adoption,
        builds: emblem.builds,
      });
    }

    const observed = new Map<number, { name: string | null; icon: string | null; builds: number }>();
    for (const build of builds ?? []) {
      const id = build.emblem?.id;
      if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) continue;
      const previous = observed.get(id);
      observed.set(id, {
        name: previous?.name ?? build.emblem?.name ?? null,
        icon: previous?.icon ?? build.emblem?.icon ?? null,
        builds: (previous?.builds ?? 0) + 1,
      });
    }
    for (const [id, row] of observed) {
      const existing = map.get(id);
      if (existing) {
        map.set(id, { ...existing, name: existing.name ?? row.name, icon: existing.icon ?? row.icon, builds: Math.max(existing.builds, row.builds) });
      } else {
        map.set(id, {
          id,
          name: row.name,
          icon: row.icon,
          evidence: "descriptive",
          adoption: totalBuilds ? row.builds / totalBuilds : null,
          builds: row.builds,
        });
      }
    }
    return [...map.values()];
  }, [combiner, builds, totalBuilds]);

  const pickerTalents = useMemo<PickerTalent[]>(() => {
    const map = new Map<number, PickerTalent>();
    for (const talent of combiner?.talents ?? []) {
      map.set(talent.id, {
        id: talent.id,
        name: talent.name,
        tier: talent.tier,
        icon: talent.icon,
        desc: talent.desc,
        evidence: talent.value_pp_source,
        valuePp: talent.value_pp,
        valuePpEst: talent.value_pp_est,
        adoption: talent.adoption,
        builds: talent.builds,
        reason: talent.value_reason,
      });
    }

    const observed = new Map<number, { name: string | null; tier: number | null; icon: string | null; desc: string | null; builds: number }>();
    for (const build of builds ?? []) {
      for (const talent of build.talents ?? []) {
        if (typeof talent.id !== "number" || !Number.isInteger(talent.id) || talent.id <= 0) continue;
        const previous = observed.get(talent.id);
        observed.set(talent.id, {
          name: previous?.name ?? talent.name ?? null,
          tier: previous?.tier ?? talent.tier ?? null,
          icon: previous?.icon ?? talent.icon ?? null,
          desc: previous?.desc ?? talent.desc ?? null,
          builds: (previous?.builds ?? 0) + 1,
        });
      }
    }
    for (const [id, row] of observed) {
      const existing = map.get(id);
      if (existing) {
        map.set(id, {
          ...existing,
          name: existing.name ?? row.name,
          tier: existing.tier ?? row.tier,
          icon: existing.icon ?? row.icon,
          desc: existing.desc ?? row.desc,
          builds: Math.max(existing.builds, row.builds),
        });
      } else {
        map.set(id, {
          id,
          name: row.name,
          tier: row.tier,
          icon: row.icon,
          desc: row.desc,
          evidence: "none",
          valuePp: null,
          valuePpEst: null,
          adoption: totalBuilds ? row.builds / totalBuilds : null,
          builds: row.builds,
          reason: null,
        });
      }
    }
    return [...map.values()];
  }, [combiner, builds, totalBuilds]);

  const pickerSpells = useMemo<PickerSpell[]>(() => {
    const map = new Map<string, PickerSpell>();
    for (const spell of combiner?.spells ?? []) {
      if (!spell.name?.trim()) continue;
      map.set(spell.name.trim().toLowerCase(), {
        name: spell.name.trim(),
        icon: spell.icon,
        desc: spell.desc,
        evidence: spell.value_pp_source,
        valuePp: spell.value_pp,
        valuePpEst: spell.value_pp_est,
        adoption: spell.adoption,
        builds: spell.builds,
        reason: spell.value_reason,
      });
    }

    const observed = new Map<string, { name: string; icon: string | null; builds: number }>();
    for (const build of builds ?? []) {
      const name = build.spell?.name?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const previous = observed.get(key);
      observed.set(key, {
        name: previous?.name ?? name,
        icon: previous?.icon ?? build.spell?.icon ?? null,
        builds: (previous?.builds ?? 0) + 1,
      });
    }
    for (const [key, row] of observed) {
      const existing = map.get(key);
      if (existing) {
        map.set(key, { ...existing, icon: existing.icon ?? row.icon, builds: Math.max(existing.builds, row.builds) });
      } else {
        map.set(key, {
          name: row.name,
          icon: row.icon,
          evidence: "none",
          valuePp: null,
          valuePpEst: null,
          adoption: totalBuilds ? row.builds / totalBuilds : null,
          builds: row.builds,
          reason: null,
        });
      }
    }
    return [...map.values()];
  }, [combiner, builds, totalBuilds]);

  const boardItems = useMemo(
    () => pickerItems.map((item) => ({ ...item, core: coreIds.has(item.id) })),
    [pickerItems, coreIds],
  );

  const [showAllBases, setShowAllBases] = useState(false);
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

  const currentLoadout = selected ? buildLoadoutFor(pick) : null;
  const prepareHref = currentLoadout ? loadoutHref(currentLoadout) : "";
  const combinerHref = currentLoadout
    ? `/builds?${new URLSearchParams({
        view: "combiner",
        hero,
        lane,
        rank,
        window,
        l: encodeLoadout(currentLoadout),
      }).toString()}`
    : "";
  const heroHref = `/hero/${hero}?${new URLSearchParams({ tab: "builds", rank, window, lane }).toString()}`;
  const draftHref = `/draft?${new URLSearchParams({ hero, rank, window, lane }).toString()}`;
  const matchupsHref = `/confrontos?${new URLSearchParams({ hero, rank, window, lane }).toString()}`;

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
    if (full) {
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

  const heroData = heroQuery.data?.data;
  const heroName = heroData?.name ?? (hero ? `Herói #${hero}` : "—");
  const visibleBases = showAllBases ? rows : rows.slice(0, 4);

  return (
    <section className="space-y-5 animate-fadeIn motion-reduce:animate-none" data-testid="build-manager">
      <CtxBar
        id="BDL"
        name="Build Management — build do herói"
        question="Qual composição eu levo e quanto ela ganha da referência?"
        status="observado + índice relativo"
        formula="índice = base + pontos_por_pp × média(contraste do componente no mesmo herói+lane+rank, encolhido por n/(n+K)); núcleo = itens que mais se repetem nas builds observadas; lift da fonte é fração 0–1 e aparece em pontos percentuais."
        prdRef="ADR-030 · ADR-044 · ADR-047"
      />

      {!hero ? (
        <>
          <SectionTitle
            kicker="Build Management"
            title="Escolha um herói para começar"
            subtitle="A tela recebe o herói da sidebar ou da URL. Sem herói, nada de build é buscado."
          />
          <Empty
            title="Nenhum herói em foco"
            hint="Selecione um herói abaixo (ou use a busca da sidebar). Depois escolha a lane: o núcleo, as builds e as sugestões mudam com o recorte."
          />
          <HeroPicker hero={null} onPick={pickHero} />
        </>
      ) : (
        <>
          <div className="rounded-2xl border border-line bg-panel p-4 md:p-5 space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
              <Avatar src={heroData?.head ?? null} name={heroName} size={64} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[22px] md:text-[28px] leading-tight font-extrabold tracking-tight text-foam">{heroName}</h1>
                  {heroData && <TierBadge tier={heroData.tier} />}
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-gold/40 bg-gold/10 text-gold">
                    Build Management
                  </span>
                </div>
                {heroData ? (
                  <p className="text-[11px] text-mist">
                    Força θ̂ <b className="num text-gold">{num(heroData.wrAdj, 3)}</b> · win {pct(heroData.win)} · pick {pct(heroData.pick)} · ban {pct(heroData.ban)}
                  </p>
                ) : heroQuery.isLoading ? (
                  <p className="text-[11px] text-mist" role="status">carregando força do herói…</p>
                ) : (
                  <p className="text-[11px] text-amber-200">Sem detalhe do herói neste recorte; as builds continuam tentando carregar.</p>
                )}
              </div>
              <Link
                to={heroHref}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-line bg-panel2 text-xs font-semibold text-mist hover:text-foam transition-colors min-h-[44px]"
              >
                Abrir ficha <ArrowRight size={13} />
              </Link>
            </div>

            <details className="rounded-xl border border-line bg-abyss/30 px-3 py-2">
              <summary className="cursor-pointer text-[11px] font-semibold text-foam/90">Trocar herói</summary>
              <div className="pt-2">
                <HeroPicker hero={hero} onPick={pickHero} compact />
              </div>
            </details>

            <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Escolha a lane da build">
              <span className="lbl text-[10px]">Lane</span>
              {LANES.map((l) => {
                const mapped = heroLanes.includes(l);
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => pickLane(l)}
                    aria-pressed={lane === l}
                    title={mapped ? "Rota mapeada do herói" : "Rota sem mapeamento do herói"}
                    className={cx(
                      "px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all min-h-[40px] inline-flex items-center gap-1.5",
                      lane === l ? "bg-gold text-abyss shadow-sm" : "bg-abyss/60 text-mist hover:text-foam border border-line",
                    )}
                  >
                    {l}
                    {mapped && <span className={cx("w-1 h-1 rounded-full", lane === l ? "bg-abyss" : "bg-gold")} aria-hidden="true" />}
                  </button>
                );
              })}
              <span className="text-[10px] text-mist/70">• ponto = rota mapeada do herói</span>
            </div>
          </div>

          {!lane ? (
            <NeedsLane onPick={pickLane} />
          ) : (
            <>
              {buildsQuery.isLoading && <Loading rows={5} />}

              {buildsQuery.isError && (
                <ErrBox
                  onRetry={() => buildsQuery.refetch()}
                  message={`Não foi possível carregar as builds de ${heroName} na lane ${lane.toUpperCase()} agora.`}
                />
              )}

              {!buildsQuery.isLoading && !buildsQuery.isError && builds != null && (
                <>
                  {builds.length === 0 ? (
                    <Empty
                      title="Nenhuma build observada neste recorte"
                      hint={`Sem volume para ${heroName} + ${lane.toUpperCase()} + ${rank.toUpperCase()}. Experimente outra lane ou outro elo.`}
                    />
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <FreshLine
                          stale={aggregateQuery.data?.context.stale}
                          ageMs={aggregateQuery.data?.context.age_ms}
                        />
                        <span className="text-[11px] text-mist">
                          {rank.toUpperCase()} · {lane.toUpperCase()} · {totalBuilds} build{totalBuilds === 1 ? "" : "s"} observada{totalBuilds === 1 ? "" : "s"}
                        </span>
                        <span className="ml-auto text-[10px] text-mist">
                          {pick.itemIds.length}/{TOTAL_ITEM_SLOTS} itens · {sameAsBase ? "base observada" : "composição sua"}
                        </span>
                      </div>

                      <SectionTitle
                        kicker="1 · Núcleo"
                        title={stableCore ? `Núcleo de ${heroName} na ${lane.toUpperCase()}` : "Itens mais frequentes"}
                        subtitle="Itens que mais se repetem nas builds observadas. Presença é descritiva; não é ordem de compra nem prova de causa."
                      />
                      <div className="card p-3.5 bg-panel border-line space-y-2.5">
                        {core.length ? (
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {core.map((item) => <CoreCard key={item.id} item={item} total={totalBuilds} />)}
                          </div>
                        ) : (
                          <GhostNote>As builds deste recorte não trazem id de item — não há núcleo para contar.</GhostNote>
                        )}
                        <p className="text-[10px] text-mist/80">
                          Contagem por build (item repetido na mesma build conta uma vez). {stableCore
                            ? "Itens com 50% ou mais de presença formam o núcleo."
                            : "Nenhum item passa de 50% das builds: a lista mostra só os mais frequentes."}
                        </p>
                      </div>

                      <SectionTitle
                        kicker="2 · Sua composição"
                        title="Quadro para montar e testar"
                        subtitle="Comece pela base observada ou pelo núcleo. Clique em qualquer slot para abrir o seletor; o poder relativo muda ao vivo."
                        right={<span className="text-[11px] text-mist">{TOTAL_ITEM_SLOTS} itens · 3 talentos · 1 emblema · 1 feitiço</span>}
                      />

                      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
                        <div className="card p-3.5 bg-panel border-line space-y-3">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div>
                              <p className="lbl text-[10px]">Ponto de partida</p>
                              <p className="text-xs font-bold text-foam">Base observada</p>
                              <p className="text-[10px] text-mist">A build do sistema entra preenchida; o quadro é seu para alterar.</p>
                            </div>
                            {!sameAsBase ? (
                              <button
                                type="button"
                                onClick={resetBase}
                                className="inline-flex min-h-[32px] items-center gap-1.5 rounded-xl border border-line bg-panel2 px-2.5 text-[10px] font-semibold text-mist hover:border-gold/40 hover:text-foam"
                              >
                                <RotateCcw size={12} /> Voltar à base
                              </button>
                            ) : (
                              <span className="rounded-full border border-line bg-abyss/50 px-2 py-0.5 text-[10px] text-mist">
                                {rows.length} no recorte
                              </span>
                            )}
                          </div>

                          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Escolher build observada como base">
                            {visibleBases.map((row) => (
                              <BaseChip
                                key={`${row.signature || "build"}-${row.position}`}
                                row={row}
                                selected={selected?.signature === row.signature}
                                onSelect={() => selectBase(row.signature)}
                              />
                            ))}
                          </div>
                          {rows.length > 4 ? (
                            <button
                              type="button"
                              onClick={() => setShowAllBases((value) => !value)}
                              className="text-left text-[10px] font-semibold text-gold hover:underline"
                            >
                              {showAllBases ? "mostrar menos bases" : `ver todas as ${rows.length} bases`}
                            </button>
                          ) : null}

                          {staleBase ? (
                            <p className="rounded-xl border border-amber-300/30 bg-amber-300/5 px-2.5 py-1.5 text-[10px] text-amber-100">
                              A build de <code>?build=</code> não existe mais neste recorte. A primeira base assumiu o
                              quadro; escolha outra acima para corrigir o endereço.
                            </p>
                          ) : null}
                          {contextMismatch ? (
                            <p className="rounded-xl border border-amber-300/30 bg-amber-300/5 px-2.5 py-1.5 text-[10px] text-amber-100">
                              A composição de <code>?l=</code> é de outro herói/lane/elo/janela. Ela foi ignorada e o
                              quadro voltou à base observada.
                            </p>
                          ) : null}
                          {!combiner && aggregateQuery.isLoading ? (
                            <p className="text-[10px] text-mist" role="status">carregando os pesos do recorte…</p>
                          ) : null}
                          {!combiner && aggregateQuery.isError ? (
                            <p className="rounded-xl border border-amber-300/30 bg-amber-300/5 px-2.5 py-1.5 text-[10px] text-amber-100">
                              Os pesos do recorte não carregaram. O quadro e o seletor continuam com o que foi observado
                              nas builds; o índice fica em aberto.
                            </p>
                          ) : null}

                          <BuildBoard
                            pick={pick}
                            items={boardItems}
                            emblems={pickerEmblems}
                            talents={pickerTalents}
                            spells={pickerSpells}
                            onOpen={openPicker}
                            onRemove={(slot) => commitPick(removeSlot(pick, slot, combiner?.talents))}
                          />
                        </div>

                        <div className="space-y-2.5">
                          <CompositionPower
                            score={score}
                            baseScore={baseScore}
                            sameAsBase={sameAsBase}
                            base={selected?.build ?? null}
                          />
                          <RuneCombos
                            combos={combos}
                            pick={pick}
                            onApply={applyRuneCombo}
                          />
                        </div>
                      </div>

                      <SectionTitle
                        kicker="3 · Biblioteca de equipamentos"
                        title="Complete a composição"
                        subtitle="Abaixo do quadro e dos talentos: sugestões com o mesmo lastro do recorte. Clique para preencher o primeiro slot livre ou abra o catálogo para escolher outro item."
                        right={<span className={cx(
                          "text-[11px] font-bold px-2 py-0.5 rounded-full border",
                          full ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-line bg-abyss/50 text-mist",
                        )}>
                          {pick.itemIds.length}/{TOTAL_ITEM_SLOTS} itens
                        </span>}
                      />

                      <div className="card p-3.5 bg-panel border-line">
                        <CandidateRail
                          suggestions={suggestions}
                          coreIds={coreIds}
                          full={full}
                          error={actionError}
                          onPick={addSuggestion}
                          onOpenCatalog={() => openPicker({ kind: "item", index: full ? 0 : pick.itemIds.length })}
                        />
                      </div>

                      <div className="card p-3.5 bg-panel2/40 border-line space-y-2">
                        <p className="flex items-start gap-1.5 text-[11px] text-mist">
                          <Info size={13} className="mt-0.5 shrink-0" />
                          O índice é relativo: não é winrate, não é previsão, não é probabilidade e não é o número
                          interno do jogo. Sugestões não são recomendação. Sem contraste não vira sugestão. O lift é a
                          diferença de win vs a build mais usada, exibida em pontos percentuais.
                        </p>
                        <details className="text-[11px] text-mist">
                          <summary className="cursor-pointer text-foam/90">Como isso foi calculado</summary>
                          <div className="mt-2 space-y-1.5">
                            <p>{combiner?.scale.index_rule ?? "Índice = base + pontos por pp × média dos pesos por contraste. Sem o bloco de componentes, o índice fica em aberto."}</p>
                            <p>
                              <b className="text-foam/90">Núcleo:</b> itens contados uma vez por build observada; a fração usa o total de builds do recorte.
                            </p>
                            <p>
                              <b className="text-foam/90">Sugestões:</b> somente componentes com valor observado ou estimado; item sem contraste não entra.
                              Uma bota no máximo e teto de {TOTAL_ITEM_SLOTS} itens.
                            </p>
                            <p>
                              <b className="text-foam/90">Combinações prontas:</b> só o conjunto exato de emblema + talentos + feitiço que apareceu junto
                              em uma build. Uma build não vira “padrão recorrente”; ela é mostrada como 1 build.
                            </p>
                            <p>
                              <b className="text-foam/90">Editar:</b> a composição deixa de ser a build observada e vira <code>custom</code>.
                              Win/pick/lift da origem não são herdados pela sua versão.
                            </p>
                            <p>Sem N de partidas. Nada aqui é causal.</p>
                          </div>
                        </details>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={prepareHref || heroHref}
                          className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gold text-abyss text-sm font-bold hover:bg-gold-light transition-colors min-h-[44px]"
                        >
                          {sameAsBase ? "Levar esta build para a preparação" : "Levar composição editada para a preparação"} →
                        </Link>
                        <Link
                          to={combinerHref || heroHref}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-line bg-panel2 text-xs font-semibold text-mist hover:text-foam transition-colors min-h-[44px]"
                        >
                          <Swords size={13} /> Abrir no combinador
                        </Link>
                        <Link
                          to={heroHref}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-line bg-panel2 text-xs font-semibold text-mist hover:text-foam transition-colors min-h-[44px]"
                        >
                          Ver ficha
                        </Link>
                      </div>

                      <SectionTitle
                        kicker="4 · Próximo passo"
                        title="Da build para a partida"
                        subtitle="Leve o herói e o contexto para a leitura de confrontos ou para o draft. Nenhum número de composição de time é inventado."
                      />
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <Link
                          to={matchupsHref}
                          className="card p-3.5 bg-panel border-line hover:border-gold/40 transition-colors space-y-1"
                        >
                          <p className="text-xs font-bold text-foam flex items-center gap-1.5"><Swords size={14} className="text-gold" /> Confrontos</p>
                          <p className="text-[11px] text-mist">Quem este herói enfrenta e com qual evidência.</p>
                        </Link>
                        <Link
                          to={draftHref}
                          className="card p-3.5 bg-panel border-line hover:border-gold/40 transition-colors space-y-1"
                        >
                          <p className="text-xs font-bold text-foam flex items-center gap-1.5"><Crosshair size={14} className="text-gold" /> Draft</p>
                          <p className="text-[11px] text-mist">Pressão de pick/ban antes de entrar na rankeada.</p>
                        </Link>
                        <Link
                          to={heroHref}
                          className="card p-3.5 bg-panel border-line hover:border-gold/40 transition-colors space-y-1"
                        >
                          <p className="text-xs font-bold text-foam flex items-center gap-1.5"><Sparkles size={14} className="text-gold" /> Ficha completa</p>
                          <p className="text-[11px] text-mist">Força, confiança, ranks e tempo no mesmo recorte.</p>
                        </Link>
                      </div>

                      <p className="text-[10px] text-mist/70 flex items-start gap-1.5">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                        Itens fora do recorte não aparecem: o seletor só usa o catálogo observado e os pesos da lane.
                        Trocar de lane ou de herói limpa a composição.
                      </p>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      <ItemComposer
        variant="modal"
        open={itemTarget != null}
        onClose={() => { setItemTarget(null); setPickerError(null); }}
        title={itemTarget != null ? `Montar equipamento · slot ${itemTarget + 1}` : "Montar equipamento"}
        targetIndex={itemTarget ?? 0}
        items={pickerItems}
        recommended={suggestions}
        value={pick.itemIds}
        onPick={applyItemAt}
        onRemove={removeItemAt}
        max={TOTAL_ITEM_SLOTS}
        blockReason={itemBlockReason}
        spells={pickerSpells}
        spell={pick.spellName}
        onPickSpell={applySpell}
        spellBlockReason={spellBlockReason}
      />

      <SlotPicker
        open={pickerTarget}
        pick={pick}
        items={pickerItems}
        emblems={pickerEmblems}
        talents={pickerTalents}
        spells={pickerSpells}
        error={pickerError}
        blocked={blockedForPicker}
        onApply={applyToSlot}
        onRemove={removeFromSlot}
        onClose={() => { setPickerTarget(null); setPickerError(null); }}
      />
    </section>
  );
}
