/**
 * Build Management — helpers puros compartilhados pelo domínio `/build`.
 *
 * Extraído de `buildManager.ts` (ADR-041: teto de 300 linhas por arquivo) para
 * que os três módulos do domínio não repitam a mesma validação. Puro por
 * construção: sem React, sem rede, sem `shared/api` de runtime.
 */

/** Número finito ou `null` — NaN/Infinity não vazam para o índice. */
export function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Id de componente utilizável: inteiro positivo. */
export function validId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
