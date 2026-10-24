import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_PICK, TOTAL_ITEM_SLOTS, evidenceLabel, freeItemSlots, pickFromBuild,
  scoreCombination, validatePick, valueText,
} from "../src/shared/domain/combiner.ts";

// Fixture mínima no formato de `body.combiner` (ADR-030/ADR-031).
const component = (extra = {}) => ({
  contexts: 4, builds: 8, hero_coverage: 4, adoption: 0.5,
  win_median: 0.52, delta_wr_pp_median: 1, value_pp: 1, shrinkage: 0.7,
  value_pp_est: null, value_pp_source: "observed", power: 110,
  contrast: { contexts: 4, paired_contexts: 4, pairs: 12, pooled_pp: 1.5, shrink: 0.57, mode: "paired", status: "no_practical_difference" },
  delta_status: "no_practical_difference", weighting_sensitivity: "stable",
  pattern_scope: "cross_hero", discovery_status: "consolidated",
  support: { status: "ok", k: 4, m: 8, h: 4, min: { contexts: 3, builds: 5, mode: "and" } },
  ...extra,
});

const noContrast = (extra = {}) => component({
  value_pp: null, value_pp_est: null, value_pp_source: "none", power: null,
  contrast: { contexts: 0, paired_contexts: 0, pairs: 0, pooled_pp: null, shrink: 0, mode: null, status: "insufficient" },
  support: { status: "insufficient", k: 1, m: 1, h: 1, min: { contexts: 3, builds: 5, mode: "and" } },
  ...extra,
});

const combiner = {
  scale: {
    base: 100, points_per_pp: 10, shrink_k: 3,
    slots: { items: 6, emblems: 1, talents: 3, spells: 1 },
    value_unit: "pp_contrast_shrunk",
    index_rule: "100 + points_per_pp * média(value_pp observado ou estimado)",
    contrast: { shrink_k: 3, min: {}, evidence_rule: "observed/estimated/descriptive/none" },
  },
  items: [
    { id: 1001, name: "Sword", icon: null, archetype: "physical_attack", archetype_label: "Ataque físico", ...component({ value_pp: 2, power: 120 }) },
    { id: 9001, name: "Boots", icon: null, archetype: "movement", archetype_label: "Movimento", ...component({ value_pp: 1 }) },
    { id: 9002, name: "Boots 2", icon: null, archetype: "movement", archetype_label: "Movimento", ...component({ value_pp: 1 }) },
    { id: 3001, name: "Sem contraste", icon: null, archetype: "magic_defense", archetype_label: "Defesa mágica", ...noContrast() },
    { id: 3002, name: "Estimado", icon: null, archetype: "magic_defense", archetype_label: "Defesa mágica", ...noContrast({ value_pp_est: 1.5, value_pp_source: "estimated", power: 115, contrast: { contexts: 2, paired_contexts: 2, pairs: 2, pooled_pp: 4, shrink: 0.4, mode: "paired", status: "positive" } }) },
  ],
  emblems: [{
    emblem_id: 20012, name: "Marksman", icon: null, attrs: null,
    ...noContrast({
      value_pp_source: "descriptive",
      value_reason: "a escolha do emblema é constante dentro do herói — sem contraste para estimar peso",
    }),
  }],
  talents: [
    { id: 1, name: "T1", tier: 1, desc: null, icon: null, label: "T1", ...component({ value_pp: 1 }) },
    { id: 2, name: "T2", tier: 2, desc: null, icon: null, label: "T2", ...component({ value_pp: -1 }) },
    { id: 3, name: "T3", tier: 2, desc: null, icon: null, label: "T3", ...component({ value_pp: 2 }) },
  ],
  spells: [{ name: "Flicker", icon: null, desc: null, ...component({ value_pp: 0.5 }) }],
  heroes: [{ id: 7, name: "H7", head: null, tier: "A", wrAdj: 0.51, win: 0.5, ref_win: 0.49, hero_mean_win: 0.5, builds: 4 }],
};

