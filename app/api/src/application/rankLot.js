// Coleta e normalização do lote de heróis por rank/janela.
// Porta fina para a Arena API (arena.js) + SnapshotHistory (cache.js); o resto
// do sistema consome `fetchRankAll` e nunca fala com o upstream diretamente.
//
// Fábrica com DI (Problema 3 da auditoria): o gateway, o cache e o histórico
// entram por parâmetro pelo composition root. As funções PURAS
// (`normalize`/`lanesFromRoadsort`/`ROAD_SORT_TO_LANE`) seguem exportadas aqui —
// não têm dependência de infraestrutura.
import { createSingleFlight } from "./singleFlight.js";

export function normalize(rec) {
  const d = rec?.data ?? rec;
  if (d == null) return null;
  // EC-002: Number(null)===0 criaria herói fantasma; rejeita nulo/ausente antes de converter
  for (const k of ["main_hero_win_rate", "main_hero_ban_rate"]) {
    if (d[k] == null || d[k] === "") return null;
  }
  if (d.main_hero_appearance_rate == null && d.main_hero_pick_rate == null) return null;
  const id = Number(d.main_heroid ?? d.heroid);
  const win = Number(d.main_hero_win_rate);
  const pick = Number(d.main_hero_appearance_rate ?? d.main_hero_pick_rate);
  const ban = Number(d.main_hero_ban_rate);
  if (!Number.isFinite(id)) return null;
  if ([win, pick, ban].some((v) => !Number.isFinite(v) || v < 0 || v > 1)) return null; // INV-001
  return { id, name: d?.main_hero?.data?.name ?? `Hero ${id}`, head: d?.main_hero?.data?.head ?? null, win, pick, ban };
}

// Lane-por-herói a partir da fonte viva (verificado contra dado real em 2026-10-10,
// via arenaGet em dev sobre ~40 hero_ids; só estes 5 títulos existem na fonte):
//   'Exp Lane' (road_sort_id 1) -> exp · 'Mid Lane' (2) -> mid · 'Roam' (3) -> roam
//   'Jungle' (4) -> jungle · 'Gold Lane' (5) -> gold
// Forma: GET /api/academy/heroes/{id}/lane -> records[].data.hero.data.roadsort[],
// cada entrada com data {road_sort_id, road_sort_title, road_sort_icon}
// (a lista traz ainda uma entrada "" vazia por herói — ignorada).
// Título fora da tabela = herói SEM lane (aparece sem filtro, nunca sob lane errada).
export const ROAD_SORT_TO_LANE = {
  "exp lane": "exp",
  "mid lane": "mid",
  "roam": "roam",
  "jungle": "jungle",
  "gold lane": "gold",
};

// roadsort[] (bruto da fonte) -> { lanes, unknown }.
// Pura e testável: nunca inventa lane; título desconhecido vai p/ `unknown`.
export function lanesFromRoadsort(roadsort) {
  const lanes = [];
  const unknown = [];
  for (const entry of roadsort ?? []) {
    const title = entry?.data?.road_sort_title;
    if (typeof title !== "string" || !title.trim()) continue;
    const lane = ROAD_SORT_TO_LANE[title.trim().toLowerCase()];
    if (lane) {
      if (!lanes.includes(lane)) lanes.push(lane);
    } else if (!unknown.includes(title)) {
      unknown.push(title);
    }
  }
  return { lanes, unknown };
}

/**
 * @param {{ arena: { getRankPage: Function, mapConc: Function }, cacheStore: { cacheGet: Function, cacheSet: Function }, snapshotHistory: { recordSnapshot: Function, listSnapshots: Function }, versions: { currentGameVersion: Function }, engine: { checkPickSum: Function, median: Function, summarizeWalkPosterior: Function, isValidWalkPrior: Function } }} deps
 */
