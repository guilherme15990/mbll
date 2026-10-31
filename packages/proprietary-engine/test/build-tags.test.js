import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getBuildTags } from "../src/builds/build-tags.js";

// Paridade com app/web/src/shared/domain/buildLabel.ts.
describe("build-tags: paridade getBuildTags", () => {
  it("popular é frequência (pick≥5%)", () => {
    const t = getBuildTags({ pick: 0.05, lift_vs_most_used: null });
    assert.deepEqual(t.map((x) => x.key), ["popular"]);
    assert.equal(t[0].tone, "popular");
  });
  it("emergente: pick<0.02 e lift>0.015", () => {
    const t = getBuildTags({ pick: 0.01, lift_vs_most_used: 0.016 });
    assert.deepEqual(t.map((x) => x.key), ["emergente"]);
    assert.equal(t[0].tone, "edge");
  });
  it("emergente exige lift>0.015 (0.015 não basta)", () => {
    assert.deepEqual(getBuildTags({ pick: 0.01, lift_vs_most_used: 0.015 }), []);
  });
  it("situacional: lift>0.02 com pick≥0.02", () => {
    const t = getBuildTags({ pick: 0.03, lift_vs_most_used: 0.021 });
    assert.deepEqual(t.map((x) => x.key), ["situacional"]);
  });
  it("negativo não gera tag (abaixo-da-ref foi removida)", () => {
    assert.deepEqual(getBuildTags({ pick: 0.03, lift_vs_most_used: -0.021 }), []);
  });
  it("silêncio no inconclusivo (|lift|≤0.02 ou sem suporte)", () => {
    assert.deepEqual(getBuildTags({ pick: 0.03, lift_vs_most_used: 0.02 }), []);
    assert.deepEqual(getBuildTags({ pick: 0.03, lift_vs_most_used: -0.02 }), []);
    assert.deepEqual(getBuildTags({ pick: 0.03, lift_vs_most_used: null }), []);
    assert.deepEqual(getBuildTags({ pick: 0.03 }), []);
  });
  it("popular + situacional acumulam", () => {
    const t = getBuildTags({ pick: 0.08, lift_vs_most_used: 0.05 });
    assert.deepEqual(t.map((x) => x.key), ["popular", "situacional"]);
  });
});
