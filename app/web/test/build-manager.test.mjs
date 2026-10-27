import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addCompletionItem,
  applyCandidate,
  candidateBlockReason,
  completionSuggestions,
  coreItems,
  maxIndexPick,
  observedRuneCombos,
  pickFromObservedBuild,
  removeSlot,
  sameAsObserved,
} from "../src/shared/domain/buildManager.ts";
import { liftPp, liftTone } from "../src/shared/format.ts";

// Fixtures no formato real de `Build` (/heroes/:id/builds) e de
// `AggregateCombinerItem` (/builds/aggregate → combiner.items).
const item = (id, extra = {}) => ({ id, name: `Item ${id}`, icon: null, ...extra });
const build = (items, extra = {}) => ({
  items,
  win: 0.5,
  pick: 0.1,
  lift_vs_most_used: 0.01,
  emblem: null,
  talents: [],
  spell: null,
  ...extra,
});
const component = (id, extra = {}) => ({
  id,
  name: `Item ${id}`,
  icon: null,
  archetype: "attack",
  archetype_label: "Ataque",
  value_pp: 0.8,
  value_pp_est: null,
  value_pp_source: "observed",
  adoption: 0.3,
  builds: 5,
  contexts: 3,
  value_reason: null,
  ...extra,
});
const pick = (itemIds, extra = {}) => ({
  itemIds,
  emblemId: null,
  talentIds: [],
  spellName: null,
  ...extra,
});

describe("coreItems", () => {
  it("conta presença por build, sem duplicar item repetido na mesma build", () => {
    const builds = [
      build([item(1), item(2)]),
      build([item(1), item(2), item(2)]),
      build([item(1), item(3)]),
      build([]),
    ];
    const core = coreItems(builds, 6);

    assert.deepEqual(core.map((c) => [c.id, c.builds]), [[1, 3], [2, 2], [3, 1]]);
    // Denominador é o total de builds do recorte (inclusive a build sem item).
    assert.equal(core[0].share, 0.75);
    assert.equal(core[1].share, 0.5);
  });

  it("mediana do win e melhor lift ignoram ausência (nunca viram 0)", () => {
    const builds = [
      build([item(1)], { win: 0.40, lift_vs_most_used: -0.02 }),
      build([item(1)], { win: 0.50, lift_vs_most_used: 0.03 }),
      build([item(1)], { win: 0.60, lift_vs_most_used: null }),
    ];
    const [row] = coreItems(builds);
    assert.equal(row.winMedian, 0.5);
    assert.equal(row.bestLift, 0.03);
  });

  it("sem win/lift em nenhuma build devolve null, não zero", () => {
    const [row] = coreItems([build([item(1)], { win: null, lift_vs_most_used: null })]);
    assert.equal(row.winMedian, null);
    assert.equal(row.bestLift, null);
  });

  it("ignora id inválido e item sem id, e respeita o limite", () => {
    const builds = [
      build([item(1), item(2), item(3)]),
      build([{ id: 0, name: "zero", icon: null }, { id: -1, name: "neg", icon: null }, { id: 1.5, name: "float", icon: null }, { name: "sem id", icon: null }]),
    ];
    const core = coreItems(builds, 2);
    assert.deepEqual(core.map((c) => c.id), [1, 2]);
  });

  it("recorte vazio devolve lista vazia", () => {
    assert.deepEqual(coreItems([]), []);
  });
});

describe("pickFromObservedBuild", () => {
  it("materializa itens, emblema, talentos e feitiço válidos", () => {
    const observed = build([item(1), item(2), item(1), { name: "sem id", icon: null }], {
      emblem: { id: 9, name: "Emblema", icon: null },
      talents: [
        { id: 11, name: "T1", tier: 1, icon: null },
        { id: 11, name: "T1 dup", tier: 1, icon: null },
      ],
      spell: { name: "  Retribuição  ", icon: null },
    });

    assert.deepEqual(pickFromObservedBuild(observed), {
      itemIds: [1, 2],
      emblemId: 9,
      talentIds: [11],
      spellName: "Retribuição",
    });
  });

  it("não inventa id: emblema inválido, nome em branco e listas ausentes viram null/vazio", () => {
    const observed = build([{ id: 0 }, { id: 2.5 }, { id: -3 }], {
      emblem: { id: 0 },
      talents: [{ id: 0 }, { id: 2.5 }],
      spell: { name: "   " },
    });
    assert.deepEqual(pickFromObservedBuild(observed), {
      itemIds: [],
      emblemId: null,
      talentIds: [],
      spellName: null,
    });
  });
});

