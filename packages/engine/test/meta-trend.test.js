import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  META_TREND_MIN_POINTS,
  detectMetaTrend,
} from "../src/heroes/trends.js";

const P = (win, i) => ({ date: `2026-09-${String(i + 1).padStart(2, "0")}`, win, pick: 0.05, ban: 0.1 });
const wins = (arr) => arr.map(P);

// Detector único: MA + regressão + ruptura + projeção honesta.
describe("meta-trend", () => {
  it("piso congelado", () => {
    assert.equal(META_TREND_MIN_POINTS, 7);
  });
  it("sem-dado com série curta (nunca chute)", () => {
    const r = detectMetaTrend(wins([0.5, 0.51, 0.52]));
    assert.equal(r.verdict, "sem-dado");
    assert.equal(r.forecastNext, null);
  });
  it("subindo: tendência linear limpa", () => {
    const ys = [0.5, 0.51, 0.52, 0.53, 0.54, 0.55, 0.56, 0.57, 0.58, 0.59];
    const r = detectMetaTrend(wins(ys));
    assert.equal(r.verdict, "subindo");
    assert.ok(r.slopePerDay > 0 && r.r2 > 0.9);
    assert.ok(r.forecastNext.value > ys[ys.length - 1]);
    assert.ok(r.forecastNext.lo <= r.forecastNext.value && r.forecastNext.value <= r.forecastNext.hi);
  });
  it("caindo: idem invertido", () => {
    const ys = [0.59, 0.58, 0.57, 0.56, 0.55, 0.54, 0.53, 0.52, 0.51, 0.5];
    const r = detectMetaTrend(wins(ys));
    assert.equal(r.verdict, "caindo");
    assert.ok(r.corr < -0.9);
  });
  it("estavel: ruído sem direção", () => {
    const ys = [0.5, 0.52, 0.49, 0.51, 0.5, 0.52, 0.49, 0.51, 0.5, 0.51];
    const r = detectMetaTrend(wins(ys));
    assert.equal(r.verdict, "estavel");
  });
  it("ruptura: patamar que vira (projeção suspensa)", () => {
    const ys = [0.5, 0.5, 0.51, 0.5, 0.49, 0.5, 0.5, 0.58, 0.59, 0.58, 0.6, 0.59, 0.6, 0.61];
    const r = detectMetaTrend(wins(ys));
    assert.equal(r.verdict, "ruptura");
    assert.ok(r.changeDate != null);
    assert.equal(r.forecastNext, null);
    assert.ok(r.reasons.some((x) => x.startsWith("ruptura-cusum")));
  });
  it("métrica pick/ban + nulos ignorados", () => {
    const pts = wins([0.5, 0.51, 0.52, 0.53, 0.54, 0.55, 0.56, 0.57]).map((p, i) => ({
      ...p,
      pick: [0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09][i],
    }));
    pts[7] = { date: pts[7].date, win: NaN, pick: NaN, ban: NaN };
    const r = detectMetaTrend(pts, "pick");
    assert.equal(r.verdict, "subindo");
  });
});
