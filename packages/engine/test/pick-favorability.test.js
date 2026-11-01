import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyBlindPick, classifyFirstPick } from "../src/matchups/blind-pick.js";

describe("pick-favorability: classifyBlindPick", () => {
  it("sem dado quando não há matriz ou n<5", () => {
    assert.equal(classifyBlindPick().key, "sem_dado");
    assert.equal(classifyBlindPick({ blind: null }).key, "sem_dado");
    assert.equal(classifyBlindPick({ blind: { n_pairs: 4, robustness_status: "robusto" } }).key, "sem_dado");
    assert.equal(classifyBlindPick({ blind: { n_pairs: 9, classification_status: "inconclusive" } }).key, "sem_dado");
  });

  it("favorável com cauda robusta", () => {
    const v = classifyBlindPick({ blind: { robustness_status: "robusto", adverse_p10: 0.01, worst_observed: -0.005, n_pairs: 8 } });
    assert.equal(v.key, "favoravel");
    assert.equal(v.label, "Favorável");
    assert.equal(v.tone, "emerald");
  });

  it("favorável pela cauda quando o status não vem (p10 > -2pp e pior δ > -3pp)", () => {
    assert.equal(classifyBlindPick({ blind: { adverse_p10: -0.01, worst_observed: -0.02, n_pairs: 7 } }).key, "favoravel");
  });

  it("desfavorável com counter replicado", () => {
    const v = classifyBlindPick({ blind: { robustness_status: "sensivel-a-counter", adverse_p10: -0.05, worst_observed: -0.03, n_pairs: 10 } });
    assert.equal(v.key, "desfavoravel");
    assert.equal(v.tone, "rose");
  });

  it("situacional no meio", () => {
    const v = classifyBlindPick({ blind: { robustness_status: "sensivel-a-counter", adverse_p10: -0.035, worst_observed: -0.02, n_pairs: 12 } });
    assert.equal(v.key, "situacional");
    assert.equal(v.tone, "amber");
  });
});

describe("pick-favorability: classifyFirstPick", () => {
  const blind = { robustness_status: "sensivel-a-counter", adverse_p10: -0.015, worst_observed: -0.02, n_pairs: 12 };

  it("sem dado sem matriz ou sem força", () => {
    assert.equal(classifyFirstPick({ hero: { wrAdj: 0.52 } }).key, "sem_dado");
    assert.equal(classifyFirstPick({ blind, hero: null }).key, "sem_dado");
    assert.equal(classifyFirstPick({ blind: { ...blind, n_pairs: 3 }, hero: { wrAdj: 0.52 } }).key, "sem_dado");
  });

  it("favorável com força acima da referência e sem counter duro", () => {
    const v = classifyFirstPick({ hero: { wrAdj: 0.52 }, blind, baseline: 0.5 });
    assert.equal(v.key, "favoravel");
    assert.equal(v.evidence.strength, 0.52);
  });

  it("desfavorável quando o pior counter é replicado", () => {
    const v = classifyFirstPick({ hero: { wrAdj: 0.55 }, blind: { ...blind, worst_observed: -0.04, n_pairs: 12 }, baseline: 0.5 });
    assert.equal(v.key, "desfavoravel");
    assert.match(v.motive, /pior counter/);
  });

  it("desfavorável com força fraca e cauda frágil", () => {
    const v = classifyFirstPick({ hero: { wrAdj: 0.48 }, blind: { ...blind, adverse_p10: -0.04, worst_observed: -0.02 }, baseline: 0.5 });
    assert.equal(v.key, "desfavoravel");
    assert.match(v.motive, /abaixo da referência/);
  });

  it("situacional com força sem cauda limpa", () => {
    const v = classifyFirstPick({ hero: { wrAdj: 0.52 }, blind: { ...blind, adverse_p10: -0.04 }, baseline: 0.5 });
    assert.equal(v.key, "situacional");
  });

  it("situacional sem vantagem de força mas sem counter duro", () => {
    const v = classifyFirstPick({ hero: { wrAdj: 0.48 }, blind, baseline: 0.5 });
    assert.equal(v.key, "situacional");
    assert.match(v.motive, /first pick neutro/);
  });

  it("baseline inválida cai para 0.5", () => {
    assert.equal(classifyFirstPick({ hero: { wrAdj: 0.51 }, blind, baseline: 0 }).key, "favoravel");
    assert.equal(classifyFirstPick({ hero: { wrAdj: 0.49 }, blind, baseline: 0 }).key, "situacional");
  });
});