describe("completionSuggestions", () => {
  it("só sugere item fora da build e fora das adições", () => {
    const items = [component(1), component(2), component(3), component(4)];
    const rows = completionSuggestions(items, pick([1]), [2]);
    assert.deepEqual(rows.map((r) => r.id), [3, 4]);
  });

  it("exclui sem contraste e sem valor observado/estimado", () => {
    const items = [
      component(1, { value_pp: 0.9 }),
      component(2, { value_pp: null, value_pp_est: null, value_pp_source: "none" }),
      component(3, { value_pp: null, value_pp_est: 0.4, value_pp_source: "estimated" }),
      component(4, { value_pp: 0.7, value_pp_source: "descriptive" }),
      component(5, { value_pp: null, value_pp_est: null, value_pp_source: "observed" }),
    ];
    const rows = completionSuggestions(items, pick([]));
    assert.deepEqual(rows.map((r) => r.id), [1, 3]);
    assert.equal(rows[1].evidence, "estimated");
    assert.equal(rows[1].valueUsed, 0.4);
  });

  it("value_pp tem precedência sobre value_pp_est no índice", () => {
    const rows = completionSuggestions(
      [component(1, { value_pp: 0.6, value_pp_est: 0.9, value_pp_source: "estimated" })],
      pick([]),
    );
    assert.equal(rows[0].evidence, "estimated");
    assert.equal(rows[0].valueUsed, 0.6);
    assert.equal(rows[0].valuePp, 0.6);
    assert.equal(rows[0].valuePpEst, 0.9);
  });

  it("respeita uma bota no máximo", () => {
    const items = [
      component(1, { archetype: "movement", archetype_label: "Movimento", value_pp: 0.5 }),
      component(2, { archetype: "movement", archetype_label: "Movimento", value_pp: 0.4 }),
      component(3, { value_pp: 0.3 }),
    ];

    const withoutBoots = completionSuggestions(items, pick([]));
    assert.deepEqual(withoutBoots.map((r) => r.id), [1, 2, 3]);

    const withBoots = completionSuggestions(items, pick([1]));
    assert.deepEqual(withBoots.map((r) => r.id), [3]);
  });

  it("ordena por peso, adoção, builds e nome; e respeita o limite", () => {
    const items = [
      component(1, { value_pp: 0.4, adoption: 0.9 }),
      component(2, { value_pp: 0.9, adoption: 0.1 }),
      component(3, { value_pp: 0.4, adoption: 0.2 }),
      component(4, { value_pp: 0.4, adoption: 0.2, builds: 99 }),
    ];
    assert.deepEqual(completionSuggestions(items, pick([])).map((r) => r.id), [2, 1, 4, 3]);
    assert.deepEqual(completionSuggestions(items, pick([]), [], 2).map((r) => r.id), [2, 1]);
  });

  it("valor 0 observado é dado real, não ausência", () => {
    const rows = completionSuggestions([component(1, { value_pp: 0 })], pick([]));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].valueUsed, 0);
  });
});

describe("addCompletionItem", () => {
  const items = [
    component(1),
    component(2),
    component(3, { archetype: "movement", archetype_label: "Movimento" }),
    component(4, { archetype: "movement", archetype_label: "Movimento" }),
    component(5),
    component(6),
    component(7),
  ];

  it("adiciona item válido", () => {
    assert.deepEqual(addCompletionItem([], 1, items), [1]);
  });

  it("bloqueia id inválido, item desconhecido e repetição", () => {
    assert.deepEqual(addCompletionItem([], 0, items), []);
    assert.deepEqual(addCompletionItem([], 2.5, items), []);
    assert.deepEqual(addCompletionItem([], 99, items), []);
    assert.deepEqual(addCompletionItem([1], 1, items), [1]);
  });

  it("bloqueia acima de 6 itens", () => {
    assert.deepEqual(addCompletionItem([1, 2, 3, 5, 6, 7], 4, items), [1, 2, 3, 5, 6, 7]);
  });

  it("permite uma bota e bloqueia a segunda", () => {
    assert.deepEqual(addCompletionItem([], 3, items), [3]);
    assert.deepEqual(addCompletionItem([3], 4, items), [3]);
  });

  it("não muta o array recebido", () => {
    const current = [1];
    const next = addCompletionItem(current, 2, items);
    assert.deepEqual(current, [1]);
    assert.deepEqual(next, [1, 2]);
  });
});

describe("lift da fonte (fração 0–1) em pontos percentuais", () => {
  it("converte fração em pp e nunca aplica 100× duas vezes", () => {
    assert.equal(liftPp(0.034), "+3.4 pp");
    assert.equal(liftPp(-0.018), "-1.8 pp");
    assert.equal(liftPp(null), "—");
  });

  it("separa ausência, ruído prático e sinal", () => {
    assert.equal(liftTone(null), "unknown");
    assert.equal(liftTone(0.011), "neutral");
    assert.equal(liftTone(0.031), "positive");
    assert.equal(liftTone(-0.031), "negative");
  });
});

