import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyEquipmentItem,
  normalizeEquipmentCatalog,
  normalizeEmblemCatalog,
  normalizeSpellCatalog,
  parseBuild,
  detectPackages,
  buildAggregate,
  PRACTICAL_DELTA_PP,
} from "../src/index.js";

// Catálogo sintético: 1001+1002 sempre juntos (pacote), 2001 ocasional,
// 2002 raro (suporte insuficiente), 3002+3003 para pacote provisório.
const EQUIPMENT_RECORDS = [
  { data: { equipid: 1001, equipname: "Blade", equipicon: "blade.png", equiptypename: "Attack", equiptips: "Physical ATK +60" } },
  { data: { equipid: 1002, equipname: "Claw", equipicon: "claw.png", equiptypename: "Attack", equiptips: "Physical ATK +30, Attack Speed +20%" } },
  { data: { equipid: 2001, equipname: "Plate", equipicon: "plate.png", equiptypename: "Defense", equiptips: "Physical Defense +50" } },
  { data: { equipid: 2002, equipname: "Tome", equipicon: "tome.png", equiptypename: "Magic", equiptips: "Magic Power +40" } },
  { data: { equipid: 9001, equipname: "Boots", equipicon: "boots.png", equiptypename: "Movement", equiptips: "Movement Speed +40" } },
  { data: { equipid: 3001, equipname: "Robe", equipicon: "robe.png", equiptypename: "Defense", equiptips: "Magic Defense +40" } },
  { data: { equipid: 3002, equipname: "Hybrid", equipicon: "hybrid.png", equiptypename: "Defense", equiptips: "Physical Defense +30, Magic Defense +30" } },
  { data: { equipid: 3003, equipname: "HP Plate", equipicon: "hp.png", equiptypename: "Defense", equiptips: "HP +500" } },
  { data: { equipid: 4001, equipname: "No Tips", equipicon: "none.png", equiptypename: "Attack", equiptips: "" } },
];

const EMBLEM_RECORDS = [1, 2, 3].map((id) => ({
  data: { giftid: id, gifttiers: id, emblemskill: { skillname: `Talent ${id}`, skilldesc: `Desc ${id}`, skillicon: `t${id}.png` } },
}));

const SPELL_RECORDS = [
  { data: { __data: { skillname: "Flicker", skillicon: "flicker.png", skilldesc: "Blink" }, skillshortdesc: "Blink" } },
];

const equipment = normalizeEquipmentCatalog(EQUIPMENT_RECORDS);
const emblems = normalizeEmblemCatalog(EMBLEM_RECORDS);
const spells = normalizeSpellCatalog(SPELL_RECORDS);

const build = (items, win, pick) => ({
  equipid: items,
  build_win_rate: win,
  build_pick_rate: pick,
  emblem: {
    data: {
      emblemid: 20012,
      emblemname: "Marksman",
      emblemattr: { emblemattr: [{ name: "Attack Speed", value: 15 }] },
    },
  },
  new_rune_skill: [1, 2, 3],
  battleskill: { data: { skillname: "Flicker", skillicon: "flicker.png", skilldesc: "Blink" } },
});

// 4 heróis × 4 builds = 16 builds. 1001+1002 sempre juntos (pacote).
const buildsFor = () => [
  build([1001, 1002, 2001], 0.55, 0.30),
  build([2001, 1001, 1002], 0.56, 0.06),
  build([1002, 2001, 1001], 0.56, 0.06),
  build([1001, 1002, 2002], 0.54, 0.04),
];

const contexts = [1, 2, 3, 4].map((id) => ({
  hero: { id, name: `H${id}`, head: null, tier: "A", wrAdj: 0.5 + id * 0.001, win: 0.5, pick: 0.1, ban: 0.1 },
  rawBuilds: buildsFor(),
  status: "ok",
}));

const aggregate = (ctx = contexts, coverage = {}) => buildAggregate({
  lane: "gold",
  rank: "mythic",
  window: 7,
  top: 10,
  population: "ranked",
  contexts: ctx,
  equipment,
  emblems,
  spells,
  coverage: { heroes_in_lane: ctx.length, heroes_with_rank: ctx.length, heroes_requested: ctx.length, ...coverage },
  sources: {},
  generatedAt: "2026-10-20T00:00:00.000Z",
});

