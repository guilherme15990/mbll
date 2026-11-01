import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getSafetyClassification, safetyToGuide } from "../src/matchups/blind-pick.js";

// Paridade unificada BlindSection + BlindPanel (canônico = painel).
describe("blind-safety: getSafetyClassification", () => {
  it("inconclusiva sem dado / status / n<5", () => {
    assert.equal(getSafetyClassification(null).label, "Segurança Inconclusiva");
    assert.equal(getSafetyClassification({ classification_status: "inconclusive", n_pairs: 9 }).label, "Segurança Inconclusiva");
    assert.equal(getSafetyClassification({ n_pairs: 4 }).label, "Segurança Inconclusiva");
    assert.match(getSafetyClassification(null).motive, /n < 5/);
  });
  it("seguro com robustez robusta", () => {
    const r = getSafetyClassification({ robustness_status: "robusto", n_pairs: 8 });
    assert.equal(r.label, "Blind Pick Seguro");
    assert.match(r.color, /emerald/);
  });
  it("teto situacional sem denominador validado (V2 §8.2/§12)", () => {
    const r = getSafetyClassification({ robustness_status: "robusto", n_pairs: 8, exposure_status: "unvalidated" });
    assert.equal(r.label, "Seguro, mas Situacional");
    assert.match(r.motive, /sem contagens validadas/);
  });
  it("counterável com cauda ≤-0.03 e n≥10", () => {
    const r = getSafetyClassification({ robustness_status: "x", worst_observed: -0.03, n_pairs: 10 });
    assert.equal(r.label, "Counterável");
    assert.equal(getSafetyClassification({ worst_observed: -0.029, n_pairs: 10 }).label, "Seguro, mas Situacional");
    assert.equal(getSafetyClassification({ worst_observed: -0.05, n_pairs: 9 }).label, "Seguro, mas Situacional");
  });
  it("situacional por default", () => {
    assert.equal(getSafetyClassification({ n_pairs: 7 }).label, "Seguro, mas Situacional");
  });
});

describe("blind-safety: safetyToGuide", () => {
  it("mapeamento fixo §1.3", () => {
    assert.equal(safetyToGuide("Blind Pick Seguro"), "SIM");
    assert.equal(safetyToGuide("Seguro, mas Situacional"), "CUIDADO");
    assert.equal(safetyToGuide("Counterável"), "NÃO");
    assert.equal(safetyToGuide("Segurança Inconclusiva"), "SEM DADO");
    assert.equal(safetyToGuide("qualquer outra"), "SEM DADO");
  });
});
