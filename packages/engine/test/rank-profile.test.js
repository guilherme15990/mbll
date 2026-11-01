import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RANK_ORDER, getRankProfileLabel } from "../src/heroes/ranking.js";

// Paridade unificada RanksSection + RanksPanel (canônico = painel).
describe("rank-profile: getRankProfileLabel", () => {
  it("ordem de ranks", () => {
    assert.deepEqual(RANK_ORDER, ["epic", "legend", "mythic", "honor", "glory"]);
  });
  it("inconclusivo sem classificação ou D inválido", () => {
    const d = { diff: 0.05, classification_status: "provisional" };
    assert.equal(getRankProfileLabel(d, "mythic", "glory").label, "Inconclusivo");
    assert.equal(getRankProfileLabel({ diff: null, classification_status: "classified" }, "mythic", "glory").label, "Inconclusivo");
    assert.equal(getRankProfileLabel({ diff: NaN, classification_status: "classified" }, "mythic", "glory").label, "Inconclusivo");
  });
  it("consistente |D|≤Δr (Δr default 0.02)", () => {
    const r = getRankProfileLabel({ diff: 0.01, classification_status: "classified" }, "mythic", "glory");
    assert.equal(r.label, "Consistente entre ranks");
    assert.match(r.motive, /\|D\|=0\.0100 ≤ Δr \(0\.02\)/);
    assert.match(r.color, /emerald/);
  });
  it("dependente com prob<0.8", () => {
    const r = getRankProfileLabel({ diff: 0.05, prob_above: 0.5, classification_status: "classified" }, "epic", "glory");
    assert.equal(r.label, "Dependente do rank");
    assert.match(r.motive, /P\(D>Δr\)=50\.0%/);
  });
  it("escala com o rank quando o elo mais alto é mais forte", () => {
    // D<0 com a=mythic,b=glory: mais forte em glory = elo mais alto do par.
    const r = getRankProfileLabel({ diff: -0.05, prob_above: 0.9, classification_status: "classified" }, "mythic", "glory");
    assert.equal(r.label, "Escala com o rank");
    assert.match(r.motive, /GLORY/);
    const r2 = getRankProfileLabel({ diff: 0.05, prob_above: 0.9, classification_status: "classified" }, "mythic", "glory");
    assert.equal(r2.label, "Mais forte em ranks inferiores");
  });
  it("D>0 favorece a; D<0 favorece b", () => {
    // D>0 com a=epic: mais forte no elo mais BAIXO do par.
    const r = getRankProfileLabel({ diff: 0.05, prob_above: 0.95, classification_status: "classified" }, "epic", "legend");
    assert.equal(r.label, "Mais forte em ranks inferiores");
    // D<0 com a=epic,b=legend: mais forte em legend = elo mais alto do par.
    const r2 = getRankProfileLabel({ diff: -0.05, prob_above: 0.95, classification_status: "classified" }, "epic", "legend");
    assert.equal(r2.label, "Escala com o rank");
  });
});
