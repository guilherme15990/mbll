// Filtros globais da URL (rank/janela/rotas/herói) — F4a.
//
// Antes vivia em `App.tsx` e as páginas importavam `../App` só para ler o
// filtro, criando um ciclo App → página → App. Aqui o hook não depende de
// nenhum componente: quem importa não puxa o shell.
//
// `lanes` é multi-seleção (?lanes=mid,jungle): vazio = todas as rotas. O
// controle vive no header, junto de elo e janela, e o valor é global — a página
// que sabe filtrar por rota (Dashboard/Lista) lê daqui em vez de manter estado
// local. Rota não entra em query key de rede: é join client com `/heroes/lanes`.
import { useSearchParams } from "react-router-dom";
import { LANES } from "../shared/api/queries/filters";

/** Lê ?lanes= descartando valor desconhecido (link velho/typo não vira filtro vazio). */
export function parseLanes(raw: string | null): string[] {
  const parsed = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => (LANES as readonly string[]).includes(s));
  return [...new Set(parsed)];
}

/** Preserva a seleção global de rota em um link já montado. */
export function withLanes(href: string, lanes: string[]): string {
  if (!lanes.length) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}lanes=${encodeURIComponent(lanes.join(","))}`;
}

export function useFilters() {
  const [sp, setSp] = useSearchParams();
  const rank = sp.get("rank") ?? "mythic";
  const window = sp.get("window") ?? "7";
  const hero = sp.get("hero") ?? "";
  const lanes = parseLanes(sp.get("lanes"));

  // Cópia (não mutação) do URLSearchParams: o objeto do hook pode ser
  // compartilhado entre renders; mutar direto já causou perda de parâmetro.
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp);
    next.set(k, v);
    setSp(next, { replace: true });
  };

  const setLanes = (next: string[]) => {
    const params = new URLSearchParams(sp);
    if (next.length) params.set("lanes", next.join(","));
    else params.delete("lanes");
    setSp(params, { replace: true });
  };

  const toggleLane = (lane: string) => {
    setLanes(lanes.includes(lane) ? lanes.filter((l) => l !== lane) : [...lanes, lane]);
  };

  return { rank, window, hero, lanes, set, setLanes, toggleLane };
}

/** Query canônica para links internos (preserva o contexto global). */
export function filtersQuery({
  rank,
  window,
  hero,
  lanes,
}: {
  rank: string;
  window: string;
  hero: string;
  lanes?: string[];
}) {
  const params = new URLSearchParams();
  if (rank) params.set("rank", rank);
  if (window) params.set("window", window);
  if (hero) params.set("hero", hero);
  if (lanes?.length) params.set("lanes", lanes.join(","));
  return params.toString();
}
