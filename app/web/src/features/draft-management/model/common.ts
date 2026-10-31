/**
 * Draft Management — vocabulário e primitivas numéricas (ADR-052).
 *
 * Puro: sem React, sem rede. Os módulos de `model/` compartilham só isto.
 */

/** Ordem canônica das rotas no produto (`queries/filters.ts`), usada como slot default. */
export const DRAFT_LANES = ["exp", "mid", "roam", "jungle", "gold"] as const;
export type DraftLane = (typeof DRAFT_LANES)[number];

export const DRAFT_SLOTS = 5;
export const BAN_SLOTS = 3;

export type DraftSide = "us" | "them";

/** Escala de exibição do índice — NÃO é calibração de win rate. */
export const POWER_SCALE_K = 0.05;

/** Pesos de exibição dos componentes. Ver ADR-052 D2. */
export const COMPONENT_WEIGHTS = { strength: 1, synergy: 0.5, matchup: 0.5 } as const;

export const other = (side: DraftSide): DraftSide => (side === "us" ? "them" : "us");

export const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function mean(values: readonly number[]): number | null {
  const xs = values.filter(finite);
  return xs.length ? xs.reduce((sum, value) => sum + value, 0) / xs.length : null;
}

export function median(values: readonly number[]): number | null {
  const xs = values.filter(finite).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
}
