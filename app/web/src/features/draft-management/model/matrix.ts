/**
 * Draft Management — matriz 5×5 de confronto direto (ADR-053 D7).
 *
 * Cada célula é UM par. A direção vem da lista (`countersUp`/`countersDown`),
 * nunca do sinal do δ; |δ| é severidade. Linha com os dois lados observados é
 * `contested` (neutra) e é contada — a matriz não escolhe lado.
 *
 * Nenhuma soma de linha vira "vantagem total": o resumo é QUANTOS pares
 * favorecem cada lado, não a soma dos efeitos.
 */
import { deltaOf, type MatchupBooks } from "./pairs.ts";
import type { DraftLane } from "./common.ts";
import type { DraftSlot } from "./state.ts";

export type MatrixCellState = "advantage" | "disadvantage" | "contested" | "unknown";

export type MatrixCell = {
  state: MatrixCellState;
  /** |δ| do par (severidade), quando observado. */
  delta: number | null;
};

export type MatrixRow = {
  index: number;
  heroId: number | null;
  lane: DraftLane;
  cells: MatrixCell[];
  advantages: number;
  disadvantages: number;
  contested: number;
  observed: number;
};

export type MatchupMatrix = {
  rows: MatrixRow[];
  cols: { index: number; heroId: number | null }[];
  wired: boolean;
};

/** Confronto de UM par, com a direção vinda da lista. */
export function cellOf(ours: number, theirs: number, books: MatchupBooks): MatrixCell {
  const weCounter = deltaOf(books[ours]?.countersUp, theirs) ?? deltaOf(books[theirs]?.countersDown, ours);
  const theyCounter = deltaOf(books[ours]?.countersDown, theirs) ?? deltaOf(books[theirs]?.countersUp, ours);
  if (weCounter != null && theyCounter != null) {
    return { state: "contested", delta: Math.max(weCounter, theyCounter) };
  }
  if (weCounter != null) return { state: "advantage", delta: weCounter };
  if (theyCounter != null) return { state: "disadvantage", delta: theyCounter };
  return { state: "unknown", delta: null };
}

export function matchupMatrix(
  ours: readonly DraftSlot[],
  theirs: readonly DraftSlot[],
  books: MatchupBooks,
): MatchupMatrix {
  const rows: MatrixRow[] = ours.map((slot, index) => {
    const cells = theirs.map((other) =>
      slot.heroId != null && other.heroId != null
        ? cellOf(slot.heroId, other.heroId, books)
        : { state: "unknown" as const, delta: null },
    );
    return {
      index,
      heroId: slot.heroId,
      lane: slot.lane,
      cells,
      advantages: cells.filter((cell) => cell.state === "advantage").length,
      disadvantages: cells.filter((cell) => cell.state === "disadvantage").length,
      contested: cells.filter((cell) => cell.state === "contested").length,
      observed: cells.filter((cell) => cell.state !== "unknown").length,
    };
  });

  return {
    rows,
    cols: theirs.map((slot, index) => ({ index, heroId: slot.heroId })),
    wired: rows.some((row) => row.observed > 0),
  };
}

/** Total de pares observados e o saldo de células (contagem, não efeito). */
export function matrixSummary(matrix: MatchupMatrix): {
  advantages: number;
  disadvantages: number;
  contested: number;
  observed: number;
  total: number;
} {
  const advantages = matrix.rows.reduce((sum, row) => sum + row.advantages, 0);
  const disadvantages = matrix.rows.reduce((sum, row) => sum + row.disadvantages, 0);
  const contested = matrix.rows.reduce((sum, row) => sum + row.contested, 0);
  return {
    advantages,
    disadvantages,
    contested,
    observed: advantages + disadvantages + contested,
    total: matrix.rows.length * matrix.cols.length,
  };
}
