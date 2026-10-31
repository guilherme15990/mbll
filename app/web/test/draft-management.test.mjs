import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BALANCE_WEIGHT,
  BAN_SLOTS,
  COMPONENT_WEIGHTS,
  DRAFT_LANES,
  DRAFT_SLOTS,
  POWER_SCALE_K,
  actionsUntilNextPick,
  analyzeDraft,
  availabilityProxy,
  balanceOf,
  banTargets,
  buildTeamPower,
  cellOf,
  contestHazard,
  curveDelta,
  curvePeak,
  curveRows,
  draftSequence,
  draftVerdict,
  emptyDraft,
  encodeDraft,
  heroArchetype,
  indexShare,
  isUsed,
  laneCandidates,
  laneMetaStats,
  lanePercentile,
  matchupMatrix,
  matrixSummary,
  mixRelation,
  nextBanIndex,
  nextPickIndex,
  nextTurn,
  oppositeArchetype,
  pairMatchup,
  pairSynergy,
  parseDraft,
  pickSuggestions,
  readFirstPick,
  resetDraft,
  sequenceState,
  setBan,
  setFirst,
  setLane,
  setPick,
  teamCurve,
  teamMix,
  teamStrength,
  usedIds,
} from "../src/features/draft-management/model/index.ts";

// Fixtures no formato de `DraftHero` (derivado de /heroes + /catalog + /heroes/lanes).
const hero = (id, over = {}) => ({
  id,
  name: `H${id}`,
  head: null,
  wrAdj: 0.5,
  pick: 0.05,
  ban: 0.02,
  B: 0.6,
  tier: "Médio",
  credible: null,
  smallSample: false,
  lanes: [],
  ...over,
});

const book = (id, over = {}) => ({
  id,
  countersUp: [],
  countersDown: [],
  synergiesUp: [],
  synergiesDown: [],
  ...over,
});

const pair = (id, delta, over = {}) => ({ id, delta, ...over });

/** Store de URL fake: `parseDraft` recebe só um `get`. */
const store = (query) => (key) => {
  const params = new URLSearchParams(query);
  return params.get(key);
};

describe("estado e URL", () => {
  it("emptyDraft tem 5 slots por lado e 3 bans por lado", () => {
    const state = emptyDraft();
    assert.equal(state.us.length, DRAFT_SLOTS);
    assert.equal(state.them.length, DRAFT_SLOTS);
    assert.equal(state.usBans.length, BAN_SLOTS);
    assert.equal(state.themBans.length, BAN_SLOTS);
    assert.deepEqual(state.us.map((slot) => slot.lane), [...DRAFT_LANES]);
    assert.equal(state.first, "us");
    assert.deepEqual(usedIds(state), []);
  });

  it("encode/parse faz round-trip com picks, rotas e bans", () => {
    let state = emptyDraft();
    state = setFirst(state, "them");
    state = setPick(state, "us", 0, 12);
    state = setLane(state, "us", 0, "gold");
    state = setPick(state, "them", 2, 34);
    state = setBan(state, "us", 1, 56);

    const encoded = encodeDraft(state);
    const parsed = parseDraft(store(`d=${encodeURIComponent(encoded.d)}&b=${encoded.b}&first=${encoded.first}`));

    assert.equal(parsed.first, "them");
    assert.deepEqual(parsed.us[0], { heroId: 12, lane: "gold" });
    assert.equal(parsed.them[2]?.heroId, 34);
    assert.deepEqual(parsed.usBans, [null, 56, null]);
  });

  it("link inválido degrada em vez de quebrar", () => {
    const parsed = parseDraft(store("d=abc@xx,0@mid&b=zz,7&first=sideways"));
    assert.equal(parsed.first, "us");
    assert.equal(parsed.us[0]?.heroId, null);
    assert.equal(parsed.us[0]?.lane, "exp", "rota desconhecida cai na default do slot");
    assert.equal(parsed.us[1]?.heroId, null, "id 0 não é herói");
    assert.deepEqual(parsed.usBans, [null, 7, null]);
  });

  it("URL ausente devolve o draft vazio", () => {
    assert.deepEqual(parseDraft(store("")), emptyDraft());
  });

  it("link com herói repetido (ou ban de herói já pickado) perde a repetição", () => {
    const parsed = parseDraft(store("d=1@exp,1@mid,,,|1@gold,2@roam,,,&b=2,0,0|9,9,0"));
    const ids = [...parsed.us, ...parsed.them].map((slot) => slot.heroId);
    assert.deepEqual(ids.filter((id) => id == null ? false : id === 1), [1], "só a 1ª ocorrência fica");
    assert.deepEqual(ids, [1, null, null, null, null, null, 2, null, null, null]);
    assert.deepEqual(parsed.usBans, [null, null, null], "ban de herói já usado é descartado");
    assert.deepEqual(parsed.themBans, [9, null, null], "9 aparece uma vez só");
  });

  it("herói já usado não entra de novo (pick nem ban)", () => {
    let state = setPick(emptyDraft(), "us", 0, 10);
    const duplicated = setPick(state, "them", 0, 10);
    assert.equal(duplicated, state, "pick repetido é rejeitado sem mutar");
    assert.equal(setBan(state, "them", 0, 10), state, "ban de herói já pickado é rejeitado");
    assert.equal(isUsed(state, 10), true);
  });

  it("remover pick devolve o herói ao pool", () => {
    let state = setPick(emptyDraft(), "us", 0, 10);
    state = setPick(state, "us", 0, null);
    assert.equal(isUsed(state, 10), false);
    assert.equal(state.us[0]?.heroId, null);
  });

  it("índice fora da faixa não muta", () => {
    const state = emptyDraft();
    assert.equal(setPick(state, "us", 5, 10), state);
    assert.equal(setBan(state, "us", 3, 10), state);
  });

  it("reset limpa picks e bans mas preserva quem picka primeiro", () => {
    let state = setFirst(emptyDraft(), "them");
    state = setPick(state, "us", 0, 10);
    state = setBan(state, "them", 0, 11);
    const reset = resetDraft(state);
    assert.deepEqual(usedIds(reset), []);
    assert.equal(reset.first, "them");
  });
});

