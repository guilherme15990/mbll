/**
 * Helpers de apresentação sem dono de contexto (`cx`, `dir`, `dirWord`).
 *
 * Não são domínio nem dados: são formatação defensiva. Moram em `shared/domain`
 * porque são lógica pura (zero React, zero fetch), testável isolada — e o
 * barrel de `shared/api` os reexporta para a UI que já importa de lá.
 */

// formatação defensiva: nunca quebra com undefined/NaN
export const dir = (z: unknown) => (typeof z !== "number" || !Number.isFinite(z) ? "■" : z > 0.5 ? "▲" : z < -0.5 ? "▼" : "■");
export const dirWord = (z: unknown) => (typeof z !== "number" || !Number.isFinite(z) ? "estável" : z > 0.5 ? "sobe" : z < -0.5 ? "cai" : "estável");
export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");
