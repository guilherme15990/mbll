import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getBuildTags } from "../src/shared/domain/buildLabel.ts";
import {
  ITEMSET_SCORE_VERSION,
  scoreAtomicItemset,
  scoreRouteItemsets,
} from "../src/shared/domain/itemsets.ts";

// DECISÃO REGISTRADA: web não depende de @radar/engine (ver package.json) —
// por isso o smoke do scoring vive aqui (node com type-stripping), não em engine.test.js.

// Fixture: build mínima no formato da ficha (ordem da fonte preservada).
const B = (ids, win, pick, refMost, refMean) => ({
  win,
  pick,
  lift_raw: win - refMost,
  lift_vs_most_used: win - refMost,
  lift_vs_mean: win - refMean,
  lift_adjusted: null,
  adjusted_association: null,
  causal_build_lift: null,
  reference_win: refMost,
  reference_kind: "mais-usada",
  references: { most_used_win: refMost, hero_mean_win: refMean },
  uncertainty_method: null,
  causal_status: "nao-avaliado",
  exposure_status: "unvalidated",
  classification_status: "provisional",
  spell: null,
  emblem: null,
  items: ids.map((id) => ({ id, name: `Item${id}`, icon: null })),
});

const ctx = (heroId, builds, refMost, refMean, lane = "gold") => ({
  heroId,
  heroName: `H${heroId}`,
  builds,
  refMostWin: refMost,
  refMeanWin: refMean,
  rank: "mythic",
  lane,
});

describe("itemset-score-v1 (fórmula versionada)", () => {
  it("versão da fórmula citada em toda exibição", () => {
    assert.equal(ITEMSET_SCORE_VERSION, "itemset-score-v1");
  });

  it("getBuildTags: popular/emergente/situacional + silêncio no inconclusivo", () => {
    assert.deepEqual(
      getBuildTags({ pick: 0.008, lift_vs_most_used: 0.05 }).map((t) => t.key),
      ["emergente"],
    );
    assert.deepEqual(
      getBuildTags({ pick: 0.3, lift_vs_most_used: 0.05 }).map((t) => t.key),
      ["popular", "situacional"],
    );
    assert.deepEqual(
      getBuildTags({ pick: 0.3, lift_vs_most_used: 0.005 }).map((t) => t.key),
      ["popular"],
    );
    assert.deepEqual(getBuildTags({ pick: 0.01, lift_vs_most_used: null }), []);
    assert.deepEqual(getBuildTags({ pick: 0.01, lift_vs_most_used: 0.001 }), []);
    assert.deepEqual(
      getBuildTags({ pick: 0.01, lift_vs_most_used: -0.05 }).map((t) => t.key),
      ["abaixo-da-ref"],
    );
  });

  it("S(u,c) atômico: trinca em 2/3 builds = ok, win_desc = média no contexto comum", () => {
    const builds = [
      B([1, 2, 3, 7], 0.58, 0.1, 0.52, 0.5),
      B([1, 2, 3, 8], 0.56, 0.12, 0.52, 0.5),
      B([4, 5, 6, 7], 0.5, 0.2, 0.52, 0.5),
    ];
    const s = scoreAtomicItemset([1, 2, 3], ctx(1, builds, 0.52, 0.5));
    assert.equal(s.status, "ok");
    assert.equal(s.nBuilds, 2);
    assert.equal(s.deBuilds, 3);
    assert.ok(Math.abs(s.winDesc - 0.57) < 1e-9);
    assert.ok(Math.abs(s.liftMost - 0.05) < 1e-9);
    assert.equal(s.ajustado, null);
    assert.equal(s.causal, null);
    assert.equal(s.formula, "itemset-score-v1");
  });

  it("B_u == 0 vira sem_suporte (nunca 0 inventado)", () => {
    const s = scoreAtomicItemset([9, 10, 11], ctx(1, [B([1, 2, 3, 4], 0.5, 0.1, 0.5, 0.5)], 0.5, 0.5));
    assert.equal(s.status, "sem_suporte");
    assert.equal(s.winDesc, null);
  });

  it("B_u == 1 força sem_suporte (silêncio no inconclusivo, mínimo 2)", () => {
    const s = scoreAtomicItemset([1, 2, 3], ctx(1, [B([1, 2, 3, 4], 0.6, 0.1, 0.52, 0.5)], 0.52, 0.5));
    assert.equal(s.status, "sem_suporte");
    assert.match(s.motive, /mínimo 2/);
  });

  it("sem referência finita vira sem_referencia", () => {
    const s = scoreAtomicItemset(
      [1, 2, 3],
      ctx(1, [B([1, 2, 3, 4], 0.6, 0.1, 0.52, 0.5), B([1, 2, 3, 5], 0.58, 0.1, 0.52, 0.5)], null, null),
    );
    assert.equal(s.status, "sem_referencia");
    assert.equal(s.liftMost, null);
  });
});

