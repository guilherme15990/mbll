import type { AggregateCombinerItem, Build } from "../api";
import type { CombinerPick } from "./combiner";
import { finite } from "./buildCommon.ts";

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
 * Puro por construção: só `import type` de fora do domínio e nenhuma chamada
 * de rede. A UI decide como exibir; aqui não há React.
 *
 * O domínio cresceu além de um arquivo (ADR-041): a edição por slot vive em
 * `buildSlotEdit.ts`, as runas/composição de maior índice em `buildRunes.ts` e
 * os helpers comuns em `buildCommon.ts`. Este arquivo é o núcleo (núcleo
 * observado + sugestões) e o barrel público do domínio — os ~40 call sites e os
 * testes continuam importando de `shared/domain/buildManager`.
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

// Barrel do domínio: quem importa `shared/domain/buildManager` continua vendo a
// superfície inteira (edição por slot + runas), sem conhecer os arquivos irmãos.
export * from "./buildSlotEdit.ts";
export * from "./buildRunes.ts";