describe("combinador: índice aditivo", () => {
  it("índice é 100 + 10 × média dos pesos; emblema descritivo fica fora", () => {
    const pick = { itemIds: [1001], emblemId: 20012, talentIds: [1], spellName: "Flicker" };
    const score = scoreCombination(pick, combiner);
    // valores no índice: 2 (item) + 1 (talento) + 0.5 (feitiço) = 3.5 / 3 = 1.1667
    assert.equal(score.withData, 3);
    assert.equal(score.total, 4);
    assert.equal(score.observed, 3);
    assert.equal(score.estimated, 0);
    assert.equal(score.descriptive, 1);
    assert.equal(score.meanPp, 1.17);
    assert.equal(score.index, 111.7);
    const emblem = score.contributions.find((c) => c.kind === "emblem");
    assert.equal(emblem.evidence, "descriptive");
    assert.equal(emblem.hasData, false);
    assert.equal(emblem.points, null);
    assert.match(emblem.reason, /constante dentro do herói/);
    const points = score.contributions.reduce((s, c) => s + (c.points ?? 0), 0);
    assert.ok(Math.abs(points - (score.index - combiner.scale.base)) < 0.05, `pontos ${points} != índice`);
  });

  it("componente sem contraste não soma e reduz a cobertura", () => {
    const pick = { itemIds: [1001, 3001], emblemId: null, talentIds: [], spellName: null };
    const score = scoreCombination(pick, combiner);
    assert.equal(score.total, 2);
    assert.equal(score.withData, 1);
    assert.equal(score.coverage, 0.5);
    assert.equal(score.index, 120);
    const semContraste = score.contributions.find((c) => c.id === 3001);
    assert.equal(semContraste.hasData, false);
    assert.equal(semContraste.evidence, "none");
    assert.equal(semContraste.points, null);
    assert.equal(semContraste.supportStatus, "insufficient");
  });

  it("estimado entra no índice com o valor encolhido", () => {
    const score = scoreCombination({ itemIds: [3002], emblemId: null, talentIds: [], spellName: null }, combiner);
    assert.equal(score.estimated, 1);
    assert.equal(score.observed, 0);
    assert.equal(score.withData, 1);
    assert.equal(score.index, 115);
    const row = score.contributions[0];
    assert.equal(row.evidence, "estimated");
    assert.equal(row.valuePp, null);
    assert.equal(row.valuePpEst, 1.5);
    assert.equal(row.valueUsed, 1.5);
  });

  it("combinação vazia devolve índice nulo, nunca 100", () => {
    const score = scoreCombination(EMPTY_PICK, combiner);
    assert.equal(score.index, null);
    assert.equal(score.meanPp, null);
    assert.equal(score.total, 0);
    assert.equal(score.coverage, 0);
  });

  it("componente fora do recorte entra como sem dado, com o id no rótulo", () => {
    const score = scoreCombination({ itemIds: [4242], emblemId: null, talentIds: [], spellName: null }, combiner);
    assert.equal(score.contributions[0].label, "#4242");
    assert.equal(score.contributions[0].hasData, false);
    assert.equal(score.index, null);
  });
});

describe("combinador: texto de evidência", () => {
  it("nunca mostra 0 no lugar de sem dado", () => {
    assert.equal(valueText("observed", 2, null), "+2.00 pp");
    assert.equal(valueText("estimated", null, 1.5), "~+1.50 pp");
    assert.equal(valueText("descriptive", null, null), "descritivo");
    assert.equal(valueText("none", null, null), "sem contraste");
    assert.equal(valueText(undefined, null, null), "sem contraste");
    assert.equal(evidenceLabel("observed"), "observado");
    assert.equal(evidenceLabel("estimated"), "estimado");
    assert.equal(evidenceLabel("descriptive"), "descritivo");
    assert.equal(evidenceLabel("none"), "sem contraste");
  });
});

