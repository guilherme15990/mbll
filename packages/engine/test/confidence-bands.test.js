import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { interpretProbBand } from "../src/heroes/trust.js";

// Paridade unificada ConfiancaSection + ConfiancaPanel (PRD Confidence §8).
describe("confidence-bands: interpretProbBand", () => {
  it("faixas e fronteiras exatas", () => {
    assert.equal(interpretProbBand(null).label, "Indisponível");
    assert.equal(interpretProbBand(undefined).label, "Indisponível");
    assert.equal(interpretProbBand(NaN).label, "Indisponível");
    assert.equal(interpretProbBand(0.95).label, "Evidência posterior forte a favor");
    assert.equal(interpretProbBand(0.949).label, "Sinal favorável, ainda incerto");
    assert.equal(interpretProbBand(0.8).label, "Sinal favorável, ainda incerto");
    assert.equal(interpretProbBand(0.799).label, "Inconclusivo para a decisão");
    assert.equal(interpretProbBand(0.21).label, "Inconclusivo para a decisão");
    assert.equal(interpretProbBand(0.2).label, "Sinal contrário, ainda incerto");
    assert.equal(interpretProbBand(0.06).label, "Sinal contrário, ainda incerto");
    assert.equal(interpretProbBand(0.05).label, "Evidência posterior forte contra");
    assert.equal(interpretProbBand(0).label, "Evidência posterior forte contra");
  });
  it("forma canônica com desc", () => {
    const b = interpretProbBand(0.5);
    assert.deepEqual(Object.keys(b).sort(), ["calibration_status", "color", "desc", "label"]);
    assert.match(b.desc, /20% a 80%/);
    assert.equal(b.calibration_status, "uncalibrated_model_based");
  });
});
