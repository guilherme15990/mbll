import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LOADOUT_VERSION,
  decodeLoadout,
  encodeLoadout,
  forkObservedBuild,
  freeCompositionItems,
  matchLoadout,
  observedEvidence,
  signatureOfPick,
} from "../src/shared/domain/loadout.ts";

// Fixtures no formato real de `Build` (ficha do herói) e `Loadout`.
const pick = (extra = {}) => ({
  itemIds: [1, 2, 3],
  emblemId: 9,
  talentIds: [11, 12, 13],
  spellName: "Retribuição",
  ...extra,
});

const loadout = (extra = {}) => ({
  v: LOADOUT_VERSION,
  heroId: 42,
  lane: "gold",
  rank: "mythic",
  window: "7",
  pick: pick(),
  provenance: "observed",
  observedItems: 3,
  ref: "1-2-3|9|11-12-13|retribuição",
  ...extra,
});

const observedBuild = (extra = {}) => ({
  items: [{ id: 1, name: "A", icon: null }, { id: 2, name: "B", icon: null }, { id: 3, name: "C", icon: null }],
  emblem: { id: 9, name: "Emblema", icon: null },
  talents: [{ id: 11, name: "T1", tier: 1, icon: null }, { id: 12, name: "T2", tier: 2, icon: null }, { id: 13, name: "T3", tier: 3, icon: null }],
  spell: { name: "Retribuição", icon: null },
  win: 0.54,
  pick: 0.11,
  lift_vs_most_used: 0.02,
  lift_vs_mean: 0.01,
  reference_win: 0.52,
  ...extra,
});

describe("codec do loadout", () => {
  it("ida e volta preserva composição, contexto e acento", () => {
    const result = decodeLoadout(encodeLoadout(loadout()));
    assert.equal(result.ok, true);
    assert.deepEqual(result.loadout, loadout());
  });

  it("código gerado é base64url (sem + / =) e cabe na URL", () => {
    const code = encodeLoadout(loadout());
    assert.match(code, /^[A-Za-z0-9_-]+$/);
    assert.ok(code.length < 300);
  });

  it("aceita base64url com padding de outra origem", () => {
    const code = encodeLoadout(loadout());
    assert.equal(decodeLoadout(`${code}==`).ok, true);
  });

  it("recusa URL vazia com mensagem acionável", () => {
    const result = decodeLoadout(null);
    assert.equal(result.ok, false);
    assert.match(result.error, /não traz nenhum loadout/i);
  });

  it("recusa código ilegível sem lançar", () => {
    assert.equal(decodeLoadout("nao-e-base64url!").ok, false);
  });

  it("recusa correio corrompido sem lançar", () => {
    const broken = Buffer.from("{nao-e-json", "utf8").toString("base64url");
    assert.equal(decodeLoadout(broken).ok, false);
  });

  it("recusa versão desconhecida", () => {
    const payload = Buffer.from(JSON.stringify({ v: 2, h: 42, l: "gold", r: "mythic", w: "7", i: [1] }), "utf8").toString("base64url");
    const result = decodeLoadout(payload);
    assert.equal(result.ok, false);
    assert.match(result.error, /Versão/);
  });

  it("recusa mais de 6 itens", () => {
    const payload = Buffer.from(
      JSON.stringify({ v: 1, h: 42, l: "gold", r: "mythic", w: "7", i: [1, 2, 3, 4, 5, 6, 7], e: null, t: [], s: null, p: 1, n: 3, f: null }),
      "utf8",
    ).toString("base64url");
    assert.equal(decodeLoadout(payload).ok, false);
  });

  it("deduplica ids e limita observedItems ao total de itens", () => {
    const payload = Buffer.from(
      JSON.stringify({ v: 1, h: 42, l: "gold", r: "mythic", w: "7", i: [1, 1, 2], e: null, t: [5, 5], s: null, p: 1, n: 99, f: null }),
      "utf8",
    ).toString("base64url");
    const result = decodeLoadout(payload);
    assert.equal(result.ok, true);
    assert.deepEqual(result.loadout.pick.itemIds, [1, 2]);
    assert.deepEqual(result.loadout.pick.talentIds, [5]);
    assert.equal(result.loadout.observedItems, 2);
  });

  it("recusa código acima do teto", () => {
    assert.equal(decodeLoadout("a".repeat(4000)).ok, false);
  });
});

