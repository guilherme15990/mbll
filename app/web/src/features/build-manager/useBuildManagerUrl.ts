import { useParams, useSearchParams } from "react-router-dom";
import type { SetURLSearchParams } from "react-router-dom";
import { LANES } from "../../shared/api";

/**
 * Leitura do recorte do Build Management (ADR-047) a partir da URL.
 *
 * Herói vem do path (`/build/:id`) ou de `?hero=`; rank e janela têm padrão; a
 * lane só vale se for uma das cinco do jogo. Aqui só se LÊ: quem escreve na URL
 * (trocar herói/lane, escolher base) é `useBuildEditor`, que também limpa a
 * seleção. Extraído de `BuildManager.tsx` (ADR-041: teto de 300 linhas).
 */
export type BuildManagerUrl = {
  sp: URLSearchParams;
  setSp: SetURLSearchParams;
  hero: string;
  rank: string;
  window: string;
  lane: string;
  heroId: number;
  heroHref: string;
};

export function useBuildManagerUrl(): BuildManagerUrl {
  const params = useParams();
  const [sp, setSp] = useSearchParams();

  const hero = params.id ?? sp.get("hero") ?? "";
  const rank = sp.get("rank") ?? "mythic";
  const window = sp.get("window") ?? "7";
  const laneParam = sp.get("lane");
  const lane = laneParam && (LANES as readonly string[]).includes(laneParam) ? laneParam : "";
  const heroId = Number.parseInt(hero, 10);
  const heroHref = `/hero/${hero}?${new URLSearchParams({ tab: "builds", rank, window, lane }).toString()}`;

  return { sp, setSp, hero, rank, window, lane, heroId, heroHref };
}
