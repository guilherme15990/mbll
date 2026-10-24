import type { BuildTag, BuildTagKey, BuildTagTone } from "@radar/proprietary-engine";
import { getBuildTags } from "@radar/proprietary-engine";

/**
 * Tags de build (PRD Build §10, Camada A) — cálculo em `@radar/proprietary-engine`.
 *
 * FICA aqui (presentacional): `BUILD_TAG_CLASS` (tom → classes CSS).
 */
export type { BuildTag, BuildTagKey, BuildTagTone };
export type { BuildTagsInput } from "@radar/proprietary-engine";
export { getBuildTags };

export const BUILD_TAG_CLASS: Record<BuildTagTone, string> = {
  popular: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  edge: "text-cyan-300 border-cyan-400/30 bg-cyan-400/10",
  situ: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  down: "text-rose-300 border-rose-400/30 bg-rose-400/10",
};

// O tipo `Build` é do contrato da API (`shared/api`): quem precisa dele importa
// de lá. Reexportar aqui criaria aresta domain → api sem uso (removido na F1).