describe("fork de build observada", () => {
  it("materializa composição e contexto", () => {
    const fork = forkObservedBuild({ heroId: "42", lane: "gold", rank: "mythic", window: "7", build: observedBuild() });
    assert.equal(fork.ok, true);
    assert.equal(fork.loadout.heroId, 42);
    assert.deepEqual(fork.loadout.pick.itemIds, [1, 2, 3]);
    assert.equal(fork.loadout.pick.emblemId, 9);
    assert.deepEqual(fork.loadout.pick.talentIds, [11, 12, 13]);
    assert.equal(fork.loadout.provenance, "observed");
    assert.equal(fork.loadout.observedItems, 3);
    assert.deepEqual(fork.skipped, []);
  });

  it("a carga gerada sobrevive ao codec", () => {
    const fork = forkObservedBuild({ heroId: 42, lane: "gold", rank: "mythic", window: "7", build: observedBuild() });
    const decoded = decodeLoadout(encodeLoadout(fork.loadout));
    assert.equal(decoded.ok, true);
    assert.deepEqual(decoded.loadout.pick, fork.loadout.pick);
    assert.equal(decoded.loadout.ref, fork.loadout.ref);
  });

  it("recusa build sem id de item (não endereçável)", () => {
    const fork = forkObservedBuild({
      heroId: 42, lane: "gold", rank: "mythic", window: "7",
      build: { items: [{ name: "sem id" }] },
    });
    assert.equal(fork.ok, false);
    assert.match(fork.error, /sem id de item/);
  });

  it("reporta o que foi descartado em vez de inventar id", () => {
    const fork = forkObservedBuild({
      heroId: 42, lane: "gold", rank: "mythic", window: "7",
      build: { items: [{ id: 7 }], emblem: { name: "sem id" }, talents: [{ name: "sem id" }], spell: { name: "Flicker" } },
    });
    assert.equal(fork.ok, true);
    assert.equal(fork.loadout.pick.emblemId, null);
    assert.deepEqual(fork.loadout.pick.talentIds, []);
    assert.ok(fork.skipped.includes("emblema sem id"));
    assert.ok(fork.skipped.includes("talento sem id"));
  });

  it("recusa contexto incompleto", () => {
    assert.equal(forkObservedBuild({ heroId: 42, lane: "", rank: "mythic", window: "7", build: observedBuild() }).ok, false);
    assert.equal(forkObservedBuild({ heroId: "abc", lane: "gold", rank: "mythic", window: "7", build: observedBuild() }).ok, false);
  });
});

describe("match contra builds observadas", () => {
  it("composição idêntica é exact e carrega evidência", () => {
    const match = matchLoadout(loadout(), [observedBuild()]);
    assert.equal(match.status, "exact");
    const evidence = observedEvidence(match);
    assert.equal(evidence.win, 0.54);
    assert.equal(evidence.liftVsMostUsed, 0.02);
    assert.equal(evidence.referenceWin, 0.52);
  });

  it("ordem dos itens não importa (a fonte não traz ordem de compra)", () => {
    const reordered = observedBuild({ items: [{ id: 3 }, { id: 1 }, { id: 2 }] });
    assert.equal(matchLoadout(loadout(), [reordered]).status, "exact");
  });

  it("emblema sem id na fonte vira partial — nunca exact", () => {
    const match = matchLoadout(loadout(), [observedBuild({ emblem: { name: "Emblema" } })]);
    assert.equal(match.status, "partial");
    assert.deepEqual(match.unknown, ["emblema"]);
    assert.equal(observedEvidence(match), null);
  });

  it("trocar um item cai para none e zera a evidência", () => {
    const edited = loadout({ pick: pick({ itemIds: [1, 2, 4] }) });
    const match = matchLoadout(edited, [observedBuild()]);
    assert.equal(match.status, "none");
    assert.deepEqual(match.mismatched, ["itens"]);
    assert.equal(observedEvidence(match), null);
  });

  it("composição de 6 itens nunca herda estatística de build de 3", () => {
    const wide = loadout({ pick: pick({ itemIds: [1, 2, 3, 4, 5, 6] }) });
    const match = matchLoadout(wide, [observedBuild()]);
    assert.equal(match.status, "none");
    assert.equal(observedEvidence(match), null);
    assert.equal(freeCompositionItems(wide), 3);
  });

  it("feitiço diferente derruba o match", () => {
    const other = loadout({ pick: pick({ spellName: "Flicker" }) });
    assert.equal(matchLoadout(other, [observedBuild()]).status, "none");
  });

  it("sem builds, não há match nem evidência", () => {
    const match = matchLoadout(loadout(), []);
    assert.equal(match.status, "none");
    assert.equal(observedEvidence(match), null);
  });

  it("escolhe a build idêntica entre várias", () => {
    const target = observedBuild({ win: 0.6, lift_vs_most_used: 0.05 });
    const match = matchLoadout(loadout(), [observedBuild({ items: [{ id: 99 }] }), target]);
    assert.equal(match.status, "exact");
    assert.equal(observedEvidence(match).win, 0.6);
  });
});

describe("assinatura e slots livres", () => {
  it("assinatura é estável e insensível à ordem", () => {
    assert.equal(signatureOfPick(pick({ itemIds: [3, 1, 2] })), signatureOfPick(pick()));
    assert.equal(signatureOfPick(pick({ talentIds: [13, 12, 11] })), signatureOfPick(pick()));
  });

  it("assinatura distingue composições diferentes", () => {
    assert.notEqual(signatureOfPick(pick()), signatureOfPick(pick({ emblemId: 10 })));
    assert.notEqual(signatureOfPick(pick()), signatureOfPick(pick({ spellName: "Flicker" })));
  });

  it("slots livres descontam só o que foi observado", () => {
    assert.equal(freeCompositionItems(loadout()), 0);
    assert.equal(freeCompositionItems(loadout({ pick: pick({ itemIds: [1, 2, 3, 4] }) })), 1);
    assert.equal(freeCompositionItems(loadout({ observedItems: 0 })), 3);
  });
});