describe("ordem do draft", () => {
  it("bans alternam e picks seguem 1-2-2-2-2-1", () => {
    const seq = draftSequence("us");
    assert.equal(seq.length, 6 + 10);
    assert.deepEqual(
      seq.slice(0, 6).map((step) => step.side),
      ["us", "them", "us", "them", "us", "them"],
    );
    assert.deepEqual(
      seq.filter((step) => step.kind === "pick").map((step) => step.side),
      ["us", "them", "them", "us", "us", "them", "them", "us", "us", "them"],
    );
    // Primeiro lado picka turnos 7, 10, 11, 14, 15.
    assert.deepEqual(
      seq.filter((step) => step.kind === "pick" && step.side === "us").map((step) => step.step),
      [7, 10, 11, 14, 15],
    );
  });

  it("trocar quem picka primeiro espelha a ordem", () => {
    const seq = draftSequence("them");
    assert.deepEqual(
      seq.filter((step) => step.kind === "pick" && step.side === "them").map((step) => step.step),
      [7, 10, 11, 14, 15],
    );
  });

  it("próximo turno é sempre um pick aberto, bans não bloqueiam", () => {
    const state = emptyDraft();
    assert.equal(nextTurn(state)?.step, 7);
    assert.equal(nextTurn(state)?.side, "us");
    // Bans preenchidos não avançam o cursor de pick.
    let withBans = state;
    for (let i = 0; i < BAN_SLOTS; i++) {
      withBans = setBan(withBans, "us", i, 100 + i);
      withBans = setBan(withBans, "them", i, 200 + i);
    }
    assert.equal(nextTurn(withBans)?.step, 7);
  });

  it("sequenceState marca como atual só o próximo pick em aberto", () => {
    let state = setPick(emptyDraft(), "us", 0, 1);
    state = setPick(state, "them", 0, 2);
    const steps = sequenceState(state);
    const current = steps.filter((step) => step.current);
    assert.equal(current.length, 1);
    assert.equal(current[0].step, 9, "o inimigo tem dois picks seguidos (8 e 9)");
    assert.equal(current[0].side, "them");
    assert.equal(steps.find((step) => step.step === 7)?.done, true);
    assert.equal(steps.find((step) => step.step === 7)?.heroId, 1);
  });

  it("bans preenchidos aparecem na trilha com o herói banido", () => {
    let state = setBan(emptyDraft(), "us", 0, 111);
    state = setBan(state, "them", 2, 222);
    const steps = sequenceState(state);
    const bans = steps.filter((step) => step.kind === "ban");
    assert.equal(bans.length, 6);
    assert.equal(bans[0]?.heroId, 111, "ban 1 do 1º lado");
    assert.equal(bans[0]?.done, true);
    assert.equal(bans[0]?.lane, null, "ban não tem rota");
    assert.equal(bans[5]?.heroId, 222, "ban 3 do 2º lado é o passo 6");
    assert.equal(bans[1]?.heroId, null, "ban ainda não escolhido fica vazio");
    assert.equal(bans[1]?.done, false);
  });

  it("k conta ações pendentes até o nosso próximo pick", () => {
    const state = emptyDraft();
    assert.deepEqual(actionsUntilNextPick(state), { k: 6, lane: "exp" });
    // 6 bans + 2 picks do inimigo pendentes antes do nosso segundo pick.
    const afterFirst = setPick(state, "us", 0, 1);
    assert.deepEqual(actionsUntilNextPick(afterFirst), { k: 8, lane: "mid" });
  });

  it("sem pick nosso em aberto, k = 0", () => {
    let state = emptyDraft();
    for (let i = 0; i < DRAFT_SLOTS; i++) state = setPick(state, "us", i, 10 + i);
    assert.deepEqual(actionsUntilNextPick(state), { k: 0, lane: null });
    assert.equal(nextTurn(state)?.side, "them");
  });
});

