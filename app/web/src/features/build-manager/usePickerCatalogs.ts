import { useMemo } from "react";
import type { AggregateCombiner, Build } from "../../shared/api";
import type { PickerEmblem, PickerItem, PickerSpell, PickerTalent } from "./SlotPicker";

export type PickerCatalogs = {
  pickerItems: PickerItem[];
  pickerEmblems: PickerEmblem[];
  pickerTalents: PickerTalent[];
  pickerSpells: PickerSpell[];
};

/**
 * Catálogos do seletor do quadro (ADR-047): itens, emblemas, talentos e
 * feitiços.
 *
 * Os pesos do agregado entram primeiro; o que só apareceu nas builds entra com
 * evidência `none` (nunca com valor 0 — "sem contraste" é ausência, não zero).
 * Extraído de `BuildManager.tsx` (ADR-041: teto de 300 linhas).
 */
export function usePickerCatalogs(
  combiner: AggregateCombiner | undefined,
  builds: readonly Build[] | undefined,
  totalBuilds: number,
): PickerCatalogs {
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

  return { pickerItems, pickerEmblems, pickerTalents, pickerSpells };
}
