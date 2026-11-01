// @radar/engine · heroes/ranking — postos, tiers, índices de força e seleção de listas de heróis.
// Consolidado (ADR-061): reúne hero/strength-index.js, hero/tierOf.js, hero/lot-ranking.js, hero/hero-lists.js, hero/forca-sorting.js, ranks/rank-profile.js.
// Barrel público: src/index.js (nenhum nome público muda).

import { PRACTICAL_DELTA } from "../core/thresholds.js";
import { ClassificationStatus } from "../core/states.js";

// ── hero/strength-index.js ──
// hero/strength-index — vistas de θ̂ baseadas em POSTO. Puro, sem I/O, zero dependências.
//
// Spec V2 §7.1: `strength_index = 100 × (n − posto)/(n − 1)`, postos médios em empates.
// MOTIVO: uma única primitiva de posto alimenta strength_index, tier e os quantis de
// exposição (pick/ban). Assim as vistas de θ̂ não podem divergir entre si:
// θ̂_A > θ̂_B  ⇒  posto_A < posto_B  ⇒  pct_A > pct_B  ⇒  tier_A ≥ tier_B e índice_A > índice_B.
// O índice é ordinal e relativo ao lote — não é chance de vitória (§7.1/§18).

/**
 * Postos e índices relativos ao lote. Sem estado entre chamadas — reutilizável.
 * Valores não-finitos (null/NaN de heróis sem estimativa) recebem posto null e nunca
 * ganham posição numérica comum (V2 §5.3: ausência não vira posição mediana).
 */
class StrengthIndex {
  /**
   * Posto médio 1-based, DECRESCENTE (1 = maior valor). Empates dividem o posto médio
   * (nunca zeram nem coroam um grupo empatado). O(n log n). Independe da ordem de entrada.
   */
  averageRanks(values) {
    const out = new Array(values.length).fill(null);
    const idx = values.map((_, i) => i).filter((i) => Number.isFinite(values[i])).sort((a, b) => values[b] - values[a]);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && values[idx[j + 1]] === values[idx[i]]) j++;
      const avg = (i + 1 + j + 1) / 2; // posto médio do grupo empatado
      for (let k = i; k <= j; k++) out[idx[k]] = avg;
      i = j + 1;
    }
    return out;
  }

  /** Posição normalizada em [0,1] a partir do posto médio (1 = maior, 0 = menor). n<=1 = null. */
  pctFromRank(avgRank, n) {
    if (!Number.isFinite(avgRank) || !Number.isFinite(n) || n <= 1) return null;
    return Math.min(1, Math.max(0, (n - avgRank) / (n - 1)));
  }

  /** Quantis por posto de um vetor (1 = maior valor). Substitui percentileRank O(n) por item. */
  rankQuantiles(values) {
    const n = values.length;
    return this.averageRanks(values).map((r) => this.pctFromRank(r, n));
  }

  /**
   * ADR-024 L2-IDX-01: índice 0–100 = pct do θ̂ no lote × 100 (100 = mais forte). Expressão
   * numérica idêntica à versão anterior (mesmo arredondamento). N<=1 ou inválido = null.
   */
  strengthIndexByRank(avgRank, n) {
    if (!Number.isFinite(avgRank) || !Number.isFinite(n) || n <= 1) return null;
    return +Math.min(100, Math.max(0, (100 * (n - avgRank)) / (n - 1))).toFixed(1);
  }
}

const defaultIndex = new StrengthIndex();

/** Shims compatíveis — comportamento byte-idêntico ao anterior. */
function averageRanks(values) {
  return defaultIndex.averageRanks(values);
}
function pctFromRank(avgRank, n) {
  return defaultIndex.pctFromRank(avgRank, n);
}
function rankQuantiles(values) {
  return defaultIndex.rankQuantiles(values);
}
export function strengthIndexByRank(avgRank, n) {
  return defaultIndex.strengthIndexByRank(avgRank, n);
}

