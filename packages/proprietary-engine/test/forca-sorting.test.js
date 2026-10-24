import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sortHeroesByMetric, medianWrAdj, heroRankPosition } from "../src/hero/forca-sorting.js";

// Paridade com ForcaPanel.tsx.
const H = (id, extra = {}) => ({ id, name: `H${id}`, d: 0, wrAdj: 0.5, win: 0.5, pick: 0.01, ban: 0.05, q: 0.5, B: 0.9, ...extra });

describe("forca-sorting", () => {
  it("q asc; B desc; demais desc (?? 0); 'd' alias de wrAdj; empate por id", () => {
    const rows = [H(1, { q: 0.2, B: 0.1 }), H(2, { q: 0.05, B: 0.9 }), H(3, { q: 0.1, B: 0.5 })];
    assert.deepEqual(sortHeroesByMetric(rows, "q").map((h) => h.id), [2, 3, 1]);
    assert.deepEqual(sortHeroesByMetric(rows, "B").map((h) => h.id), [2, 3, 1]);
    // MOTIVO (DESVIO c): `d` saiu do motor — alias de wrAdj (d era afim crescente de θ̂).
    assert.deepEqual(sortHeroesByMetric([H(1, { wrAdj: 0.4 }), H(2, { wrAdj: 0.6 })], "d").map((h) => h.id), [2, 1]);
    // MOTIVO: empates desempatados por id (antes: ordem de entrada).
    assert.deepEqual(sortHeroesByMetric([H(3), H(1), H(2)], "wrAdj").map((h) => h.id), [1, 2, 3]);
    assert.deepEqual(sortHeroesByMetric([H(1, { wrAdj: 0.4 }), H(2, { wrAdj: 0.6 })], "wrAdj").map((h) => h.id), [2, 1]);
  });
  it("medianWrAdj com fallback 0.5; mediana verdadeira em n par", () => {
    assert.equal(medianWrAdj([H(1, { wrAdj: 0.4 }), H(2, { wrAdj: 0.6 }), H(3, { wrAdj: 0.5 })]), 0.5);
    // MOTIVO: mediana verdadeira (antes: elemento superior em n par).
    assert.equal(medianWrAdj([H(1, { wrAdj: 0.4 }), H(2, { wrAdj: 0.6 })]), 0.5);
    assert.equal(medianWrAdj([]), 0.5);
  });
  it("heroRankPosition 1-based por θ̂ desc", () => {
    const rows = [H(1, { wrAdj: 0.4 }), H(2, { wrAdj: 0.6 })];
    assert.equal(heroRankPosition(rows, 2), 1);
    assert.equal(heroRankPosition(rows, 1), 2);
    assert.equal(heroRankPosition(rows, "2"), 1);
    assert.equal(heroRankPosition(rows, 99), 0);
  });
});