describe("componentes do poder", () => {
  it("força média usa peso de credibilidade e IC para o erro", () => {
    const pool = {
      1: hero(1, { wrAdj: 0.8, B: 1, credible: [0.7, 0.9] }),
      2: hero(2, { wrAdj: 0.6, B: 0.5, credible: [0.5, 0.7] }),
    };
    const result = teamStrength([1, 2], pool, 0.5);
    assert.ok(Math.abs((result.value ?? 0) - (0.3 + 0.5 * 0.1) / 1.5) < 1e-12);
    assert.equal(result.observed, 2);
    assert.equal(result.total, 2);
    const se = Math.sqrt(((0.2 / 3.92) ** 2) * 2) / 2;
    assert.ok(Math.abs((result.se ?? 0) - se) < 1e-12);
  });

  it("amostra pequena reduz o peso relativo, não o valor absoluto", () => {
    const pool = {
      1: hero(1, { wrAdj: 0.8, B: 1, smallSample: true }),
      2: hero(2, { wrAdj: 0.5, B: 1 }),
    };
    const result = teamStrength([1, 2], pool, 0.5);
    // Peso 0,25 no herói de amostra pequena contra 1 do herói estável.
    assert.ok(Math.abs((result.value ?? 0) - (0.25 * 0.3) / 1.25) < 1e-12);
    assert.ok(result.value != null && result.value < 0.3, "pico de amostra pequena não domina");
  });

  it("baseline inválido cai em 0,5 e herói sem θ̂ fica fora", () => {
    const pool = {
      1: hero(1, { wrAdj: 0.6, B: 1 }),
      2: hero(2, { wrAdj: null, B: 1 }),
    };
    const result = teamStrength([1, 2], pool, 0.95);
    assert.ok(Math.abs((result.value ?? 0) - 0.1) < 1e-12);
    assert.equal(result.observed, 1);
    assert.equal(result.total, 2);
    assert.equal(result.se, null, "sem IC não há banda");
  });

  it("time vazio não tem força", () => {
    assert.deepEqual(teamStrength([], {}, null), { value: null, observed: 0, total: 0, se: null });
  });

  it("sinergia usa uma observação por par e o sinal da lista", () => {
    const books = {
      1: book(1, { synergiesUp: [pair(2, 0.03)] }),
      2: book(2, { synergiesDown: [pair(1, 0.02)] }),
    };
    const result = pairSynergy([1, 2], books);
    assert.equal(result.observed, 1);
    assert.equal(result.total, 1);
    assert.equal(result.value, (0.03 - 0.02) / 2, "mediana entre +0,03 e −0,02");
  });

  it("par sem sinergia observada é null, nunca 0", () => {
    const result = pairSynergy([1, 2], {});
    assert.equal(result.value, null);
    assert.equal(result.observed, 0);
  });

  it("confronto: direção vem de countersUp/countersDown, não do sinal do δ", () => {
    const ours = [1];
    const theirs = [2];

    const weCounter = pairMatchup(ours, theirs, { 1: book(1, { countersUp: [pair(2, -0.04)] }) });
    assert.equal(weCounter.value, 0.04, "|δ| é severidade; a direção é da lista");

    const theyCounter = pairMatchup(ours, theirs, { 1: book(1, { countersDown: [pair(2, 0.05)] }) });
    assert.equal(theyCounter.value, -0.05, "par listado como counter do inimigo entra negativo");

    const contested = pairMatchup(ours, theirs, {
      1: book(1, { countersUp: [pair(2, 0.04)] }),
      2: book(2, { countersUp: [pair(1, 0.03)] }),
    });
    assert.equal(contested.value, 0);
    assert.equal(contested.contested, 1, "os dois lados se counteram: par contestado");
  });

  it("confronto desconhecido não entra no denominador", () => {
    const result = pairMatchup([1, 2], [3, 4], { 1: book(1, { countersUp: [pair(3, 0.04)] }) });
    assert.equal(result.observed, 1, "só o par observado entra");
    assert.equal(result.total, 4);
    assert.equal(result.value, 0.04, "média por par marcado, não soma de 4");
  });

  it("hazard e disponibilidade são proxy com clamp", () => {
    assert.equal(contestHazard(hero(1, { pick: 0.1, ban: 0.05 })), (1 + 0.3) / 16);
    assert.equal(contestHazard(hero(1, { pick: null })), null);
    assert.equal(contestHazard(undefined), null);
    assert.equal(contestHazard(hero(1, { pick: 1, ban: 1 })), 0.95, "teto de 0,95");
    const q = (10 * 0.1 + 6 * 0.05) / 16;
    assert.equal(availabilityProxy(hero(1, { pick: 0.1, ban: 0.05 }), 3), (1 - q) ** 3);
    assert.equal(availabilityProxy(hero(1, { pick: 0.1, ban: 0.05 }), -2), 1, "k negativo vira 0 ação");
  });
});

