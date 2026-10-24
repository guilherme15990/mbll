import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  orderBuildsByLift, selectTopBuildsByLift, selectBuildsAboveMostUsed, refWinsOf,
} from "../src/builds/builds-ordering.js";

// Paridade: BuildsSection (ordered/withLift), HeroDetails/LaneBuilds (top-3), BuildsTab (refWinsOf).
const mk = (win, lift) => ({ win, lift_vs_most_used: lift, references: { most_used_win: 0.5, hero_mean_win: 0.52 } });

describe("builds-ordering", () => {
  it("orderBuildsByLift: lift desc, NULL por último, empate win desc", () => {
    const rows = [mk(0.5, null), mk(0.6, 0.02), mk(0.55, 0.02), mk(0.7, undefined)];
    assert.deepEqual(orderBuildsByLift(rows).map((b) => b.win), [0.6, 0.55, 0.7, 0.5]);
  });
  it("não muta a entrada", () => {
    const rows = [mk(0.5, null), mk(0.6, 0.02)];
    orderBuildsByLift(rows);
    assert.equal(rows[0].win, 0.5);
  });
  it("selectTopBuildsByLift: só lift finito, desc, corte N", () => {
    const rows = [mk(0.5, null), mk(0.6, 0.02), mk(0.55, 0.05), mk(0.7, NaN)];
    assert.deepEqual(selectTopBuildsByLift(rows, 3).map((b) => b.win), [0.55, 0.6]);
    assert.equal(selectTopBuildsByLift(rows, 1).length, 1);
  });
  it("selectBuildsAboveMostUsed: lift finito > 0", () => {
    const rows = [mk(0.6, 0.02), mk(0.5, 0), mk(0.4, -0.01), mk(0.5, null)];
    assert.deepEqual(selectBuildsAboveMostUsed(rows).map((b) => b.win), [0.6]);
  });
  it("refWinsOf: refs da 1ª build; null sem builds", () => {
    assert.deepEqual(refWinsOf([mk(0.6, 0.02)]), { most: 0.5, mean: 0.52 });
    assert.deepEqual(refWinsOf([]), { most: null, mean: null });
  });
});
