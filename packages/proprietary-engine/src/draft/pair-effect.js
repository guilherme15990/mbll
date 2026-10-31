// draft/pair-effect — primitivas de PAR compartilhadas pelos modelos de draft.
//
// Fonte ÚNICA da DIREÇÃO dos pares (sinergia pelo sinal da lista, confronto com
// lado observado pelos dois lados valendo 0 — contestado), do proxy de exposição
// (`pick` é N, nunca tamanho de amostra real) e do shrinkage empírico-Bayes de um
// efeito de par. Consumido por `draft-score.js` (candidato DENTRO de um draft) —
// fonte única da direção/exposição/shrinkage de um par sobre o mesmo par.
// (`hero-draft-score.js` NÃO usa pares: o Draft Score do herói é min–max da WR
//  no recorte — não há termo de par.)
//
// Princípios (mesma cultura do motor):
// - Ausência de par = DESCONHECIDO: efeito 0 e variância = prior, nunca zero
//   silencioso.
// - SEM N na API: `pick` é o PROXY de exposição.
// - Zero I/O. Puro.

import { C_REFERENCE } from "../utils/config.js";
import { ebShrink } from "../utils/statistics.js";
import { medianNull } from "../utils/math.js";

export const EMPTY_BOOK = { countersUp: [], countersDown: [], synergiesUp: [], synergiesDown: [] };
export const VAR_UNIT = 0.25; // teto Bernoulli p(1-p)

// Exposição (pick) de fallback quando o `pick` de um parceiro/candidato é
// DESCONHECIDO (vem só como id, ou ausente). Evita descartar um par OBSERVADO
// por falta de exposição. Declarado, não calibrado (≈ RARE_PICK_MAX).
// `pick = 0` NÃO usa fallback: ausência de pick é `null`/`undefined`, não zero.
export const PAIR_FALLBACK_PICK = 0.02;

/** Normaliza um herói de contexto: aceita `{id,...}` ou um id cru. */
export function asHero(x) {
  if (x == null) return null;
  if (typeof x === "number") return { id: x };
  if (typeof x === "object" && Number.isFinite(Number(x.id))) return x;
  return null;
}

export const idOf = (x) => Number(x?.id);

/** Número finito ou `null` quando ausente/vazio/não numérico (null NÃO vira 0). */
export function numOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** |δ| observado de um par numa lista de livro, ou null quando ausente/inválido. */
export function absDelta(list, otherId) {
  const row = (list ?? []).find((p) => Number(p?.id) === otherId);
  const d = row ? numOrNull(row.delta) : null;
  return d == null ? null : Math.abs(d);
}

/**
 * Sinergia observada entre `hero` e `ally` (direção vem da LISTA, |δ| é o
 * tamanho; nunca o sinal cru — ver `matchups.js` e `pairs.ts`).
 * Duas perspectivas (livro do herói e do aliado) entram com o mesmo peso.
 */
export function pairSynergy(hero, ally) {
  const hb = hero.book ?? EMPTY_BOOK;
  const ab = ally.book ?? EMPTY_BOOK;
  const vals = [];
  const up = absDelta(hb.synergiesUp, idOf(ally));
  const dn = absDelta(hb.synergiesDown, idOf(ally));
  if (up != null) vals.push(up);
  if (dn != null) vals.push(-dn);
  const up2 = absDelta(ab.synergiesUp, idOf(hero));
  const dn2 = absDelta(ab.synergiesDown, idOf(hero));
  if (up2 != null) vals.push(up2);
  if (dn2 != null) vals.push(-dn2);
  const raw = medianNull(vals);
  return { present: raw != null, raw, perspectives: vals.length };
}

/**
 * Confronto observado entre `hero` e `enemy`. Positivo = vantagem do herói.
 * Direção em quarentena (Fase 0): os dois lados observados => contestado => 0.
 */
export function pairMatchup(hero, enemy) {
  const hb = hero.book ?? EMPTY_BOOK;
  const eb = enemy.book ?? EMPTY_BOOK;
  const heroCounters = absDelta(hb.countersUp, idOf(enemy)) ?? absDelta(eb.countersDown, idOf(hero));
  const enemyCounters = absDelta(hb.countersDown, idOf(enemy)) ?? absDelta(eb.countersUp, idOf(hero));
  if (heroCounters != null && enemyCounters != null) return { present: true, raw: 0, contested: true, perspectives: 2 };
  if (heroCounters != null) return { present: true, raw: heroCounters, contested: false, perspectives: 1 };
  if (enemyCounters != null) return { present: true, raw: -enemyCounters, contested: false, perspectives: 1 };
  return { present: false, raw: null, contested: false, perspectives: 0 };
}

/** pick informado; ausente (null/undefined/""/NaN) => fallback; 0 permanece 0. */
export function exposurePick(p) {
  const n = numOrNull(p);
  return n == null ? PAIR_FALLBACK_PICK : n;
}

/** n proxy do par = C_REFERENCE · pick_herói · pick_outro (0 => não exposto). */
export function pairExposure(pA, pB) {
  return C_REFERENCE * exposurePick(pA) * exposurePick(pB);
}

/**
 * Shrinkage empírico-Bayes de um efeito de par rumo ao prior 0.
 * `n` = exposição proxy; s2 = VAR_UNIT/n; posterior via `ebShrink(y,s2,0,priorVar)`.
 * Par não observado (ou sem exposição): efeito 0 e variância = priorVar
 * (desconhecido, não zero).
 */
export function shrinkEffect(obs, n, priorVar) {
  const hasExposure = n > 0;
  if (!obs.present || !hasExposure) {
    // Sem observação OU sem exposição: efeito 0 e variância do prior.
    // `observed` exige exposição — par listado sem exposição NÃO conta como
    // observado (evita inflar cobertura/evidência com efeito 0 sem sinal).
    return { effect: 0, var: priorVar, observed: obs.present && hasExposure, contested: obs.contested ?? false, n };
  }
  const s2 = VAR_UNIT / n;
  const post = ebShrink(obs.raw, s2, 0, priorVar);
  return { effect: post.m, var: post.V, observed: true, contested: obs.contested ?? false, n, raw: obs.raw, B: post.B };
}
