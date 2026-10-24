import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TREND_N, TREND_DELTA, trendOf } from "../src/hero/hero-trend.js";

// Paridade com HeroCard.tsx (trendOf; sparkPath fica na web).
describe("hero-trend: paridade trendOf", () => {
  it("constantes", () => {
    assert.equal(TREND_N, 5);
    assert.equal(TREND_DELTA, 0.005);
  });
  const P = (wins) => wins.map((win, i) => ({ date: `2026-01-0${i + 1}`, win }));
  it("sem-dado com <2 pontos finitos", () => {
    assert.deepEqual(trendOf([], 5), { dir: "sem-dado", delta: null, n: 0 });
    assert.deepEqual(trendOf(P([0.5])), { dir: "sem-dado", delta: null, n: 1 });
    assert.deepEqual(trendOf([{ win: NaN }]).dir, "sem-dado");
  });
  it("janela dos últimos n + limiar ±0.005 (Theil–Sen, robusta a outlier)", () => {
    // MOTIVO: Theil–Sen (mediana das inclinações) no lugar de último − primeiro: um ponto
    // atípico no extremo não decide mais sozinho a seta (antes: "subindo"/"caindo").
    assert.equal(trendOf(P([0.5, 0.5, 0.5, 0.5, 0.5, 0.9])).dir, "estável");
    assert.equal(trendOf(P([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.1])).dir, "estável");
    assert.equal(trendOf(P([0.5, 0.505, 0.51, 0.515, 0.52])).dir, "subindo");
    const t = trendOf(P([0.5, 0.504]));
    assert.equal(t.dir, "estável");
    assert.ok(Math.abs(t.delta - 0.004) < 1e-12);
    assert.equal(t.n, 2);
  });
  it("ignora win não-finito antes da janela", () => {
    const t = trendOf([{ win: NaN }, ...P([0.5, 0.6])]);
    assert.equal(t.dir, "subindo");
    assert.equal(t.n, 2);
  });
});
