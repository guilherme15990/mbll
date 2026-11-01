import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CONTRAST_MIN,
  componentsOfBuild,
  contextContrasts,
  contrastEstimates,
  valueFieldsOf,
} from "../src/builds/contrast.js";

// Build sintética no formato interno (`parseBuild`): item_ids ordenados,
// emblema/talentos/feitiço resolvidos.
const B = (items, win, pick = 0.1, extra = {}) => ({
  item_ids: [...items],
  win,
  pick,
  emblem: { id: 20012 },
  talents: [
    { id: 11, tier: 1 },
    { id: 21, tier: 2 },
    { id: 31, tier: 3 },
  ],
  spell: { name: "Flicker" },
  ...extra,
});

const ctx = (builds, heroId = 1) => ({ hero: { id: heroId }, builds });

describe("contraste: componentes da build", () => {
  it("expõe item, emblema, talento por slot e feitiço", () => {
    const keys = componentsOfBuild(B([1, 2, 3], 0.5)).map((c) => c.key);
    assert.deepEqual(keys, [
      "i:1", "i:2", "i:3",
      "e:20012",
      "t:1:11", "t:2:21", "t:3:31",
      "s:flicker",
    ]);
  });

  it("talento sem tier no catálogo cai na posição do array", () => {
    const b = B([1], 0.5, 0.1, { talents: [{ id: 90 }, { id: 91 }, { id: 92 }] });
    const keys = componentsOfBuild(b).filter((c) => c.kind === "talent").map((c) => c.key);
    assert.deepEqual(keys, ["t:1:90", "t:2:91", "t:3:92"]);
  });
});

describe("contraste: troca pareada", () => {
  it("troca de 1 item no mesmo núcleo vira contraste pareado simétrico", () => {
    const c = ctx([
      B([1001, 1002, 2001], 0.55, 0.30),
      B([1001, 1002, 2002], 0.50, 0.10),
    ]);
    const rows = contextContrasts(c);
    const out = rows.get("i:2001");
    const inn = rows.get("i:2002");
    assert.equal(out.mode, "paired");
    assert.equal(out.delta_pp, 5);
    assert.equal(inn.delta_pp, -5);
    assert.equal(out.pairs, 1);
    // itens presentes nas duas builds não têm contraste
    assert.equal(rows.has("i:1001"), false);
  });

  it("troca de talento no mesmo tier é pareada; outros tiers não entram", () => {
    const c = ctx([
      B([1001, 1002, 2001], 0.55, 0.2, { talents: [{ id: 11, tier: 1 }, { id: 21, tier: 2 }, { id: 31, tier: 3 }] }),
      B([1001, 1002, 2001], 0.51, 0.2, { talents: [{ id: 11, tier: 1 }, { id: 21, tier: 2 }, { id: 32, tier: 3 }] }),
    ]);
    const rows = contextContrasts(c);
    assert.equal(rows.get("t:3:31").delta_pp, 4);
    assert.equal(rows.get("t:3:32").delta_pp, -4);
    assert.equal(rows.get("t:3:31").mode, "paired");
    assert.equal(rows.has("t:1:11"), false);
  });

  it("build sem talento no slot não conta como troca pareada", () => {
    const c = ctx([
      B([1001, 1002, 2001], 0.55, 0.2, { talents: [{ id: 11, tier: 1 }, { id: 21, tier: 2 }, { id: 31, tier: 3 }] }),
      B([1001, 1002, 2001], 0.51, 0.2, { talents: [{ id: 11, tier: 1 }, { id: 21, tier: 2 }] }),
    ]);
    const row = contextContrasts(c).get("t:3:31");
    assert.equal(row.mode, "cohort");
    assert.equal(row.pairs, 0);
  });

  it("feitiço diferente com o resto igual é pareado; emblema constante não tem contraste", () => {
    const c = ctx([
      B([1001, 1002, 2001], 0.55, 0.2, { spell: { name: "Flicker" } }),
      B([1001, 1002, 2001], 0.52, 0.2, { spell: { name: "Retribution" } }),
    ]);
    const rows = contextContrasts(c);
    assert.equal(rows.get("s:flicker").delta_pp, 3);
    assert.equal(rows.get("s:flicker").mode, "paired");
    assert.equal(rows.has("e:20012"), false);
  });

  it("sem troca limpa o contraste é de coorte (mode cohort, pairs 0)", () => {
    const c = ctx([
      B([1001, 1002, 2001], 0.55, 0.2),
      B([1001, 2002, 2003], 0.50, 0.2),
    ]);
    const rows = contextContrasts(c);
    const row = rows.get("i:2001");
    assert.equal(row.mode, "cohort");
    assert.equal(row.pairs, 0);
    assert.equal(row.delta_pp, 5);
  });
});

