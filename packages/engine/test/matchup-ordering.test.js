import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  comparePairsByDeltaAsc, sortPairsByDeltaAsc, comparePairsByDeltaDesc, sortPairsByDeltaDesc, hasFiniteDelta,
  selectTopCountersByDelta, selectTopSynergiesByDelta, firstPairByDeltaAsc,
} from "../src/matchups/counters.js";

// Paridade: ConfrontosSection (byDeltaAsc) + HeroDetails (filtros finitos).
const P = (id, delta) => ({ id, name: `P${id}`, delta });

describe("matchup-ordering", () => {
  it("δ asc com ausente por último (nunca 0)", () => {
    const rows = [P(1, 0.02), P(2, null), P(3, -0.05), P(4, undefined)];
    assert.deepEqual(sortPairsByDeltaAsc(rows).map((p) => p.id), [3, 1, 2, 4]);
    assert.ok(comparePairsByDeltaAsc(P(1, null), P(2, 0)) > 0);
  });
  it("δ desc com ausente por último (nunca lidera)", () => {
    const rows = [P(1, 0.02), P(2, null), P(3, -0.05), P(4, undefined), P(5, 0.09)];
    assert.deepEqual(sortPairsByDeltaDesc(rows).map((p) => p.id), [5, 1, 3, 2, 4]);
    assert.ok(comparePairsByDeltaDesc(P(1, null), P(2, 0)) > 0);
    assert.deepEqual(rows.map((p) => p.id), [1, 2, 3, 4, 5]);
  });
  it("hasFiniteDelta", () => {
    assert.equal(hasFiniteDelta(P(1, 0)), true);
    assert.equal(hasFiniteDelta(P(1, null)), false);
    assert.equal(hasFiniteDelta(P(1, NaN)), false);
  });
  it("selectTopCountersByDelta: finito asc + corte", () => {
    const rows = [P(1, 0.02), P(2, null), P(3, -0.05), P(4, -0.01)];
    assert.deepEqual(selectTopCountersByDelta(rows, 3).map((p) => p.id), [3, 4, 1]);
  });
  it("selectTopSynergiesByDelta: finito desc + corte", () => {
    const rows = [P(1, 0.02), P(2, null), P(3, -0.05), P(4, 0.09)];
    assert.deepEqual(selectTopSynergiesByDelta(rows, 2).map((p) => p.id), [4, 1]);
  });
  it("firstPairByDeltaAsc: undefined sem pares", () => {
    assert.equal(firstPairByDeltaAsc([]), undefined);
    assert.equal(firstPairByDeltaAsc([P(1, 0.02), P(3, -0.05)]).id, 3);
  });
});