// ── hero/tierOf.js ──
// hero/tierOf — faixas de tier por posição percentílica de θ̂. Puro, sem I/O.
//
// Spec V2 §7.2–§7.3: tier é ORDINAL e RELATIVO ao lote (fatia do ranking
// 8%/17%/50%/17%/8%), nunca força absoluta nem confiança. Sem dados → "?", nunca Tier D.
// `pct` vem de pctFromRank(). tier-v2: pct = (n − posto)/(n − 1).

/** Tiers canônicos — "?" = sem dado (nunca Tier D). */
export const Tier = Object.freeze({
  S: "S",
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  UNKNOWN: "?",
});

/** Ordem crescente de força — útil p/ comparar tiers (índice; "?" não entra). */
export const TIER_ORDER = Object.freeze([Tier.D, Tier.C, Tier.B, Tier.A, Tier.S]);

/**
 * Faixas de tier com cortes injetáveis (OCP: outro jogo/modo usa outros cortes
 * sem editar a regra; o padrão é o §7.2).
 */
class HeroTier {
  #cuts;

  /**
   * @param {object} [opts]
   * @param {{S:number,A:number,B:number,C:number}} [opts.cuts] Limiares de pct.
   */
  constructor({ cuts = { S: 0.92, A: 0.75, B: 0.25, C: 0.08 } } = {}) {
    this.#cuts = cuts;
  }

