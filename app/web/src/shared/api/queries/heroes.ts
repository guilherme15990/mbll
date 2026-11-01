/**
 * Domínio: heróis — lista paginada, lote completo, detalhe, catálogo e mapa de lanes.
 *
 * Consumido por `app/` e `shared/` além das features, por isso mora em `shared/api`
 * (a fronteira proíbe `app|shared → features`).
 *
 * `useHeroes` = 1 página. `useAllHeroes` = lote inteiro (pagina pelo `total`,
 * sem tamanho de lote fixo). `useHero` = detalhe. `useCatalog` = nome/avatar de
 * todo herói. `useHeroLanes` = rota por herói.
 */
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getJSON } from "../http";
import { PAGE_SIZE } from "./filters";

export type Hero = {
  id: number; name: string; head: string | null;
  win: number; pick: number; ban: number;
  wrAdj: number; z: number; q: number;
  B?: number;
  tier: string;
  // R3 (critic-017): d/class/confidence/prior/strong/weak/se removidos do tipo —
  // zero leitores em web/src (sorts usam wrAdj; classOf() deriva). v3: sensitivity_band
  // removida da engine (grade c podada) — o tipo não a declara mais.
  strength_index?: number | null;
  isGem: boolean; degenerate: boolean; smallSample: boolean;
  uncertainty_status?: string; posterior_mean?: number | null;
  credible_interval_95?: [number, number] | null; posterior_prob_above_threshold?: number | null;
};

export type LotMeta = {
  mu: number; tau: number; c_reference: number; c_grade: string | null;
  n?: number; n_dropped?: number; c?: number;
  fdr_alpha?: number; gem_quantile?: number; small_sample?: boolean;
  prior?: string; version_break?: boolean;
  counts?: { strong: number; weak: number; gem: number; degenerate: number };
};

export type HeroesResponse = {
  data: Hero[]; total: number; stale?: boolean; collectedAgoMs?: number;
  postPatch?: boolean; truncated?: boolean; totalFonte?: number;
  pickSumCheck?: { sum: number; ok: boolean };
  // ADR-023 walk-forward: "walk-forward v{H}" | "flat" (só leitura).
  prior?: string;
  // ADR-024: base do índice ({n do lote}).
  index_basis?: { n: number };
  // Meta do lote (era repetida por herói): μ, τ + carimbos.
  meta?: LotMeta;
};

export type CatalogEntry = { name: string; head: string | null; smallmap?: string | null };

export type HeroLanesResponse = {
  data: Record<string, string[]>;
  total: number;
  stale?: boolean;
  ageMs?: number;
  fallback?: boolean;
  note?: string;
};

/**
 * Lista paginada no SERVIDOR (`size`/`index` no request; `total` na resposta).
 * `extra` carrega sorts reais do backend (ex. `sort=win&order=desc`); `index`
 * entra na query key. `placeholderData: keepPreviousData` troca de página sem
 * piscar. 1 request de lista por página — trends seguem lazy por card.
 */
export const useHeroes = (rank: string, window: string, extra = "", index = 1, size = PAGE_SIZE, enabled = true) =>
  useQuery({
    queryKey: ["heroes", rank, window, extra, index, size],
    placeholderData: keepPreviousData,
    enabled,
    queryFn: () => getJSON<HeroesResponse>(`/v1/heroes?rank=${rank}&window=${window}&size=${size}&index=${index}&${extra}`),
  });

/**
 * Teto de `size` por request imposto pelo SERVIDOR (`qHeroes` clampa em 133 —
 * `app/api/src/application/scoring.js`). NÃO é o tamanho do lote: o lote é lido
 * de `total` e coberto por paginação (`index`), para que um herói novo apareça
 * sozinho, sem mexer em constante alguma.
 */
export const HEROES_PAGE_CAP = 133;

/** Resultado do lote COMPLETO: todas as páginas concatenadas + estado do hook. */
export type AllHeroesResult = {
  data: HeroesResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => void;
};

