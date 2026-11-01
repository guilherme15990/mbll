import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDraftPatterns } from "../src/matchups/draft-patterns.js";

// Paridade unificada DraftSection + DraftPanel (PRD Draft §7, canônico = painel).
describe("draft-patterns: getDraftPatterns", () => {
  it("5 padrões com badgeColor, stale sempre inativo", () => {
    const ps = getDraftPatterns({ strength_class: "Forte", pick: { residual: 0.01 }, ban: { residual: 0.01 } });
    assert.equal(ps.length, 5);
    assert.ok(ps.every((p) => typeof p.badgeColor === "string" && p.badgeColor.length > 0));
    assert.equal(ps[3].caso, "Stale Draft Pressure (Pressão Defasada)");
    assert.equal(ps[3].ativo, false);
  });
  it("forte + ban alto", () => {
    const ps = getDraftPatterns({ strength_class: "Joia", ban: { residual: 0.02 } });
    assert.equal(ps[0].ativo, true);
    assert.equal(ps[1].ativo, false);
  });
  it("overbanned: moderado + ban alto", () => {
    const ps = getDraftPatterns({ strength_class: "Mediano", ban: { residual: 0.02 } });
    assert.equal(ps[1].ativo, true);
  });
  it("hidden gem: forte + pick baixo", () => {
    const ps = getDraftPatterns({ strength_class: "Forte", pick: { residual: -0.01 } });
    assert.equal(ps[2].ativo, true);
  });
  it("popular underperformer: moderado + pick alto", () => {
    const ps = getDraftPatterns({ strength_class: "x", pick: { residual: 0.01 } });
    assert.equal(ps[4].ativo, true);
  });
  it("limiares estritos em 0 (residual 0 não ativa)", () => {
    const ps = getDraftPatterns({ strength_class: "Forte", pick: { residual: 0 }, ban: { residual: 0 } });
    assert.ok(ps.every((p) => p.ativo === false));
  });
  it("sem dado: tudo inativo menos nada (modesto sem resíduos)", () => {
    const ps = getDraftPatterns(undefined);
    assert.ok(ps.every((p) => p.ativo === false));
  });
});
