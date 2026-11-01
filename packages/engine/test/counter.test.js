import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COUNTER_VERDICT_VERSION,
  COUNTER_MIN_ABS_DELTA,
  COUNTER_MIN_PAIRS,
  compareCounterRelation,
} from "../src/matchups/counters.js";
import { compareCounterRelation as viaIndex } from "../src/index.js";

// Modelo (a): relations declarado × δ observado. Fixtures: (a) acordo real,
// (b) ruído/divergência → contestado, (c) extremes-only insuficiente.
describe("counter-verdict-v1", () => {
  it("versão e limiares congelados", () => {
    assert.equal(COUNTER_VERDICT_VERSION, "counter-verdict-v1");
    assert.equal(COUNTER_MIN_ABS_DELTA, 0.015);
    assert.equal(COUNTER_MIN_PAIRS, 5);
    assert.equal(viaIndex, compareCounterRelation);
  });
  it("confirmado: declarado + δ concorda", () => {
    const r = compareCounterRelation({ expected: -1, delta: -0.042, nPairs: 10, coverage: "extremes" });
    assert.equal(r.verdict, "confirmado");
    assert.ok(r.reasons.includes("acordo-declarado-observado"));
  });
  it("contestado: direção divergente", () => {
    const r = compareCounterRelation({ expected: -1, delta: 0.03, nPairs: 10, coverage: "extremes" });
    assert.equal(r.verdict, "contestado");
    assert.ok(r.reasons.includes("direcao-divergente"));
  });
  it("contestado: declarado sem observado", () => {
    const r = compareCounterRelation({ expected: -1, delta: null, nPairs: 10, coverage: "extremes" });
    assert.equal(r.verdict, "contestado");
    assert.ok(r.reasons.includes("declarado-sem-observado"));
  });
  it("contestado: declarado abaixo do limiar", () => {
    const r = compareCounterRelation({ expected: 1, delta: 0.005, nPairs: 10, coverage: "full" });
    assert.equal(r.verdict, "contestado");
    assert.ok(r.reasons.includes("declarado-abaixo-do-limiar"));
  });
  it("so-observado: δ forte sem declaração", () => {
    const r = compareCounterRelation({ expected: null, delta: -0.05, nPairs: 8, coverage: "extremes" });
    assert.equal(r.verdict, "so-observado");
    assert.ok(r.reasons.includes("observado-sem-declaracao"));
  });
  it("desconhecido: nada declarado, nada observado", () => {
    const r = compareCounterRelation({ expected: null, delta: null, nPairs: 0 });
    assert.equal(r.verdict, "desconhecido");
    const r2 = compareCounterRelation({ expected: null, delta: 0.002, nPairs: 10, coverage: "full" });
    assert.equal(r2.verdict, "desconhecido");
  });
  it("suporte fraco vira reason, nunca trava veredito", () => {
    const r = compareCounterRelation({ expected: -1, delta: -0.04, nPairs: 3, coverage: "extremes" });
    assert.equal(r.verdict, "confirmado");
    assert.ok(r.reasons.some((x) => x.startsWith("n=")));
  });
  it("assist/teammate não entra (só weak/strong mapeados fora)", () => {
    const r = compareCounterRelation({ expected: 0, delta: -0.04, nPairs: 10, coverage: "full" });
    assert.equal(r.verdict, "so-observado");
  });
});
