// Testes do Draft Score do herói (`hero-draft-score-v1`).
//
// Foco: UM número 0–100 por herói = min–max da WR no recorte (o melhor WR lê 100,
// o pior lê 0); só o desfecho entra (nada de `pick`/`ban`, pesos ou constantes
// declaradas); ausência de WR = `draft_score` nulo (sem-dado), nunca 0 silencioso;
// lote sem faixa (constante) = 50 (meio da escala, leitura honesta de "sem spread").
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scoreHeroDraftScore,
  HERO_DRAFT_SCORE_VERSION,
} from "../src/index.js";

const hero = (id, over = {}) => ({ id, name: `H${id}`, win: 0.5, ...over });
const scoreOf = (out, id) => out.rows.find((r) => r.id === id).draft_score;

test("contrato: versão, meta e ausência de parâmetros declarados", () => {
  const out = scoreHeroDraftScore({ heroes: [hero(1, { win: 0.4 }), hero(2, { win: 0.6 })] });
  assert.equal(out.version, HERO_DRAFT_SCORE_VERSION);
  assert.equal(out.version, "hero-draft-score-v1");
  assert.equal(out.meta.calibrated, false);
  assert.equal(out.meta.n_heroes, 2);
  assert.equal(out.meta.with_data, 2);
  // Sem knobs declarados: o resultado NÃO carrega k/priorVar/unit_status.
  assert.equal("k" in out, false);
  assert.equal("priorVar" in out, false);
  assert.equal("unit_status" in out, false);
});

test("escala do lote: melhor WR = 100, pior WR = 0", () => {
  const out = scoreHeroDraftScore({ heroes: [hero(1, { win: 0.56 }), hero(2, { win: 0.5 }), hero(3, { win: 0.44 })] });
  assert.equal(scoreOf(out, 1), 100, "maior WR");
  assert.equal(scoreOf(out, 3), 0, "menor WR");
  assert.equal(scoreOf(out, 2), 50, "meio da faixa: (0.5−0.44)/(0.56−0.44)=0.5");
});

test("reecala no lote: WR 50% só lê 50 se for o meio da faixa observada", () => {
  // Faixa 0.40–0.60 ⇒ 0.50 é o meio ⇒ 50.
  const centered = scoreHeroDraftScore({ heroes: [hero(1, { win: 0.4 }), hero(2, { win: 0.5 }), hero(3, { win: 0.6 })] });
  assert.equal(scoreOf(centered, 2), 50);
  // Faixa 0.50–0.60 ⇒ 0.50 é o PISO do lote ⇒ 0 (não 50): a escala é do recorte.
  const floorish = scoreHeroDraftScore({ heroes: [hero(1, { win: 0.5 }), hero(2, { win: 0.6 })] });
  assert.equal(scoreOf(floorish, 1), 0);
});

test("monotônico na WR: quem ganha mais nunca pontua menos", () => {
  const out = scoreHeroDraftScore({ heroes: [hero(1, { win: 0.4 }), hero(2, { win: 0.52 }), hero(3, { win: 0.6 })] });
  const s = [scoreOf(out, 1), scoreOf(out, 2), scoreOf(out, 3)];
  assert.deepEqual(s, [...s].sort((a, b) => a - b));
  assert.equal(s[0], 0);
  assert.equal(s[2], 100);
});

test("pick/ban NÃO influenciam o número (exposição ≠ força)", () => {
  const a = scoreHeroDraftScore({ heroes: [hero(1, { win: 0.53, pick: 0.3, ban: 0.8 }), hero(2, { win: 0.45 })] });
  const b = scoreHeroDraftScore({ heroes: [hero(1, { win: 0.53, pick: 0.001, ban: 0 }), hero(2, { win: 0.45 })] });
  assert.equal(scoreOf(a, 1), scoreOf(b, 1));
  assert.equal(scoreOf(a, 1), 100, "maior WR do lote");
});