describe("classificação e catálogos do agregado", () => {
  it("attack com Physical ATK -> physical_attack; magic power -> magic_attack", () => {
    assert.equal(classifyEquipmentItem(EQUIPMENT_RECORDS[0]).archetype, "physical_attack");
    assert.equal(classifyEquipmentItem(EQUIPMENT_RECORDS[3]).archetype, "magic_attack");
  });
  it("defense separa physical, magic e híbrida; só HP = generic", () => {
    assert.equal(classifyEquipmentItem(EQUIPMENT_RECORDS[2]).archetype, "physical_defense");
    assert.equal(classifyEquipmentItem(EQUIPMENT_RECORDS[5]).archetype, "magic_defense");
    assert.equal(classifyEquipmentItem(EQUIPMENT_RECORDS[6]).archetype, "hybrid_defense");
    assert.equal(classifyEquipmentItem(EQUIPMENT_RECORDS[7]).archetype, "generic_defense");
  });
  it("sem tips nunca é chutado: unclassified", () => {
    const item = classifyEquipmentItem(EQUIPMENT_RECORDS[8]);
    assert.equal(item.archetype, "unclassified");
    assert.equal(item.reason, "sem tips");
  });
  it("normaliza emblemas e feitiços por id/nome", () => {
    assert.equal(emblems[2].name, "Talent 2");
    assert.equal(spells.flicker.name, "Flicker");
  });
});

describe("parse e pacotes", () => {
  it("parseBuild preserva ordem, deduplica ids e resolve runa/feitiço", () => {
    const b = parseBuild(build([1001, 1002, 1001, 2001], 0.55, 0.3), { id: 1, name: "H1" }, { equipment, emblems, spells }, { rank: "mythic", lane: "gold" });
    assert.deepEqual(b.order, [1001, 1002, 2001]);
    assert.deepEqual(b.item_ids, [1001, 1002, 2001]);
    assert.equal(b.core_key, "1001+1002+2001");
    assert.equal(b.emblem.id, 20012);
    assert.equal(b.talents.length, 3);
    assert.equal(b.spell.name, "Flicker");
  });

  it("1001+1002 com suporte vira pacote consolidado; coocorrência é explícita", () => {
    const parsed = contexts.map((c) => ({
      hero: c.hero,
      builds: c.rawBuilds.map((b) => parseBuild(b, c.hero, { equipment, emblems, spells }, { rank: "mythic", lane: "gold" })),
    }));
    const pkgs = detectPackages(parsed, equipment);
    assert.equal(pkgs.length, 1);
    assert.deepEqual(pkgs[0].item_ids, [1001, 1002]);
    assert.equal(pkgs[0].support.status, "ok");
    assert.equal(pkgs[0].inseparable, true);
    assert.equal(pkgs[0].inseparable_observed, true);
    assert.equal(pkgs[0].pattern_scope, "cross_hero");
    assert.equal(pkgs[0].discovery_status, "consolidated");
    assert.equal(pkgs[0].cooccurrence.p_both_min, 0.8);
  });
});

