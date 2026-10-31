/**
 * Vocabulário de filtros/ordenação compartilhado por quase toda a web.
 *
 * `GRID_SERVER_SORT` é o mapeamento honesto grade → sorts reais do backend
 * (`application/scoring.js` qHeroes: sort=d|win|pick|ban|q). `sort=win` ordena por wrAdj
 * (θ̂); `sort=pick` por pick; `sort=ban` por qBan (posto monotônico do ban —
 * mesma ordem do ban bruto). `win` observado e `nome` NÃO têm sort no servidor
 * (string vazia = ordenação local, só na página atual).
 */

export const LANES = ["exp", "mid", "roam", "jungle", "gold"] as const;
export const RANKS = ["all", "epic", "legend", "mythic", "honor", "glory"];

export type Lane = (typeof LANES)[number];
export type LaneFilter = "todas" | Lane;

/** Tamanho de página da lista (espelha o `size` do request). */
export const PAGE_SIZE = 50;

export type GridSort = "theta" | "pick" | "ban" | "win" | "nome";

export const GRID_SERVER_SORT: Record<GridSort, string> = {
  theta: "sort=win&order=desc",
  pick: "sort=pick&order=desc",
  ban: "sort=ban&order=desc",
  win: "",
  nome: "",
};

export const isServerSort = (s: GridSort): boolean => GRID_SERVER_SORT[s] !== "";
