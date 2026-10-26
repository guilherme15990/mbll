import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scoreHeroes, classOf } from "../src/index.js";
import { tierOf } from "../src/hero/tierOf.js";

// Contrato das vistas de θ̂ (tier-v2 + strength-index-v1): tier e strength_index são funções
// monotônicas de θ̂ (mesma ordenação, roupas diferentes). z/strong/weak/isGem NÃO
// são (família de significância — podem e devem discordar).
// MOTIVO (adaptação ao contrato enxuto): `d` SAIU do motor (DESVIO (c) — era afim crescente
// de θ̂; sorts usam wrAdj); `class`/`confidence` viraram classOf()/confidenceOf() (trust.js);
// `strong`/`weak`/`se` AGORA SÃO saída oficial (antes só dentro de `class`/banidos aqui).
// `z`/`posterior_mean` retidos no topo pelos desvios (a)(b). `prior` mora em meta.
// v3: tiers de confiança podados — rótulos derivam via classOf()/selos v3.
const TIER_ORD = ["?", "D", "C", "B", "A", "S"];

const spread = (n = 24) =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `H${i + 1}`,
    win: 0.4 + (i * 0.2) / (n - 1),
    pick: 0.05,
    ban: 0.05,
  }));

describe("vistas de θ̂: monotonicidade estrita", () => {
  it("tier e índice acompanham θ̂ em pares consecutivos", () => {
    const out = scoreHeroes(spread());
    const byTheta = [...out].sort((a, b) => a.wrAdj - b.wrAdj);
    for (let i = 1; i < byTheta.length; i++) {
      const a = byTheta[i - 1];
      const b = byTheta[i];
      assert.ok(
        TIER_ORD.indexOf(a.tier) <= TIER_ORD.indexOf(b.tier),
        `tier quebrou entre ${a.id} (${a.tier}) e ${b.id} (${b.tier})`,
      );
      assert.ok(a.strength_index <= b.strength_index, `índice quebrou entre ${a.id} e ${b.id}`);
    }
  });
  it("tier-v2: limites e NaN", () => {
    // MOTIVO: tierOf(NaN/undefined) antes caía em "D" (rebaixava sem dado); agora "?".
    assert.equal(tierOf(NaN), "?");
    assert.equal(tierOf(undefined), "?");
    assert.equal(tierOf(0.92), "S");
    assert.equal(tierOf(0.919), "A");
    assert.equal(tierOf(0.75), "A");
    assert.equal(tierOf(0.25), "B");
    assert.equal(tierOf(0.08), "C");
    assert.equal(tierOf(0.079), "D");
  });
  it("s3/momentum/d/class/confidence fora da saída; strong/weak/se dentro (contrato)", () => {
    const out = scoreHeroes(spread());
    const banned = ["s3", "d", "class", "confidence", "prior", "momentum", "momentumConsistent", "w", "shrinkage", "mBatch", "seBatch", "s2", "V", "qPick", "qBan", "presence", "p", "mu", "tau", "exposure", "c_reference", "c_grade", "evidence_robustness", "strength_index_version"];
    for (const h of out) {
      for (const k of banned) {
        assert.ok(!(k in h), `campo órfão ressuscitou em ${h.id}: ${k}`);
      }
      // Contrato: significância e incerteza saem no herói; rótulos derivam em trust.js.
      for (const k of ["strong", "weak", "se", "z", "posterior_mean"]) {
        assert.ok(k in h, `campo do contrato faltando em ${h.id}: ${k}`);
      }
      assert.ok(typeof classOf(h) === "string");
    }
  });
});
