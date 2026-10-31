/**
 * Draft Management — análise completa do draft (ADR-052 + ADR-053).
 *
 * Junta poder dos dois lados, divisão em %, veredito, turnos, primeiro pick,
 * matriz 5×5, curva de duração, mix de arquétipos e candidatos. Função pura:
 * recebe estado + livros + recorte, devolve leitura — sem rede.
 */
import { DRAFT_LANES } from "./common.ts";
import type { DraftLane } from "./common.ts";
import { usedIds, nextTurn, nextPickStep, sequenceState, type DraftState, type NextTurn, type StepState } from "./state.ts";
import type { HeroPool, MatchupBooks } from "./pairs.ts";
import { buildTeamPower, draftVerdict, indexShare, type DraftVerdict, type IndexShare, type TeamPower } from "./power.ts";
import { readFirstPick, type FirstPickRead } from "./firstPick.ts";
import { banTargets, pickSuggestions, type BanTarget, type Candidate } from "./suggestions.ts";
import { matchupMatrix, matrixSummary, type MatchupMatrix } from "./matrix.ts";
import { teamCurve, curveDelta, type CurveDelta, type TeamCurve } from "./curve.ts";
import { mixRelation, teamMix, type MixRelation, type TeamMix } from "./archetype.ts";

export type DraftAnalysis = {
  ourPower: TeamPower;
  theirPower: TeamPower;
  /** Divisão do índice somado em % — não é probabilidade. */
  share: IndexShare | null;
  verdict: DraftVerdict;
  steps: StepState[];
  next: NextTurn | null;
  firstPick: FirstPickRead;
  /** Lane alvo das recomendações (URL, próximo slot nosso ou `exp`). */
  lane: DraftLane;
  /** Heróis com pick em cada lado (para agrupar arquétipos na UI). */
  teams: { us: number[]; them: number[] };
  suggestions: Candidate[];
  bans: BanTarget[];
  matrix: MatchupMatrix;
  matrixSummary: ReturnType<typeof matrixSummary>;
  curve: { ours: TeamCurve; theirs: TeamCurve; delta: CurveDelta[] };
  mix: { ours: TeamMix; theirs: TeamMix; relation: MixRelation };
  used: number[];
};

const idsOf = (state: DraftState, side: "us" | "them") =>
  state[side].map((slot) => slot.heroId).filter((id): id is number => id != null);

export function analyzeDraft(
  state: DraftState,
  {
    pool,
    books,
    baseline,
    lane,
  }: { pool: HeroPool; books: MatchupBooks; baseline: number | null; lane?: DraftLane },
): DraftAnalysis {
  const ourIds = idsOf(state, "us");
  const theirIds = idsOf(state, "them");

  const ourPower = buildTeamPower({ slots: state.us, pool, books, opponentIds: theirIds, baseline });
  const theirPower = buildTeamPower({ slots: state.them, pool, books, opponentIds: ourIds, baseline });

  const oursMix = teamMix(ourIds, books);
  const theirsMix = teamMix(theirIds, books);
  const mix = { ours: oursMix, theirs: theirsMix, relation: mixRelation(oursMix, theirsMix) };

  const laneTarget: DraftLane = lane ?? nextPickStep(state, "us")?.lane ?? DRAFT_LANES[0];
  const matrix = matchupMatrix(state.us, state.them, books);

  const ourCurve = teamCurve(ourIds, books);
  const theirCurve = teamCurve(theirIds, books);

  return {
    ourPower,
    theirPower,
    share: indexShare(ourPower.index, theirPower.index),
    verdict: draftVerdict(ourPower, theirPower),
    steps: sequenceState(state),
    next: nextTurn(state),
    firstPick: readFirstPick(state, pool, books),
    lane: laneTarget,
    teams: { us: ourIds, them: theirIds },
    suggestions: pickSuggestions(state, pool, books, baseline, { lane: laneTarget, target: mix.relation.target }),
    bans: banTargets(state, pool, books),
    matrix,
    matrixSummary: matrixSummary(matrix),
    curve: { ours: ourCurve, theirs: theirCurve, delta: curveDelta(ourCurve, theirCurve) },
    mix,
    used: usedIds(state),
  };
}
