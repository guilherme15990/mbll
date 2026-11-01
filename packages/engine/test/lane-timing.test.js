import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LANE_TIMING_VERSION,
  LANE_TIMING_MIN_WINDOWS,
  LANE_TIMING_DELTA,
  laneTimingCurve,
} from "../src/heroes/trends.js";
import { laneTimingCurve as viaIndex } from "../src/index.js";

// time_win_rate[] → curva por rota, gramática do meta-trend.
describe("lane-timing-v1", () => {
  it("versão, pisos e reexport", () => {
    assert.equal(LANE_TIMING_VERSION, "lane-timing-v1");
    assert.equal(LANE_TIMING_MIN_WINDOWS, 3);
    assert.equal(LANE_TIMING_DELTA, 0.02);
    assert.equal(viaIndex, laneTimingCurve);
  });
  const W = (wins) => wins.map((win_rate, i) => ({ time_min: 8 + i * 2, time_max: 10 + i * 2, win_rate }));
  it("sobe: rampa limpa (voto + rampa concordam)", () => {
    const r = laneTimingCurve(W([0.42, 0.46, 0.51, 0.56]), "jungle");
    assert.equal(r.verdict, "subindo");
    assert.equal(r.lane, "jungle");
    assert.equal(r.n, 4);
    assert.deepEqual(r.segments.map((s) => s.move), ["ref", "sobe", "sobe", "sobe"]);
    assert.equal(r.peak.time_min, 14);
    assert.ok(r.slopePerWindow > 0);
  });
  it("desce: idem invertido", () => {
    const r = laneTimingCurve(W([0.56, 0.51, 0.46, 0.42]), "gold");
    assert.equal(r.verdict, "caindo");
    assert.ok(r.slopePerWindow < 0);
    assert.equal(r.peak.time_min, 8);
  });
  it("estável: ruído dentro do limiar", () => {
    const r = laneTimingCurve(W([0.5, 0.51, 0.495, 0.505]));
    assert.equal(r.verdict, "estavel");
    assert.ok(r.segments.slice(1).every((s) => s.move === "estavel"));
  });
  it("curto: <3 janelas = sem-dado (nunca chute), pico nulo sem dado", () => {
    const r = laneTimingCurve(W([0.5, 0.6]), "mid");
    assert.equal(r.verdict, "sem-dado");
    assert.ok(r.reasons.some((x) => x.startsWith("janelas=")));
    assert.equal(laneTimingCurve([], "mid").peak, null);
  });
  it("ordena por time_min + ignora win não-finito", () => {
    const r = laneTimingCurve([
      { time_min: 12, time_max: 14, win_rate: 0.6 },
      { time_min: 8, time_max: 10, win_rate: 0.5 },
      { time_min: 10, time_max: 12, win_rate: NaN },
      { time_min: 14, time_max: 16, win_rate: 0.55 },
    ]);
    assert.equal(r.n, 3);
    assert.deepEqual(r.segments.map((s) => s.time_min), [8, 12, 14]);
    assert.equal(r.peak.win_rate, 0.6);
  });
  it("delegação ao detector com n≥7 (mesma gramática, sem data/projeção semanal)", () => {
    const ys = [0.5, 0.51, 0.52, 0.53, 0.54, 0.55, 0.56, 0.57];
    const r = laneTimingCurve(W(ys), "exp");
    assert.equal(r.verdict, "subindo");
    assert.ok(r.reasons.some((x) => x.includes("pico=")));
    assert.ok(r.reasons.includes("projecao-semanal-nao-aplica-a-duracao"));
  });
  it("reasons retraduzidos p/ duração (sem /dia nem @data sintética)", () => {
    const ys = [0.5, 0.51, 0.5, 0.52, 0.51, 0.53, 0.52, 0.54];
    const r = laneTimingCurve(W(ys), "jungle");
    const blob = r.reasons.join(" | ");
    assert.ok(!/\/dia\b/.test(blob), "vazou /dia");
    assert.ok(!/ruptura-cusum@janela-\d/.test(blob), "vazou data sintética");
    assert.equal(r.forecastNext, null);
    assert.equal(r.changeDate, null);
  });
});
