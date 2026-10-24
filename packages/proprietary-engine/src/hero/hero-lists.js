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
export class HeroLists {
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
export function compareById(a, b) {
  return byId(a, b);
}
export function medianOf(values) {
  return defaultLists.medianOf(values);
}
export function averageStrengthOf(heroes) {
  return defaultLists.averageStrengthOf(heroes);
}
export function averageStrengthOfDetailed(heroes) {
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
export function selectLevelPopularityCandidates(heroes, n = 6) {
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