describe("contraste: agregação e evidência", () => {
  it("1 contexto = 1 voto, com encolhimento n/(n+K)", () => {
    const contexts = [1, 2, 3].map((id) => ctx([
      B([1001, 1002, 2001], 0.55, 0.2),
      B([1001, 1002, 2002], 0.51, 0.2),
    ], id));
    const stats = contrastEstimates(contexts);
    const s = stats.get("i:2001");
    assert.equal(s.contexts_contrast, 3);
    assert.equal(s.contexts_paired, 3);
    assert.equal(s.pooled_pp, 4);
    assert.equal(s.shrink, 0.5);
    assert.equal(s.value, 2);
    assert.equal(s.evidence, "observed");
    assert.equal(s.status, "positive");
  });

  it("valor entre 0 e o mínimo prático vira no_practical_difference", () => {
    const contexts = [1, 2, 3].map((id) => ctx([
      B([1001, 1002, 2001], 0.551, 0.2),
      B([1001, 1002, 2002], 0.55, 0.2),
    ], id));
    const s = contrastEstimates(contexts).get("i:2001");
    assert.equal(s.status, "no_practical_difference");
  });

  it("poucos contextos: valor é publicado como estimated, nunca null", () => {
    const contexts = [1, 2].map((id) => ctx([
      B([1001, 1002, 2001], 0.56, 0.2),
      B([1001, 1002, 2002], 0.50, 0.2),
    ], id));
    const s = contrastEstimates(contexts).get("i:2001");
    assert.equal(s.evidence, "estimated");
    assert.equal(s.value, 2.4);
    const fields = valueFieldsOf(s);
    assert.equal(fields.value_pp, null);
    assert.ok(Number.isFinite(fields.value_pp_est));
    assert.ok(Number.isFinite(fields.power));
  });

  it("mediana evita que 1 contexto extremo domine", () => {
    const deltas = [10, 10, -2];
    const contexts = deltas.map((pp, i) => ctx([
      B([1001, 1002, 2001], 0.55 + pp / 100, 0.2),
      B([1001, 1002, 2002], 0.55, 0.2),
    ], i + 1));
    const s = contrastEstimates(contexts).get("i:2001");
    assert.equal(s.pooled_pp, 10);
  });

  it("emblema é descritivo mesmo quando existe contraste (variação rara)", () => {
    const contexts = [1, 2, 3].map((id) => ctx([
      B([1001, 1002, 2001], 0.55, 0.2, { emblem: { id: 20012 } }),
      B([1001, 1002, 2002], 0.51, 0.2, { emblem: { id: 20013 } }),
    ], id));
    const stats = contrastEstimates(contexts);
    const s = stats.get("e:20012");
    assert.equal(s.evidence, "descriptive");
    assert.equal(s.value, null);
    const fields = valueFieldsOf(s);
    assert.equal(fields.value_pp, null);
    assert.equal(fields.value_pp_est, null);
    assert.equal(fields.power, null);
    assert.equal(fields.value_pp_source, "descriptive");
    // o emblema alternativo também é descritivo, nunca valor
    assert.equal(stats.get("e:20013").evidence, "descriptive");
  });

  it("componente sem contraste não entra nas estimativas (source none)", () => {
    const contexts = [ctx([B([1001, 1002, 2001], 0.55, 0.2), B([1001, 1002, 2001], 0.54, 0.2)])];
    const stats = contrastEstimates(contexts);
    assert.equal(stats.size, 0);
    const fields = valueFieldsOf(stats.get("i:1001"));
    assert.equal(fields.value_pp_source, "none");
    assert.equal(fields.contrast.contexts, 0);
  });

  it("mínimos por tipo: item exige 3 contextos, talento 2", () => {
    assert.equal(CONTRAST_MIN.item.contexts, 3);
    assert.equal(CONTRAST_MIN.talent.contexts, 2);
    assert.equal(CONTRAST_MIN.spell.contexts, 2);
    assert.equal(CONTRAST_MIN.emblem.contexts, Infinity);
  });

  it("determinismo: mesmos contextos, mesmos valores", () => {
    const contexts = [1, 2, 3].map((id) => ctx([
      B([1001, 1002, 2001], 0.55, 0.2),
      B([1001, 1002, 2002], 0.51, 0.2),
    ], id));
    const a = contrastEstimates(contexts).get("i:2001");
    const b = contrastEstimates(contexts).get("i:2001");
    assert.deepEqual(a, b);
  });
});
