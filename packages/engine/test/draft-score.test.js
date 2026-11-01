import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DS_UNIT_STATUS,
  DS_OFFLANE_PENALTY_PP,
  DS_PRIOR_VAR,
  scoreDraftCandidates,
} from "../src/matchups/draft-score.js";

const hero = (o) => ({ pick: 0.05, ban: 0.02, ...o });
const pair = (id, delta) => ({ id, delta });
const book = (o = {}) => ({ countersUp: [], countersDown: [], synergiesUp: [], synergiesDown: [], ...o });

describe("draft-score: contrato e honestidade básica", () => {
  it("marca unidade como hipótese", () => {
    const out = scoreDraftCandidates({ candidates: [hero({ id: 1, win: 0.5 })] });
    assert.equal(out.unit_status, DS_UNIT_STATUS);
    assert.equal(out.meta.calibrated, false);
    assert.equal(out.rows.length, 1);
  });

  it("herói acima de 50% tem expected_pp positivo; abaixo, negativo", () => {
    const out = scoreDraftCandidates({ candidates: [hero({ id: 1, win: 0.55 }), hero({ id: 2, win: 0.45 })] });
    const r1 = out.rows.find((r) => r.id === 1);
    const r2 = out.rows.find((r) => r.id === 2);
    assert.ok(r1.expected_pp > 0, `r1=${r1.expected_pp}`);
    assert.ok(r2.expected_pp < 0, `r2=${r2.expected_pp}`);
  });

  it("shrinkage: pick baixo puxa o efeito para 0 (mais incerteza)", () => {
    const hiPick = scoreDraftCandidates({ candidates: [hero({ id: 1, win: 0.58, pick: 0.1 })] }).rows[0];
    const loPick = scoreDraftCandidates({ candidates: [hero({ id: 1, win: 0.58, pick: 0.0005 })] }).rows[0];
    assert.ok(hiPick.expected_pp > loPick.expected_pp, `${hiPick.expected_pp} > ${loPick.expected_pp}`);
    // efeito nunca ultrapassa o desvio bruto de 8pp
    assert.ok(hiPick.expected_pp < 8, `raw=8, shrunk=${hiPick.expected_pp}`);
  });

  it("normalização: frações 0–1 são usadas como estão (sem heurística ×100)", () => {
    const out = scoreDraftCandidates({ candidates: [hero({ id: 1, win: 0.5 })] });
    assert.equal(out.rows[0].breakdown.base_pp, 0);
  });
});

describe("draft-score: banidos e já escolhidos saem do lote", () => {
  const candidates = [hero({ id: 1, win: 0.55 }), hero({ id: 2, win: 0.55 }), hero({ id: 3, win: 0.55 })];
  it("banido é removido", () => {
    const out = scoreDraftCandidates({ candidates, bans: [2] });
    assert.deepEqual(out.rows.map((r) => r.id).sort(), [1, 3]);
  });
  it("aliado/inimigo já no draft é removido do lote de candidatos", () => {
    const out = scoreDraftCandidates({ candidates, allies: [hero({ id: 1 })] });
    assert.ok(!out.rows.some((r) => r.id === 1));
    assert.equal(out.meta.n_allies, 1);
  });
});

