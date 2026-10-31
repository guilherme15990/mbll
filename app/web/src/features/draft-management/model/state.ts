/**
 * Draft Management — estado, URL e ordem do draft (ADR-052).
 *
 * URL como store: `?first=us|them&d=hero@pista,...|...&b=id,id,id|...`.
 * Link inválido degrada (slot vazio / rota default), nunca quebra a tela.
 */
import { BAN_SLOTS, DRAFT_LANES, DRAFT_SLOTS, other, type DraftLane, type DraftSide } from "./common.ts";

/** Slot de pick. A rota vive no slot mesmo quando ainda não há herói. */
export type DraftSlot = { heroId: number | null; lane: DraftLane };

export type DraftState = {
  us: DraftSlot[];
  them: DraftSlot[];
  usBans: (number | null)[];
  themBans: (number | null)[];
  /** Lado que faz o pick 1 (e o ban 1). */
  first: DraftSide;
};

export function emptyDraft(): DraftState {
  return {
    us: DRAFT_LANES.map((lane) => ({ heroId: null, lane })),
    them: DRAFT_LANES.map((lane) => ({ heroId: null, lane })),
    usBans: Array.from({ length: BAN_SLOTS }, () => null),
    themBans: Array.from({ length: BAN_SLOTS }, () => null),
    first: "us",
  };
}

function validHeroId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function laneOf(raw: unknown, fallback: DraftLane): DraftLane {
  return (DRAFT_LANES as readonly string[]).includes(String(raw)) ? (String(raw) as DraftLane) : fallback;
}

/** `12@exp,,34@mid` → slots. Token vazio (`""`) mantém a rota default do índice. */
function parseSide(raw: string | null): DraftSlot[] {
  const tokens = (raw ?? "").split(",");
  return DRAFT_LANES.map((fallbackLane, index) => {
    const token = (tokens[index] ?? "").trim();
    if (!token) return { heroId: null, lane: fallbackLane };
    const at = token.indexOf("@");
    const heroId = validHeroId(at >= 0 ? token.slice(0, at) : token);
    const laneRaw = at >= 0 ? token.slice(at + 1) : "";
    return { heroId, lane: laneOf(laneRaw, fallbackLane) };
  });
}

function parseBans(raw: string | null): (number | null)[] {
  const tokens = (raw ?? "").split(",");
  return Array.from({ length: BAN_SLOTS }, (_, index) => validHeroId((tokens[index] ?? "").trim()));
}

/**
 * Herói repetido em link editado à mão é descartado (INV-DMP-006): a primeira
 * ocorrência na ordem dos slots fica, as seguintes viram `null`.
 */
function dedupe(ids: readonly (number | null)[]): (number | null)[] {
  const seen = new Set<number>();
  return ids.map((id) => {
    if (id == null) return null;
    if (seen.has(id)) return null;
    seen.add(id);
    return id;
  });
}

/** Lê o draft de um store no formato URLSearchParams (`get`). */
export function parseDraft(get: (key: string) => string | null): DraftState {
  const parts = (get("d") ?? "").split("|");
  const banParts = (get("b") ?? "").split("|");
  const us = parseSide(parts[0] ?? "");
  const them = parseSide(parts[1] ?? "");

  const usIds = dedupe(us.map((slot) => slot.heroId));
  const themIds = dedupe([...usIds, ...them.map((slot) => slot.heroId)]).slice(usIds.length);
  const pickIds = [...usIds, ...themIds];
  const banIds = dedupe([...pickIds, ...parseBans(banParts[0] ?? ""), ...parseBans(banParts[1] ?? "")]);

  return {
    us: us.map((slot, index) => ({ ...slot, heroId: usIds[index] })),
    them: them.map((slot, index) => ({ ...slot, heroId: themIds[index] })),
    usBans: banIds.slice(pickIds.length, pickIds.length + BAN_SLOTS),
    themBans: banIds.slice(pickIds.length + BAN_SLOTS),
    first: get("first") === "them" ? "them" : "us",
  };
}

/** Serializa para os três parâmetros da URL. Sempre grava os três (store explícito). */
export function encodeDraft(state: DraftState): { d: string; b: string; first: DraftSide } {
  const side = (slots: readonly DraftSlot[]) =>
    slots.map((slot) => `${slot.heroId ?? ""}@${slot.lane}`).join(",");
  const bans = (ids: readonly (number | null)[]) => ids.map((id) => (id ?? "")).join(",");
  return {
    d: `${side(state.us)}|${side(state.them)}`,
    b: `${bans(state.usBans)}|${bans(state.themBans)}`,
    first: state.first,
  };
}

export function pickedIds(state: DraftState): number[] {
  return [...state.us, ...state.them]
    .map((slot) => slot.heroId)
    .filter((id): id is number => id != null);
}

export function bannedIds(state: DraftState): number[] {
  return [...state.usBans, ...state.themBans].filter((id): id is number => id != null);
}

export function usedIds(state: DraftState): number[] {
  return [...pickedIds(state), ...bannedIds(state)];
}

export function isUsed(state: DraftState, heroId: number): boolean {
  return usedIds(state).includes(heroId);
}

export function countPicks(state: DraftState): number {
  return pickedIds(state).length;
}

export function countBans(state: DraftState): number {
  return bannedIds(state).length;
}

export function setPick(state: DraftState, side: DraftSide, index: number, heroId: number | null): DraftState {
  if (!Number.isInteger(index) || index < 0 || index >= DRAFT_SLOTS) return state;
  if (heroId != null && isUsed(state, heroId)) return state;
  const slots = state[side].map((slot, i) => (i === index ? { ...slot, heroId } : slot));
  return { ...state, [side]: slots } as DraftState;
}