describe("combinador: regras de slot", () => {
  it("aceita configuração válida", () => {
    const check = validatePick({ itemIds: [1001, 9001], emblemId: 20012, talentIds: [1, 2], spellName: "Flicker" }, combiner);
    assert.equal(check.ok, true, check.errors.join(" · "));
  });

  it("barra duas botas, item repetido e dois talentos do mesmo tier", () => {
    const boots = validatePick({ itemIds: [9001, 9002], emblemId: null, talentIds: [], spellName: null }, combiner);
    assert.equal(boots.ok, false);
    assert.ok(boots.errors.includes("só uma bota"));

    const dup = validatePick({ itemIds: [1001, 1001], emblemId: null, talentIds: [], spellName: null }, combiner);
    assert.ok(dup.errors.includes("item repetido"));

    const tiers = validatePick({ itemIds: [], emblemId: null, talentIds: [2, 3], spellName: null }, combiner);
    assert.ok(tiers.errors.includes("um talento por tier"));
  });

  it("barra mais de 6 itens", () => {
    const check = validatePick({ itemIds: [1, 2, 3, 4, 5, 6, 7], emblemId: null, talentIds: [], spellName: null }, combiner);
    assert.equal(check.ok, false);
    assert.ok(check.errors.some((e) => e.includes("no máximo 6 itens")));
  });
});

// Build observada no formato de `body.top_builds[].builds[]`.
const observedBuild = {
  items: [{ id: 1001, name: "Sword", icon: null }],
  item_ids: [1001, 1002, 1003],
  emblem: { id: 20012, name: "Marksman", icon: null, attrs: null, label: "Marksman" },
  talents: [{ id: 1, name: "T1", tier: 1, icon: null, desc: null, label: "T1" }],
  spell: { name: "Flicker", icon: null },
  win: 0.53, pick: 0.1, delta_wr_pp_vs_most_used: 1.2,
  references: { most_used_win: 0.51 }, core_key: "k", variant_key: "v",
};

describe("combinador: build observada → pick", () => {
  it("leva itens, emblema, talentos e feitiço da build observada", () => {
    const pick = pickFromBuild(observedBuild);
    assert.deepEqual(pick.itemIds, [1001, 1002, 1003]);
    assert.equal(pick.emblemId, 20012);
    assert.deepEqual(pick.talentIds, [1]);
    assert.equal(pick.spellName, "Flicker");
  });

  it("extras entram no fim e item repetido da build é ignorado", () => {
    const pick = pickFromBuild(observedBuild, [1002, 4001]);
    assert.deepEqual(pick.itemIds, [1001, 1002, 1003, 4001]);
  });

  it("slots livres descontam os itens observados e os extras, nunca negativo", () => {
    assert.equal(freeItemSlots(observedBuild), 3);
    assert.equal(freeItemSlots(observedBuild, [4001]), 2);
    assert.equal(freeItemSlots(observedBuild, [4001, 4002, 4003]), 0);
    assert.equal(freeItemSlots(observedBuild, [4001, 4002, 4003, 4004]), 0);
    assert.equal(TOTAL_ITEM_SLOTS, 6);
  });

  it("build completa em 6 itens flui para o índice com cobertura somada", () => {
    const pick = pickFromBuild(observedBuild, [4001, 4002, 4003]);
    assert.equal(pick.itemIds.length, TOTAL_ITEM_SLOTS);
    assert.equal(freeItemSlots(observedBuild, [4001, 4002, 4003]), 0);
    const score = scoreCombination(pick, combiner);
    // No índice: 1001 (2,0) + talento (1,0) + feitiço (0,5) → média 1,1667.
    // Fora: emblema (descritivo) e itens sem contraste entram na cobertura, não no índice.
    assert.equal(score.withData, 3);
    assert.equal(score.total, 9);
    assert.equal(score.index, 111.7);
  });
});
