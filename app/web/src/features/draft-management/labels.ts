import type { DraftLane } from "./model";

/** Rótulo de rota na tela. Fonte única para os componentes do draft. */
export const LANE_LABEL: Record<DraftLane, string> = {
  exp: "Exp",
  mid: "Mid",
  roam: "Roam",
  jungle: "Jungle",
  gold: "Ouro",
};

export const laneName = (lane: DraftLane | null | undefined): string =>
  lane ? LANE_LABEL[lane] : "—";