describe("índice e veredito", () => {
  const pool = {
    1: hero(1, { wrAdj: 0.7, B: 1, credible: [0.6, 0.8], lanes: ["jungle"] }),
    2: hero(2, { wrAdj: 0.45, B: 1, credible: [0.4, 0.5], lanes: ["roam"] }),
  };

  it("índice neutro é 50 e a escala é tanh", () => {
    const power = buildTeamPower({
      slots: [{ heroId: 1, lane: "jungle" }, { heroId: 2, lane: "roam" }],
      pool: { 1: hero(1, { wrAdj: 0.5, B: 1, credible: [0.45, 0.55], lanes: ["jungle"] }),
        2: hero(2, { wrAdj: 0.5, B: 1, credible: [0.45, 0.55], lanes: ["roam"] }) },
      books: {},
      opponentIds: [],
      baseline: 0.5,
    });
    assert.equal(power.index, 50);
    assert.equal(power.components.find((c) => c.key === "strength")?.value, 0);
    assert.equal(power.components.find((c) => c.key === "synergy")?.value, null);
    assert.equal(power.components.find((c) => c.key === "matchup")?.value, null);
    assert.equal(power.evidence, "parcial", "sem pares internos nem confronto");
  });

  it("índice cresce com Λ e respeita K", () => {
    const power = buildTeamPower({
      slots: [{ heroId: 1, lane: "jungle" }],
      pool: { 1: hero(1, { wrAdj: 0.5 + POWER_SCALE_K, B: 1, credible: [0.4, 0.6], lanes: ["jungle"] }) },
      books: {},
      opponentIds: [],
      baseline: 0.5,
    });
    assert.ok(Math.abs((power.index ?? 0) - (50 + 50 * Math.tanh(1))) < 1e-9);
    assert.ok(power.band != null);
  });

  it("componente sem suporte sai do denominador e marca parcial", () => {
    const power = buildTeamPower({
      slots: [{ heroId: 1, lane: "jungle" }],
      pool: { 1: hero(1, { wrAdj: 0.6, B: 1, credible: null, lanes: ["jungle"] }) },
      books: { 1: book(1, { countersUp: [pair(9, 0.04)] }) },
      opponentIds: [9],
      baseline: 0.5,
    });
    // Só força (0,1) e confronto (+0,04), sem sinergia (time de 1).
    const expected = (0.1 * COMPONENT_WEIGHTS.strength + 0.04 * COMPONENT_WEIGHTS.matchup)
      / (COMPONENT_WEIGHTS.strength + COMPONENT_WEIGHTS.matchup);
    assert.ok(Math.abs((power.value ?? 0) - expected) < 1e-12);
    assert.equal(power.components.find((c) => c.key === "synergy")?.value, null);
  });

  it("cobertura de rota, flex e contestação são descritivas", () => {
    const power = buildTeamPower({
      slots: [
        { heroId: 1, lane: "jungle" },
        { heroId: 2, lane: "gold" },
      ],
      pool,
      books: {},
      opponentIds: [],
      baseline: 0.5,
    });
    assert.equal(power.laneFitRate, 0.5, "um encaixa, um está fora");
    assert.deepEqual(power.emptyLanes, ["exp", "mid", "roam"]);
    assert.equal(power.flex, 1);
    assert.equal(power.contest.pick, 0.05);
    assert.equal(power.contest.ban, 0.02);
  });

  it("veredito exige 3 heróis por lado", () => {
    const empty = buildTeamPower({ slots: [], pool, books: {}, opponentIds: [], baseline: 0.5 });
    const verdict = draftVerdict(empty, empty);
    assert.equal(verdict.label, "Leitura incompleta");
    assert.equal(verdict.delta, null);
  });

  it("veredito usa as faixas 3 / 8 / 15", () => {
    const power = (index) => ({ ...buildTeamPower({ slots: [], pool, books: {}, opponentIds: [], baseline: 0.5 }), index, filled: 5 });
    assert.equal(draftVerdict(power(52), power(50)).label, "Equilíbrio");
    assert.equal(draftVerdict(power(55), power(50)).label, "Vantagem leve");
    assert.equal(draftVerdict(power(60), power(50)).label, "Vantagem");
    assert.equal(draftVerdict(power(70), power(50)).label, "Vantagem ampla");
    assert.equal(draftVerdict(power(50), power(70)).tone, "rose");
    assert.match(draftVerdict(power(60), power(50)).detail, /Não é probabilidade/);
  });
});