describe("destaque por rota (composição, sem pooling)", () => {
  // Fixture Simpson: mesmo itemset, lifts opostos em refs distintas.
  const simpson = () => [
    ctx(10, [B([1, 2, 3, 4], 0.58, 0.1, 0.52, 0.5), B([1, 2, 3, 5], 0.58, 0.1, 0.52, 0.5)], 0.52, 0.5, "mid"),
    ctx(20, [B([1, 2, 3, 6], 0.47, 0.1, 0.5, 0.49), B([1, 2, 3, 7], 0.47, 0.1, 0.5, 0.49)], 0.5, 0.49, "mid"),
  ];

  it("Simpson: k=2 com faixa por herói, sem win médio poolado", () => {
    const rows = scoreRouteItemsets(simpson());
    assert.equal(rows.length, 1);
    const r = rows[0];
    assert.deepEqual([...r.itemIds], [1, 2, 3]);
    assert.equal(r.k, 2);
    assert.equal(r.m, 4);
    assert.ok(Math.abs(r.winMin - 0.47) < 1e-9);
    assert.ok(Math.abs(r.winMax - 0.58) < 1e-9);
    assert.equal(r.perHero.length, 2);
    // Nenhum campo de média poolada existe no VO.
    const json = JSON.stringify(r);
    assert.doesNotMatch(json, /win_medio|winMedio|avgWin|avg_win|pool/i);
  });

  it("trinca de builds parciais misturadas termina sem_suporte (veto §5.4)", () => {
    const builds = [B([1, 7, 8, 9], 0.55, 0.1, 0.5, 0.5), B([2, 3, 7, 8], 0.55, 0.1, 0.5, 0.5)];
    const rows = scoreRouteItemsets([ctx(1, builds, 0.5, 0.5), ctx(2, builds, 0.5, 0.5)]);
    assert.ok(!rows.some((r) => r.itemIds.join("+") === "1+2+3"), "trinca nunca observada junta não existe");
  });

  it("corte v1: k=1,m=1 não entra; k=1,m=3 entra", () => {
    const solo = [B([5, 6, 7, 8], 0.55, 0.1, 0.5, 0.5)];
    const rowsSolo = scoreRouteItemsets([ctx(1, solo, 0.5, 0.5)]);
    assert.equal(rowsSolo.length, 0);
    const triple = [
      B([5, 6, 7, 8], 0.55, 0.1, 0.5, 0.5),
      B([5, 6, 7, 9], 0.56, 0.1, 0.5, 0.5),
      B([5, 6, 7, 10], 0.54, 0.1, 0.5, 0.5),
    ];
    const rowsM = scoreRouteItemsets([ctx(1, triple, 0.5, 0.5)]);
    assert.equal(rowsM.length, 1);
    assert.equal(rowsM[0].k, 1);
    assert.equal(rowsM[0].m, 3);
  });

  it("ordem por cobertura desc(k, m); teto de 5 linhas", () => {
    // 6 trincas distintas com k=1,m=3 + a do Simpson (k=2,m=4) = 7 candidatas -> teto 5.
    const many = Array.from({ length: 6 }, (_, h) => {
      const t = [10 * h + 11, 10 * h + 12, 10 * h + 13];
      return ctx(
        100 + h,
        [0, 1, 2].map((i) => B([...t, 500 + i], 0.55, 0.1, 0.5, 0.5)),
        0.5,
        0.5,
      );
    });
    const rows = scoreRouteItemsets([...simpson(), ...many]);
    assert.equal(rows.length, 5);
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1];
      const b = rows[i];
      assert.ok(b.k < a.k || (b.k === a.k && b.m <= a.m), "ordem desc(k, m)");
    }
    assert.deepEqual([...rows[0].itemIds], [1, 2, 3]);
  });

  it("determinismo: mesma flat[] = mesmos números", () => {
    const a = scoreRouteItemsets(simpson());
    const b = scoreRouteItemsets(simpson());
    assert.deepEqual(a, b);
  });
});
