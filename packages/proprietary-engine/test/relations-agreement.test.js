import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  RELATIONS_AGREEMENT_VERSION,
  expectedForTarget,
  agreementForPair,
} from "../src/counters/relations-agreement.js";
import { agreementForPair as viaIndex, expectedForTarget as viaIndexMap } from "../src/index.js";

// relations → expected → compareCounterRelation. Assist nunca entra.
describe("relations-agreement-v1: mapeamento", () => {
  it("versão congelada + reexport", () => {
    assert.equal(RELATIONS_AGREEMENT_VERSION, "relations-agreement-v1");
    assert.equal(viaIndex, agreementForPair);
    assert.equal(viaIndexMap, expectedForTarget);
  });
  it("weak → -1, strong → +1", () => {
    const rel = { weak: { target_hero_id: [7] }, strong: { target_hero_id: [9] }, assist: { target_hero_id: [] } };
    assert.deepEqual(expectedForTarget(rel, 7), { expected: -1, reasons: ["declarado-weak"] });
    assert.deepEqual(expectedForTarget(rel, 9), { expected: 1, reasons: ["declarado-strong"] });
  });
  it("ausente → null; assist sozinho → null com motivo de exclusão", () => {
    const rel = { weak: { target_hero_id: [] }, strong: { target_hero_id: [] }, assist: { target_hero_id: [11] } };
    assert.deepEqual(expectedForTarget(rel, 11), { expected: null, reasons: ["assist-ignorado(n=1)", "sem-declaracao"] });
    assert.deepEqual(expectedForTarget(rel, 12), { expected: null, reasons: ["assist-ignorado(n=1)", "sem-declaracao"] });
  });
  it("weak+strong no mesmo alvo → null conflitante (nunca chute)", () => {
    const rel = { weak: { target_hero_id: [5] }, strong: { target_hero_id: [5] } };
    assert.deepEqual(expectedForTarget(rel, 5), { expected: null, reasons: ["declaracao-conflitante"] });
  });
  it("alvo inválido / relations ausente → null honesto", () => {
    assert.deepEqual(expectedForTarget(null, 5), { expected: null, reasons: ["sem-declaracao"] });
    assert.deepEqual(expectedForTarget({}, "x"), { expected: null, reasons: ["alvo-invalido"] });
  });
});

describe("relations-agreement-v1: veredito", () => {
  const rel = { weak: { target_hero_id: [7] }, strong: { target_hero_id: [9] }, assist: { target_hero_id: [11] } };
  it("acordo: weak + δ negativo → confirmado", () => {
    const r = agreementForPair(rel, { targetId: 7, delta: -0.04, nPairs: 8, coverage: "extremes" });
    assert.equal(r.expected, -1);
    assert.equal(r.verdict, "confirmado");
    assert.ok(r.reasons.includes("acordo-declarado-observado"));
    assert.ok(r.reasons.includes("assist-ignorado(n=1)"));
  });
  it("divergência: strong + δ negativo → contestado", () => {
    const r = agreementForPair(rel, { targetId: 9, delta: -0.04, nPairs: 8, coverage: "full" });
    assert.equal(r.expected, 1);
    assert.equal(r.verdict, "contestado");
    assert.ok(r.reasons.includes("direcao-divergente"));
  });
  it("ausente: sem declaração + δ forte → so-observado; sem nada → desconhecido", () => {
    const a = agreementForPair(rel, { targetId: 99, delta: -0.05, nPairs: 8, coverage: "full" });
    assert.equal(a.expected, null);
    assert.equal(a.verdict, "so-observado");
    const b = agreementForPair(rel, { targetId: 99, delta: null, nPairs: 0 });
    assert.equal(b.verdict, "desconhecido");
    assert.ok(b.reasons.includes("sem-declaracao"));
  });
  it("assist nunca vira expected mesmo com δ forte", () => {
    const r = agreementForPair(rel, { targetId: 11, delta: 0.06, nPairs: 8, coverage: "full" });
    assert.equal(r.expected, null);
    assert.equal(r.verdict, "so-observado");
  });
});