describe("draft-score: pares (sinergia e confronto) — direção vem da lista", () => {
  it("synergiesUp soma efeito positivo; synergiesDown, negativo", () => {
    const c = hero({ id: 1, win: 0.5, book: book({ synergiesUp: [pair(7, 0.03)] }) });
    const ally = hero({ id: 7 });
    const up = scoreDraftCandidates({ candidates: [c], allies: [ally], enemies: [] }).rows[0];
    assert.ok(up.breakdown.synergy_pp > 0, `syn=${up.breakdown.synergy_pp}`);

    const c2 = hero({ id: 1, win: 0.5, book: book({ synergiesDown: [pair(7, 0.03)] }) });
    const down = scoreDraftCandidates({ candidates: [c2], allies: [ally], enemies: [] }).rows[0];
    assert.ok(down.breakdown.synergy_pp < 0, `syn=${down.breakdown.synergy_pp}`);
  });

  it("countersUp => vantagem (+); countersDown => desvantagem (−)", () => {
    const c = hero({ id: 1, win: 0.5, book: book({ countersUp: [pair(9, 0.04)] }) });
    const en = hero({ id: 9 });
    const good = scoreDraftCandidates({ candidates: [c], enemies: [en] }).rows[0];
    assert.ok(good.breakdown.matchup_pp > 0, `mat=${good.breakdown.matchup_pp}`);

    const c2 = hero({ id: 1, win: 0.5, book: book({ countersDown: [pair(9, 0.04)] }) });
    const bad = scoreDraftCandidates({ candidates: [c2], enemies: [en] }).rows[0];
    assert.ok(bad.breakdown.matchup_pp < 0, `mat=${bad.breakdown.matchup_pp}`);
  });

  it("confronto observado pelos dois lados = contestado => 0, mas conta como observado", () => {
    const c = hero({ id: 1, win: 0.5, book: book({ countersUp: [pair(9, 0.04)] }) });
    const en = hero({ id: 9, book: book({ countersUp: [pair(1, 0.04)] }) });
    const r = scoreDraftCandidates({ candidates: [c], enemies: [en] }).rows[0];
    assert.equal(r.breakdown.matchup_pp, 0);
    assert.equal(r.breakdown.coverage.observed, 1);
    assert.equal(r.breakdown.terms[0].contested, true);
  });

  it("perspectiva do parceiro conta: sinergia pode vir do livro do aliado", () => {
    const c = hero({ id: 1, win: 0.5 }); // sem livro
    const ally = hero({ id: 7, book: book({ synergiesUp: [pair(1, 0.03)] }) });
    const r = scoreDraftCandidates({ candidates: [c], allies: [ally] }).rows[0];
    assert.ok(r.breakdown.synergy_pp > 0, `syn=${r.breakdown.synergy_pp}`);
  });

  it("aliado passado como id cru (sem pick) NÃO descarta par observado (fallback de exposição)", () => {
    const c = hero({ id: 1, win: 0.5, book: book({ synergiesUp: [pair(7, 0.03)] }) });
    const asId = scoreDraftCandidates({ candidates: [c], allies: [7] }).rows[0];
    assert.equal(asId.breakdown.coverage.observed, 1);
    assert.ok(asId.breakdown.synergy_pp > 0, `syn=${asId.breakdown.synergy_pp}`);
  });
});

describe("draft-score: ausência = desconhecido (variância), nunca zero silencioso", () => {
  it("par ausente: efeito 0 mas sigma maior que par observado", () => {
    const observed = scoreDraftCandidates({
      candidates: [hero({ id: 1, win: 0.5, book: book({ synergiesUp: [pair(7, 0.03)] }) })],
      allies: [hero({ id: 7 })],
    }).rows[0];
    const absent = scoreDraftCandidates({
      candidates: [hero({ id: 1, win: 0.5 })],
      allies: [hero({ id: 7 })],
    }).rows[0];
    assert.equal(absent.breakdown.coverage.observed, 0);
    assert.equal(absent.breakdown.coverage.ratio, 0);
    assert.ok(absent.sigma_pp > observed.sigma_pp, `${absent.sigma_pp} > ${observed.sigma_pp}`);
    assert.equal(absent.evidence_status, "inconclusive"); // tem base observada, mas 0 pares
    // sem base e sem par => sem-dado
    const naked = scoreDraftCandidates({ candidates: [hero({ id: 1 })] }).rows[0];
    assert.equal(naked.evidence_status, "sem-dado");
  });

  it("cobertura incompleta é sinalizada no meta", () => {
    const out = scoreDraftCandidates({
      candidates: [hero({ id: 1, win: 0.5 })],
      allies: [hero({ id: 7 }), hero({ id: 8 })],
      enemies: [hero({ id: 9 })],
    });
    assert.equal(out.meta.coverage_incomplete, true);
    assert.equal(out.rows[0].breakdown.coverage.total, 3);
  });
});

describe("draft-score: invariância à ordem dos aliados/inimigos", () => {
  it("mesma saída com listas embaralhadas", () => {
    const mk = () => hero({
      id: 1, win: 0.52,
      book: book({ synergiesUp: [pair(7, 0.03)], countersUp: [pair(9, 0.04)] }),
    });
    const a = scoreDraftCandidates({ candidates: [mk()], allies: [hero({ id: 7 }), hero({ id: 8 })], enemies: [hero({ id: 9 }), hero({ id: 10 })] }).rows[0];
    const b = scoreDraftCandidates({ candidates: [mk()], allies: [hero({ id: 8 }), hero({ id: 7 })], enemies: [hero({ id: 10 }), hero({ id: 9 })] }).rows[0];
    assert.equal(a.expected_pp, b.expected_pp);
    assert.equal(a.sigma_pp, b.sigma_pp);
  });
});

