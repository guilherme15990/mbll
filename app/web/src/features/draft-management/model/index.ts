/**
 * Draft Management — lógica pura da tela `/draft` (ADR-052 + ADR-053).
 *
 * Objeto: 5 slots por lado + 3 bans por lado + lado que picka primeiro.
 * Leitura: índice relativo de poder (50 = neutro) composto de força média,
 * sinergia observada e confronto por par; divisão do índice em %; matriz 5×5;
 * curva de duração dos pares; mix de arquétipos. NUNCA win rate/probabilidade
 * de composição. Componente sem par observado é `null` e sai do índice.
 *
 * Puro por construção: sem React, sem rede. Importa só irmãos e o motor
 * (`dominantProfileOf`), como `shared/domain` já faz.
 */
export * from "./common.ts";
export * from "./state.ts";
export * from "./pairs.ts";
export * from "./power.ts";
export * from "./firstPick.ts";
export * from "./laneMeta.ts";
export * from "./archetype.ts";
export * from "./curve.ts";
export * from "./matrix.ts";
export * from "./suggestionFactors.ts";
export * from "./suggestions.ts";
export * from "./analyze.ts";
