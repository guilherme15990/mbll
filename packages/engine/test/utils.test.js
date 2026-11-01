import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mean,
  medianNull,
  median,
  mad,
  quantile,
  percentileRank,
  benjaminiHochberg,
  ebShrink,
  obsVariance,
  logit,
  invLogit,
  pFromZ,
  C_REFERENCE,
} from "../src/index.js";

// Primitivas (dono: utils/math.js + utils/statistics.js).
// Portado da suite do engine removido (ADR-025: QA aritmética + G6);
// o resto da cobertura do engine (scoreHeroes/WF/strength/confidence/blind)
// já existe nas suites de modelo + routes da API.
describe("utils: primitivas", () => {
  it("mean: média de finitos, null sem dado", () => {
    assert.equal(mean([1, 2, 3]), 2);
    assert.equal(mean([]), null);
    assert.equal(mean([NaN, Infinity]), null);
    assert.equal(mean([1, NaN, 3]), 2);
  });
  it("medianNull: mediana de finitos, null sem dado", () => {
    assert.equal(medianNull([3, 1, 2]), 2);
    assert.equal(medianNull([4, 1, 3, 2]), 2.5);
    assert.equal(medianNull([]), null);
  });
  it("median", () => { assert.equal(median([3, 1, 2]), 2); assert.equal(median([4, 1, 3, 2]), 2.5); });
  it("mad", () => { assert.equal(mad([1, 1, 2, 2, 4, 6, 9]), 1); });
  it("quantile", () => { assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5); });
  it("percentileRank", () => { assert.equal(percentileRank(3, [1, 2, 3, 4]), 0.75); });
  it("BH monotônico e limitado", () => {
    const q = benjaminiHochberg([0.01, 0.04, 0.5]);
    assert.ok(q[0] <= q[1] && q[1] <= q[2] && q.every((x) => x >= 0 && x <= 1));
  });
  it("G6: EB fiel — B alto preserva observado, pick~0 encolhe p/ média; s²=μ(1−μ)/(c·pick)", () => {
    const mu = 0.5, tau2 = 0.031 ** 2;
    const s2hi = obsVariance(mu, 0.2, C_REFERENCE);
    assert.ok(Math.abs(s2hi - (0.25 / (C_REFERENCE * 0.2))) < 1e-12);
    const hi = ebShrink(0.65, s2hi, mu, tau2);
    assert.ok(hi.B > 0.9 && Math.abs(hi.m - 0.65) < 0.01, `B=${hi.B} m=${hi.m}`);
    const lo = ebShrink(0.65, obsVariance(mu, 1e-6, C_REFERENCE), mu, tau2);
    assert.ok(lo.B < 0.05 && Math.abs(lo.m - mu) < 0.01, `B=${lo.B} m=${lo.m}`);
    assert.ok(Math.abs(invLogit(logit(0.6)) - 0.6) < 1e-9);
  });
  it("pFromZ: bicaudal em [0,1], ≈1 no centro", () => {
    assert.ok(Math.abs(pFromZ(0) - 1) < 1e-6, `p=${pFromZ(0)}`);
    const p = pFromZ(1.96);
    assert.ok(p > 0.03 && p < 0.07, `p=${p}`);
  });
});
