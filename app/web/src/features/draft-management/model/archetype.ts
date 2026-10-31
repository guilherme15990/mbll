/**
 * Draft Management — arquétipo do herói e relação entre composições (ADR-053 D4).
 *
 * O perfil existe POR PAR no fio (`Pair.profile`). O herói herda o perfil
 * dominante dos pares listados — mesma regra do selo da `HeroCard`, mesma
 * função do motor (`dominantProfileOf`). Sem par com perfil → null, nunca
 * "uniforme" inventado.
 */
import { dominantProfileOf } from "@radar/proprietary-engine";
import type { MatchupBooks } from "./pairs.ts";

export const ARCHETYPES = ["snowball", "scaling", "uniforme"] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export const ARCHETYPE_LABEL: Record<Archetype, string> = {
  snowball: "Snowball",
  scaling: "Scaling",
  uniforme: "Uniforme",
};

export const ARCHETYPE_NOTE: Record<Archetype, string> = {
  snowball: "pares rendem mais cedo",
  scaling: "pares rendem mais tarde",
  uniforme: "sem inclinação na duração",
};

export const isArchetype = (value: unknown): value is Archetype =>
  typeof value === "string" && (ARCHETYPES as readonly string[]).includes(value);

/** Oposto declarado: o tipo que contrabalança a janela do inimigo. */
export function oppositeArchetype(archetype: Archetype | null): Archetype | null {
  if (archetype === "snowball") return "scaling";
  if (archetype === "scaling") return "snowball";
  return null;
}

export type ArchetypeRead = { top: Archetype; n: number; total: number };

/** Perfil dominante dos pares do herói, com suporte `n/total`. */
export function heroArchetype(heroId: number, books: MatchupBooks): ArchetypeRead | null {
  const book = books[heroId];
  if (!book) return null;
  const profiles: string[] = [];
  for (const list of [book.countersUp, book.countersDown, book.synergiesUp, book.synergiesDown]) {
    for (const pair of list) if (isArchetype(pair.profile)) profiles.push(pair.profile);
  }
  const dom = dominantProfileOf(profiles);
  if (!dom || !isArchetype(dom.top)) return null;
  return { top: dom.top, n: dom.n, total: dom.total };
}

export type TeamMix = {
  counts: Record<Archetype, number>;
  /** Heróis com pick e sem arquétipo observado — fora do denominador. */
  semDado: number;
  /** Heróis com arquétipo observado. */
  observed: number;
  dominant: Archetype | null;
  support: number;
};

export function teamMix(ids: readonly number[], books: MatchupBooks): TeamMix {
  const counts: Record<Archetype, number> = { snowball: 0, scaling: 0, uniforme: 0 };
  let semDado = 0;
  let support = 0;
  for (const id of ids) {
    const read = heroArchetype(id, books);
    if (!read) {
      semDado += 1;
      continue;
    }
    counts[read.top] += 1;
    support += read.n;
  }
  const observed = ARCHETYPES.reduce((sum, key) => sum + counts[key], 0);
  let dominant: Archetype | null = null;
  for (const key of ARCHETYPES) {
    if (!counts[key]) continue;
    if (dominant == null || counts[key] > counts[dominant]) dominant = key;
  }
  return { counts, semDado, observed, dominant, support };
}

export type MixRelation = {
  label: string;
  detail: string;
  tone: "emerald" | "amber" | "slate";
  /** Tipo que contrabalança o dominante inimigo (null quando não há alvo). */
  target: Archetype | null;
};

/**
 * Leitura descritiva das duas composições. Concentração de perfil, nunca
 * previsão: fala em "tende" e em janela, não em resultado.
 */
export function mixRelation(ours: TeamMix, theirs: TeamMix): MixRelation {
  const target = oppositeArchetype(theirs.dominant);
  if (!theirs.dominant || !ours.dominant) {
    return {
      label: "Mix sem leitura",
      detail: `Pares insuficientes para perfil dominante (nós: ${ours.observed} com perfil, inimigo: ${theirs.observed}).`,
      tone: "slate",
      target: null,
    };
  }
  const oursLabel = ARCHETYPE_LABEL[ours.dominant];
  const theirsLabel = ARCHETYPE_LABEL[theirs.dominant];
  if (ours.dominant === theirs.dominant) {
    return {
      label: `Mesma janela: ${theirsLabel}`,
      detail: `Os dois lados concentram ${theirsLabel.toLowerCase()} (${theirs.counts[theirs.dominant]} deles, ${ours.counts[ours.dominant]} nossos). Sem contrapeso declarado.`,
      tone: "slate",
      target: null,
    };
  }
  if (theirs.dominant === "snowball") {
    return {
      label: "Janelas opostas",
      detail: `Eles concentram snowball (${theirs.counts.snowball}); nós, ${oursLabel.toLowerCase()}. A leitura é de janela: eles tendem a render cedo, nós depois.`,
      tone: "amber",
      target,
    };
  }
  if (theirs.dominant === "scaling") {
    return {
      label: "Janelas opostas",
      detail: `Eles concentram scaling (${theirs.counts.scaling}); nós, ${oursLabel.toLowerCase()}. A leitura é de janela: eles tendem a render depois, nós antes.`,
      tone: "emerald",
      target,
    };
  }
  return {
    label: "Sem contrapeso",
    detail: `O inimigo não tem perfil dominante fora de uniforme (${theirsLabel}: ${theirs.counts.uniforme}).`,
    tone: "slate",
    target,
  };
}

/** Nome de exibição do arquétipo, com suporte quando existe. */
export function archetypeText(read: ArchetypeRead | null): string {
  if (!read) return "sem dado";
  return `${ARCHETYPE_LABEL[read.top]} (${read.n}/${read.total})`;
}

/** Distribuição em texto curto para o painel de mix. */
export function mixText(mix: TeamMix): string {
  const parts = ARCHETYPES.filter((key) => mix.counts[key] > 0).map(
    (key) => `${ARCHETYPE_LABEL[key]} ${mix.counts[key]}`,
  );
  if (mix.semDado) parts.push(`sem dado ${mix.semDado}`);
  return parts.length ? parts.join(" · ") : "sem heróis";
}
