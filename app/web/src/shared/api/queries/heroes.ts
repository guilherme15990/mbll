/**
 * Domínio: heróis — lista paginada, detalhe, catálogo e mapa de lanes.
 *
 * Consumido por `app/` e `shared/` além das features, por isso mora em `shared/api`
 * (a fronteira proíbe `app|shared → features`).
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
  strength_index_version?: string; tier_version?: string;
  counts?: { strong: number; weak: number; gem: number; degenerate: number };
};

export type HeroesResponse = {
  data: Hero[]; total: number; stale?: boolean; collectedAgoMs?: number;
  postPatch?: boolean; truncated?: boolean; totalFonte?: number;
  pickSumCheck?: { sum: number; ok: boolean };
  // ADR-023 walk-forward: "walk-forward v{H}" | "flat" (só leitura).
  prior?: string;
  // ADR-024: base do índice ({method, n do lote}).
  index_basis?: { method: string; n: number };
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