test("sem WR no recorte ⇒ draft_score null (sem-dado), nunca 0", () => {
  const out = scoreHeroDraftScore({ heroes: [hero(1, { win: null })] });
  assert.equal(out.rows[0].draft_score, null);
  assert.equal(out.meta.with_data, 0);
  assert.equal(out.meta.wr_min, null);
  assert.equal(out.meta.wr_max, null);
});

test("win ausente/''/NaN caem para null; win 0 é dado válido", () => {
  const out = scoreHeroDraftScore({
    heroes: [hero(1, { win: undefined }), hero(2, { win: "" }), hero(3, { win: "abc" }), hero(4, { win: 0 }), hero(5, { win: 1 })],
  });
  assert.equal(scoreOf(out, 1), null);
  assert.equal(scoreOf(out, 2), null);
  assert.equal(scoreOf(out, 3), null);
  assert.equal(scoreOf(out, 4), 0, "WR 0% é o piso do lote");
  assert.equal(scoreOf(out, 5), 100, "WR 100% é o topo do lote");
});

test("lote sem faixa (todos os WR iguais) ⇒ 50 (meio da escala), não 100/0", () => {
  const out = scoreHeroDraftScore({ heroes: [hero(1, { win: 0.51 }), hero(2, { win: 0.51 })] });
  assert.equal(scoreOf(out, 1), 50);
  assert.equal(scoreOf(out, 2), 50);
  // Herói único também não tem faixa.
  assert.equal(scoreHeroDraftScore({ heroes: [hero(9, { win: 0.62 })] }).rows[0].draft_score, 50);
});

test("arredonda a 2 casas (min–max no lote)", () => {
  // Faixa 0.40–0.50; 0.45257 ⇒ (0.05257/0.10)=52.57%.
  const out = scoreHeroDraftScore({ heroes: [hero(1, { win: 0.45257 }), hero(2, { win: 0.4 }), hero(3, { win: 0.5 })] });
  assert.equal(scoreOf(out, 1), 52.57);
});

test("dedupe por id preserva a primeira ocorrência", () => {
  const out = scoreHeroDraftScore({ heroes: [hero(1, { win: 0.55 }), hero(1, { win: 0.4 }), hero(2, { win: 0.45 })] });
  assert.equal(out.rows.length, 2);
  assert.equal(scoreOf(out, 1), 100);
  assert.equal(scoreOf(out, 2), 0);
});

test("entradas nulas / id não-numérico são ignoradas", () => {
  const out = scoreHeroDraftScore({ heroes: [null, { name: "sem id" }, { id: "abc" }, hero(7, { win: 0.5 })] });
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].id, 7);
});

test("input vazio / indefinido ⇒ rows vazio, sem NaN", () => {
  for (const input of [undefined, {}, { heroes: [] }, { heroes: null }]) {
    const out = scoreHeroDraftScore(input);
    assert.equal(out.rows.length, 0);
    assert.equal(out.meta.n_heroes, 0);
  }
});

test("meta expõe as âncoras do lote (WR mín/máx)", () => {
  const out = scoreHeroDraftScore({ heroes: [hero(1, { win: 0.5426 }), hero(2, { win: 0.444 })] });
  assert.equal(out.meta.wr_min, 0.444);
  assert.equal(out.meta.wr_max, 0.5426);
  // Com este lote o de maior WR lê 100 e o de menor lê 0 (escala do recorte).
  assert.equal(scoreOf(out, 1), 100);
  assert.equal(scoreOf(out, 2), 0);
});

test("eco de identidade: name/head repassados; head ausente ⇒ null", () => {
  const out = scoreHeroDraftScore({ heroes: [{ id: 5, name: "Fanny", head: "u.png", win: 0.51 }, { id: 6, win: 0.49 }] });
  assert.equal(out.rows.find((r) => r.id === 5).name, "Fanny");
  assert.equal(out.rows.find((r) => r.id === 5).head, "u.png");
  assert.equal(out.rows.find((r) => r.id === 6).head, null);
});
