import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classOf, verdictShort } from "../src/hero/trust.js";

// v3: selos públicos de confiança (confidenceToTrust/trustOf/verdictSentence)
// removidos. Restam a taxonomia descritiva (classOf) e a L3 curta (verdictShort).
describe("trust v3: classOf (rótulos descritivos)", () => {
  it("Joia antes de Forte; nulos", () => {
    // MOTIVO: isGem ⊂ strong — na ordem antiga o ramo Joia era inalcançável.
    assert.equal(classOf({ smallSample: true, strong: true, isGem: true }), "Amostra pequena");
    assert.equal(classOf({ strong: true, isGem: true }), "Joia");
    assert.equal(classOf({ strong: true }), "Forte");
    assert.equal(classOf({ weak: true }), "Fraco");
    assert.equal(classOf({}), "Na media");
    assert.equal(classOf(null), null);
  });
});

describe("trust v3: verdictShort (HeroDetails)", () => {
  it("verdictShort 2 vias", () => {
    assert.equal(verdictShort(undefined), "sem dado neste recorte");
    assert.equal(verdictShort({ smallSample: true, B: 0.9 }), "número encolhido à média, desconfie de picos");
    assert.equal(verdictShort({ B: 0.9 }), "não locke cego, veja quem countera");
  });
});
