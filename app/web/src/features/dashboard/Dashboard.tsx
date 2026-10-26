import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { GRID_SERVER_SORT, PAGE_SIZE, isServerSort, useHeroLanes, useHeroes, type GridSort } from "../../shared/api";
import { useFilters } from "../../app/filters";
import HeroCard from "./HeroCard";
import RankingsTab from "./RankingsTab";
import BuildsTab from "./BuildsTab";
import { Empty, ErrBox, Loading } from "../../shared/ui";

/** Ordenações da grade: o backend só ordena índice (θ̂), pick e ban; win/nome são locais. */
const SORTS: { id: GridSort; label: string; hint: string }[] = [
  { id: "theta", label: "Índice", hint: "Maior índice de força (θ̂ estimado) primeiro — ordem do servidor" },
  { id: "win", label: "Win", hint: "Maior win observado primeiro — ordena só a página atual" },
  { id: "pick", label: "Pick", hint: "Maior pick rate primeiro — ordem do servidor" },
  { id: "ban", label: "Ban", hint: "Maior ban rate primeiro — ordem do servidor" },
  { id: "nome", label: "Nome", hint: "Ordem alfabética — só a página atual" },
];

const TABS = ["herois", "rankings", "builds"] as const;
const TAB_LABEL: Record<(typeof TABS)[number], string> = {
  herois: "Heróis",
  rankings: "Rankings",
  builds: "Builds",
};

