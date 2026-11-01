/**
 * Build Management — combinações observadas de runas e composição de maior
 * índice (ADR-047).
 *
 * Duas leituras que NÃO são recomendação: (1) o conjunto EXATO de emblema +
 * talentos + feitiço que apareceu junto nas builds observadas; (2) a composição
 * montada pelo maior valor do recorte — ação explícita do sistema, que o
 * chamador grava como `provenance: "custom"`. Puro por construção: só
 * `import type` de fora do domínio.
 */
import type { AggregateCombiner, AggregateCombinerEmblem, AggregateValueSource, Build } from "../api";
import type { CombinerPick } from "./combiner";
import { validId } from "./buildCommon.ts";

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
