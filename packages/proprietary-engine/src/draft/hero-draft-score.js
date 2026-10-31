// draft/hero-draft-score — Draft Score: UM número 0–100 por herói.
//
// Substitui o score do app legado (`scoreCandidatesWithSTEAM`), que misturava
// percentis de WR, pick, ban, confiança e adaptabilidade. Lá popularidade entrava
// como força e o número não tinha unidade. Aqui entra SÓ o desfecho medido (a WR
// do recorte), reescalado para 0–100 dentro do próprio lote:
//
//     draft_score = 100 · (WR − WR_min) / (WR_max − WR_min)
//
// O melhor WR do recorte lê 100; o pior lê 0; o resto se distribui entre os dois.
// Não há constante declarada nem peso inventado — os únicos parâmetros são o
// mínimo e o máximo OBSERVADOS no lote (a escala é a do próprio recorte).
//
// `pick` e `ban` NÃO entram: são exposição (quanto o herói é jogado/banido),
// nunca força. Quem ganha mais vale mais; ponto. O número é RELATIVO ao recorte
// (elo + janela): não compare Draft Score entre recortes diferentes.
//
// Casos degenerados (registrados): herói sem WR no recorte sai com
// `draft_score: null` (sem-dado, nunca 0 silencioso); lote sem nenhuma WR, ou com
// todos os WR iguais (sem faixa para reescalar), dá `50` para quem tem dado — meio
// da escala, que é a leitura honesta de "não há spread para ranquear".
//
// Limitação registrada (ADR-054 §D10): como a escala é min–max do lote, um herói
// de WR alto lê 100 mesmo que a WR esteja inflada (difícil, escolhido por pro).
// A versão que removeria essa inflação usaria WR por lane (agregada por exposição)
// e desconto de confusão por elo — a fonte atual não expõe nem uma nem outra.
// Zero I/O. Puro.

export const HERO_DRAFT_SCORE_VERSION = "hero-draft-score-v1";

/** Número finito ou null (ausente/vazio/NaN nunca vira 0). */
function numOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const round2 = (v) => Math.round(v * 100) / 100;
const round4 = (v) => Math.round(v * 10000) / 10000;

/**
 * Draft Score do pool. Puro, sem I/O.
 *
 * @param {{ heroes?: Array<{ id: number|string, name?: string|null, head?: string|null, win?: number|null }> }} [input]
 *   `heroes`: uma entrada por herói do recorte. `win` é a WR em fração 0–1.
 * @returns {{ version: string, rows: Array<{ id: number, name: string|null, head: string|null, draft_score: number|null }>, meta: object }}
 */
export function scoreHeroDraftScore(input = {}) {
  const src = input ?? {};
  const seen = new Set();
  const pool = [];
  for (const raw of src.heroes ?? []) {
    if (raw == null) continue;
    const id = Number(raw.id);
    if (!Number.isFinite(id) || seen.has(id)) continue; // dedupe; id não-numérico fora
    seen.add(id);
    pool.push({ id, name: raw.name ?? null, head: raw.head ?? null, win: numOrNull(raw.win) });
  }

  const wins = pool.filter((h) => h.win != null).map((h) => h.win);
  const wrMin = wins.length ? Math.min(...wins) : null;
  const wrMax = wins.length ? Math.max(...wins) : null;
  const spread = wrMin != null && wrMax > wrMin; // sem faixa não há o que reescalar

  const rows = pool.map((h) => ({
    id: h.id,
    name: h.name,
    head: h.head,
    draft_score:
      h.win == null
        ? null
        : spread
          ? round2(100 * ((h.win - wrMin) / (wrMax - wrMin)))
          : 50, // lote sem spread: meio da escala, a leitura honesta de "sem faixa"
  }));

  const withData = rows.reduce((n, r) => n + (r.draft_score == null ? 0 : 1), 0);
  return {
    version: HERO_DRAFT_SCORE_VERSION,
    rows,
    meta: {
      n_heroes: rows.length,
      with_data: withData,
      wr_min: wrMin == null ? null : round4(wrMin),
      wr_max: wrMax == null ? null : round4(wrMax),
      calibrated: false,
      note: "draft_score = 100·(WR − WR_min)/(WR_max − WR_min), reescalado no "
        + "recorte: o melhor WR lê 100, o pior lê 0. Número RELATIVO ao elo+janela "
        + "(não compare entre recortes). Só o desfecho medido entra — `pick`/`ban` "
        + "são exposição, nunca força; sem pesos nem constantes declaradas. Sem WR "
        + "no recorte ⇒ `draft_score: null`; sem faixa (lote constante) ⇒ 50. "
        + "Não é probabilidade.",
    },
  };
}
