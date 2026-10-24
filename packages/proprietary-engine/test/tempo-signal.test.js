import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getSignalStateBadge, seriesSpanMs, seriesSpanDays, isShortSeries,
  resolveTemporalSignal, trendDirectionOf,
} from "../src/meta/tempo-signal.js";

// Paridade unificada TempoSection + TempoPanel (PRD Temporal §6, canônico = painel).
const D = 86400e3;
const pts = (n, spanDays) => Array.from({ length: n }, (_, i) => ({
  date: new Date(Date.UTC(2026, 0, 1 + Math.round((i * spanDays) / Math.max(1, n - 1)))).toISOString().slice(0, 10),
  win: 0.5,
}));

describe("tempo-signal: getSignalStateBadge", () => {
  it("4 estados + case-insensitive", () => {
    assert.equal(getSignalStateBadge("persistent").label, "Sinal Persistente");
    assert.equal(getSignalStateBadge("REVERTED").label, "Sinal Revertido");
    assert.equal(getSignalStateBadge("initial").label, "Sinal Inicial");
    assert.equal(getSignalStateBadge("x").label, "Inconclusivo");
    assert.equal(getSignalStateBadge(undefined).label, "Inconclusivo");
  });
});

describe("tempo-signal: série curta e direção", () => {
  it("span em dias + curta <2pt ou <14d", () => {
    assert.equal(seriesSpanDays(pts(2, 20)), 20);
    assert.equal(seriesSpanMs([]), 0);
    assert.equal(isShortSeries(pts(1, 0)), true);
    assert.equal(isShortSeries(pts(5, 10)), true);
    assert.equal(isShortSeries(pts(5, 14)), false);
  });
  it("resolveTemporalSignal: curta sempre inconclusiva", () => {
    const r = resolveTemporalSignal("persistent", pts(1, 0));
    assert.equal(r.label, "Inconclusivo");
    assert.equal(r.short, true);
    assert.match(r.desc, /Série curta/);
    const ok = resolveTemporalSignal("persistent", pts(5, 20));
    assert.equal(ok.label, "Sinal Persistente");
    assert.equal(ok.short, false);
  });
  it("trendDirectionOf: limiar ±0,02, fallback delta_logit", () => {
    assert.equal(trendDirectionOf({ delta: 0.03 }).word, "subindo");
    assert.equal(trendDirectionOf({ delta: -0.03 }).word, "caindo");
    assert.equal(trendDirectionOf({ delta: 0.02 }).word, "estável");
    assert.equal(trendDirectionOf({ delta_logit: 0.05 }).word, "subindo");
    assert.equal(trendDirectionOf({ delta: null }).word, "sem direção");
    assert.equal(trendDirectionOf(undefined).word, "sem direção");
  });
});
