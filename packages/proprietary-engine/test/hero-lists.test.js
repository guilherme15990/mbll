import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  averageStrengthOf, medianPickOf, medianBanOf, topBansByBan,
  topGemsByStrengthLowPick, selectConsistentCandidates, selectLaneTopHeroes,
} from "../src/hero/hero-lists.js";

// Paridade: DraftPanel (agregados/top), BlindPanel (consistentes), BuildsTab (top-3 da rota).
const H = (id, wrAdj, pick, ban) => ({ id, name: `H${id}`, wrAdj, pick, ban });
const heroes = [H(1, 0.55, 0.02, 0.1), H(2, 0.52, 0.005, 0.3), H(3, 0.48, 0.05, 0.05), H(4, 0.6, 0.001, 0.4)];

describe("hero-lists: agregados (DraftPanel)", () => {
  it("média / medianas com fallbacks", () => {
    assert.ok(Math.abs(averageStrengthOf(heroes) - 0.5375) < 1e-12);
    assert.equal(averageStrengthOf([]), 0.5);
    // MOTIVO: mediana verdadeira em n par (antes: elemento superior). picks → (0.005+0.02)/2.
    assert.equal(medianPickOf(heroes), 0.0125);
    assert.equal(medianPickOf([]), 0.007);
    // bans → (0.1+0.3)/2.
    assert.equal(medianBanOf(heroes), 0.2);
    assert.equal(medianBanOf([]), 0.05);
  });
  it("top bans desc + top gems (força>media e pick<mediana)", () => {
    assert.deepEqual(topBansByBan(heroes).map((h) => h.id), [4, 2, 1, 3]);
    const gems = topGemsByStrengthLowPick(heroes, averageStrengthOf(heroes), medianPickOf(heroes));
    assert.deepEqual(gems.map((h) => h.id), [4]); // H1 tem pick 0.02 > mediana 0.0125, e o corte é estrito <
  });
});

describe("hero-lists: selectConsistentCandidates (BlindPanel)", () => {
  it("θ̂>0.51 e pick>0.01, θ̂ desc, teto 6", () => {
    assert.deepEqual(selectConsistentCandidates(heroes).map((h) => h.id), [1]);
    assert.deepEqual(selectConsistentCandidates([], 6), []);
  });
});

describe("hero-lists: selectLaneTopHeroes (BuildsTab)", () => {
  const lanes = { 1: ["gold"], 2: ["mid"], 3: ["gold", "mid"], 4: ["gold"] };
  it("top-3 da rota em ordem θ̂ (R2)", () => {
    const rows = [...heroes].sort((a, b) => b.wrAdj - a.wrAdj);
    assert.deepEqual(selectLaneTopHeroes(rows, lanes, "gold").map((h) => h.id), [4, 1, 3]);
  });
  it("mapa null → [] ; mapa vazio → sem filtro", () => {
    assert.deepEqual(selectLaneTopHeroes(heroes, null, "gold"), []);
    assert.deepEqual(selectLaneTopHeroes(heroes, {}, "gold").map((h) => h.id), [1, 2, 3]);
  });
});
