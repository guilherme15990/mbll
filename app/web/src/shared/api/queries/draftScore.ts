/**
 * Domínio: Draft Score do herói (número único, motor `hero-draft-score-v1`).
 *
 * Consumido pela página de TESTE `/draft-score`. A API compõe o lote oficial no
 * SERVIDOR (`/v1/heroes/draft-score`), então a web faz 1 request por recorte —
 * sem fan-out. O DTO do fio vem de `@radar/contracts` (fonte única): o hook
 * reexporta o tipo, nunca redeclara a forma.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { HeroDraftScoreResponse } from "@radar/contracts";
import { getJSON } from "../http";

export type { HeroDraftScoreResponse, HeroDraftScoreRow } from "@radar/contracts";

/**
 * Draft Score do recorte (rank + janela). `enabled` fica falso com `rank=all`:
 * a métrica exige um recorte explícito (a WR vem do elo). `staleTime` curto
 * porque o número acompanha o patch; a API já cacheia por trás.
 */
export const useHeroDraftScore = (rank: string, window: string, enabled = true) =>
  useQuery({
    queryKey: ["hero-draft-score", rank, window],
    enabled: enabled && rank !== "all",
    staleTime: 5 * 60e3,
    placeholderData: keepPreviousData,
    queryFn: () => getJSON<HeroDraftScoreResponse>(`/v1/heroes/draft-score?rank=${rank}&window=${window}`),
  });