describe("primeiro pick", () => {
  it("lê turnos, exposição do 1º lock e respostas do último pick", () => {
    const pool = {
      1: hero(1, { lanes: ["jungle"] }),
      5: hero(5, { name: "Counter" }),
    };
    let state = setPick(emptyDraft(), "us", 0, 1);
    const read = readFirstPick(state, pool, { 1: book(1, { countersDown: [pair(5, -0.04)] }) });

    assert.equal(read.side, "us");
    assert.equal(read.firstTurns.length, 5);
    assert.equal(read.firstLast, 15);
    assert.equal(read.secondLast, 16);
    assert.equal(read.exposure?.heroId, 1);
    assert.equal(read.exposure?.available, 1);
    assert.equal(read.exposure?.worst, 0.04);
    assert.equal(read.exposure?.worstName, "Counter");
  });

  it("counter já usado não conta como resposta disponível", () => {
    let state = setFirst(setPick(emptyDraft(), "us", 0, 1), "them");
    state = setPick(state, "them", 0, 5);
    const read = readFirstPick(state, { 1: hero(1), 5: hero(5) }, { 1: book(1, { countersDown: [pair(5, 0.04)] }) });
    assert.equal(read.exposure?.available, 0);
  });
});

describe("sugestões", () => {
  const pool = {
    1: hero(1, { name: "A", wrAdj: 0.9, B: 1, lanes: ["mid"] }),
    2: hero(2, { name: "B", wrAdj: 0.6, B: 1, lanes: ["exp"] }),
    3: hero(3, { name: "C", wrAdj: 0.5, B: 1, lanes: ["exp"] }),
    9: hero(9, { name: "Z", wrAdj: 0.95, B: 1, lanes: ["exp"], pick: 0.2, ban: 0.3 }),
  };

  it("encaixe de rota vem antes do score bruto", () => {
    const list = pickSuggestions(emptyDraft(), pool, {}, 0.5);
    assert.equal(list[0]?.heroId, 9, "θ̂ maior e encaixa em exp");
    const a = list.find((c) => c.heroId === 1);
    const b = list.find((c) => c.heroId === 2);
    assert.ok(list.indexOf(b) < list.indexOf(a), "fora da rota cai para depois do encaixe");
    assert.equal(a?.laneFit, false);
  });

  it("herói já usado não é sugerido e a disponibilidade é proxy", () => {
    const state = setPick(emptyDraft(), "us", 0, 9);
    const list = pickSuggestions(state, pool, {}, 0.5);
    assert.equal(list.some((c) => c.heroId === 9), false);
    assert.equal(list[0]?.k, 8);
  });

  it("sem pick nosso em aberto não há sugestão", () => {
    let state = emptyDraft();
    for (let i = 0; i < DRAFT_SLOTS; i++) state = setPick(state, "us", i, 10 + i);
    assert.deepEqual(pickSuggestions(state, pool, {}, 0.5), []);
  });

  it("alvos de ban ordenam por nº de counters, pior severidade e contestação", () => {
    const poolWithBan = {
      1: hero(1),
      2: hero(2),
      7: hero(7, { pick: 0.05, ban: 0.01 }),
      8: hero(8, { pick: 0.1, ban: 0.2 }),
    };
    const state = setPick(setPick(emptyDraft(), "us", 0, 1), "us", 1, 2);
    const books = {
      1: book(1, { countersDown: [pair(7, 0.03), pair(8, 0.05)] }),
      2: book(2, { countersDown: [pair(8, 0.02)] }),
    };
    const targets = banTargets(state, poolWithBan, books);
    assert.equal(targets[0]?.heroId, 8, "countera dois picks nossos no topo");
    assert.equal(targets[0]?.counters, 2);
    assert.equal(targets[0]?.worst, 0.05);
    assert.ok(Math.abs((targets[0]?.contested ?? 0) - 0.3) < 1e-12);
    assert.equal(targets[1]?.heroId, 7);
  });

  it("sem counter observado, a lista de bans é vazia (não inventa alvo)", () => {
    assert.deepEqual(banTargets(emptyDraft(), pool, {}), []);
  });
});

describe("analyzeDraft", () => {
  it("junta poder, veredito, turnos e sugestões sem quebrar em draft vazio", () => {
    const analysis = analyzeDraft(emptyDraft(), { pool: {}, books: {}, baseline: null });
    assert.equal(analysis.ourPower.filled, 0);
    assert.equal(analysis.theirPower.filled, 0);
    assert.equal(analysis.verdict.label, "Leitura incompleta");
    assert.equal(analysis.next?.step, 7);
    assert.equal(analysis.steps.length, 16);
    assert.deepEqual(analysis.suggestions, []);
    assert.deepEqual(analysis.bans, []);
  });

  it("poder dos dois lados é simétrico na fonte", () => {
    const pool = { 1: hero(1, { wrAdj: 0.7, B: 1, credible: [0.6, 0.8] }) };
    const state = setPick(emptyDraft(), "us", 0, 1);
    const analysis = analyzeDraft(state, { pool, books: {}, baseline: 0.5 });
    assert.ok(Math.abs((analysis.ourPower.components[0].value ?? 0) - 0.2) < 1e-12);
    assert.equal(analysis.theirPower.components[0].value, null);
    assert.equal(analysis.ourPower.index != null, true);
    assert.equal(analysis.theirPower.index, null);
  });
});

