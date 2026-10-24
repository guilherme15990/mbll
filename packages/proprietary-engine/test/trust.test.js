import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classOf, confidenceToTrust, trustOf, verdictSentence, verdictShort } from "../src/hero/trust.js";

// v3: sem tiers de B (CONF_HIGH/CONF_LOW removidos), sem ramos "Robusto", sem teto
// proxy — níveis Situacional|Inconclusivo. Escasso (B<B_FLOOR/smallSample/degenerate)
// → Inconclusivo; senão Situacional. Paridade: heroSeal, Dashboard, HeroDetails.
describe("trust v3: confidenceToTrust (heroSeal)", () => {
  it("sem herói", () => {
    assert.deepEqual(confidenceToTrust(undefined), { level: "Inconclusivo", motive: "sem dado do herói" });
  });
  it("amostra escassa / degenerado / B<0.25", () => {
    assert.equal(confidenceToTrust({ smallSample: true, B: 0.9 }).level, "Inconclusivo");
    assert.equal(confidenceToTrust({ degenerate: true, B: 0.9 }).level, "Inconclusivo");
    assert.equal(confidenceToTrust({ B: 0.1 }).level, "Inconclusivo");
    assert.equal(confidenceToTrust({ B: 0.24 }).motive, "amostra escassa (encolhido à média)");
  });
  it("selo categórico vira Situacional (nunca Robusto público)", () => {
    assert.deepEqual(confidenceToTrust({ B: 0.9, confidence: "Alta" }), { level: "Situacional", motive: "confiança Alta" });
    assert.equal(confidenceToTrust({ B: 0.9, confidence: "Média" }).level, "Situacional");
    assert.equal(confidenceToTrust({ B: 0.1, confidence: "Alta" }).level, "Inconclusivo");
  });
  it("sem selo categórico deriva da classe (contrato enxuto)", () => {
    assert.deepEqual(confidenceToTrust({ B: 0.9 }), { level: "Situacional", motive: "classe Na media" });
    assert.deepEqual(confidenceToTrust({ B: 0.9, strong: true, isGem: true }), { level: "Situacional", motive: "classe Joia" });
    assert.deepEqual(confidenceToTrust({ B: 0.1 }), { level: "Inconclusivo", motive: "amostra escassa (encolhido à média)" });
  });
  it("classOf: Joia antes de Forte; nulos", () => {
    // MOTIVO: isGem ⊂ strong — na ordem antiga o ramo Joia era inalcançável.
    assert.equal(classOf({ smallSample: true, strong: true, isGem: true }), "Amostra pequena");
    assert.equal(classOf({ strong: true, isGem: true }), "Joia");
    assert.equal(classOf({ strong: true }), "Forte");
    assert.equal(classOf({ weak: true }), "Fraco");
    assert.equal(classOf({}), "Na media");
    assert.equal(classOf(null), null);
  });
});

describe("trust v3: trustOf (Dashboard)", () => {
  const base = { uncertainty_status: "ok", B: 0.9 };
  it("inconclusivo domina", () => {
    assert.deepEqual(trustOf({ ...base, smallSample: true }), { level: "Inconclusivo", motive: "amostra pequena" });
    assert.deepEqual(trustOf({ ...base, B: 0.1 }), { level: "Inconclusivo", motive: "sem dado suficiente" });
  });
  it("senão, situacional por faixa (sem Robusto)", () => {
    assert.deepEqual(trustOf(base), { level: "Situacional", motive: "leitura por faixa" });
    assert.deepEqual(trustOf({ ...base, confidence: "alta" }), { level: "Situacional", motive: "leitura por faixa" });
  });
  it("nulos não quebram (contrato enxuto)", () => {
    assert.deepEqual(trustOf(null), { level: "Inconclusivo", motive: "sem dado do herói" });
    assert.deepEqual(trustOf(undefined), { level: "Inconclusivo", motive: "sem dado do herói" });
  });
});

describe("trust v3: verdictSentence/verdictShort (HeroDetails)", () => {
  it("verdictSentence 2 vias", () => {
    assert.equal(verdictSentence(undefined), "");
    assert.equal(verdictSentence({ B: 0.1 }), "Amostra escassa: leitura puxada à média — desconfie de picos.");
    assert.equal(verdictSentence({ B: 0.9 }), "Leitura situacional: confira a prova na aba antes de lockar.");
  });
  it("verdictShort 2 vias", () => {
    assert.equal(verdictShort(undefined), "sem dado neste recorte");
    assert.equal(verdictShort({ smallSample: true, B: 0.9 }), "número encolhido à média, desconfie de picos");
    assert.equal(verdictShort({ B: 0.9 }), "não locke cego, veja quem countera");
  });
});
