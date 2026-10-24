import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ITEMSET_SCORE_VERSION, ITEMSET_M_MIN, ITEMSET_CUT_K, ITEMSET_CUT_M, ITEMSET_MAX_ROWS,
  itemIdsOf, scoreAtomicItemset, scoreRouteItemsets,
} from "../src/builds/itemsets.js";

// Paridade com app/web/src/shared/domain/itemsets.ts (itemset-score-v1).
const B = (ids, win, pick, refMost, refMean) => ({
  win, pick,
  items: ids.map((id) => ({ id, name: `Item${id}`, icon: null })),
});
const ctx = (heroId, builds, refMost, refMean, lane = "gold") => ({
  heroId, heroName: `H${heroId}`, builds, refMostWin: refMost, refMeanWin: refMean, rank: "mythic", lane,
});

describe("itemsets: paridade itemset-score-v1", () => {
  it("constantes versionadas", () => {
    assert.equal(ITEMSET_SCORE_VERSION, "itemset-score-v1");
    assert.equal(ITEMSET_M_MIN, 2);
    assert.equal(ITEMSET_CUT_K, 2);
    assert.equal(ITEMSET_CUT_M, 3);
    assert.equal(ITEMSET_MAX_ROWS, 5);
  });
  it("itemIdsOf: dedup + ordenado", () => {
    assert.deepEqual(itemIdsOf(B([3, 1, 3, 2], 0.5, 0.05)), [1, 2, 3]);
  });
  it("sem_suporte sem coocorrência intra-build", () => {
    const c = ctx(1, [B([1, 2, 4], 0.55, 0.05, 0.5, 0.5)], 0.5, 0.5);
    const s = scoreAtomicItemset([1, 2, 3], c);
    assert.equal(s.status, "sem_suporte");
    assert.equal(s.winDesc, null);
    assert.equal(s.ajustado, null);
    assert.equal(s.causal, null);
  });
  it("sem_referencia sem refs finitas", () => {
    const c = ctx(1, [B([1, 2, 3], 0.55, 0.05), B([1, 2, 3, 4], 0.57, 0.06)], null, null);
    const s = scoreAtomicItemset([1, 2, 3], c);
    assert.equal(s.status, "sem_referencia");
    assert.ok(Math.abs(s.winDesc - 0.56) < 1e-9);
    assert.equal(s.liftMost, null);
  });
  it("ok com lifts em 4 casas + suporte mínimo", () => {
    const c = ctx(1, [B([1, 2, 3], 0.55, 0.05), B([1, 2, 3, 4], 0.57, 0.06)], 0.5, 0.52);
    const s = scoreAtomicItemset([3, 1, 2], c);
    assert.equal(s.status, "ok");
    assert.equal(s.winDesc, 0.56);
    assert.equal(s.liftMost, 0.06);
    assert.equal(s.liftMean, 0.04);
    assert.equal(s.nBuilds, 2);
  });
  it("suporte mínimo m<2 vira sem_suporte com número", () => {
    const c = ctx(1, [B([1, 2, 3], 0.55, 0.05)], 0.5, 0.5);
    const s = scoreAtomicItemset([1, 2, 3], c);
    assert.equal(s.status, "sem_suporte");
    assert.match(s.motive, /mínimo 2/);
    assert.equal(s.winDesc, 0.55);
  });
  it("rota: corte k≥2∨m≥3, ordem desc(k,m), teto 5, sem média poolada", () => {
    // Trinca A em 2 heróis (k=2); trinca B em 1 herói com 3 builds (m=3).
    const mk = (extra) => B([1, 2, 3, ...extra], 0.55, 0.05);
    const c1 = ctx(1, [mk([9]), mk([10]), mk([11])], 0.5, 0.5);
    const c2 = ctx(2, [mk([9])], 0.5, 0.5);
    const rows = scoreRouteItemsets([c1, c2]);
    assert.ok(rows.length >= 1 && rows.length <= 5);
    const a = rows.find((r) => r.itemIds.join("+") === "1+2+3");
    assert.equal(a.k, 2);
    assert.equal(a.m, 4);
    assert.equal(a.winMin, a.winMax);
    assert.equal(rows[0].itemIds.join("+"), "1+2+3");
    assert.ok(!("winMean" in a));
  });
  it("emergente: pickMed<0.02 e liftMost>0.015", () => {
    const c1 = ctx(1, [B([1, 2, 3], 0.6, 0.01), B([1, 2, 3, 4], 0.6, 0.01)], 0.5, 0.5);
    const c2 = ctx(2, [B([1, 2, 3], 0.6, 0.01), B([1, 2, 3, 4], 0.6, 0.01)], 0.5, 0.5);
    const rows = scoreRouteItemsets([c1, c2]);
    assert.equal(rows[0].emergent, true);
  });
});
