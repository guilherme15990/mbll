import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PERSONAL_CALIBRATION_VERSION,
  PERSONAL_MIN_N,
  PERSONAL_Z,
  calibrateOwnVsGlobal,
  poolProfile,
} from "../src/heroes/profile.js";
import { calibrateOwnVsGlobal as viaIndex, poolProfile as viaIndexPool } from "../src/index.js";

// Próprio × global: só o modelo, sem auth. n pequeno = honestidade.
describe("personal-calibration-v1: calibrateOwnVsGlobal", () => {
  it("versão, piso e reexport", () => {
    assert.equal(PERSONAL_CALIBRATION_VERSION, "personal-calibration-v1");
    assert.equal(PERSONAL_MIN_N, 5);
    assert.equal(PERSONAL_Z, 2);
    assert.equal(viaIndex, calibrateOwnVsGlobal);
    assert.equal(viaIndexPool, poolProfile);
  });
  it("acima do global: diff além da faixa", () => {
    const r = calibrateOwnVsGlobal({ own: { win: 0.7, n: 40 }, global: { theta: 0.5, se: 0.01 } });
    assert.equal(r.verdict, "acima-do-global");
    assert.ok(r.diff > r.band);
  });
  it("abaixo do global", () => {
    const r = calibrateOwnVsGlobal({ own: { win: 0.3, n: 40 }, global: { theta: 0.5, se: 0.01 } });
    assert.equal(r.verdict, "abaixo-do-global");
  });
  it("na faixa: diff dentro da banda combinada", () => {
    const r = calibrateOwnVsGlobal({ own: { win: 0.52, n: 40 }, global: { theta: 0.5, se: 0.02 } });
    assert.equal(r.verdict, "na-faixa");
  });
  it("n=1 honesto: incerteza-dominante, nunca direção", () => {
    const r = calibrateOwnVsGlobal({ own: { win: 1, n: 1 }, global: { theta: 0.5, se: 0.01 } });
    assert.equal(r.verdict, "incerteza-dominante");
    assert.ok(r.reasons.includes("n=1"));
    assert.ok(r.reasons.includes("incerteza-amostral-domina"));
    const r4 = calibrateOwnVsGlobal({ own: { win: 1, n: 4 }, global: { theta: 0.5, se: 0.01 } });
    assert.equal(r4.verdict, "incerteza-dominante");
  });
  it("sem-dado com entrada inválida (nunca chute, nunca %)", () => {
    assert.equal(calibrateOwnVsGlobal({ own: { win: null, n: 10 }, global: { theta: 0.5, se: 0.01 } }).verdict, "sem-dado");
    assert.equal(calibrateOwnVsGlobal({ own: { win: 0.6, n: 0 }, global: { theta: 0.5, se: 0.01 } }).verdict, "sem-dado");
    assert.equal(calibrateOwnVsGlobal({ own: { win: 0.6, n: 10 }, global: { theta: 0.5, se: -1 } }).verdict, "sem-dado");
    assert.equal(calibrateOwnVsGlobal({}).verdict, "sem-dado");
    const r = calibrateOwnVsGlobal({ own: { win: 0.7, n: 40 }, global: { theta: 0.5, se: 0.01 } });
    assert.ok(r.diff <= 1 && r.band <= 1, "proporção, não %");
  });
});

describe("personal-calibration-v1: poolProfile", () => {
  const freq = [
    { hid: 1, tc: 30, wc: 18 },
    { hid: 2, tc: 20, wc: 8 },
    { hid: 3, tc: 10, wc: 7 },
  ];
  it("agrega pool por papel via mapa", () => {
    const p = poolProfile(freq, { 1: "assassino", 2: "mago", 3: "assassino" });
    assert.equal(p.nHeroes, 3);
    assert.equal(p.totalMatches, 60);
    assert.equal(p.mainRole, "assassino");
    assert.deepEqual(p.perRole.map((g) => g.role), ["assassino", "mago"]);
    assert.equal(p.perRole[0].matches, 40);
    assert.ok(p.winRate > 0 && p.winRate < 1);
    assert.ok(p.topShare <= 1, "proporção, não %");
  });
  it("papel declarado no item + fallback sem-papel", () => {
    const p = poolProfile([{ hid: 9, tc: 5, wc: 3, role: "suporte" }, { hid: 8, tc: 5, wc: 2 }]);
    assert.deepEqual(p.perRole.map((g) => g.role).sort(), ["sem-papel", "suporte"]);
  });
  it("vazio → null (sem pool inventada)", () => {
    assert.equal(poolProfile([]), null);
    assert.equal(poolProfile(null), null);
  });
});
