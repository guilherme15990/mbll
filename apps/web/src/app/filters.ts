// Filtros globais da URL (rank/janela/herói) — F4a.
//
// Antes vivia em `App.tsx` e as páginas importavam `../App` só para ler o
// filtro, criando um ciclo App → página → App. Aqui o hook não depende de
// nenhum componente: quem importa não puxa o shell.
import { useSearchParams } from "react-router-dom";

export function useFilters() {
  const [sp, setSp] = useSearchParams();
  const rank = sp.get("rank") ?? "mythic";
  const window = sp.get("window") ?? "7";
  const hero = sp.get("hero") ?? "";

  // Cópia (não mutação) do URLSearchParams: o objeto do hook pode ser
  // compartilhado entre renders; mutar direto já causou perda de parâmetro.
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp);
    next.set(k, v);
    setSp(next, { replace: true });
  };

  return { rank, window, hero, set };
}

/** Query canônica para links internos (preserva o contexto global). */
export function filtersQuery({ rank, window, hero }: { rank: string; window: string; hero: string }) {
  const params = new URLSearchParams();
  if (rank) params.set("rank", rank);
  if (window) params.set("window", window);
  if (hero) params.set("hero", hero);
  return params.toString();
}