/** Query de uma página extra (mesma query key do `useHeroes`; cache compartilhado). */
function heroPageQuery(rank: string, window: string, extra: string, index: number) {
  return {
    queryKey: ["heroes", rank, window, extra, index, HEROES_PAGE_CAP],
    placeholderData: keepPreviousData,
    queryFn: () =>
      getJSON<HeroesResponse>(
        `/v1/heroes?rank=${rank}&window=${window}&size=${HEROES_PAGE_CAP}&index=${index}&${extra}`,
      ),
  };
}

/**
 * Lote COMPLETO do recorte: a página 1 descobre `total` e o resto é paginado
 * por `index` até cobrir tudo. O tamanho do lote NÃO é fixado no cliente — o
 * único número é o teto de request do servidor (`HEROES_PAGE_CAP`). O lote
 * atual (≤ teto) cabe em 1 request; se crescer, as páginas extras vêm sozinhas.
 *
 * `truncated` fica true só quando a FONTE cortou (`fetched.truncated`) ou quando,
 * com todas as páginas carregadas, ainda faltar linha do `total` — nunca por
 * página ainda em voo.
 */
export function useAllHeroes(
  rank: string,
  window: string,
  extra = "",
  enabled = true,
): AllHeroesResult {
  const first = useHeroes(rank, window, extra, 1, HEROES_PAGE_CAP, enabled);
  const firstCount = first.data?.data.length ?? 0;
  const total = first.data?.total ?? 0;
  const pages = firstCount > 0 ? Math.ceil(total / firstCount) : 1;

  const rest = useQueries({
    queries: Array.from({ length: Math.max(0, pages - 1) }, (_, k) =>
      heroPageQuery(rank, window, extra, k + 2),
    ),
  });

  // Assinatura das páginas extras: o memo recomputa quando qualquer uma muda
  // (dado ou estado), sem depender da identidade instável do array do useQueries.
  const restStamp = rest.map((query) => `${query.dataUpdatedAt}:${query.status}`).join("|");

  const combined = useMemo<HeroesResponse | undefined>(() => {
    if (!first.data) return undefined;
    const rows = [...first.data.data];
    let settled = true;
    for (const query of rest) {
      if (query.data) rows.push(...query.data.data);
      if (!query.isSuccess) settled = false;
    }
    return {
      ...first.data,
      data: rows,
      total,
      truncated: Boolean(first.data.truncated) || (settled && rows.length < total),
    };
    // `rest` é derivado de restStamp; o memo cobre toda mudança de página extra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first.data, restStamp, total]);

  return {
    data: combined,
    isLoading: first.isLoading || rest.some((query) => query.isLoading),
    isError: first.isError || rest.some((query) => query.isError),
    isSuccess: first.isSuccess,
    refetch: () => {
      void first.refetch();
      for (const query of rest) void query.refetch();
    },
  };
}

export const useHero = (id: string | null | undefined, rank: string, window: string) =>
  useQuery({
    queryKey: ["hero", id, rank, window],
    enabled: !!id,
    queryFn: () => getJSON<{ data: Hero; meta?: LotMeta }>(`/v1/heroes/${id}?rank=${rank}&window=${window}`),
  });

export const useCatalog = () =>
  useQuery({
    queryKey: ["catalog"],
    staleTime: 24 * 3600e3,
    queryFn: () => getJSON<{ data: Record<string, CatalogEntry> }>("/v1/catalog"),
  });

/**
 * Mapa heroId -> lanes[] (`GET /heroes/lanes?rank=`, cache C 24h).
 * 1 request extra por elo, `staleTime` 24h (sem tempestade). Chamar com
 * `enabled = filtro ativo` p/ não buscar quando o filtro está em "todas".
 * Mapa vazio = fonte indisponível (a lista segue sem filtro).
 */
export const useHeroLanes = (rank: string, enabled = true) =>
  useQuery({
    queryKey: ["hero-lanes", rank],
    enabled,
    staleTime: 24 * 3600e3,
    queryFn: () => getJSON<HeroLanesResponse>(`/v1/heroes/lanes?rank=${rank}`),
  });