// ── v2 (ADR-053) ───────────────────────────────────────────────────────────

describe("divisão do índice em %", () => {
  it("só existe com os dois índices e soma 100", () => {
    assert.equal(indexShare(null, 50), null);
    assert.equal(indexShare(50, null), null);
    const share = indexShare(62, 38);
    assert.ok(Math.abs((share?.ours ?? 0) - 62) < 1e-12);
    assert.ok(Math.abs((share?.theirs ?? 0) - 38) < 1e-12);
    const neutral = indexShare(50, 50);
    assert.equal(neutral?.ours, 50);
  });
});

describe("arquétipo do herói e mix", () => {
  const books = {
    1: book(1, {
      countersUp: [pair(2, 0.03, { profile: "snowball" })],
      countersDown: [pair(3, 0.02, { profile: "snowball" })],
      synergiesUp: [pair(4, 0.01, { profile: "scaling" })],
      synergiesDown: [pair(5, 0.01, { profile: "insufficient_data" })],
    }),
  };

  it("herói herda o perfil dominante dos pares e ignora rótulo inválido", () => {
    const read = heroArchetype(1, books);
    assert.equal(read?.top, "snowball");
    assert.equal(read?.n, 2);
    assert.equal(read?.total, 3, "insufficient_data não entra no denominador");
  });

  it("sem par com perfil vira null, nunca uniforme", () => {
    assert.equal(heroArchetype(99, books), null);
    assert.equal(heroArchetype(1, { 1: book(1) }), null);
  });

  it("oposto declarado só existe para snowball/scaling", () => {
    assert.equal(oppositeArchetype("snowball"), "scaling");
    assert.equal(oppositeArchetype("scaling"), "snowball");
    assert.equal(oppositeArchetype("uniforme"), null);
    assert.equal(oppositeArchetype(null), null);
  });

  it("teamMix conta perfis, separa sem dado e declara o dominante", () => {
    const pool = { 1: hero(1), 2: hero(2), 3: hero(3), 4: hero(4) };
    const mix = teamMix([1, 2, 3, 4], {
      ...books,
      2: book(2, { countersUp: [pair(9, 0.02, { profile: "scaling" })] }),
      3: book(3, { countersUp: [pair(9, 0.02, { profile: "scaling" })] }),
    });
    assert.equal(mix.counts.snowball, 1);
    assert.equal(mix.counts.scaling, 2);
    assert.equal(mix.observed, 3);
    assert.equal(mix.semDado, 1);
    assert.equal(mix.dominant, "scaling");
    void pool;
  });

  it("relação descreve janelas e aponta o contrapeso", () => {
    const ours = teamMix([1], books);
    const theirs = teamMix([2], { 2: book(2, { countersUp: [pair(3, 0.02, { profile: "scaling" })] }) });
    const relation = mixRelation(ours, theirs);
    assert.equal(relation.label, "Janelas opostas");
    assert.equal(relation.target, "snowball");
    assert.equal(relation.tone, "emerald");

    const same = mixRelation(ours, ours);
    assert.equal(same.target, null);
    assert.equal(same.tone, "slate");

    const semDado = mixRelation(teamMix([1], {}), teamMix([2], {}));
    assert.equal(semDado.label, "Mix sem leitura");
    assert.equal(semDado.target, null);
  });
});

