/**
 * Domínio: leituras transversais (tendência, distorção, blind, gems, views,
 * meta e módulos).
 *
 * São as rotas que descrevem o estado do índice, não uma entidade. Ficam
 * juntas porque compartilham a mesma forma de consumo (id + janela) e nenhuma
 * delas domina o arquivo.
 */
import { useQuery } from "@tanstack/react-query";
import { getJSON } from "../http";
import type { Hero } from "./heroes";

export type TrendPoint = { date: string; win: number; pick: number; ban: number };

export const useTrends = (
  id: string | null | undefined,
  rank: string,
  days = "30",
  // Opcionais: chamadas em grade (1 por card) usam staleTime longo e sem retry.
  opts: { staleTime?: number; retry?: number } = {},
) =>
  useQuery({
    queryKey: ["trends", id, rank, days],
    enabled: !!id,
    ...(opts.staleTime != null ? { staleTime: opts.staleTime } : {}),
    ...(opts.retry != null ? { retry: opts.retry } : {}),
    queryFn: () => getJSON<{ data: TrendPoint[] }>(`/v1/heroes/${id}/trends?rank=${rank}&days=${days}`),
  });

export const useViews = (view: string, rank: string, window: string) =>
  useQuery({
    queryKey: ["views", view, rank, window],
    queryFn: () => getJSON<any>(`/v1/views/${view}?rank=${rank}&window=${window}`),
  });

export const useGems = (rank: string, window: string) =>
  useQuery({
    queryKey: ["gems", rank, window],
    queryFn: () => getJSON<{ data: (Hero & { reason: string })[] }>(`/v1/gems?rank=${rank}&window=${window}`),
  });

export const useMeta = () =>
  useQuery({ queryKey: ["meta"], queryFn: () => getJSON<any>("/v1/meta/status") });

export const useModules = () =>
  useQuery({ queryKey: ["modules"], queryFn: () => getJSON<{ data: any[]; c_reference: number; c_grade: string; impossibilities: string[] }>("/v1/modules"), staleTime: 3600e3 });

export const useDistortion = (id: string | null | undefined, rank: string, window: string) =>
  useQuery({
    queryKey: ["distortion", id, rank, window],
    enabled: !!id,
    queryFn: () => getJSON<any>(`/v1/heroes/${id}/distortion?rank=${rank}&window=${window}`),
  });

export const useBlind = (id: string | null | undefined, rank: string, days: string) =>
  useQuery({
    queryKey: ["blind", id, rank, days],
    enabled: !!id && rank !== "all",
    queryFn: () => getJSON<any>(`/v1/heroes/${id}/blind?rank=${rank}&days=${days}`),
  });
