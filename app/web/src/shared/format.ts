// Formatação numérica defensiva — fonte ÚNICA da web (F4a).
//
// Regra: valor ausente/inválido NUNCA vira 0. Vira "—". É o mesmo contrato
// que os testes-guardião exigem nas telas ("nunca 0 no lugar de sem dado").
//
// `shared/api` reexporta `pct`/`num`/`ago` por compatibilidade com imports
// antigos; código novo importa daqui.
export const DASH = "—";

/** Fração (0..1) → "52,3%"? Não: usa ponto decimal, como o resto da UI. */
export function pct(v: unknown, digits = 1): string {
  return typeof v === "number" && Number.isFinite(v)
    ? `${(v * 100).toFixed(digits)}%`
    : DASH;
}

/** Número puro com casas fixas; inválido → "—". */
export function num(v: unknown, digits = 2): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : DASH;
}

/** Número com sinal explícito (+/−) e sufixo opcional; inválido → "—". */
export function signed(
  v: number | null | undefined,
  digits = 1,
  suffix = "",
): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}${suffix}`;
}

/** Ponto percentual com sinal: "+1.2 pp". */
export function pp(v: number | null | undefined, digits = 1): string {
  return signed(v, digits, " pp");
}

/**
 * Lift vem da fonte em fração 0–1 (`build-lift.js`: `unit: "fraction_0_1"`).
 * A leitura de produto é em pontos percentuais: 0.034 vira "+3.4 pp".
 * Não use `signed(lift, …)` direto — isso exibe 100× menor.
 */
export function liftPp(v: number | null | undefined, digits = 1): string {
  return v == null || !Number.isFinite(v) ? DASH : pp(v * 100, digits);
}

export type LiftTone = "unknown" | "neutral" | "positive" | "negative";

/** Três estados de leitura do lift, com o corte prático em 2 pp por padrão. */
export function liftTone(v: number | null | undefined, practicalPp = 2): LiftTone {
  if (v == null || !Number.isFinite(v)) return "unknown";
  if (Math.abs(v * 100) < practicalPp) return "neutral";
  return v > 0 ? "positive" : "negative";
}

/** Idade relativa curta: "agora", "há 5 min", "há 3.2 h". */
export function ago(ms?: number): string {
  if (ms == null) return "agora";
  const h = ms / 3600e3;
  if (h < 1) return `há ${Math.max(1, Math.round(ms / 60e3))} min`;
  return `há ${h.toFixed(h < 10 ? 1 : 0)} h`;
}