describe("curva de duração", () => {
  const books = {
    1: book(1, {
      countersUp: [pair(3, 0.03, { curve: [{ label: "6-8", mid: 7, win: 0.1 }] })],
      synergiesUp: [
        pair(2, 0.02, {
          curve: [
            { label: "6-8", mid: 7, win: 0.55 },
            { label: "8-10", mid: 9, win: 0.58 },
          ],
        }),
      ],
      synergiesDown: [pair(4, -0.02, { curve: [{ label: "6-8", mid: 7, win: 0.9 }] })],
    }),
    2: book(2, {
      synergiesUp: [pair(3, 0.01, { curve: [{ label: "6-8", mid: 7, win: 0.5 }] })],
      synergiesDown: [pair(1, -0.02, { curve: [{ label: "6-8", mid: 7, win: 0.35 }] })],
    }),
    3: book(3, { synergiesUp: [pair(4, 0.01, { curve: [{ label: "6-8", mid: 7, win: 0.4 }] })] }),
    4: book(4, {}),
  };

  it("percorre todas as duplas do time e faz a média por faixa", () => {
    const ours = teamCurve([1, 2], books);
    assert.equal(ours.pairs, 1, "2 heróis → 1 dupla; 5 heróis → até 10");
    assert.equal(ours.points, 3, "as duas perspectivas da dupla entram");
    // faixa 7: (0,55 de 1→2 + 0,35 de 2→1) / 2; faixa 9: só a de 1→2.
    assert.deepEqual(ours.bands.map((band) => band.value), [0.45, 0.58]);
    assert.equal(ours.bands[0].n, 1);
  });

  it("cada dupla vale um voto na faixa, não cada ponto", () => {
    const ours = teamCurve([1, 2, 3], books);
    assert.equal(ours.pairs, 2, "1+2 e 2+3; 1+3 não é listado");
    assert.equal(ours.bands[0].n, 2);
    // duplas: (0,45) e (0,50) → 0,475; média de pontos daria 0,4667.
    assert.ok(Math.abs((ours.bands[0].value ?? 0) - 0.475) < 1e-12);
    assert.deepEqual(ours.bands.map((band) => band.label), ["6-8", "8-10"]);
  });

  it("dupla não listada não contribui, e o herói fora do time não entra", () => {
    // 1+3 não é listado pela fonte: sobram 1+2 e 3+2 — a ordem dos ids não muda.
    const shuffled = teamCurve([3, 1, 2], books);
    assert.equal(shuffled.pairs, 2);
    assert.ok(Math.abs((shuffled.bands[0].value ?? 0) - 0.475) < 1e-12);
    const ours = teamCurve([1, 2, 3], books);
    assert.ok(!ours.bands.some((band) => band.value === 0.9), "par contra herói fora do time fica fora");
    assert.ok(!ours.bands.some((band) => band.value === 0.1), "confronto é a matriz, não a curva");
  });

  it("com menos de duas escolhas não há dupla (buraco, nunca zero)", () => {
    assert.equal(teamCurve([1], books).bands.length, 0);
    assert.equal(teamCurve([], books).bands.length, 0);
  });

  it("delta e linhas alinham por duração e só existem com os dois lados", () => {
    const ours = teamCurve([1, 2], books);
    const theirs = teamCurve([3, 4], books);
    const delta = curveDelta(ours, theirs);
    assert.ok(Math.abs((delta[0].delta ?? 0) - 0.05) < 1e-12);
    assert.equal(delta[1].delta, null);
    assert.equal(curvePeak(delta)?.label, "6-8");
    assert.deepEqual(curveRows(ours, theirs).map((row) => [row.ours, row.theirs]), [[45, 40], [58, null]]);
  });
});

describe("matriz 5×5", () => {
  it("direção vem da lista; os dois lados é contestado", () => {
    const books = {
      1: book(1, { countersUp: [pair(2, 0.04)] }),
      2: book(2, { countersUp: [pair(1, 0.03)] }),
    };
    assert.equal(cellOf(1, 2, books).state, "contested");
    assert.equal(cellOf(1, 2, books).delta, 0.04);

    assert.equal(cellOf(1, 2, { 1: book(1, { countersUp: [pair(2, 0.04)] }) }).state, "advantage");
    assert.equal(cellOf(1, 2, { 1: book(1, { countersDown: [pair(2, 0.04)] }) }).state, "disadvantage");
    assert.equal(cellOf(1, 2, {}).state, "unknown");
  });

  it("monta 5×5 e resume contagem de pares, nunca soma de efeitos", () => {
    let state = emptyDraft();
    for (let i = 0; i < DRAFT_SLOTS; i++) state = setPick(state, "us", i, 10 + i);
    for (let i = 0; i < DRAFT_SLOTS; i++) state = setPick(state, "them", i, 20 + i);
    const matrix = matchupMatrix(state.us, state.them, { 10: book(10, { countersUp: [pair(20, 0.03)] }) });
    assert.equal(matrix.rows.length, 5);
    assert.equal(matrix.cols.length, 5);
    assert.equal(matrix.rows[0].cells[0].state, "advantage");
    const summary = matrixSummary(matrix);
    assert.equal(summary.total, 25);
    assert.equal(summary.advantages, 1);
    assert.equal(summary.observed, 1);
    assert.equal(matrix.wired, true);
  });
});

describe("meta da lane e candidatos", () => {
  const pool = {
    1: hero(1, { wrAdj: 0.7, lanes: ["exp"] }),
    2: hero(2, { wrAdj: 0.6, lanes: ["exp"] }),
    3: hero(3, { wrAdj: 0.5, lanes: ["exp", "mid"] }),
    4: hero(4, { wrAdj: 0.9, lanes: ["gold"] }),
  };

  it("percentil é rank dentro da lane (0–1), null fora dela", () => {
    const meta = laneMetaStats(pool, "exp");
    assert.equal(meta.n, 3);
    assert.equal(lanePercentile(pool[1], meta), 1);
    assert.ok(Math.abs((lanePercentile(pool[3], meta) ?? 0) - 1 / 3) < 1e-12);
    assert.equal(lanePercentile(pool[4], meta), null);
    assert.equal(lanePercentile(undefined, meta), null);
  });

  it("candidatos da lane excluem usados e respeitam o teto", () => {
    const list = laneCandidates(pool, "exp", [1], 1);
    assert.deepEqual(list.map((entry) => entry.id), [2]);
    assert.deepEqual(laneCandidates(pool, "exp", [], 5).map((entry) => entry.id), [1, 2, 3]);
  });
});