export function setLane(state: DraftState, side: DraftSide, index: number, lane: DraftLane): DraftState {
  if (!Number.isInteger(index) || index < 0 || index >= DRAFT_SLOTS) return state;
  const slots = state[side].map((slot, i) => (i === index ? { ...slot, lane } : slot));
  return { ...state, [side]: slots } as DraftState;
}

export function setBan(state: DraftState, side: DraftSide, index: number, heroId: number | null): DraftState {
  if (!Number.isInteger(index) || index < 0 || index >= BAN_SLOTS) return state;
  const key = side === "us" ? "usBans" : "themBans";
  if (heroId != null && isUsed(state, heroId)) return state;
  const bans = state[key].map((id, i) => (i === index ? heroId : id));
  return { ...state, [key]: bans };
}

export function setFirst(state: DraftState, first: DraftSide): DraftState {
  return { ...state, first };
}

export function resetDraft(state: DraftState): DraftState {
  return { ...emptyDraft(), first: state.first };
}

// ── ordem do draft ──────────────────────────────────────────────────────────

export type DraftStep = { step: number; side: DraftSide; kind: "ban" | "pick"; index: number };

/**
 * Ordem MLBB (regra do jogo, não dado estatístico):
 * bans F,S,F,S,F,S; picks 1-2-2-2-2-1.
 */
export function draftSequence(first: DraftSide = "us"): DraftStep[] {
  const second = other(first);
  const steps: DraftStep[] = [];
  for (let i = 0; i < BAN_SLOTS; i++) {
    steps.push({ step: steps.length + 1, side: first, kind: "ban", index: i });
    steps.push({ step: steps.length + 1, side: second, kind: "ban", index: i });
  }
  const pickOrder: DraftSide[] = [first, second, second, first, first, second, second, first, first, second];
  const counter: Record<DraftSide, number> = { us: 0, them: 0 };
  for (const side of pickOrder) {
    steps.push({ step: steps.length + 1, side, kind: "pick", index: counter[side] });
    counter[side] += 1;
  }
  return steps;
}

export type StepState = DraftStep & {
  done: boolean;
  current: boolean;
  heroId: number | null;
  lane: DraftLane | null;
};

/** Próximo pick em aberto (qualquer lado). Bans têm trilha própria e não bloqueiam o pick. */
export function nextPickStep(
  state: DraftState,
  side?: DraftSide,
): (DraftStep & { lane: DraftLane | null }) | null {
  const step = draftSequence(state.first).find(
    (candidate) =>
      candidate.kind === "pick" &&
      (side == null || candidate.side === side) &&
      state[candidate.side][candidate.index]?.heroId == null,
  );
  if (!step) return null;
  return { ...step, lane: state[step.side][step.index]?.lane ?? null };
}

/**
 * Próximo slot de pick nosso em aberto, preferindo a lane alvo (ADR-053 D6).
 * A ordem é a do draft; a preferência de lane só escolhe entre os slots que o
 * turno ainda ocuparia — nunca antecipa um pick que não é nosso.
 */
export function nextPickIndex(state: DraftState, lane?: DraftLane | null): number | null {
  const open = draftSequence(state.first)
    .filter((step) => step.kind === "pick" && step.side === "us")
    .map((step) => step.index)
    .filter((index) => state.us[index]?.heroId == null);
  if (!open.length) return null;
  if (lane) {
    const match = open.find((index) => state.us[index]?.lane === lane);
    if (match != null) return match;
  }
  return open[0];
}

/** Próximo ban nosso em aberto (bans têm trilha própria e não bloqueiam o pick). */
export function nextBanIndex(state: DraftState): number | null {
  const index = state.usBans.findIndex((id) => id == null);
  return index >= 0 ? index : null;
}

const stepDone = (state: DraftState, step: DraftStep): boolean =>
  step.kind === "ban"
    ? state[step.side === "us" ? "usBans" : "themBans"][step.index] != null
    : state[step.side][step.index]?.heroId != null;

/** Mapeia a sequência para o que já foi preenchido (ban por posição; pick por slot). */
export function sequenceState(state: DraftState): StepState[] {
  const nextPick = nextPickStep(state);
  return draftSequence(state.first).map((step) => {
    const heroId =
      step.kind === "ban"
        ? (state[step.side === "us" ? "usBans" : "themBans"][step.index] ?? null)
        : (state[step.side][step.index]?.heroId ?? null);
    return {
      ...step,
      done: stepDone(state, step),
      current: nextPick?.step === step.step,
      heroId,
      lane: step.kind === "pick" ? (state[step.side][step.index]?.lane ?? null) : null,
    };
  });
}

export type NextTurn = { step: number; side: DraftSide; kind: "pick"; index: number; lane: DraftLane | null };

export function nextTurn(state: DraftState): NextTurn | null {
  const step = nextPickStep(state);
  return step ? { step: step.step, side: step.side, kind: "pick", index: step.index, lane: step.lane } : null;
}

/**
 * Ações consumidoras ainda pendentes (ban informado ou não; pick do outro lado)
 * entre agora e o próximo pick NOSSO. Proxy de hazard, não probabilidade.
 */
export function actionsUntilNextPick(state: DraftState): { k: number; lane: DraftLane | null } {
  const next = nextPickStep(state, "us");
  if (!next) return { k: 0, lane: null };
  const seq = draftSequence(state.first);
  const cursor = seq.findIndex((step) => step.step === next.step);
  let k = 0;
  for (let i = 0; i < cursor; i++) {
    const step = seq[i];
    if (stepDone(state, step)) continue;
    if (step.kind === "pick" && step.side === "us") continue;
    k += 1;
  }
  return { k, lane: next.lane };
}