describe("contrato de descobertas (revisão 2026-10-21)", () => {
  const body = aggregate();

  it("B0: cobertura honesta e pick_sum como participação catalogada", () => {
    assert.equal(body.coverage.heroes_in_lane, 4);
    assert.equal(body.coverage.heroes_requested, 4);
    assert.equal(body.coverage.builds, 16);
    assert.equal(body.coverage.pick_sum, 1.84);
    assert.equal(body.coverage.pick_sum_per_hero, 0.46);
    assert.equal(body.coverage.pick_sum_status, "cataloged_participation_not_coverage");
    assert.equal(body.coverage.unit, "slot_share");
    assert.equal(body.partial, false);
    assert.equal(body.cells.length, 4);
  });

  it("descobertas começam por trincas e pacotes; suporte separa consolidado de provisório", () => {
    assert.equal(body.packages.length, 1);
    const pkg = body.packages[0];
    assert.deepEqual(pkg.item_ids, [1001, 1002]);
    assert.equal(pkg.support.status, "ok");
    assert.equal(pkg.contexts, 4);
    assert.equal(pkg.pattern_scope, "cross_hero");
    assert.equal(pkg.discovery_status, "consolidated");
    assert.ok(pkg.adoption_builds > 0);
    assert.equal(body.packages_ok, 1);
    assert.equal(body.packages_provisional_count, 0);

    assert.ok(body.triples.length > 0);
    const triple = body.triples.find((t) => t.item_ids.join("+") === "1001+1002+2001");
    assert.ok(triple);
    assert.equal(triple.k_heroes, 4);
    assert.equal(triple.m_builds, 12);
    assert.equal(triple.pattern_scope, "cross_hero");
    assert.equal(triple.discovery_status, "consolidated");
    assert.ok(Number.isFinite(triple.delta_wr_pp_max));
    assert.equal(body.triples_total, body.triples.length);
    assert.equal(body.discovery_summary.triples.consolidated, body.triples.filter((t) => t.discovery_status === "consolidated").length);
  });

  it("itens fora de pacote usam delta_wr_pp e publicam weighted + unweighted", () => {
    assert.ok(!body.items.some((i) => [1001, 1002].includes(i.item_id)), "itens do pacote não são ranqueados sozinhos");
    const plate = body.items.find((i) => i.item_id === 2001);
    assert.ok(plate, "2001 aparece como item individual");
    assert.equal(plate.support.status, "ok");
    assert.equal(plate.delta_status, "no_practical_difference");
    assert.ok(Number.isFinite(plate.delta_wr_pp_median));
    assert.ok(Number.isFinite(plate.delta_wr_pp_unweighted_median));
    assert.equal(plate.weighting_sensitivity, "stable");
    assert.equal(body.metrics.practical_delta_pp, PRACTICAL_DELTA_PP);
    assert.equal(body.metrics.difference_field, "delta_wr_pp");
    assert.equal(body.metrics.pick_weighting, "hypothesis_not_validated");
    assert.equal(body.metrics.http_partial, "200_with_partial_true");
    assert.ok(body.items_insufficient.some((i) => i.item_id === 2002), "2002 tem m=4 <5");
  });

  it("conjuntos têm escopo local/entre heróis e resumo", () => {
    assert.ok(body.sets.length > 0);
    assert.ok(body.sets.some((s) => s.archetype === "physical_attack"));
    assert.ok(body.sets.every((s) => s.label.includes("6 slots")));
    assert.ok(body.sets.every((s) => !(s.item_ids ?? []).includes(9001)), "movement/botas ficam fora");
    assert.ok(body.sets_counts.physical_attack >= 1);
    assert.ok(body.sets_summary.consolidated > 0);
    assert.equal(body.sets_summary.total, body.sets_summary.consolidated + body.sets_summary.emerging + body.sets_summary.local);
  });

  it("emblemas têm suporte e win median como os itens", () => {
    assert.equal(body.emblems_total, 1);
    const emblem = body.emblems[0];
    assert.equal(emblem.emblem_id, 20012);
    assert.equal(emblem.name, "Marksman");
    assert.equal(emblem.support.status, "ok");
    assert.equal(emblem.contexts, 4);
    assert.equal(emblem.builds, 16);
    assert.equal(emblem.hero_coverage, 4);
    assert.equal(emblem.pattern_scope, "cross_hero");
    assert.equal(emblem.discovery_status, "consolidated");
    assert.equal(emblem.adoption_builds, 1);
    assert.ok(Number.isFinite(emblem.win_median));
    assert.ok(Number.isFinite(emblem.delta_wr_pp_median));
    assert.equal(body.metrics.support.emblem.contexts, 3);
    assert.equal(body.metrics.support.emblem.builds, 5);
  });

  it("força da combinação = herói × build × emblema", () => {
    const cell = body.top_builds[0];
    const build = cell.builds[0];
    const emblem = body.emblems[0];
    const expected = cell.hero.wrAdj * build.win * emblem.win_median;
    assert.ok(Number.isFinite(build.hero_strength));
    assert.ok(Number.isFinite(build.build_strength));
    assert.ok(Number.isFinite(build.emblem_strength));
    assert.ok(Math.abs(build.combination_strength - expected) < 1e-4);
    assert.ok(Math.abs(build.combination_strength_index - expected * 100) < 1e-4);
  });

  it("sem suporte de emblema, a força fica nula (nunca 0)", () => {
    const small = aggregate([contexts[0]]);
    assert.equal(small.emblems.length, 0);
    assert.equal(small.emblems_total, 0);
    assert.equal(small.emblems_insufficient.length, 1);
    const build = small.top_builds[0].builds[0];
    assert.equal(build.emblem_strength, null);
    assert.equal(build.combination_strength, null);
    assert.equal(build.combination_strength_index, null);
  });

  it("runa page com emblema nomeado, 3 talentos e feitiço", () => {
    assert.equal(body.rune_pages.length, 1);
    const page = body.rune_pages[0];
    assert.equal(page.emblem.label, "Marksman");
    assert.equal(page.adoption, 1);
    assert.equal(page.talents.length, 3);
    assert.equal(page.spell.name, "Flicker");
    assert.equal(body.talents.length, 3);
    assert.equal(body.spells.length, 1);
    assert.equal(body.spells[0].name, "Flicker");
  });

  it("talentos e feitiços expõem win median e se agrupam por tier", () => {
    assert.deepEqual(body.talents.map((t) => t.tier), [1, 2, 3]);
    for (const t of body.talents) {
      assert.ok(Number.isFinite(t.win_median), `talent ${t.id} sem win_median`);
      assert.equal(t.adoption, 1);
    }
    assert.ok(Number.isFinite(body.spells[0].win_median));
    assert.equal(body.spells[0].adoption, 1);
  });

  it("combinador publica valor por contraste e classifica a evidência", () => {
    assert.equal(body.combiner.scale.base, 100);
    assert.equal(body.combiner.scale.value_unit, "pp_contrast_shrunk");
    assert.equal(body.combiner.items.length, 4);
    assert.equal(body.combiner.emblems.length, 1);
    assert.equal(body.combiner.talents.length, 3);
    assert.equal(body.combiner.spells.length, 1);
    assert.equal(body.combiner.heroes.length, 4);

    // 1001 aparece em todas as builds: não há contraste -> sem valor, nunca zero.
    const always = body.combiner.items.find((i) => i.id === 1001);
    assert.equal(always.adoption, 1);
    assert.equal(always.value_pp_source, "none");
    assert.equal(always.value_pp, null);
    assert.equal(always.value_pp_est, null);
    assert.equal(always.power, null);
    assert.equal(always.contrast.contexts, 0);

    // 2001 sai quando 2002 entra no mesmo núcleo: troca pareada em todos os
    // contextos -> evidência observada, valor encolhido por 4/(4+3).
    const swapped = body.combiner.items.find((i) => i.id === 2001);
    assert.equal(swapped.value_pp_source, "observed");
    assert.ok(Number.isFinite(swapped.value_pp));
    assert.equal(swapped.value_pp_est, null);
    assert.equal(swapped.contrast.contexts, 4);
    assert.equal(swapped.contrast.paired_contexts, 4);
    assert.equal(swapped.contrast.pairs, 12);
    assert.equal(swapped.contrast.mode, "paired");
    assert.ok(swapped.contrast.shrink > 0 && swapped.contrast.shrink < 1);
    assert.ok(Number.isFinite(swapped.power));
    // Simetria: o item que entrou carrega o delta oposto.
    const entered = body.combiner.items.find((i) => i.id === 2002);
    assert.equal(entered.value_pp_source, "observed");
    assert.ok(Math.abs(entered.value_pp + swapped.value_pp) < 1e-9);

    // Emblema é constante dentro do herói: descritivo, nunca peso.
    const emblem = body.combiner.emblems[0];
    assert.equal(emblem.emblem_id, 20012);
    assert.equal(emblem.value_pp, null);
    assert.equal(emblem.value_pp_est, null);
    assert.equal(emblem.value_pp_source, "descriptive");
    assert.equal(emblem.power, null);
    assert.match(emblem.value_reason, /constante dentro do herói/);

    assert.deepEqual(body.combiner.talents.map((t) => t.tier), [1, 2, 3]);
    assert.equal(body.combiner.spells[0].name, "Flicker");
  });

  it("combinador não inventa valor para emblema nem em recorte pequeno", () => {
    const small = aggregate([contexts[0]]);
    const emblem = small.combiner.emblems[0];
    assert.equal(emblem.value_pp, null);
    assert.equal(emblem.value_pp_source, "descriptive");
  });

  it("variantes usam delta_wr_pp_vs_modal e silenciam <2 pp", () => {
    assert.equal(body.variant_summary.cores, 8);
    assert.equal(body.variant_summary.cores_with_variants, 4);
    assert.equal(body.variant_summary.order_only_cores, 4);
    const core = body.variants.find((v) => v.core_key === "1001+1002+2001");
    assert.ok(core);
    assert.equal(core.variant_count, 3);
    assert.equal(core.order_only, true);
    assert.equal(core.discovery_status, "local");
    assert.ok(core.variants.every((v) => v.delta_status === "no_practical_difference"));
    assert.ok(core.variants.some((v) => v.is_modal));
    assert.ok(core.variants.some((v) => v.delta_wr_pp_vs_modal === 1));
  });

  it("top builds preservam referência e usam pp", () => {
    assert.equal(body.top_builds.length, 4);
    const cell = body.top_builds[0];
    assert.equal(cell.cell_status, "ok");
    assert.equal(cell.builds.length, 4);
    assert.equal(cell.builds[0].reference_kind, "mais-usada");
    assert.ok(Number.isFinite(cell.builds[0].reference_win));
    assert.equal(cell.builds[0].delta_wr_pp_vs_most_used, 0);
    assert.equal(cell.builds[1].delta_wr_pp_vs_most_used, 1);
    assert.ok(Array.isArray(cell.builds[0].items));
  });

  it("parcial: 1 célula com erro não derruba o agregado", () => {
    const partial = aggregate(contexts.map((c, i) => i === 0
      ? { ...c, rawBuilds: [], status: "error", error: "upstream_unavailable" }
      : c));
    assert.equal(partial.partial, true);
    assert.equal(partial.cells[0].status, "error");
    assert.equal(partial.cells.filter((c) => c.status === "ok").length, 3);
    assert.ok(partial.coverage.cells_error >= 1);
  });
});

