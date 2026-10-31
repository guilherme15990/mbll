import type { Build, BuildsAggregateResponse, Hero } from "../../src/shared/api";

/**
 * Fixtures mínimas dos contratos da web.
 *
 * Objetivo: caracterizar o que cada painel MOSTRA, não reproduzir um payload
 * real completo. Todos os campos obrigatórios dos tipos são preenchidos; as
 * listas nascem vazias para o teste controlar o cenário.
 */

export function aggregateFixture(
  overrides: Partial<BuildsAggregateResponse> = {},
): BuildsAggregateResponse {
  const base: BuildsAggregateResponse = {
    version: "test",
    context: {
      rank: "mythic",
      lane: "mid",
      window: 7,
      top: 10,
      population: "ranked",
      generated_at: "2026-10-27T00:00:00.000Z",
      stale: false,
      age_ms: 1_000,
      cache_hit: false,
      window_applies_to: "hero order",
      build_window: null,
    },
    coverage: {
      heroes_in_lane: 5,
      heroes_with_rank: 5,
      heroes_requested: 10,
      heroes_with_builds: 0,
      builds: 0,
      contexts: 0,
      items_cataloged: 0,
      items_unclassified: 0,
      pick_sum: null,
      pick_sum_status: "ok",
      cells_error: 0,
      cells_empty: 0,
      partial: false,
      unit: "pp",
      exposure_status: "validated",
    },
    packages: [],
    packages_provisional: [],
    packages_total: 0,
    packages_ok: 0,
    packages_provisional_count: 0,
    triples: [],
    triples_total: 0,
    items: [],
    items_total: 0,
    items_insufficient: [],
    items_insufficient_count: 0,
    sets: [],
    sets_total: 0,
    sets_counts: {},
    sets_summary: {
      total: 0,
      consolidated: 0,
      emerging: 0,
      local: 0,
      by_scope: { cross_hero: 0, two_heroes: 0, single_hero: 0 },
    },
    discovery_summary: {
      triples: { total: 0, consolidated: 0, emerging: 0, local: 0, provisional: 0 },
      packages: {
        total: 0,
        consolidated: 0,
        emerging: 0,
        local: 0,
        provisional: 0,
        supported: 0,
      },
      sets: {
        total: 0,
        consolidated: 0,
        emerging: 0,
        local: 0,
        by_scope: { cross_hero: 0, two_heroes: 0, single_hero: 0 },
      },
    },
    emblems: [],
    emblems_insufficient: [],
    emblems_total: 0,
    rune_pages: [],
    rune_pages_insufficient: 0,
    talents: [],
    spells: [],
    combiner: {
      scale: {
        base: 100,
        points_per_pp: 10,
        shrink_k: 3,
        slots: { items: 6, emblems: 1, talents: 3, spells: 1 },
        value_unit: "pp",
        index_rule: "média do contraste",
      },
      items: [],
      emblems: [],
      talents: [],
      spells: [],
      heroes: [],
    },
    variants: [],
    variant_summary: { cores: 0, cores_with_variants: 0, order_only_cores: 0 },
    top_builds: [],
    cells: [],
    sources: {},
    metrics: {
      difference_unit: "percentage_points",
      difference_field: "delta_wr_pp",
      practical_delta_pp: 0.5,
      lift_semantics: "fração 0–1",
      pick_weighting: "pick",
      support: {},
      pattern_scope: { cross_hero: "", two_heroes: "", single_hero: "" },
      discovery_status: {
        consolidated: "",
        emerging: "",
        local: "",
        provisional: "",
      },
      http_partial: "",
    },
    honesty: [],
    note: "fixture",
    partial: false,
  };
  return { ...base, ...overrides };
}

/** Build observada mínima: 2 itens, emblema, 1 talento e feitiço. */
export function buildFixture(overrides: Partial<Build> = {}): Build {
  return {
    win: 0.52,
    pick: 0.1,
    lift_raw: 0.02,
    lift_vs_most_used: 0.02,
    lift_vs_mean: 0.03,
    reference_win: 0.5,
    reference_kind: "hero_mean",
    references: { most_used_win: 0.5, hero_mean_win: 0.5 },
    exposure_status: "validated",
    classification_status: "observed",
    spell: { name: "Flash", icon: null },
    emblem: { id: 1, name: "Assassin", icon: null },
    talents: [{ id: 1, name: "Talent 1", tier: 1, icon: null }],
    items: [
      { id: 1, name: "Item 1", icon: null },
      { id: 2, name: "Item 2", icon: null },
      { id: 3, name: "Item 3", icon: null },
    ],
    ...overrides,
  };
}

export function heroFixture(overrides: Partial<Hero> = {}): Hero {
  return {
    id: 42,
    name: "Akai",
    head: null,
    win: 0.51,
    pick: 0.08,
    ban: 0.04,
    wrAdj: 0.505,
    z: 0.4,
    q: 0.6,
    tier: "A",
    isGem: false,
    degenerate: false,
    smallSample: false,
    ...overrides,
  };
}