describe("sameAsObserved", () => {
  it("ignora ordem e caixa do feitiço", () => {
    const observed = pick([1, 2], { emblemId: 9, talentIds: [11, 12], spellName: "Retribuição" });
    assert.equal(sameAsObserved(pick([2, 1], { emblemId: 9, talentIds: [12, 11], spellName: "  retribuição " }), observed), true);
  });

  it("qualquer peça diferente derruba a equivalência", () => {
    const observed = pick([1, 2], { emblemId: 9, talentIds: [11], spellName: "Flicker" });
    assert.equal(sameAsObserved(pick([1, 3], { emblemId: 9, talentIds: [11], spellName: "Flicker" }), observed), false);
    assert.equal(sameAsObserved(pick([1, 2], { emblemId: 8, talentIds: [11], spellName: "Flicker" }), observed), false);
    assert.equal(sameAsObserved(pick([1, 2], { emblemId: 9, talentIds: [12], spellName: "Flicker" }), observed), false);
    assert.equal(sameAsObserved(pick([1, 2], { emblemId: 9, talentIds: [11], spellName: "Purify" }), observed), false);
  });
});

describe("applyCandidate / removeSlot", () => {
  const items = [
    component(1),
    component(2),
    component(3, { archetype: "movement", archetype_label: "Movimento" }),
    component(4, { archetype: "movement", archetype_label: "Movimento" }),
    component(5),
    component(6),
    component(7),
  ];
  const talents = [
    { id: 11, name: "T1", tier: 1, icon: null, value_pp: 1, value_pp_est: null, value_pp_source: "observed", adoption: 0.5, builds: 3 },
    { id: 12, name: "T2", tier: 2, icon: null, value_pp: 1, value_pp_est: null, value_pp_source: "observed", adoption: 0.5, builds: 3 },
    { id: 13, name: "T3", tier: 3, icon: null, value_pp: 1, value_pp_est: null, value_pp_source: "observed", adoption: 0.5, builds: 3 },
    { id: 21, name: "T1 alt", tier: 1, icon: null, value_pp: 0.5, value_pp_est: null, value_pp_source: "observed", adoption: 0.2, builds: 2 },
  ];
  const ctx = { items, talents, maxItems: 6 };

  it("adiciona, substitui e anexa no primeiro vazio", () => {
    assert.deepEqual(applyCandidate(pick([]), { kind: "item", index: 0 }, { kind: "item", id: 1 }, ctx), {
      ok: true,
      pick: pick([1]),
    });
    assert.deepEqual(applyCandidate(pick([1, 2]), { kind: "item", index: 1 }, { kind: "item", id: 5 }, ctx), {
      ok: true,
      pick: pick([1, 5]),
    });
    assert.deepEqual(applyCandidate(pick([1]), { kind: "item", index: 4 }, { kind: "item", id: 2 }, ctx), {
      ok: true,
      pick: pick([1, 2]),
    });
  });

  it("explica duplicata, teto e segunda bota", () => {
    assert.equal(candidateBlockReason(pick([1]), { kind: "item", index: 1 }, { kind: "item", id: 1 }, ctx), "duplicate");
    assert.equal(candidateBlockReason(pick([1, 2, 3, 4, 5, 6]), { kind: "item", index: 6 }, { kind: "item", id: 7 }, ctx), "full");
    assert.equal(candidateBlockReason(pick([3]), { kind: "item", index: 1 }, { kind: "item", id: 4 }, ctx), "second_boot");
    const blocked = applyCandidate(pick([3]), { kind: "item", index: 1 }, { kind: "item", id: 4 }, ctx);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, "second_boot");
  });

  it("troca talento do mesmo tier e bloqueia tier conflitante", () => {
    const withT1 = applyCandidate(pick([]), { kind: "talent", tier: 1 }, { kind: "talent", id: 11, tier: 1 }, ctx);
    assert.equal(withT1.ok, true);
    const replaced = applyCandidate(withT1.pick, { kind: "talent", tier: 1 }, { kind: "talent", id: 21, tier: 1 }, ctx);
    assert.deepEqual(replaced.pick.talentIds, [21]);
    const conflict = applyCandidate(pick([]), { kind: "talent", tier: 1 }, { kind: "talent", id: 12, tier: 2 }, ctx);
    assert.equal(conflict.ok, false);
    assert.equal(conflict.reason, "tier_conflict");
  });

  it("remove item, emblema, talento do tier e feitiço sem tocar no resto", () => {
    const base = pick([1, 2], { emblemId: 9, talentIds: [11, 12, 13], spellName: "Flicker" });
    assert.deepEqual(removeSlot(base, { kind: "item", index: 0 }, talents).itemIds, [2]);
    assert.equal(removeSlot(base, { kind: "emblem" }, talents).emblemId, null);
    assert.deepEqual(removeSlot(base, { kind: "talent", tier: 2 }, talents).talentIds, [11, 13]);
    assert.equal(removeSlot(base, { kind: "spell" }, talents).spellName, null);
    assert.deepEqual(base.itemIds, [1, 2]);
  });
});

