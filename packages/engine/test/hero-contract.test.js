// Testes da engine de heróis — node:test nativo, sem dependências.  Rodar: node --test
// Cobre: monotonicidade das vistas de θ̂, contrato de saída, determinismo (ordem de entrada),
// invariantes de significância e helpers de lista/ordenação/tendência/perfil.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreBatch, scoreHeroes, HERO_CONTRACT } from "../src/heroes/scoring.js";
import { TIER_ORDER } from "../src/heroes/ranking.js";
import { trendOf } from "../src/heroes/trends.js";
import { dominantProfileOf } from "../src/heroes/profile.js";
import { sortHeroesByMetric, heroRankPosition, heroRankPositions, medianWrAdj } from "../src/heroes/ranking.js";
import { medianOf, medianPickOf } from "../src/heroes/ranking.js";
import { classOf } from "../src/heroes/trust.js";

// PRNG determinístico (mulberry32) + normal por Box–Muller.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

function makeLot(seed, n, { ties = 0, degenerate = 0 } = {}) {
  const r = rng(seed);
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      id: i + 1,
      name: `H${i + 1}`,
      win: Math.min(0.99, Math.max(0.01, 0.5 + 0.035 * gauss(r))),
      pick: Math.max(0.0004, Math.exp(Math.log(0.0075) + 0.9 * gauss(r))),
      ban: Math.max(0, Math.exp(Math.log(0.04) + 1.3 * gauss(r))),
    });
  }
  for (let k = 0; k < ties; k++) rows[n - 1 - k] = { ...rows[k], id: n - k, name: `T${k}` }; // clones exatos ⇒ θ̂ empatado
  for (let k = 0; k < degenerate; k++) rows[10 + k] = { ...rows[10 + k], win: k % 2 ? 1 : 0, pick: 0.0005 };
  return rows;
}