describe("recomendador de dois fatores", () => {
  it("balanceOf marca contrapeso, repetição e neutro", () => {
    const scaling = { top: "scaling", n: 2, total: 3 };
    const snowball = { top: "snowball", n: 2, total: 3 };
    const uniforme = { top: "uniforme", n: 2, total: 3 };
    assert.equal(BALANCE_WEIGHT, 0.25);
    assert.equal(balanceOf(scaling, "scaling"), 1);
    assert.equal(balanceOf(snowball, "scaling"), -1);
    assert.equal(balanceOf(uniforme, "scaling"), 0);
    assert.equal(balanceOf(null, "scaling"), null);
    assert.equal(balanceOf(scaling, null), null);
  });

  it("empate de meta é desempatado pelo tipo que contrabalança", () => {
    const pool = {
      1: hero(1, { name: "Repete", wrAdj: 0.6, B: 1, lanes: ["exp"] }),
      2: hero(2, { name: "Contra", wrAdj: 0.6, B: 1, lanes: ["exp"] }),
    };
    const books = {
      1: book(1, { countersUp: [pair(9, 0.05, { profile: "snowball" })] }),
      2: book(2, { countersUp: [pair(9, 0.05, { profile: "scaling" })] }),
    };
    const list = pickSuggestions(emptyDraft(), pool, books, 0.5, { lane: "exp", target: "scaling" });
    assert.equal(list[0]?.heroId, 2);
    assert.equal(list[0]?.balance, 1);
    assert.equal(list.find((c) => c.heroId === 1)?.balance, -1);
    assert.ok((list[0]?.score ?? 0) > (list.find((c) => c.heroId === 1)?.score ?? 0));
  });
});

describe("slots do card", () => {
  it("nextPickIndex prefere a lane alvo entre os slots nossos em aberto", () => {
    const state = setPick(emptyDraft(), "us", 0, 1);
    assert.equal(nextPickIndex(state, "gold"), 4);
    assert.equal(nextPickIndex(state, "mid"), 1, "lane alvo entre os slots em aberto");
    assert.equal(nextPickIndex(state, "exp"), 1, "sem slot da lane, cai no próximo da ordem");
    assert.equal(nextPickIndex(state), 1);
  });

  it("sem slot nosso em aberto não há pick nem ban", () => {
    let state = emptyDraft();
    for (let i = 0; i < DRAFT_SLOTS; i++) state = setPick(state, "us", i, 10 + i);
    for (let i = 0; i < BAN_SLOTS; i++) state = setBan(state, "us", i, 20 + i);
    assert.equal(nextPickIndex(state, "gold"), null);
    assert.equal(nextBanIndex(state), null);
  });

  it("nextBanIndex pega o primeiro ban nosso vazio", () => {
    const state = setBan(emptyDraft(), "us", 0, 5);
    assert.equal(nextBanIndex(state), 1);
  });
});

describe("analyzeDraft v2", () => {
  it("expõe times, divisão, matriz, curva, mix e lane explícita", () => {
    const pool = {
      1: hero(1, { wrAdj: 0.7, B: 1, credible: [0.6, 0.8], lanes: ["exp"] }),
      2: hero(2, { wrAdj: 0.45, B: 1, credible: [0.4, 0.5], lanes: ["roam"] }),
    };
    const books = {
      1: book(1, {
        countersUp: [pair(2, 0.04, { profile: "snowball", pairKey: "p1" })],
        synergiesUp: [
          pair(3, 0.02, {
            profile: "snowball",
            pairKey: "p3",
            curve: [{ label: "6-8", mid: 7, win: 0.55 }],
          }),
        ],
      }),
      2: book(2, { countersDown: [pair(1, 0.04, { profile: "scaling", pairKey: "p2" })] }),
      3: book(3, { synergiesUp: [pair(1, 0.02, { profile: "snowball", pairKey: "p4" })] }),
    };
    const state = setPick(setPick(setPick(emptyDraft(), "us", 0, 1), "us", 1, 3), "them", 0, 2);
    const analysis = analyzeDraft(state, { pool, books, baseline: 0.5, lane: "gold" });

    assert.equal(analysis.lane, "gold");
    assert.deepEqual(analysis.teams, { us: [1, 3], them: [2] });
    assert.ok(analysis.share);
    assert.equal(analysis.matrix.rows.length, 5);
    assert.equal(analysis.matrixSummary.total, 25);
    // Dupla consecutiva 1+3: curva no livro de 1.
    assert.equal(analysis.curve.ours.bands.length, 1);
    assert.equal(analysis.curve.ours.pairs, 1);
    // Um herói só do outro lado não forma dupla.
    assert.equal(analysis.curve.theirs.bands.length, 0);
    assert.equal(analysis.mix.relation.label, "Janelas opostas");
    assert.equal(analysis.mix.relation.target, "snowball");
  });
});