export function createRankLot({ arena, cacheStore, snapshotHistory, versions, engine }) {
  const { getRankPage, mapConc } = arena;
  const { cacheGet, cacheSet } = cacheStore;
  const { recordSnapshot, listSnapshots } = snapshotHistory;
  const { currentGameVersion } = versions;
  const { checkPickSum, median, summarizeWalkPosterior, isValidWalkPrior } = engine;

  // ADR-023: último posterior VERIFICADO da série (mesmo fonte+rank+janela) vira o prior.
  // Leitura local do SnapshotHistory (sem fetch ao upstream). Sem histórico/posterior ⇒ null (flat).
  /**
   * @param {{ fonte?: string, rank?: string, janela?: number }} [serie]
   * @returns {{ mu: number, tau2: number, n: number, game_version: string } | null}
   */
  function lastVerifiedPosterior({ fonte = "heroes", rank, janela } = {}) {
    try {
      const serie = listSnapshots({ fonte, rank, janela, limit: 1000 });
      for (let i = serie.length - 1; i >= 0; i--) {
        const s = serie[i];
        if (s.status !== "verificado") continue; // T5/analítico: só verificado alimenta prior
        if (isValidWalkPrior(s.posterior)) return s.posterior;
        return null; // verificado sem apêndice (pré-023) ⇒ flat honesto, sem herdar adiante
      }
    } catch { /* sem histórico ⇒ flat */ }
    return null;
  }

  // F3: chamadas concorrentes idênticas compartilham UMA coleta. Isso também evita
  // snapshots duplicados no histórico (duas rotas pedindo o mesmo lote ao mesmo tempo).
  // A chave inclui retries/timeout: um agregado com deadline curto não "pega carona"
  // numa coleta configurada para esperar mais.
  const rankFlights = createSingleFlight();

  function fetchRankAll(opts) {
    const { days, rank, retries = 3, timeoutMs = 12000 } = opts;
    return rankFlights.run(
      `rank:${rank}:${days}:${retries}:${timeoutMs}`,
      () => fetchRankAllImpl({ days, rank, retries, timeoutMs }),
    );
  }

  async function fetchRankAllImpl({ days, rank, retries = 3, timeoutMs = 12000 }) {
    const key = `rank:${rank}:${days}`;
    const hit = cacheGet(key, "A");
    if (hit.hit && !hit.stale) {
      // Cache quente: sem nova gravação ⇒ ler o prior da série é seguro (sem auto-prior).
      const vg = currentGameVersion();
      const prior = lastVerifiedPosterior({ fonte: "heroes", rank, janela: days });
      return { rows: hit.body, ageMs: hit.ageMs, stale: false, fromCache: true, pages: 0, truncated: false, totalFonte: hit.body.length, prior, gameVersion: vg };
    }
    const first = await getRankPage({ days, rank, size: 50, index: 1, retries, timeoutMs });
    const total = Number(first?.data?.total ?? 0) || 0;
    // SEC M-02/EC-001: total vem da fonte; teto de 6 páginas (~300 registros, cobre os ~133 heróis)
    const pages = Math.min(6, Math.max(1, Math.ceil(total / 50)));
    const truncated = total > pages * 50;
    const rest = await mapConc(Array.from({ length: pages - 1 }, (_, k) => k + 2),
      (idx) => getRankPage({ days, rank, size: 50, index: idx, retries, timeoutMs }));
    const recs = [first, ...rest].flatMap((p) => p?.data?.records ?? []);
    const rows = recs.map(normalize).filter(Boolean);
    // ADR-021-09 / DDD-V4-05: hook append-only — todo lote válido gravado no histórico (INSERT, nunca REPLACE).
    // L2 (violado ENTRA marcado): snapshot violado entra com status "violado"+motivo para auditoria
    // C-101/C-102 e comparação C-105; consumo analítico (T5) usa só "verificado". Excluir = proibido.
    // O histórico nunca quebra a coleta; versão do jogo reaproveita o cache de patches (sem fetch novo).
    // ADR-023: prior = último VERIFICADO da mesma série (carregado ANTES de inserir o atual,
    // senão o lote viraria prior de si mesmo); o posterior do lote corrente vai como
    // apêndice p/ a rodada seguinte (L2-WF-04). Só "verificado" alimenta o prior; violado
    // entra marcado mas nunca como prior.
    const vg = currentGameVersion();
    const chk = checkPickSum(rows.map((h) => h.pick));
    const prior = chk.ok ? lastVerifiedPosterior({ fonte: "heroes", rank, janela: days }) : null;
    let posterior = null;
    try {
      if (chk.ok) {
        const wins = rows.filter((x) => x && Number.isFinite(x.win)).map((x) => x.win);
        const muB = median(wins);
        const madB = median(wins.map((x) => Math.abs(x - muB)).sort((a, b) => a - b)) || 1e-6;
        const tB = 1.4826 * madB;
        posterior = summarizeWalkPosterior({ muBatch: muB, tau2Batch: tB * tB, nBatch: wins.length, prior, gameVersion: vg });
      }
    } catch { posterior = null; }
    try {
      recordSnapshot({
        fonte: "heroes", rank, janela: days,
        versao_jogo: vg,
        rows, status: chk.ok ? "verificado" : "violado", motivo: chk.ok ? null : `sigma_pick:${chk.sum}`,
        posterior,
      });
    } catch { /* histórico nunca quebra a coleta */ }
    cacheSet(key, rows);
    // EC-010: refetch OK renova a idade; stale só quando servimos dado velho
    return { rows, ageMs: 0, stale: false, fromCache: false, pages, truncated, totalFonte: total, prior, gameVersion: vg, posterior };
  }

  return { fetchRankAll, lastVerifiedPosterior };
}
