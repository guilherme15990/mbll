import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PLAYSTYLE_MIN_MATCHES,
  clusterPlaystyle,
  compareToPattern,
} from "../src/heroes/profile.js";

// Playstyle (op, tfr): dados user/matches (JWT). Sem auth, sem fiação — só modelo.
describe("playstyle", () => {
  it("piso congelado", () => {
    assert.equal(PLAYSTYLE_MIN_MATCHES, 5);
  });
  const quad = (op, tfr, n, jitter) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ op: op + (i % 2 ? jitter : -jitter), tfr: tfr + (i % 3 ? jitter : -jitter) });
    }
    return out;
  };
  it("separa 4 quadrantes limpos", () => {
    const pts = [
      ...quad(0.35, 0.8, 8, 0.02),
      ...quad(0.35, 0.2, 8, 0.02),
      ...quad(0.08, 0.8, 8, 0.02),
      ...quad(0.08, 0.2, 8, 0.02),
    ];
    const r = clusterPlaystyle(pts, 4);
    assert.equal(r.clusters.length, 4);
    const keys = r.clusters.map((c) => c.key).sort();
    assert.deepEqual(keys, ["frontline", "pickoff", "teamfight", "transicao"]);
    assert.ok(r.clusters.every((c) => c.n >= 6));
  });
  it("determinístico: mesma entrada, mesma saída", () => {
    const pts = [...quad(0.3, 0.7, 6, 0.03), ...quad(0.1, 0.2, 6, 0.03)];
    const a = JSON.stringify(clusterPlaystyle(pts, 2));
    const b = JSON.stringify(clusterPlaystyle(pts, 2));
    assert.equal(a, b);
  });
  it("n<5 = null; inválidos filtrados", () => {
    assert.equal(clusterPlaystyle([{ op: 0.3, tfr: 0.7 }]), null);
    assert.equal(clusterPlaystyle([]), null);
    const r = clusterPlaystyle([
      { op: 0.3, tfr: 0.7 }, { op: 0.31, tfr: 0.72 }, { op: 0.29, tfr: 0.68 },
      { op: 0.32, tfr: 0.71 }, { op: 0.28, tfr: 0.69 }, { op: NaN, tfr: 0.5 },
      { op: 0.3 }, { tfr: 0.7 },
    ]);
    assert.equal(r.n, 5);
  });
  it("compareToPattern exige origem (proveniência)", () => {
    const v = { op: 0.3, tfr: 0.7 };
    assert.equal(compareToPattern(v, { op: 0.3, tfr: 0.7 }), null);
    const r = compareToPattern(v, { op: 0.3, tfr: 0.7, label: "pool", origin: "pool-propria" });
    assert.equal(r.distance, 0);
    assert.equal(r.origin, "pool-propria");
    const r2 = compareToPattern(v, { op: 0.1, tfr: 0.1, label: "papel", origin: "papel-assassino" });
    assert.ok(r2.distance > 0.5);
    assert.equal(compareToPattern({ op: 9, tfr: 0.7 }, { op: 0.3, tfr: 0.7, origin: "x" }).distance, compareToPattern({ op: 1, tfr: 0.7 }, { op: 0.3, tfr: 0.7, origin: "x" }).distance);
  });
});