describe("suporte e fragilidade", () => {
  it("pacote com k=1 e m=3 fica provisório, nunca 'inseparável consolidado'", () => {
    const provisional = aggregate([{
      hero: { id: 9, name: "H9", head: null, tier: "A", wrAdj: 0.5, win: 0.5, pick: 0.1, ban: 0.1 },
      rawBuilds: [
        build([3002, 3003, 9001], 0.50, 0.10),
        build([3002, 3003, 9001], 0.51, 0.10),
        build([3002, 3003, 9001], 0.52, 0.10),
      ],
      status: "ok",
    }]);
    assert.equal(provisional.packages.length, 0);
    assert.equal(provisional.packages_provisional_count, 1);
    const pkg = provisional.packages_provisional[0];
    assert.ok(pkg.item_ids.includes(3002));
    assert.ok(pkg.item_ids.includes(3003));
    assert.equal(pkg.support.status, "insufficient");
    assert.equal(pkg.inseparable, false);
    assert.equal(pkg.inseparable_observed, true);
    assert.equal(pkg.discovery_status, "provisional");
    assert.equal(pkg.pattern_scope, "single_hero");
    assert.ok(provisional.discovery_summary.packages.provisional >= 1);
  });

  it("pick weighting pode inverter o sinal: weighted vs unweighted é publicado", () => {
    const fragileBuilds = () => [
      build([9001], 0.50, 0.90),
      build([2001], 0.44, 0.09),
      build([2001, 9001], 0.62, 0.01),
    ];
    const fragile = aggregate([1, 2, 3].map((id) => ({
      hero: { id, name: `F${id}`, head: null, tier: "A", wrAdj: 0.5, win: 0.5, pick: 0.1, ban: 0.1 },
      rawBuilds: fragileBuilds(),
      status: "ok",
    })));
    const plate = fragile.items.find((i) => i.item_id === 2001);
    assert.ok(plate);
    assert.equal(plate.delta_wr_pp_median, -4.2);
    assert.equal(plate.delta_wr_pp_unweighted_median, 3);
    assert.equal(plate.weighting_sensitivity, "sign_flip");
    assert.ok(fragile.coverage.weighting_sensitivity_counts.sign_flip >= 1);
  });
});
