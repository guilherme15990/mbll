/**
 * Draft Management — índice relativo de poder (ADR-052 D2).
 *
 * `índice = 50 + 50·tanh(Λ / K)`, K = 0,05 (escala de exibição, NÃO calibração).
 * Λ = média ponderada dos componentes disponíveis; componente sem suporte é
 * `null` e sai do denominador. Nunca win rate/probabilidade de composição.
 */
import { COMPONENT_WEIGHTS, DRAFT_LANES, POWER_SCALE_K, clamp, mean, finite } from "./common.ts";
import type { DraftLane } from "./common.ts";
import type { DraftSlot } from "./state.ts";
import { pairMatchup, pairSynergy, teamStrength, type DraftHero, type HeroPool, type MatchupBooks } from "./pairs.ts";

export type PowerComponent = {
  key: "strength" | "synergy" | "matchup";
  label: string;
  value: number | null;
  weight: number;
  observed: number;
  total: number;
  note: string;
};

export type LaneFit = { index: number; lane: DraftLane; heroId: number | null; fit: boolean | null };

export type TeamPower = {
  index: number | null;
  value: number | null;
  band: [number, number] | null;
  components: PowerComponent[];
  filled: number;
  laneFit: LaneFit[];
  laneFitRate: number | null;
  emptyLanes: DraftLane[];
  flex: number | null;
  contest: { pick: number | null; ban: number | null };
  evidence: "vazio" | "parcial" | "completo";
};

/** Escala de exibição: Λ (logit) → índice 0–100. Única fonte de K na UI. */
export function scaleIndex(value: number | null): number | null {
  return value == null ? null : clamp(50 + 50 * Math.tanh(value / POWER_SCALE_K), 0, 100);
}

export type IndexShare = { ours: number; theirs: number };

/**
 * Divisão do índice somado em % (ADR-053 D2). NÃO é probabilidade: só
 * existe com os dois índices presentes, e 50/50 é o espelho do neutro.
 */
export function indexShare(ours: number | null, theirs: number | null): IndexShare | null {
  if (ours == null || theirs == null) return null;
  const sum = ours + theirs;
  if (!(sum > 0)) return null;
  const share = (ours / sum) * 100;
  return { ours: share, theirs: 100 - share };
}

export function laneFitOf(hero: DraftHero | undefined, lane: DraftLane): boolean | null {
  if (!hero || !hero.lanes.length) return null;
  return hero.lanes.includes(lane);
}

export function buildTeamPower({
  slots,
  pool,
  books,
  opponentIds,
  baseline,
}: {
  slots: readonly DraftSlot[];
  pool: HeroPool;
  books: MatchupBooks;
  opponentIds: readonly number[];
  baseline: number | null;
}): TeamPower {
  const ids = slots.map((slot) => slot.heroId).filter((id): id is number => id != null);
  const strength = teamStrength(ids, pool, baseline);
  const synergy = pairSynergy(ids, books);
  const matchup = pairMatchup(ids, opponentIds, books);

  const components: PowerComponent[] = [
    {
      key: "strength",
      label: "Força média",
      value: strength.value,
      weight: COMPONENT_WEIGHTS.strength,
      observed: strength.observed,
      total: strength.total,
      note: "θ̂ − μ com peso de credibilidade",
    },
    {
      key: "synergy",
      label: "Sinergia observada",
      value: synergy.value,
      weight: COMPONENT_WEIGHTS.synergy,
      observed: synergy.observed,
      total: synergy.total,
      note: "média por par interno (mediana das direções)",
    },
    {
      key: "matchup",
      label: "Confronto por par",
      value: matchup.value,
      weight: COMPONENT_WEIGHTS.matchup,
      observed: matchup.observed,
      total: matchup.total,
      note: "média de ±|δ| contra o outro lado",
    },
  ];

  const present = components.filter((component) => component.value != null);
  const weightSum = present.reduce((sum, component) => sum + component.weight, 0);
  const value = weightSum
    ? present.reduce((sum, component) => sum + (component.value as number) * component.weight, 0) / weightSum
    : null;
  const index = scaleIndex(value);

  const band: [number, number] | null =
    index != null && strength.se != null
      ? [
          clamp(index - 50 * (strength.se / POWER_SCALE_K), 0, 100),
          clamp(index + 50 * (strength.se / POWER_SCALE_K), 0, 100),
        ]
      : null;

  const laneFit: LaneFit[] = slots.map((slot, i) => ({
    index: i,
    lane: slot.lane,
    heroId: slot.heroId,
    fit: slot.heroId == null ? null : laneFitOf(pool[slot.heroId], slot.lane),
  }));
  const fitRows = laneFit.filter((row) => row.heroId != null && row.fit != null);
  const laneFitRate = fitRows.length ? fitRows.filter((row) => row.fit).length / fitRows.length : null;

  const lanesUsed = new Set(slots.map((slot) => slot.lane));
  const emptyLanes = DRAFT_LANES.filter((lane) => !lanesUsed.has(lane));

  const flexRows = ids.map((id) => pool[id]?.lanes.length ?? 0).filter((n) => n > 0);
  const flex = flexRows.length ? flexRows.reduce((sum, n) => sum + n, 0) / flexRows.length : null;

  const pick = mean(ids.map((id) => pool[id]?.pick).filter(finite));
  const ban = mean(ids.map((id) => pool[id]?.ban).filter(finite));

  const evidence: TeamPower["evidence"] =
    ids.length === 0 ? "vazio" : present.length === components.length ? "completo" : "parcial";

  return {
    index,
    value,
    band,
    components,
    filled: ids.length,
    laneFit,
    laneFitRate,
    emptyLanes,
    flex,
    contest: { pick, ban },
    evidence,
  };
}

// ── veredito ────────────────────────────────────────────────────────────────

export type VerdictTone = "emerald" | "amber" | "rose" | "slate";
export type DraftVerdict = { label: string; tone: VerdictTone; detail: string; delta: number | null };

export function draftVerdict(ours: TeamPower, theirs: TeamPower): DraftVerdict {
  if (ours.index == null || theirs.index == null || ours.filled < 3 || theirs.filled < 3) {
    return {
      label: "Leitura incompleta",
      tone: "slate",
      detail: "Preencha ao menos 3 heróis em cada lado para comparar os índices.",
      delta: null,
    };
  }
  const delta = ours.index - theirs.index;
  const magnitude = Math.abs(delta);
  const label =
    magnitude < 3 ? "Equilíbrio" : magnitude < 8 ? "Vantagem leve" : magnitude < 15 ? "Vantagem" : "Vantagem ampla";
  const tone: VerdictTone = magnitude < 3 ? "slate" : delta > 0 ? "emerald" : "rose";
  return {
    label,
    tone,
    detail:
      magnitude < 3
        ? "Diferença dentro da faixa de exibição — trate como empate estatístico."
        : delta > 0
          ? "Índice do meu time acima do inimigo. Não é probabilidade."
          : "Índice do time inimigo acima do meu. Não é probabilidade.",
    delta,
  };
}
