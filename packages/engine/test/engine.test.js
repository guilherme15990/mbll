import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  blindProxy,
  buildLift,
  summarizeWalkPosterior,
  C_REFERENCE,
  LANES,
} from "../src/index.js";
import { scoreHeroes } from "../src/heroes/scoring.js";
import { strengthIndexByRank } from "../src/heroes/ranking.js";

// Guarda de fronteira: a porta proprietária resolve e se comporta.
describe("engine: fronteira e fumaça", () => {
  it("reexporta modelos com comportamento (amostra por modelo)", () => {
    const heroes = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1, name: `H${i + 1}`, win: 0.5, pick: 0.05, ban: 0.05,
    }));
    const out = scoreHeroes(heroes);
    assert.equal(out.length, 12);
    assert.ok(out.every((h) => typeof h.strength_index === "number"));
    assert.equal(blindProxy([0.01, -0.02, 0.03, -0.01, 0.02]).n_pairs, 5);
    assert.equal(buildLift({ win: 0.6, refWin: 0.5, hasSupport: true }).lift_raw != null, true);
    const post = summarizeWalkPosterior({ muBatch: 0.55, tau2Batch: 0.001, nBatch: 100 });
    assert.ok(post.mu > 0 && post.n === 100);
    assert.equal(strengthIndexByRank(1, 12), 100);
    assert.deepEqual(C_REFERENCE, 1e5);
    assert.deepEqual(LANES, ["exp", "mid", "roam", "jungle", "gold"]);
  });
});
