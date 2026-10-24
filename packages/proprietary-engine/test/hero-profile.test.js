import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dominantProfileOf } from "../src/hero/hero-profile.js";

// Paridade com HeroCard.tsx (HeroProfileChip).
describe("hero-profile: dominantProfileOf", () => {
  it("null sem perfis válidos", () => {
    assert.equal(dominantProfileOf([]), null);
    assert.equal(dominantProfileOf(["x", null]), null);
  });
  it("filtra inválidos e conta N/M", () => {
    assert.deepEqual(
      dominantProfileOf(["snowball", "x", "snowball", "scaling"]),
      { top: "snowball", n: 2, total: 3 },
    );
  });
  it("desempate por ordem fixa snowball › scaling › uniforme (não por entrada)", () => {
    // MOTIVO: a ordem da lista É a regra de desempate (antes: quem aparecesse primeiro no input).
    const r = dominantProfileOf(["scaling", "snowball"]);
    assert.equal(r.n, 1);
    assert.equal(r.total, 2);
    assert.equal(r.top, "snowball");
    assert.equal(dominantProfileOf(["uniforme", "scaling"]).top, "scaling");
  });
});
