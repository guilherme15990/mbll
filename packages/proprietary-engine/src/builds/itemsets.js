// Scoring de itemsets — fórmula `itemset-score-v1`.
// Movido de app/web/src/shared/domain/itemsets.ts (semântica idêntica): unidade honesta =
// itemset DENTRO do mesmo herói+lane, coocorrência INTRA-build; entre contextos
// só se CONTA (k/m); destaque por rota ordenado por cobertura desc(k, m) — nunca
// por win poolado — corte `k ≥ 2 ∨ m ≥ 3`, teto de 5 linhas. Puro, sem I/O.
// Corte "emergente" canônico em ./thresholds.js (RARE_PICK_MAX/MIN_LIFT_SIGNAL).

import { RARE_PICK_MAX, MIN_LIFT_SIGNAL } from "../utils/thresholds.js";
import { mean, medianNull } from "../utils/math.js";

export const ITEMSET_SCORE_VERSION = "itemset-score-v1";
export const ITEMSET_M_MIN = 2;
export const ITEMSET_CUT_K = 2;
export const ITEMSET_CUT_M = 3;
export const ITEMSET_MAX_ROWS = 5;

function isFiniteNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}

/** `equipid`s da build, ordem-agnósticos, deduplicados e ordenados. */
export function itemIdsOf(b) {
  const ids = ((b && b.items) ?? [])
    .map((it) => (it ? it.id : undefined))
    .filter((id) => typeof id === "number" && Number.isInteger(id));
  return [...new Set(ids)].sort((a, c) => a - c);
}



/** Combinações de tamanho 3 (trincas) intra-build, determinísticas. */
function trincasOf(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++)
      for (let k = j + 1; k < ids.length; k++) out.push([ids[i], ids[j], ids[k]]);
  return out;
}

function itemsetKey(u, rank, lane, heroId) {
  return `${ITEMSET_SCORE_VERSION}:${rank}:${lane}:${heroId}:${u.join("+")}`;
}

function baseAtomic(u, ctx, nBuilds, names) {
  return {
    key: itemsetKey(u, ctx.rank, ctx.lane, ctx.heroId),
    formula: ITEMSET_SCORE_VERSION,
    itemIds: [...u],
    itemNames: [...names],
    heroId: ctx.heroId,
    rank: ctx.rank,
    lane: ctx.lane,
    refMostWin: ctx.refMostWin,
    refMeanWin: ctx.refMeanWin,
    nBuilds,
    deBuilds: ctx.builds.length,
    ajustado: null,
    causal: null,
  };
}

/**
 * Score atômico por-herói-rota `S(u,c)`. Pré-condições viram estados
 * (`sem_suporte` / `sem_referencia`) em vez de número — nunca `0` inventado.
 */
export function scoreAtomicItemset(u, ctx) {
  const sorted = [...u].sort((a, b) => a - b);
  const containing = ctx.builds.filter((b) => {
    const ids = itemIdsOf(b);
    return sorted.every((id) => ids.includes(id));
  });
  const names = sorted.map((id) => {
    for (const b of containing) {
      const found = ((b && b.items) ?? []).find((it) => it && it.id === id);
      if (found) return found.name ?? null;
    }
    return null;
  });
  const base = baseAtomic(sorted, ctx, containing.length, names);
  if (containing.length === 0) {
    return {
      ...base,
      status: "sem_suporte",
      motive: "não observado neste herói+lane (trinca exige coocorrência na mesma build)",
      winDesc: null, pickMed: null, liftMost: null, liftMean: null,
    };
  }
  const winDesc = mean(containing.map((b) => b.win).filter(isFiniteNum));
  const pickMed = medianNull(containing.map((b) => b.pick).filter(isFiniteNum));
  const refMostOk = isFiniteNum(ctx.refMostWin);
  const refMeanOk = isFiniteNum(ctx.refMeanWin);
  if (!refMostOk && !refMeanOk) {
    return {
      ...base,
      status: "sem_referencia",
      motive: "sem referência finita neste herói+lane (mais-usada e média ausentes)",
      winDesc, pickMed, liftMost: null, liftMean: null,
    };
  }
  if (winDesc == null) {
    return {
      ...base,
      status: "sem_suporte",
      motive: "sem win finito nas builds amostradas com a trinca",
      winDesc, pickMed, liftMost: null, liftMean: null,
    };
  }
  const liftMost = refMostOk ? +(winDesc - ctx.refMostWin).toFixed(4) : null;
  const liftMean = refMeanOk ? +(winDesc - ctx.refMeanWin).toFixed(4) : null;
  if (containing.length < ITEMSET_M_MIN) {
    return {
      ...base,
      status: "sem_suporte",
      motive: `suporte mínimo: ${containing.length} build amostrada (mínimo ${ITEMSET_M_MIN}) — sem leitura`,
      winDesc: +winDesc.toFixed(4), pickMed, liftMost, liftMean,
    };
  }
  return {
    ...base,
    status: "ok",
    motive: "associação descritiva no contexto comparável (Camada A)",
    winDesc: +winDesc.toFixed(4), pickMed, liftMost, liftMean,
  };
}

function isEmergentAtomic(s) {
  return s.pickMed != null && s.pickMed < RARE_PICK_MAX && s.liftMost != null && s.liftMost > MIN_LIFT_SIGNAL;
}

/**
 * Destaque por rota: trincas intra-build com corte `k ≥ 2 ∨ m ≥ 3`,
 * ordem desc(k, m, maxLiftMost), teto de 5 linhas. Determinístico.
 */
export function scoreRouteItemsets(ctxs) {
  const candidates = new Map();
  for (const ctx of ctxs) {
    for (const b of ctx.builds) {
      for (const t of trincasOf(itemIdsOf(b))) {
        const key = t.join("+");
        if (!candidates.has(key)) candidates.set(key, t);
      }
    }
  }
  const rows = [];
  for (const [, u] of [...candidates.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const scored = ctxs.map((ctx) => ({ ctx, s: scoreAtomicItemset(u, ctx) }));
    const present = scored.filter(({ s }) => s.nBuilds > 0);
    const k = present.length;
    const m = present.reduce((a, { s }) => a + s.nBuilds, 0);
    if (!(k >= ITEMSET_CUT_K || m >= ITEMSET_CUT_M)) continue;
    const wins = present.map(({ s }) => s.winDesc).filter(isFiniteNum);
    const lifts = present.map(({ s }) => s.liftMost).filter(isFiniteNum);
    const perHero = present.map(({ s }) => s);
    rows.push({
      itemIds: [...u],
      itemNames: [...perHero[0].itemNames],
      k,
      m,
      winMin: wins.length ? Math.min(...wins) : null,
      winMax: wins.length ? Math.max(...wins) : null,
      maxLiftMost: lifts.length ? Math.max(...lifts) : null,
      perHero,
      emergent: perHero.some(isEmergentAtomic),
    });
  }
  rows.sort((a, b) => {
    if (b.k !== a.k) return b.k - a.k;
    if (b.m !== a.m) return b.m - a.m;
    const la = a.maxLiftMost ?? Number.NEGATIVE_INFINITY;
    const lb = b.maxLiftMost ?? Number.NEGATIVE_INFINITY;
    if (lb !== la) return lb - la;
    const ka = a.itemIds.join("+");
    const kb = b.itemIds.join("+");
    return ka < kb ? -1 : 1;
  });
  return rows.slice(0, ITEMSET_MAX_ROWS);
}