  /** Tier de um percentil — não-finito vira "?" (nunca rebaixa sem dado). */
  tierOf(pct) {
    if (!Number.isFinite(pct)) return Tier.UNKNOWN; // antes: NaN/undefined caía em "D" (rebaixava sem dado)
    if (pct >= this.#cuts.S) return Tier.S;
    if (pct >= this.#cuts.A) return Tier.A;
    if (pct >= this.#cuts.B) return Tier.B;
    if (pct >= this.#cuts.C) return Tier.C;
    return Tier.D;
  }
}

const defaultTiers = new HeroTier();

/** Shim compatível — tiers padrão V2 §7.2. */
export function tierOf(pct) {
  return defaultTiers.tierOf(pct);
}

// ── hero/lot-ranking.js ──
// hero/scoring/lot-ranking — vistas RELATIVAS AO LOTE: índice de força, tier e quantis de exposição.



/**
 * Posição relativa de cada herói dentro do lote.
 *
 * Responsabilidade única: ordenar. Uma só primitiva de posto (`averageRanks`) alimenta
 * `strength_index`, `tier` e os quantis de pick/ban, então as vistas não podem divergir:
 * θ̂_A > θ̂_B ⇒ tier_A ≥ tier_B e índice_A > índice_B.
 * Tier é ORDINAL e RELATIVO: muda quando o conjunto comparado muda, sem θ̂ mudar.
 */
export class LotRanking {
  #n;
  #thetaRank;
  #pickQuantile;
  #banQuantile;

  /**
   * @param {number[]} thetas  θ̂ por herói (mesma ordem de `heroes`).
   * @param {{pick: number, ban: number}[]} heroes
   */
  constructor(thetas, heroes) {
    this.#n = heroes.length;
    this.#thetaRank = averageRanks(thetas);
    this.#pickQuantile = rankQuantiles(heroes.map((h) => h.pick)); // 0 = menor pick
    this.#banQuantile = rankQuantiles(heroes.map((h) => h.ban));
  }

  /** Tier S/A/B/C/D (ou "?" em lote pequeno). */
  tier(i, smallSample) {
    return smallSample ? Tier.UNKNOWN : tierOf(pctFromRank(this.#thetaRank[i], this.#n));
  }

  /** Índice 0–100 (100 = mais forte); null em lote pequeno (nunca número ao lado de "?"). */
  strengthIndex(i, smallSample) {
    return smallSample ? null : strengthIndexByRank(this.#thetaRank[i], this.#n);
  }

  pickQuantile(i) {
    return this.#pickQuantile[i];
  }

  banQuantile(i) {
    return this.#banQuantile[i];
  }
}

// ── hero/hero-lists.js ──
// Seleções e agregados de listas de heróis por métrica — FONTE ÚNICA. Puros, sem I/O.
// - averageStrengthOf/medianPickOf/medianBanOf/topBansByBan/topGemsByStrengthLowPick ← DraftPanel
// - selectLevelPopularityCandidates (alias legado: selectConsistentCandidates) ← BlindPanel
// - selectLaneTopHeroes(+Detailed) ← BuildsTab (ordem de R2 preservada)
// Cortes e fallbacks iguais aos das telas; empates desempatados por id (saída não depende da
// ordem de entrada).
//
// Spec V2 §18: força, popularidade e banimento NUNCA condensados num número só — cada
// agregado abaixo mede uma pergunta distinta. Fallbacks são valores de PRODUTO (não
// observações); as variantes `*Detailed` devolvem a proveniência junto.

// Fallbacks neutros quando não há dado (valores históricos das telas).
const FALLBACK_STRENGTH = 0.5; // sistema fechado: toda partida tem vencedor
const FALLBACK_PICK = 0.007;
const FALLBACK_BAN = 0.05;
// MOTIVO: limiares de PRODUTO (não estatísticos) do BlindPanel, hoisted com nome.
const CONSISTENT_MIN_THETA = 0.51; // ~1 p.p. acima do neutro 0,5
const CONSISTENT_MIN_PICK = 0.01;

/**
 * Agregados e seleções de lista. Sem estado — reutilizável.
 */
class HeroLists {
  /** Desempate determinístico por id (numérico quando ambos são números; senão texto). */
  compareById(a, b) {
    const x = a && a.id;
    const y = b && b.id;
    const nx = Number(x);
    const ny = Number(y);
    if (Number.isFinite(nx) && Number.isFinite(ny) && nx !== ny) return nx - ny;
    const sx = String(x);
    const sy = String(y);
    return sx < sy ? -1 : sx > sy ? 1 : 0;
  }

  /**
   * Mediana verdadeira dos valores finitos (null se vazio).
   * MOTIVO: antes medianPickOf/medianBanOf/medianWrAdj usavam o elemento superior em n par;
   * agora é a mediana de verdade, igual à do motor (μ̂).
   */
  medianOf(values) {
    const v = (values ?? []).filter(Number.isFinite).sort((a, b) => a - b);
    if (!v.length) return null;
    const mid = v.length >> 1;
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  }

  /** Força média do meta (0.5 sem dado). Só valores finitos; null nunca vira zero. */
  averageStrengthOf(heroes) {
    return this.averageStrengthOfDetailed(heroes).value;
  }

  /** averageStrengthOf com proveniência (P1: fallback é produto, não observação). */
  averageStrengthOfDetailed(heroes) {
    const rows = heroes ?? [];
    const vals = rows.map((h) => h.wrAdj).filter(Number.isFinite);
    if (!vals.length) return { value: FALLBACK_STRENGTH, n: 0, n_invalid: rows.length, fallback_used: true };
    return { value: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length, n_invalid: rows.length - vals.length, fallback_used: false };
  }

  /** Pick mediano do meta (0.007 sem dado). */
  medianPickOf(heroes) {
    return this.medianOf((heroes ?? []).map((h) => h.pick)) ?? FALLBACK_PICK;
  }

  /** Ban mediano do meta (0.05 sem dado). */
  medianBanOf(heroes) {
    return this.medianOf((heroes ?? []).map((h) => h.ban)) ?? FALLBACK_BAN;
  }

  /** Top bans (candidatos a sobrepressão). */
  topBansByBan(heroes, n = 5) {
    return [...(heroes ?? [])].sort((a, b) => (b.ban ?? -Infinity) - (a.ban ?? -Infinity) || this.compareById(a, b)).slice(0, n);
  }

  /**
   * Força alta com pick baixo (candidatos a joia).
   * MOTIVO: candidato ≠ `isGem` do motor (sem BH, corte pela mediana) — serve ao overview sem herói.
   * Se a UI aceitar só joias confirmadas, troque por heroes.filter((h) => h.isGem) e remova isto.
   */
  topGemsByStrengthLowPick(heroes, avgStrength, medPick, n = 5) {
    return (heroes ?? [])
      .filter((h) => Number.isFinite(h.wrAdj) && Number.isFinite(h.pick) && h.wrAdj > avgStrength && h.pick < medPick)
      .sort((a, b) => b.wrAdj - a.wrAdj || this.compareById(a, b))
      .slice(0, n);
  }

  /**
   * Seleção por nível + popularidade p/ blind (θ̂ > 0,51 e pick > 0,01, top por θ̂).
   * Nome canônico V2 (P1: não mede consistência temporal — mede nível e popularidade).
   */
  selectLevelPopularityCandidates(heroes, n = 6) {
    return (heroes ?? [])
      .filter((h) => Number.isFinite(h.wrAdj) && Number.isFinite(h.pick) && h.wrAdj > CONSISTENT_MIN_THETA && h.pick > CONSISTENT_MIN_PICK)
      .sort((a, b) => b.wrAdj - a.wrAdj || this.compareById(a, b))
      .slice(0, n);
  }

  /** @deprecated use selectLevelPopularityCandidates — nome antigo sugeria consistência temporal. */
  selectConsistentCandidates(heroes, n = 6) {
    return this.selectLevelPopularityCandidates(heroes, n);
  }

  /**
   * Top-N θ̂ da rota (ordem da lista rankeada preservada — nunca re-sort por lift).
   * @param rows heróis já ordenados por θ̂ desc (R2)
   * @param lanesMap mapa heroId→lanes[] (null = ainda não carregado → []; {} = fonte
   * indisponível → sem filtro de rota)
   */
  selectLaneTopHeroes(rows, lanesMap, lane, n = 3) {
    return this.selectLaneTopHeroesDetailed(rows, lanesMap, lane, n).rows;
  }

  /**
   * selectLaneTopHeroes com proveniência (P1: {} = fallback sem validação de rota).
   * Retorna {rows, validated, reason}.
   */
  selectLaneTopHeroesDetailed(rows, lanesMap, lane, n = 3) {
    const list = rows ?? [];
    if (lanesMap == null) return { rows: [], validated: false, reason: "lanes_not_loaded" };
    if (Object.keys(lanesMap).length === 0) {
      return { rows: list.slice(0, n), validated: false, reason: "no_lane_validation_fallback" };
    }
    const out = [];
    for (const h of list) {
      if (out.length >= n) break;
      if ((lanesMap[h.id] ?? []).includes(lane)) out.push(h);
    }
    return { rows: out, validated: true, reason: "lane_filtered" };
  }
}

const defaultLists = new HeroLists();
const byId = (a, b) => defaultLists.compareById(a, b);

/** Shims compatíveis — comportamento idêntico ao anterior. */
function compareById(a, b) {
  return byId(a, b);
}
export function medianOf(values) {
  return defaultLists.medianOf(values);
}
export function averageStrengthOf(heroes) {
  return defaultLists.averageStrengthOf(heroes);
}
function averageStrengthOfDetailed(heroes) {
  return defaultLists.averageStrengthOfDetailed(heroes);
}
export function medianPickOf(heroes) {
  return defaultLists.medianPickOf(heroes);
}
export function medianBanOf(heroes) {
  return defaultLists.medianBanOf(heroes);
}
export function topBansByBan(heroes, n = 5) {
  return defaultLists.topBansByBan(heroes, n);
}
export function topGemsByStrengthLowPick(heroes, avgStrength, medPick, n = 5) {
  return defaultLists.topGemsByStrengthLowPick(heroes, avgStrength, medPick, n);
}
function selectLevelPopularityCandidates(heroes, n = 6) {
  return defaultLists.selectLevelPopularityCandidates(heroes, n);
}
export function selectConsistentCandidates(heroes, n = 6) {
  return defaultLists.selectConsistentCandidates(heroes, n);
}
export function selectLaneTopHeroes(rows, lanesMap, lane, n = 3) {
  return defaultLists.selectLaneTopHeroes(rows, lanesMap, lane, n);
}
export function selectLaneTopHeroesDetailed(rows, lanesMap, lane, n = 3) {
  return defaultLists.selectLaneTopHeroesDetailed(rows, lanesMap, lane, n);
}

// ── hero/forca-sorting.js ──
// Ordenação da tabela de força e posição no meta — FONTE ÚNICA. Puros, sem I/O.
// - sortHeroesByMetric (q asc; B desc; demais métricas desc; inválidos por último)
// - medianWrAdj (mediana de θ̂ p/ a ThetaBar; 0.5 sem dado)
// - heroRankPosition / heroRankPositions (posição por θ̂ desc, 1-based)
// Filtros por nome/tier são UI local e ficam na web.
//
// Spec V2 §7: posição é relativa ao lote; heróis sem estimativa (wrAdj null) nunca
// recebem posição numérica comum — ficam por último na ordenação e fora do mapa de
// posições (V2 §5.3: ausência não vira posição mediana).


/**
 * Ordenação e posição relativa. Sem estado — reutilizável.
 */
class HeroSorting {
  /**
   * @param rows heróis
   * @param sort "wrAdj"|"strength_index"|"win"|"pick"|"ban"|"q"|"B" ("d" = alias de "wrAdj")
   * MOTIVO: `d` saiu do motor; era afim crescente de θ̂, então ordenar por d ≡ ordenar por wrAdj.
   * Empates por id → resultado independe da ordem de entrada.
   * P1: política única de inválidos — wrAdj nulo/não-finito sempre por último (nunca diverge).
   */
  sortHeroesByMetric(rows, sort) {
    const key = sort === "d" ? "wrAdj" : sort;
    const val = (h) => (Number.isFinite(h?.[key]) ? h[key] : key === "q" ? 1 : -Infinity);
    const cmp =
      key === "q"
        ? (a, b) => val(a) - val(b)
        : key === "B"
          ? (a, b) => (b.B ?? 0) - (a.B ?? 0)
          : (a, b) => val(b) - val(a);
    return [...(rows ?? [])].sort((a, b) => cmp(a, b) || compareById(a, b));
  }

  /** Mediana de θ̂ (0.5 sem dado). */
  medianWrAdj(rows) {
    return medianOf((rows ?? []).map((h) => h.wrAdj)) ?? 0.5;
  }

  /** Posição 1-based por θ̂ desc (0 se fora da lista; null se o herói não tem estimativa). */
  heroRankPosition(rows, heroId) {
    const list = rows ?? [];
    const id = String(heroId);
    const me = list.find((h) => String(h.id) === id);
    if (!me) return 0;
    if (!Number.isFinite(me.wrAdj)) return null;
    let ahead = 0;
    for (const h of list) if (h !== me && this.#aheadOf(h, me)) ahead++;
    return ahead + 1;
  }

  /**
   * Posição de TODOS de uma vez: Map(String(id) → posição). O(n log n).
   * Heróis sem estimativa ficam FORA do mapa (nunca recebem posição numérica comum).
   * MOTIVO: heroRankPosition dentro de um loop por herói é O(n²) — use esta e consulte o Map.
   */
  heroRankPositions(rows) {
    const valid = (rows ?? []).filter((h) => Number.isFinite(h?.wrAdj));
    const sorted = [...valid].sort((a, b) => b.wrAdj - a.wrAdj || compareById(a, b));
    const pos = new Map();
    sorted.forEach((h, i) => {
      const k = String(h.id);
      if (!pos.has(k)) pos.set(k, i + 1);
    });
    return pos;
  }

  #aheadOf(h, me) {
    if (!Number.isFinite(h?.wrAdj) || !Number.isFinite(me?.wrAdj)) return false;
    return h.wrAdj > me.wrAdj || (h.wrAdj === me.wrAdj && compareById(h, me) < 0);
  }
}

const defaultSorting = new HeroSorting();

/** Shims compatíveis — comportamento idêntico ao anterior. */
export function sortHeroesByMetric(rows, sort) {
  return defaultSorting.sortHeroesByMetric(rows, sort);
}
export function medianWrAdj(rows) {
  return defaultSorting.medianWrAdj(rows);
}
export function heroRankPosition(rows, heroId) {
  return defaultSorting.heroRankPosition(rows, heroId);
}
export function heroRankPositions(rows) {
  return defaultSorting.heroRankPositions(rows);
}

// ── ranks/rank-profile.js ──
// Rótulos de perfil rank a×b (PRD Rank §9) — FONTE ÚNICA.
// Unifica os DUPLICADOS `getRankProfileLabel` de
// app/web/src/pages/hero/sections/RanksSection.tsx e
// app/web/src/pages/panels/RanksPanel.tsx (limiares, rótulos e cores idênticos;
// motivos canônicos = versão do painel global; ver relatório da migração).
// Δr default = PRACTICAL_DELTA canônico (./thresholds.js — relevância prática).
// Puro, sem I/O.



export const RANK_ORDER = ["epic", "legend", "mythic", "honor", "glory"];

/**
 * @param d {{ diff: number|null, delta_r?: number, prob_above?: number, classification_status?: string }}
 * @param a rank base, @param b rank comparado
 */
export function getRankProfileLabel(d, a, b) {
  const D = d.diff;
  const dr = d.delta_r ?? PRACTICAL_DELTA;
  const prob = d.prob_above ?? 0;
  // "classified" legado + "provisional_model_based" (V2 §8) — ambos descritivos do
  // ponto estimado; o caveat abaixo marca a proveniência proxy.
  const usable = d.classification_status === ClassificationStatus.CLASSIFIED || d.classification_status === ClassificationStatus.PROVISIONAL_MODEL_BASED;
  const caveat = d.classification_status === ClassificationStatus.PROVISIONAL_MODEL_BASED ? " Estimativa model-based (sem contagens validadas)." : "";

  if (!usable || D == null || !Number.isFinite(D)) {
    return {
      label: "Inconclusivo",
      motive: "Diferença imprecisa ou classificação sensível à premissa c — padrão padrão sem evidência suficiente.",
      color: "text-mist border-line bg-abyss",
    };
  }

  if (Math.abs(D) <= dr) {
    return {
      label: "Consistente entre ranks",
      motive: `Variação relativa |D|=${Math.abs(D).toFixed(4)} ≤ Δr (${dr}). Força favorável mantida sem desvios relevantes.${caveat}`,
      color: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
    };
  }

  if (prob < 0.8) {
    return {
      label: "Dependente do rank",
      motive: `Diferença detectada, mas evidência ainda moderada P(D>Δr)=${(prob * 100).toFixed(1)}%. Exige confirmação temporal.${caveat}`,
      color: "text-amber-300 border-amber-400/30 bg-amber-400/10",
    };
  }

  const strongerRank = D > 0 ? a : b;
  const idxA = RANK_ORDER.indexOf(a);
  const idxB = RANK_ORDER.indexOf(b);
  const higherRank = idxA < idxB ? b : a;

  if (strongerRank === higherRank) {
    return {
      label: "Escala com o rank",
      motive: `Vantagem relativa superior no nível mais alto (${strongerRank.toUpperCase()}). Não implica que habilidade ou mecânica seja a causa.${caveat}`,
      color: "text-indigo-300 border-indigo-400/30 bg-indigo-400/10",
    };
  }

  return {
    label: "Mais forte em ranks inferiores",
    motive: `Vantagem relativa diminui nos elos mais altos (${strongerRank.toUpperCase()}). Não equivale a escolha fraca nos elos superiores.${caveat}`,
    color: "text-sky-300 border-sky-400/30 bg-sky-400/10",
  };
}