function shuffled(rows, seed) {
  const r = rng(seed);
  const a = [...rows];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const PRIOR_SAME = { mu: 0.5, tau2: 0.0009, n: 130, game_version: "2.1.18" };
const SCENARIOS = [
  ["sem prior, n=132", () => makeLot(1, 132), {}],
  ["com empates + degenerados, n=130", () => makeLot(2, 130, { ties: 6, degenerate: 3 }), {}],
  ["prior mesma versão", () => makeLot(3, 132), { prior: PRIOR_SAME, gameVersion: "2.1.18" }],
  ["prior com quebra de versão", () => makeLot(4, 132), { prior: PRIOR_SAME, gameVersion: "2.1.19" }],
  ["lote médio, n=40", () => makeLot(5, 40), {}],
];

for (const [label, build, opts] of SCENARIOS) {
  test(`vistas de θ̂ monotônicas — ${label}`, () => {
    const hs = scoreHeroes(build(), opts);
    let pairs = 0;
    for (const A of hs) {
      for (const B of hs) {
        if (A.wrAdj > B.wrAdj) {
          pairs++;
          assert.ok(TIER_ORDER.indexOf(A.tier) >= TIER_ORDER.indexOf(B.tier), `tier ${A.id}>${B.id}`);
          assert.ok(A.strength_index > B.strength_index, `strength_index ${A.id}>${B.id}`);
        } else if (A.wrAdj === B.wrAdj) {
          assert.equal(A.tier, B.tier);
          assert.equal(A.strength_index, B.strength_index); // empate dá o mesmo posto
        }
      }
    }
    assert.ok(pairs > 0);
  });

  test(`contrato + invariantes de significância — ${label}`, () => {
    const { heroes, meta } = scoreBatch(build(), opts);
    const allowed = new Set([...Object.keys(HERO_CONTRACT), "id", "name", "win", "pick", "ban"]);
    for (const h of heroes) {
      for (const k of Object.keys(h)) assert.ok(allowed.has(k), `campo fora do contrato: ${k}`);
      for (const k of Object.keys(HERO_CONTRACT)) assert.ok(k in h, `campo faltando: ${k}`);
      assert.ok(!(h.strong && h.weak), "strong e weak são exclusivos");
      assert.ok(!h.isGem || h.strong, "isGem ⊂ strong");
      assert.ok(!(h.degenerate && (h.strong || h.weak)), "degenerada não é significante");
      if (h.strong) assert.ok(h.wrAdj > meta.mu && h.q <= meta.fdr_alpha);
      if (h.weak) assert.ok(h.wrAdj < meta.mu && h.q <= meta.fdr_alpha);
    }
    // MOTIVO (v3: 15 do CONTRATO + posterior_mean (a) + z (b) + data_status + sample_size_method + inference_status − sensitivity_band = 19).
    assert.ok(Object.keys(HERO_CONTRACT).length <= 20);
    assert.equal(meta.counts.strong, heroes.filter((h) => h.strong).length);
    assert.equal(meta.counts.gem, heroes.filter((h) => h.isGem).length);
    assert.equal(meta.n, heroes.length);
  });

  test(`determinismo e independência da ordem de entrada — ${label}`, () => {
    const rows = build();
    const a = scoreHeroes(rows, opts);
    const b = scoreHeroes(rows, opts);
    assert.deepEqual(a, b);
    const byId = (hs) => new Map(hs.map((h) => [h.id, h]));
    const m1 = byId(a);
    const m2 = byId(scoreHeroes(shuffled(rows, 99), opts));
    for (const [id, h] of m1) assert.deepEqual(m2.get(id), h, `herói ${id} muda com a ordem`);
  });
}

test("significância PODE discordar de θ̂ (herói de θ̂ alto e pick minúsculo não é strong)", () => {
  const rows = makeLot(7, 132);
  rows[0] = { ...rows[0], win: 0.62, pick: 0.0004 };
  const hs = scoreHeroes(rows);
  const maxT = Math.max(...hs.map((h) => h.wrAdj));
  const h0 = hs[0];
  assert.ok(h0.wrAdj < maxT, "shrinkage puxou o herói de pick minúsculo");
  assert.equal(h0.strong, false);
});

test("lote pequeno: guardas ligadas, tier '?'", () => {
  const { heroes, meta } = scoreBatch(makeLot(8, 8));
  assert.equal(meta.small_sample, true);
  for (const h of heroes) {
    assert.equal(h.tier, "?");
    assert.ok(!h.strong && !h.weak && !h.isGem);
  }
});

test("lote vazio e linhas inválidas", () => {
  assert.deepEqual(scoreHeroes([]), []);
  assert.deepEqual(scoreHeroes(null), []);
  const { heroes, meta } = scoreBatch([...makeLot(9, 20), { id: 99, win: NaN, pick: 0.01, ban: 0.1 }, null]);
  assert.equal(heroes.length, 20);
  assert.equal(meta.n_dropped, 2);
});

test("debug opcional não altera os campos do contrato", () => {
  const rows = makeLot(10, 50);
  const plain = scoreHeroes(rows);
  const dbg = scoreHeroes(rows, { debug: true });
  dbg.forEach((h, i) => {
    const { _debug, ...rest } = h;
    assert.ok(_debug && "z" in _debug && "posterior_mean" in _debug);
    assert.deepEqual(rest, plain[i]);
  });
});

test("meta traz o que saiu do herói", () => {
  const { meta } = scoreBatch(makeLot(11, 132), { prior: PRIOR_SAME, gameVersion: "9.9.9" });
  for (const k of ["mu", "tau", "c", "c_reference", "c_grade", "prior", "version_break", "counts"]) {
    assert.ok(k in meta, k);
  }
  assert.equal(meta.version_break, true);
  assert.ok(meta.prior);
});

test("classOf v3: rótulos descritivos e nulos", () => {
  const rows = scoreHeroes(makeLot(12, 132));
  for (const h of rows) {
    assert.ok(typeof classOf(h) === "string");
  }
  assert.equal(classOf({ smallSample: false, strong: true, isGem: true }), "Joia");
});

test("ordenação e posição: independem da ordem, 'd' é alias de wrAdj, bulk = individual", () => {
  const hs = scoreHeroes(makeLot(13, 132, { ties: 6 }));
  const ids = (r) => r.map((h) => h.id).join(",");
  assert.equal(ids(sortHeroesByMetric(hs, "d")), ids(sortHeroesByMetric(hs, "wrAdj")));
  for (const key of ["wrAdj", "win", "pick", "ban", "q", "B", "strength_index"]) {
    assert.equal(ids(sortHeroesByMetric(hs, key)), ids(sortHeroesByMetric(shuffled(hs, 5), key)), key);
  }
  const bulk = heroRankPositions(hs);
  for (const h of hs) assert.equal(heroRankPosition(hs, h.id), bulk.get(String(h.id)));
  assert.equal(heroRankPosition(hs, "nao-existe"), 0);
  assert.equal(new Set(bulk.values()).size, hs.length); // posições 1..n sem repetição
});

test("medianas: verdadeira em n par; fallbacks sem dado", () => {
  assert.equal(medianOf([1, 2, 3, 4]), 2.5);
  assert.equal(medianOf([]), null);
  assert.equal(medianPickOf([]), 0.007);
  assert.equal(medianWrAdj([]), 0.5);
});

test("perfil dominante: empate resolve por ordem fixa, não por entrada", () => {
  assert.equal(dominantProfileOf(["scaling", "snowball"]).top, "snowball");
  assert.equal(dominantProfileOf(["snowball", "scaling"]).top, "snowball");
  assert.equal(dominantProfileOf(["x", null]), null);
  assert.deepEqual(dominantProfileOf(["uniforme", "uniforme", "snowball"]), { top: "uniforme", n: 2, total: 3 });
});

test("tendência Theil–Sen: robusta a ponto atípico no extremo, mantém o vocabulário", () => {
  const pts = (ys) => ys.map((win) => ({ win }));
  assert.equal(trendOf(pts([0.5, 0.5, 0.5, 0.5, 0.6])).dir, "estável"); // diff bruto diria "subindo"
  assert.equal(trendOf(pts([0.5, 0.505, 0.51, 0.515, 0.52])).dir, "subindo");
  assert.equal(trendOf(pts([0.52, 0.515, 0.51, 0.505, 0.5])).dir, "caindo");
  assert.deepEqual(trendOf(pts([0.5])), { dir: "sem-dado", delta: null, n: 1 });
  assert.deepEqual(trendOf(null), { dir: "sem-dado", delta: null, n: 0 });
});

test("DESVIO (c): ordem por wrAdj ≡ ordem por d (d era afim crescente de θ̂)", () => {
  // d = (θ̂ − μ)/τ com μ,τ do lote ⇒ afim crescente em θ̂; sort por "d" deve dar a
  // mesma ordem que sort por "wrAdj" em qualquer lote (prova por construção + spot check).
  const hs = scoreHeroes(makeLot(14, 132));
  const ids = (r) => r.map((h) => h.id).join(",");
  assert.equal(ids(sortHeroesByMetric(hs, "d")), ids(sortHeroesByMetric(hs, "wrAdj")));
  // Prova direta: d reconstruído no fio é afim crescente de wrAdj (τ > 0).
  const { meta } = scoreBatch(makeLot(14, 132));
  assert.ok(meta.tau > 0);
  const ds = hs.map((h) => (h.wrAdj - meta.mu) / meta.tau);
  const orderW = [...hs].sort((a, b) => b.wrAdj - a.wrAdj).map((h) => h.id).join(",");
  const orderD = hs.map((h, i) => ({ id: h.id, d: ds[i] })).sort((a, b) => b.d - a.d).map((x) => x.id).join(",");
  assert.equal(orderD, orderW);
});