describe("draft-score: lane", () => {
  it("usa laneWin quando presente (não o WR global)", () => {
    const c = hero({ id: 1, win: 0.45, laneWin: 0.55 });
    const r = scoreDraftCandidates({ candidates: [c], lane: "mid", allies: [], enemies: [] }).rows[0];
    assert.ok(r.breakdown.base_pp > 0, `base=${r.breakdown.base_pp}`);
  });

  it("fora da lane penaliza o limite inferior, NUNCA o expected_pp", () => {
    const inLane = scoreDraftCandidates({ candidates: [hero({ id: 1, win: 0.52, lanes: ["mid"] })], lane: "mid" }).rows[0];
    const offLane = scoreDraftCandidates({ candidates: [hero({ id: 1, win: 0.52, lanes: ["gold"] })], lane: "mid" }).rows[0];
    assert.equal(inLane.expected_pp, offLane.expected_pp);
    assert.equal(offLane.lane_fit, false);
    assert.equal(offLane.breakdown.lane_penalty_pp, DS_OFFLANE_PENALTY_PP);
    assert.ok(offLane.lower_bound < inLane.lower_bound);
  });
});

describe("draft-score: fronteira eficiente e score 0–100", () => {
  it("score é posição relativa; melhor limite = 100, pior = 0", () => {
    const out = scoreDraftCandidates({
      candidates: [hero({ id: 1, win: 0.56 }), hero({ id: 2, win: 0.44 })],
    });
    const scores = out.rows.map((r) => r.score).sort((a, b) => a - b);
    assert.equal(scores[0], 0);
    assert.equal(scores[scores.length - 1], 100);
  });

  it("domina quando mu maior e sigma menor/igual", () => {
    const strong = hero({ id: 1, win: 0.6, pick: 0.1 });
    const weak = hero({ id: 2, win: 0.51, pick: 0.01 });
    const out = scoreDraftCandidates({ candidates: [strong, weak] });
    const s = out.rows.find((r) => r.id === 1);
    const w = out.rows.find((r) => r.id === 2);
    assert.equal(w.dominated, true);
    assert.equal(s.frontier, true);
  });

  it("monotonicidade: WR maior => expected_pp maior (ceteris paribus)", () => {
    const out = scoreDraftCandidates({
      candidates: [hero({ id: 1, win: 0.50 }), hero({ id: 2, win: 0.53 }), hero({ id: 3, win: 0.56 })],
    });
    const by = (id) => out.rows.find((r) => r.id === id).expected_pp;
    assert.ok(by(1) < by(2) && by(2) < by(3));
  });
});

describe("draft-score: razões legíveis em pp", () => {
  it("gera razão de base, par e cobertura faltante", () => {
    const r = scoreDraftCandidates({
      candidates: [hero({ id: 1, win: 0.55, book: book({ synergiesUp: [pair(7, 0.03)] }) })],
      allies: [hero({ id: 7 }), hero({ id: 8 })],
      enemies: [hero({ id: 9 })],
    }).rows[0];
    assert.ok(r.reasons.some((x) => x.includes("pp")), r.reasons.join(" | "));
    assert.ok(r.reasons.some((x) => x.includes("sem observação")), r.reasons.join(" | "));
  });
});

describe("draft-score: honestidade de exposição (pick ausente vs zero) — F1/F2", () => {
  it("candidato SEM pick ainda estima par observado (fallback declarado) — F1", () => {
    const naked = hero({ id: 1, win: 0.5, book: book({ synergiesUp: [pair(7, 0.03)] }) });
    delete naked.pick;
    const r = scoreDraftCandidates({ candidates: [naked], allies: [hero({ id: 7 })] }).rows[0];
    assert.equal(r.breakdown.coverage.observed, 1);
    assert.ok(r.breakdown.synergy_pp > 0, `syn=${r.breakdown.synergy_pp}`);
    assert.ok(r.breakdown.terms[0].exposure_proxy > 0, `n=${r.breakdown.terms[0].exposure_proxy}`);
  });

  it("pick:0 explícito NÃO inventa exposição nem sinal — F2", () => {
    const zero = scoreDraftCandidates({ candidates: [hero({ id: 1, win: 0.55, pick: 0 })] }).rows[0];
    assert.equal(zero.breakdown.base_pp, 0);            // sem exposição => base desconhecido
    assert.equal(zero.evidence_status, "sem-dado");     // base não observável sem exposição
  });

  it("pick ausente (fallback) difere de pick:0 e de pick alto", () => {
    const noPick = { id: 1, win: 0.55 }; // sem pick => fallback declarado
    const a = scoreDraftCandidates({ candidates: [noPick] }).rows[0];
    const zero = scoreDraftCandidates({ candidates: [hero({ id: 1, win: 0.55, pick: 0 })] }).rows[0];
    const hi = scoreDraftCandidates({ candidates: [hero({ id: 1, win: 0.55, pick: 0.1 })] }).rows[0];
    assert.ok(a.breakdown.base_pp > 0, `ausente=${a.breakdown.base_pp}`);
    assert.equal(zero.breakdown.base_pp, 0);
    assert.ok(hi.breakdown.base_pp > a.breakdown.base_pp, `${hi.breakdown.base_pp} > ${a.breakdown.base_pp}`);
  });
});