/** Janela de páginas clicáveis: 1 … atual−1 [atual] atual+1 … N. */
function pageSlots(current: number, total: number): (number | "gap")[] {
  const keep = new Set<number>([1, total, current - 1, current, current + 1]);
  const pages = [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

/**
 * /dashboard — visão geral do meta (grade + abas).
 * SÓ leitura, SÓ hooks existentes (useHeroes/useHeroLanes).
 * Sem endpoint novo; a key ["heroes",rank,window,extra,index] pagina no servidor.
 * Filtro de rota = join client com o mapa /heroes/lanes (1 request extra
 * por elo, stale 24h). A seleção NÃO mora mais na página: vem do header global
 * (`useFilters().lanes` → ?lanes=), então sobrevive à navegação. A lista não
 * tem `lane=` no servidor. Sem fetch em useEffect; trends seguem lazy por card.
 */
export default function Dashboard() {
  const { rank, window, lanes } = useFilters();
  const [gridQ, setGridQ] = useState("");
  const [gridSort, setGridSort] = useState<GridSort>("theta");
  const [pageState, setPageState] = useState<{ ctx: string; page: number } | null>(null);
  const gridTopRef = useRef<HTMLDivElement>(null);
  const gridHeadingRef = useRef<HTMLHeadingElement>(null);
  // Chave estável para resetar paginação quando a rota global muda.
  const lanesKey = lanes.join(",");
  // Abas do dashboard: estado local de UI (nunca entra em query key).
  const [dashTab, setDashTab] = useState<"herois" | "rankings" | "builds">("herois");
  // Roving tabindex: só a aba ativa é tabulável, então as setas precisam mover
  // foco+seleção — sem isso as demais ficam inalcançáveis pelo teclado.
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = TABS.indexOf(dashTab);
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    const target = TABS[next];
    setDashTab(target);
    requestAnimationFrame(() => document.getElementById(`tab-${target}`)?.focus());
  };
  // Paginação SERVIDOR: `extra` só com sorts reais do backend (win=θ̂, pick,
  // ban=qBan monotônico); win observado/nome caem p/ ordenação local na página.
  const gridExtra = GRID_SERVER_SORT[gridSort];
  const serverSorted = isServerSort(gridSort);
  // Página amarrada ao recorte: trocar elo/janela/sort/rota deriva pág 1 no
  // próprio render — sem efeito de reset, sem request com a página antiga.
  const gridCtx = `${rank}|${window}|${gridExtra}|${lanesKey}`;
  const gridPage = pageState && pageState.ctx === gridCtx ? pageState.page : 1;
  const setGridPage = (p: number) => setPageState({ ctx: gridCtx, page: p });
  const heroesQuery = useHeroes(rank, window, gridExtra, gridPage, PAGE_SIZE, dashTab === "herois");
  // Mapa heroId -> lanes[]: 1 request extra por elo (stale 24h), só com a aba
  // de heróis ativa — os selos aparecem nos cards em qualquer filtro ("todas" incluso).
  const lanesQuery = useHeroLanes(rank, dashTab === "herois");

  const heroes = heroesQuery.data?.data ?? [];
  const serverTotal = heroesQuery.data?.total ?? heroes.length;
  const gridTotalPages = Math.max(1, Math.ceil(serverTotal / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, gridPage), gridTotalPages);
  // Base do índice (n do lote) — não confundir com `total` da página.
  const indexBasisN = heroesQuery.data?.index_basis?.n ?? serverTotal;

  // Total encolheu (lote novo): clampa a página para o último índice válido.
  useEffect(() => {
    if (gridPage > gridTotalPages) setGridPage(gridTotalPages);
  }, [gridPage, gridTotalPages]);

  // Página → seta o estado e devolve o usuário ao topo da grade (o pager fica no rodapé).
  const goToPage = (p: number) => {
    const next = Math.min(Math.max(1, p), gridTotalPages);
    if (next === safePage) return;
    setGridPage(next);
    requestAnimationFrame(() => {
      gridTopRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      gridHeadingRef.current?.focus({ preventScroll: true });
    });
  };

  // Grade: PÁGINA do servidor (`total` da resposta dita o nº de páginas).
  // Filtro por nome, por rota e sorts sem suporte servidor (win observado, nome)
  // aplicam-se só à página atual — avisado junto aos controles.
  // Rota = join client com o mapa /heroes/lanes (herói sem lane mapeada
  // não aparece sob filtro de rota; mapa vazio = fonte indisponível, sem filtro).
  const lanesMap = lanesQuery.data?.data;
  const lanesLoaded = lanesQuery.isSuccess && lanesMap != null;
  const lanesEmpty = lanesLoaded && Object.keys(lanesMap as Record<string, unknown>).length === 0;
  const lanesError = lanesQuery.isError;
  // Selos de rota no card: sempre que o mapa carregou e não está vazio (sem lane = sem selo).
  const laneBadges = lanesLoaded && !lanesEmpty ? (lanesMap as Record<number, string[]>) : undefined;
  const filtering = lanes.length > 0;
  const needle = gridQ.trim().toLowerCase();
  const gridLaneFiltered = laneBadges && filtering
    ? heroes.filter((h) => (laneBadges[h.id] ?? []).some((l) => lanes.includes(l)))
    : heroes;
  const laneActive = Boolean(laneBadges && filtering);
  // Ocultos pela rota NESTA página (o filtro de rota é client-side, não reduz o total do servidor).
  const laneHidden = laneActive ? heroes.length - gridLaneFiltered.length : 0;
  const gridPaged = gridLaneFiltered
    .filter((h) => (!needle ? true : h.name.toLowerCase().includes(needle)))
    .sort((a, b) => {
      if (serverSorted) return 0; // ordem já veio do servidor
      if (gridSort === "win") {
        const aw = Number.isFinite(a.win) ? a.win : -Infinity;
        const bw = Number.isFinite(b.win) ? b.win : -Infinity;
        return bw - aw;
      }
      return a.name.localeCompare(b.name, "pt-BR");
    });
  const updating = heroesQuery.isPlaceholderData === true;

  return (
    <section className="space-y-5" aria-label="Visão geral do meta">
      {/* Abas do dashboard: Heróis (grade) | Rankings (top 5) | Builds (por rota). Estado local, nunca em query key. */}
      <div className="flex items-center gap-1.5" role="tablist" aria-label="Visões do dashboard">
        {TABS.map((t) => {
          const on = dashTab === t;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              id={`tab-${t}`}
              aria-controls={`panel-${t}`}
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => setDashTab(t)}
              onKeyDown={onTabKey}
              className={on
                ? "px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gold/15 text-gold border border-gold/50"
                : "px-3.5 py-1.5 rounded-xl text-xs font-semibold text-mist bg-abyss/40 border border-line hover:text-foam hover:border-gold/40 transition-colors"}
            >
              {TAB_LABEL[t]}
            </button>
          );
        })}
      </div>

      {/* 2b · grade de heróis (todos do lote, índice padrão, 50/pág) */}
      {dashTab === "herois" ? (
      <div
        ref={gridTopRef}
        role="tabpanel"
        id="panel-herois"
        aria-labelledby="tab-herois"
        className="card p-4 bg-panel border-line space-y-3 scroll-mt-20"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 ref={gridHeadingRef} tabIndex={-1} className="text-xs font-bold uppercase tracking-wider text-foam">
            Heróis da faixa
          </h3>
          {/* Contexto quantificado: total do recorte + página (o pager fica no rodapé). */}
          <span className="text-[10px] font-mono text-mist" role="status">
            {heroesQuery.isSuccess ? `${serverTotal} heróis · página ${safePage} de ${gridTotalPages}` : ""}
            {updating ? `${heroesQuery.isSuccess ? " · " : ""}atualizando…` : ""}
          </span>
        </div>
        {/* Filtro por rota: seleção no header global (?lanes=), aplicada aqui
            com o mapa /heroes/lanes (1 request extra por elo, stale 24h). A
            lista não tem `lane=` no servidor, então o filtro vale para a
            página atual. */}
        {filtering && lanesQuery.isLoading ? (
          <p className="text-[11px] text-mist" role="status">carregando mapa de rotas — filtro ainda não aplicado</p>
        ) : null}
        {lanesEmpty && filtering ? (
          <p className="text-[11px] text-mist" role="note">mapa de rotas indisponível — lista sem filtro de rota</p>
        ) : null}
        {lanesError && filtering ? (
          <p className="text-[11px] text-mist" role="note">
            mapa de rotas indisponível — filtro {lanes.join(" + ")} não aplicado
          </p>
        ) : null}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist" aria-hidden="true" />
            <input
              className="inp w-full pl-9 pr-8"
              aria-label="Filtrar página por nome"
              placeholder="Filtrar na página por nome…"
              title="Filtro local: só a página atual"
              value={gridQ}
              onChange={(e) => { setGridQ(e.target.value); setGridPage(1); }}
            />
            {gridQ ? (
              <button
                type="button"
                onClick={() => { setGridQ(""); setGridPage(1); }}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-mist hover:text-foam p-0.5"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Ordenar a grade">
            <span className="text-[11px] text-mist">ordenar</span>
            {SORTS.map((s) => {
              const on = gridSort === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={`Ordenar por ${s.label}: ${s.hint}`}
                  title={s.hint}
                  onClick={() => { setGridSort(s.id); setGridPage(1); }}
                  className={on
                    ? "px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gold/15 text-gold border border-gold/50"
                    : "px-2.5 py-1 rounded-lg text-[11px] font-semibold text-mist bg-abyss/40 border border-line hover:text-foam hover:border-gold/40 transition-colors"}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
        {!serverSorted ? (
          <p className="text-[11px] text-mist" role="note">ordena a página atual (sem sort no servidor p/ esta opção)</p>
        ) : null}
        {heroesQuery.isLoading ? (
          <Loading rows={6} />
        ) : heroesQuery.isError ? (
          <ErrBox onRetry={() => heroesQuery.refetch()} />
        ) : !gridPaged.length ? (
          <Empty
            title="Nenhum herói nesta página"
            hint={
              needle
                ? `Nenhum nome desta página contém “${gridQ.trim()}”. A busca vale só para a página ${safePage} de ${gridTotalPages} — limpe a busca ou troque de página.`
                : laneActive
                ? `Nenhum herói com rota ${lanes.join(" + ")} nesta página. Ajuste elo, janela, rota ou página.`
                : "Nenhum herói nesta faixa."
            }
          />
        ) : (
          <ul
            className={`grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 transition-opacity ${updating ? "opacity-60" : ""}`}
            aria-label="Grade de heróis"
            aria-busy={heroesQuery.isFetching}
          >
            {gridPaged.map((h) => (
              <li key={h.id}>
                <HeroCard hero={h} rank={rank} window={window} lanes={laneBadges?.[h.id]} filterLanes={lanes} indexN={indexBasisN} />
              </li>
            ))}
          </ul>
        )}
        {laneActive && laneHidden > 0 ? (
          <p className="text-[11px] text-mist" role="note">
            {laneHidden} {laneHidden === 1 ? "herói desta página oculto" : "heróis desta página ocultos"} pela rota {lanes.join(" + ")} — a página vem do servidor sem filtro de rota.
          </p>
        ) : null}
        {gridTotalPages > 1 ? (
          <nav className="flex items-center justify-between gap-2 flex-wrap pt-1" aria-label="Paginação da grade de heróis">
            <button
              type="button"
              className="btn-ghost text-[11px]"
              disabled={safePage <= 1}
              aria-label="Página anterior"
              onClick={() => goToPage(safePage - 1)}
            >
              ← Anterior
            </button>
            <div className="flex items-center gap-1 flex-wrap">
              {pageSlots(safePage, gridTotalPages).map((slot, i) =>
                slot === "gap" ? (
                  <span key={`gap-${i}`} className="px-1 text-[11px] text-mist/60" aria-hidden="true">…</span>
                ) : (
                  <button
                    key={slot}
                    type="button"
                    aria-current={slot === safePage ? "page" : undefined}
                    aria-label={`Página ${slot}`}
                    onClick={() => goToPage(slot)}
                    className={slot === safePage
                      ? "min-w-[30px] px-2 py-1 rounded-lg text-[11px] font-bold bg-gold/15 text-gold border border-gold/50"
                      : "min-w-[30px] px-2 py-1 rounded-lg text-[11px] font-semibold text-mist bg-abyss/40 border border-line hover:text-foam hover:border-gold/40 transition-colors"}
                  >
                    {slot}
                  </button>
                )
              )}
            </div>
            <button
              type="button"
              className="btn-ghost text-[11px]"
              disabled={safePage >= gridTotalPages}
              aria-label="Próxima página"
              onClick={() => goToPage(safePage + 1)}
            >
              Próxima →
            </button>
          </nav>
        ) : null}
      </div>
      ) : dashTab === "rankings" ? (
        <RankingsTab rank={rank} window={window} lanes={lanes} active={dashTab === "rankings"} />
      ) : (
        <BuildsTab rank={rank} window={window} lanes={lanes} active={dashTab === "builds"} />
      )}
    </section>
  );
}
