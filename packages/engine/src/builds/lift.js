// @radar/engine · builds/lift — ganho/lift relativo de itens e talentos (raw, ajustado, ordenação).
// Consolidado (ADR-061): reúne builds/build-lift.js, builds/build-adjusted.js, builds/builds-ordering.js.
// Barrel público: src/index.js (nenhum nome público muda).


// ── builds/build-lift.js ──
// builds/build-lift — lift bruto de build Camada A (corpo idêntico ao ex-engine,
// PRD build §4, D-BLD-01..08). L(b,h,c)=WR(b,h,c)−WR_ref(h,c), 3 referências.
// Camada A (bruto) entregável; B ajustado e C causal = NULL sem dados por partida.
// Puro, sem I/O, zero dependências.
/** BDL: L(b,h,c)=WR(b,h,c)−WR_ref(h,c) (PRD build §4). 3 referências (mais usada, média do herói, comparável→mesma que mais usada sem covariável).
 * Camada A (bruto) entregável; B ajustado e C causal = NULL sem dados por partida (D-BLD-01..08). */
export function buildLift({ win, refWin, hasSupport = true, refKind = "mais-usada" } = {}) {
  if (!hasSupport || ![win, refWin].every(Number.isFinite)) {
    return { lift_raw: null, lift_adjusted: null, adjusted_association: null, causal_build_lift: null, reference_kind: refKind, uncertainty_method: null, causal_status: "nao-avaliado", exposure_status: "unvalidated", classification_status: "inconclusive" };
  }
  // V2 §5.2/EC-012: fora de [0,1] (ex: 53) = unidade inválida → null + inconclusive, nunca lift espúrio.
  if (win < 0 || win > 1 || refWin < 0 || refWin > 1) {
    return { lift_raw: null, lift_adjusted: null, adjusted_association: null, causal_build_lift: null, reference_kind: refKind, unit: "unknown", reference_semantics_validated: false, sample_size_available: false, uncertainty_method: null, causal_status: "nao-avaliado", exposure_status: "unvalidated", classification_status: "inconclusive" };
  }
  return { lift_raw: +(win - refWin).toFixed(4), lift_adjusted: null, adjusted_association: null, causal_build_lift: null, reference_kind: refKind, unit: "fraction_0_1", reference_semantics_validated: false, sample_size_available: false, uncertainty_method: null, causal_status: "nao-avaliado", exposure_status: "unvalidated", classification_status: "provisional" };
}
/** Referências de build: mais usada (max pick), média do herói, e rótulo de suporte. */
export function buildReferences(builds = []) {
  // HIGH EC-012 irmão: mesmo guard [0,1] do buildLift — 53 nunca vira referência.
  const rows = (builds ?? []).filter((b) => Number.isFinite(b?.win) && Number.isFinite(b?.pick) && b.win >= 0 && b.win <= 1 && b.pick >= 0 && b.pick <= 1);
  if (!rows.length) return { mostUsed: null, heroMean: null };
  const mostUsed = rows.reduce((a, b) => (b.pick > a.pick ? b : a), rows[0]);
  const heroMean = rows.reduce((s, b) => s + b.win, 0) / rows.length;
  return { mostUsed, heroMean: +heroMean.toFixed(4) };
}

// ── builds/build-adjusted.js ──
// Lift ajustado por item/emblema/spell DENTRO de um contexto herói+lane.
// Modelo: win ~ presença do atributo + FE implícito (o chamador passa builds de
// UM contexto comparável — pooling cross-contexto é vetado). Ponderação por pick
// (proxy de precisão, mesmo truque do M1) + encolhimento conservador.
// kijkl Saída é ASSOCIAÇÃO AJUSTADA, nunca causal: builds são recomendadas,
// não aleatórias (viés de seleção declarado em `warnings`).
// Pura, sem I/O, zero dependências.

export const BUILD_ADJUSTED_VERSION = "build-adjusted-v1";
// K do encolhimento (fixo, documentado): lift × w/(w+K), w = contagem harmônica.
export const BUILD_ADJUST_K = 1;

/**
 * @param builds [{win, pick, ...}] do MESMO herói+lane
 * @param getAttrs (build) => string[] (ex.: ids de itens, ou [emblema], ou [spell])
 * @returns [{ attr, lift_raw, lift_adj, nWith, nWithout, support, warnings[] }]
 *   lift nulo quando sem contraste (só com / só sem) — nunca 0 inventado.
 */