describe("draft-score: robustez de parâmetros e entradas nulas — F3/F6", () => {
  it("priorVar inválido cai no default; saídas permanecem finitas — F3", () => {
    const r = scoreDraftCandidates({ candidates: [hero({ id: 1, win: 0.55 })], params: { priorVar: -1, k: -2 } }).rows[0];
    assert.ok(Number.isFinite(r.sigma_pp), `sigma=${r.sigma_pp}`);
    assert.ok(Number.isFinite(r.lower_bound), `lower=${r.lower_bound}`);
    assert.ok(Number.isFinite(r.expected_pp), `exp=${r.expected_pp}`);
    assert.equal(DS_PRIOR_VAR, 0.02 * 0.02);
  });

  it("damping e k válidos são aplicados (não-default) — F3", () => {
    const full = scoreDraftCandidates({ candidates: [hero({ id: 1, win: 0.5, book: book({ synergiesUp: [pair(7, 0.03)] }) })], allies: [hero({ id: 7 })] }).rows[0];
    const half = scoreDraftCandidates({ candidates: [hero({ id: 1, win: 0.5, book: book({ synergiesUp: [pair(7, 0.03)] }) })], allies: [hero({ id: 7 })], params: { damping: 0.5 } }).rows[0];
    assert.ok(Math.abs(half.breakdown.synergy_pp) < Math.abs(full.breakdown.synergy_pp), `${half.breakdown.synergy_pp} < ${full.breakdown.synergy_pp}`);
    const k2 = scoreDraftCandidates({ candidates: [hero({ id: 1, win: 0.55 })], params: { k: 2 } }).rows[0];
    const k1 = scoreDraftCandidates({ candidates: [hero({ id: 1, win: 0.55 })], params: { k: 1 } }).rows[0];
    assert.equal(k2.expected_pp, k1.expected_pp);
    assert.ok(k2.lower_bound < k1.lower_bound);
    // lower_bound == expected - k*sigma - penalidade (tolerância p/ arredondamentos)
    assert.ok(Math.abs(k2.lower_bound - (k2.expected_pp - 2 * k2.sigma_pp)) < 0.05);
  });

  it("candidates:null / params:null não quebram — F6", () => {
    const a = scoreDraftCandidates({ candidates: null });
    assert.deepEqual(a.rows, []);
    assert.equal(a.meta.n_candidates, 0);
    const b = scoreDraftCandidates({ candidates: [hero({ id: 1, win: 0.55 })], params: null });
    assert.equal(b.rows.length, 1);
  });

  it("input undefined funciona", () => {
    const out = scoreDraftCandidates();
    assert.deepEqual(out.rows, []);
  });
});

describe("draft-score: lote — dedupe e consistência fronteira↔score — F4/F5/F8", () => {
  it("ids duplicados nos candidatos viram UMA linha — F8", () => {
    const out = scoreDraftCandidates({ candidates: [hero({ id: 1, win: 0.55 }), hero({ id: 1, win: 0.55 })] });
    assert.equal(out.rows.length, 1);
  });

  it("penalidade de lane entra na dominância: fora-de-lane não fica frontier sobre dentro-de-lane — F4", () => {
    const inLane = hero({ id: 1, win: 0.52, lanes: ["mid"] });
    const offLane = hero({ id: 2, win: 0.525, lanes: ["gold"] });
    const out = scoreDraftCandidates({ candidates: [inLane, offLane], lane: "mid" });
    const a = out.rows.find((r) => r.id === 1);
    const b = out.rows.find((r) => r.id === 2);
    assert.equal(b.lane_fit, false);
    assert.equal(b.dominated, true, "fora-de-lane com mu ligeiramente maior é dominado pela penalidade");
    assert.equal(a.frontier, true);
    // nunca frontier:true com lower_bound estritamente menor que um dominador
    for (const r of out.rows.filter((x) => x.frontier)) {
      const minOther = Math.min(...out.rows.filter((o) => o !== r).map((o) => o.lower_bound));
      assert.ok(r.lower_bound >= minOther, `frontier ${r.id} (${r.lower_bound}) < outro (${minOther})`);
    }
  });

  it("diferenças submilésimo de mu não criam empate espúrio de fronteira — F5", () => {
    const out = scoreDraftCandidates({
      candidates: [hero({ id: 1, win: 0.55, pick: 0.1 }), hero({ id: 2, win: 0.550001, pick: 0.1 })],
    });
    const a = out.rows.find((r) => r.id === 1);
    const b = out.rows.find((r) => r.id === 2);
    // um domina o outro (sigma igual, mu estritamente maior) — exatamente um frontier
    assert.equal([a.frontier, b.frontier].filter(Boolean).length, 1);
  });
});

