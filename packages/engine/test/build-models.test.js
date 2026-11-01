import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BUILD_ADJUSTED_VERSION,
  adjustedLiftByAttr,
  BUILD_QUADRANT_VERSION,
  buildQuadrant,
} from "../src/index.js";

// Lift ajustado intra-contexto + quadrantes (nomes do autor).
describe("build-adjusted-v1 (FE implícito, sem causal)", () => {
  const B = (win, pick, attrs) => ({ win, pick, attrs });
  const builds = [
    B(0.6, 0.1, [1, 2]),
    B(0.58, 0.1, [1, 3]),
    B(0.5, 0.1, [2, 3]),
    B(0.52, 0.1, [4]),
  ];
  it("versão congelada", () => {
    assert.equal(BUILD_ADJUSTED_VERSION, "build-adjusted-v1");
  });
  it("contraste com/sem: lift positivo p/ item dos vencedores", () => {
    const out = adjustedLiftByAttr(builds, (b) => b.attrs);
    const i1 = out.find((r) => r.attr === 1);
    assert.ok(i1.lift_raw > 0 && i1.lift_adj > 0 && i1.lift_adj <= i1.lift_raw, "encolhido, não inflado");
    assert.ok(i1.warnings.includes("associacao-ajustada-nao-causal"));
    assert.ok(i1.warnings.includes("builds-recomendadas-vies-de-selecao"));
  });
  it("sem contraste = nulo (nunca 0 inventado)", () => {
    const out = adjustedLiftByAttr([B(0.6, 0.1, [9]), B(0.5, 0.1, [9])], (b) => b.attrs);
    assert.equal(out[0].lift_raw, null);
    assert.equal(out[0].support, "sem-contraste");
  });
  it("ordenado por lift ajustado desc", () => {
    const out = adjustedLiftByAttr(builds, (b) => b.attrs).filter((r) => r.lift_adj != null);
    for (let i = 1; i < out.length; i++) assert.ok(out[i - 1].lift_adj >= out[i].lift_adj);
  });
});

describe("build-quadrant-v1 (nomes do autor)", () => {
  it("versão congelada", () => {
    assert.equal(BUILD_QUADRANT_VERSION, "build-quadrant-v1");
  });
  it("4 quadrantes com nomes exatos", () => {
    assert.equal(buildQuadrant({ pick: 0.1, lift_vs_most_used: 0.05 }).key, "popular-alta");
    assert.equal(buildQuadrant({ pick: 0.1, lift_vs_most_used: 0.05 }).label, "popular + alta");
    assert.equal(buildQuadrant({ pick: 0.01, lift_vs_most_used: 0.05 }).key, "impopular-alta");
    assert.equal(buildQuadrant({ pick: 0.1, lift_vs_most_used: -0.01 }).key, "popular-baixa");
    assert.equal(buildQuadrant({ pick: 0.01, lift_vs_most_used: -0.01 }).key, "impopular-baixa");
  });
  it("sem leitura sem os dois eixos (silêncio)", () => {
    assert.equal(buildQuadrant({ pick: 0.1, lift_vs_most_used: null }), null);
    assert.equal(buildQuadrant({ pick: null, lift_vs_most_used: 0.05 }), null);
  });
  it("cortes iguais aos das tags (sem número novo)", () => {
    assert.equal(buildQuadrant({ pick: 0.05, lift_vs_most_used: 0.020001 }).key, "popular-alta");
    assert.equal(buildQuadrant({ pick: 0.049, lift_vs_most_used: 0.05 }).key, "impopular-alta");
  });
});