export function adjustedLiftByAttr(builds, getAttrs) {
  // V2 §5.2 (MEDIUM, mesma família do EC-012): taxas fora de [0,1] nunca entram na média.
  const rows = (builds ?? []).filter(
    (b) => b && Number.isFinite(b.win) && Number.isFinite(b.pick) && b.win >= 0 && b.win <= 1 && b.pick >= 0 && b.pick <= 1 && b.pick > 0 && Array.isArray(getAttrs(b)),
  );
  const attrs = new Map();
  for (const b of rows) {
    for (const a of new Set(getAttrs(b))) {
      if (a == null) continue;
      if (!attrs.has(a)) attrs.set(a, { with: [], without: [] });
      attrs.get(a).with.push(b);
    }
  }
  const out = [];
  for (const [attr, g] of attrs) {
    g.without = rows.filter((b) => !new Set(getAttrs(b)).has(attr));
    if (!g.with.length || !g.without.length) {
      out.push({ attr, lift_raw: null, lift_adj: null, nWith: g.with.length, nWithout: g.without.length, support: "sem-contraste", warnings: ["sem-contraste-no-contexto"] });
      continue;
    }
    const wmean = (xs) => {
      const w = xs.reduce((s, b) => s + b.pick, 0);
      if (!(w > 0)) return null;
      return xs.reduce((s, b) => s + b.win * b.pick, 0) / w;
    };
    const mWith = wmean(g.with);
    const mWithout = wmean(g.without);
    if (mWith == null || mWithout == null) {
      out.push({ attr, lift_raw: null, lift_adj: null, nWith: g.with.length, nWithout: g.without.length, support: "sem-peso", warnings: ["sem-peso"] });
      continue;
    }
    const lift = mWith - mWithout;
    const w = (2 * g.with.length * g.without.length) / (g.with.length + g.without.length || 1);
    out.push({
      attr,
      lift_raw: +lift.toFixed(4),
      lift_adj: +((lift * w) / (w + BUILD_ADJUST_K)).toFixed(4),
      nWith: g.with.length,
      nWithout: g.without.length,
      support: g.with.length + g.without.length >= 4 ? "ok" : "fino",
      warnings: ["associacao-ajustada-nao-causal", "builds-recomendadas-vies-de-selecao"],
    });
  }
  return out.sort((a, b) => (b.lift_adj ?? -Infinity) - (a.lift_adj ?? -Infinity));
}

// ── builds/builds-ordering.js ──
// Ordenação e seleção de builds por lift — FONTE ÚNICA.
// Movidos da web (semântica idêntica):
// - orderBuildsByLift ← BuildsSection (lift desc, NULL por último, empate win desc)
// - selectTopBuildsByLift ← HeroDetails/LaneBuilds (lift finito desc, corte N)
// - selectBuildsAboveMostUsed ← BuildsSection (lift finito > 0)
// - refWinsOf ← BuildsTab (refs da 1ª build: mais-usada e média)
// Puros, sem I/O.

/** Ordenação client: lift_vs_most_used desc, NULL por último, empate win desc. */
export function orderBuildsByLift(rows) {
  return [...(rows ?? [])].sort((a, b) => {
    const la = a.lift_vs_most_used;
    const lb = b.lift_vs_most_used;
    const aOk = la != null && Number.isFinite(la);
    const bOk = lb != null && Number.isFinite(lb);
    if (aOk && !bOk) return -1;
    if (!aOk && bOk) return 1;
    if (aOk && bOk && la !== lb) return lb - la;
    return (b.win ?? -1) - (a.win ?? -1);
  });
}

/** Top-N builds por lift finito desc. */
export function selectTopBuildsByLift(builds, n = 3) {
  return [...(builds ?? [])]
    .filter((b) => Number.isFinite(b.lift_vs_most_used))
    .sort((a, b) => b.lift_vs_most_used - a.lift_vs_most_used)
    .slice(0, n);
}

/** Builds com lift finito acima da mais-usada. */
export function selectBuildsAboveMostUsed(rows) {
  return [...(rows ?? [])].filter(
    (b) => b.lift_vs_most_used != null && Number.isFinite(b.lift_vs_most_used) && b.lift_vs_most_used > 0,
  );
}

/** Referências de win da rota (1ª build carrega as refs do contexto). */
export function refWinsOf(builds) {
  const r = (builds ?? [])[0] && (builds ?? [])[0].references;
  return {
    most: (r && r.most_used_win) ?? null,
    mean: (r && r.hero_mean_win) ?? null,
  };
}
