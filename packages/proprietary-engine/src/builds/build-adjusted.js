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