describe("observedRuneCombos", () => {
  it("só agrupa o conjunto exato; spell diferente é outra combinação", () => {
    const talents = [
      { id: 11, name: "T1", tier: 1, icon: null },
      { id: 12, name: "T2", tier: 2, icon: null },
      { id: 13, name: "T3", tier: 3, icon: null },
    ];
    const builds = [
      build([], { emblem: { id: 9, name: "Mago", icon: null }, talents, spell: { name: "Flicker", icon: null } }),
      build([], { emblem: { id: 9, name: "Mago", icon: null }, talents, spell: { name: "Flicker", icon: null } }),
      build([], { emblem: { id: 9, name: "Mago", icon: null }, talents, spell: { name: "Purify", icon: null } }),
      build([], { emblem: { id: 9, name: "Mago", icon: null }, talents: talents.slice(0, 2), spell: { name: "Flicker", icon: null } }),
      build([], { emblem: null, talents: [], spell: null }),
    ];
    const combos = observedRuneCombos(builds, 10);
    assert.equal(combos.length, 3);
    assert.equal(combos[0].builds, 2);
    assert.equal(combos[0].share, 0.4);
    assert.deepEqual(combos[0].talents.map((t) => t.id), [11, 12, 13]);
    assert.equal(combos[0].spellName, "Flicker");
    assert.ok(combos.some((combo) => combo.spellName === "Purify" && combo.builds === 1));
    assert.ok(combos.some((combo) => combo.talents.length === 2 && combo.builds === 1));
  });
});

describe("maxIndexPick", () => {
  it("escolhe os maiores valores, uma bota, um talento por tier e o melhor feitiço", () => {
    const combiner = {
      scale: {
        base: 100, points_per_pp: 10, shrink_k: 3,
        slots: { items: 6, emblems: 1, talents: 3, spells: 1 },
        value_unit: "pp", index_rule: "teste",
      },
      items: [
        component(1, { value_pp: 2.0 }),
        component(2, { value_pp: 1.9 }),
        component(3, { value_pp: 1.8, archetype: "movement", archetype_label: "Movimento" }),
        component(4, { value_pp: 1.7, archetype: "movement", archetype_label: "Movimento" }),
        component(5, { value_pp: 1.6 }),
        component(6, { value_pp: 1.5 }),
        component(7, { value_pp: 1.4 }),
      ],
      emblems: [
        { emblem_id: 9, name: "Mago", icon: null, adoption: 0.4, builds: 2, value_pp_source: "descriptive" },
        { emblem_id: 8, name: "Comum", icon: null, adoption: 0.6, builds: 3, value_pp_source: "descriptive" },
      ],
      talents: [
        { id: 11, name: "T1", tier: 1, icon: null, value_pp: 1.0, value_pp_est: null, value_pp_source: "observed", adoption: 0.5, builds: 3 },
        { id: 12, name: "T2", tier: 2, icon: null, value_pp: 0.9, value_pp_est: null, value_pp_source: "observed", adoption: 0.5, builds: 3 },
        { id: 13, name: "T3", tier: 3, icon: null, value_pp: 0.8, value_pp_est: null, value_pp_source: "observed", adoption: 0.5, builds: 3 },
        { id: 21, name: "T1 alt", tier: 1, icon: null, value_pp: 1.1, value_pp_est: null, value_pp_source: "observed", adoption: 0.4, builds: 2 },
      ],
      spells: [
        { name: "Flicker", icon: null, value_pp: 0.4, value_pp_est: null, value_pp_source: "observed", adoption: 0.5, builds: 3 },
        { name: "Purify", icon: null, value_pp: 0.7, value_pp_est: null, value_pp_source: "observed", adoption: 0.3, builds: 2 },
      ],
      heroes: [],
    };
    const optimized = maxIndexPick(combiner, pick([], { emblemId: 9 }));
    assert.deepEqual(optimized.itemIds, [1, 2, 3, 5, 6, 7]);
    assert.deepEqual(optimized.talentIds, [21, 12, 13]);
    assert.equal(optimized.spellName, "Purify");
    assert.equal(optimized.emblemId, 9);
  });
});
