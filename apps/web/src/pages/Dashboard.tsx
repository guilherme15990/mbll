import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, FlaskConical, Gem, Search } from "lucide-react";
import { GRID_SERVER_SORT, LANES, PAGE_SIZE, isServerSort, num, useGems, useHeroLanes, useHeroes, useMeta, useViews, type GridSort, type Hero } from "../lib/api";
import { trustOf } from "@radar/proprietary-engine";
import { useFilters } from "../app/filters";
import HeroPicker from "../components/HeroPicker";
import HeroCard from "../components/HeroCard";
import RankingsTab from "../components/dashboard/RankingsTab";
import BuildsTab from "../components/dashboard/BuildsTab";
import { PrimaryAction } from "../components/idd/PrimaryAction";
import { SigmaBanCard } from "../components/idd/SigmaBanCard";
import {
  Avatar, CtxBar, Empty, ErrBox, FreshLine, IddZone,
  Loading, SectionTitle, TierBadge, TrustSeal, type TrustLevel,
} from "../components/ui";

type PickCheck = { sum: number; ok: boolean };
type GemRow = Hero & { reason: string };

// Selo da grade em `@radar/proprietary-engine` (trustOf — fonte única).

/**
 * /dashboard — visão geral do meta (T1 Panorama, leitura).
 * SÓ leitura, SÓ hooks existentes (useHeroes/useMeta/useViews/useGems/useHeroLanes).
 * Sem endpoint novo; a key ["heroes",rank,window,extra,index] pagina no servidor.
 * Filtro de rota = join client com o mapa /heroes/lanes (1 request extra
 * por elo, stale 24h, só buscado com filtro ativo — sem tempestade; a lista não
 * tem `lane=` no servidor). Sem fetch em useEffect; trends seguem lazy por card.
 */
export default function Dashboard() {
  const { rank, window, hero, set } = useFilters();
  const [gridQ, setGridQ] = useState("");
  const [gridSort, setGridSort] = useState<GridSort>("theta");
  const [gridPage, setGridPage] = useState(1);
  // Filtro multi-rota na URL (?lanes=mid,jungle): vazio = todas
  // (união: herói entra se tem QUALQUER rota marcada). Compartilhável via link.
  const [lsp, setLsp] = useSearchParams();
  const gridLanes = (lsp.get("lanes") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => (LANES as readonly string[]).includes(s));
  const writeLanes = (next: string[]) => {
    if (next.length) lsp.set("lanes", next.join(","));
    else lsp.delete("lanes");
    setLsp(lsp, { replace: true });
    setGridPage(1);
  };
  const toggleLane = (l: string) => {
    writeLanes(gridLanes.includes(l) ? gridLanes.filter((x) => x !== l) : [...gridLanes, l]);
  };
  const clearLanes = () => writeLanes([]);
  // Abas do dashboard: estado local de UI (nunca entra em query key).
  const [dashTab, setDashTab] = useState<"herois" | "rankings" | "builds">("herois");
  // Paginação SERVIDOR: `extra` só com sorts reais do backend (win=θ̂, pick,
  // ban=qBan monotônico); win observado/nome caem p/ ordenação local na página.
  const gridExtra = GRID_SERVER_SORT[gridSort];
  const serverSorted = isServerSort(gridSort);
  const heroesQuery = useHeroes(rank, window, gridExtra, gridPage);
  // Mapa heroId -> lanes[]: 1 request extra por elo (stale 24h), SEMPRE ligado —
  // os selos de rota aparecem nos cards em qualquer filtro ("todas" inclusive).
  const lanesQuery = useHeroLanes(rank, true);
  const metaQuery = useMeta();
  const gemsQuery = useGems(rank, window);
  const tiersQuery = useViews("tier", rank, window);

  // Troca de elo/janela/ordenação/filtro volta à pág 1 (evita índice fora do total novo).
  useEffect(() => { setGridPage(1); }, [rank, window, gridExtra]);
  if (heroesQuery.isLoading) return <Loading rows={6} />;
  if (heroesQuery.isError) return <ErrBox onRetry={() => heroesQuery.refetch()} />;

  const heroes = heroesQuery.data?.data ?? [];
  const pickCheck = (heroesQuery.data as unknown as { pickSumCheck?: PickCheck } | undefined)?.pickSumCheck;
  const sigmaPickSum = typeof pickCheck?.sum === "number" ? pickCheck.sum : null;
  const meta = metaQuery.data as unknown as { health?: { errors?: number } } | undefined;
  const errors = typeof meta?.health?.errors === "number" ? meta.health.errors : null;
  const ageMs = heroesQuery.data?.collectedAgoMs;
  const stale = heroesQuery.data?.stale;

  const inconclusivos = heroes.filter((h) => trustOf(h).level === "Inconclusivo");
  const sensiveis = heroes.filter((h) => {
    const t = trustOf(h);
    return t.level !== "Robusto" && t.motive.includes("sensível");
  });
  const gems = ((gemsQuery.data as unknown as { data?: GemRow[] } | undefined)?.data ?? []).slice(0, 6);
  const tierView = (tiersQuery.data as unknown as { data?: Record<string, Hero[]> } | undefined)?.data;
  const tierCounts: { tier: string; n: number }[] = ["S", "A", "B", "C", "D"].map((t) => ({
    tier: t,
    n: Array.isArray(tierView?.[t]) ? (tierView as Record<string, Hero[]>)[t].length : heroes.filter((h) => h.tier === t).length,
  }));
  const fichaTo = hero
    ? `/hero/${hero}?rank=${rank}&window=${window}`
    : "/hero";

  // Grade: PÁGINA do servidor (`total` da resposta dita o nº de páginas).
  // Filtro por nome, por rota e sorts sem suporte servidor (win observado, nome)
  // aplicam-se só à página atual — avisado junto aos controles.
  // Rota = join client com o mapa /heroes/lanes (herói sem lane mapeada
  // não aparece sob filtro de rota; mapa vazio = fonte indisponível, sem filtro).
  const serverTotal = heroesQuery.data?.total ?? heroes.length;
  const gridTotalPages = Math.max(1, Math.ceil(serverTotal / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, gridPage), gridTotalPages);
  const lanesMap = lanesQuery.data?.data;
  const lanesLoaded = lanesQuery.isSuccess && lanesMap != null;
  const lanesEmpty = lanesLoaded && Object.keys(lanesMap as Record<string, unknown>).length === 0;
  // Selos de rota no card: sempre que o mapa carregou e não está vazio (sem lane = sem selo).
  const laneBadges = lanesLoaded && !lanesEmpty ? (lanesMap as Record<number, string[]>) : undefined;
  const filtering = gridLanes.length > 0;
  const needle = gridQ.trim().toLowerCase();
  const gridLaneFiltered = laneBadges && filtering
    ? heroes.filter((h) => (laneBadges[h.id] ?? []).some((l) => gridLanes.includes(l)))
    : heroes;
  const laneActive = Boolean(laneBadges && filtering);
  const laneHidden = laneActive ? heroes.length - gridLaneFiltered.length : 0;
  const gridPaged = gridLaneFiltered
    .filter((h) => (!needle ? true : h.name.toLowerCase().includes(needle)))
    .sort((a, b) => {
      if (serverSorted) return 0; // ordem já veio do servidor
      if (gridSort === "win") return b.win - a.win;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  const refreshing = heroesQuery.isPlaceholderData === true;

  return (
    <section className="space-y-5" aria-label="Visão geral do meta">
      <CtxBar
        id="SHR"
        name="Panorama do meta por faixa"
        question="Quais heróis sustentam leitura neste elo e janela?"
        status="provisório (T1 em leitura)"
        prdRef="T1 Panorama · somente leitura"
      />

      <SectionTitle
        kicker="Panorama · T1"
        title="Visão geral do meta"
        subtitle={`Elo ${rank.toUpperCase()} · janela ${window}d · ${serverTotal} heróis · pág ${safePage}/${gridTotalPages}`}
        right={<FreshLine stale={stale} ageMs={ageMs} />}
      />

      <PrimaryAction
        contextId="SHR"
        capId="CAP-SHR-01"
        label="Abrir a Ficha do Herói"
        to={fichaTo}
        disabledReason={!hero ? "selecione um herói para abrir a ficha" : null}
      />

      {/* 1 · saúde do snapshot em 1 linha */}
      <IddZone zone="state" capId="CAP-EXP-01" className="card p-3.5 bg-panel border-line">
        <p className="text-xs text-foam" role="status">
          {sigmaPickSum != null ? `Σ pick ${num(sigmaPickSum, 4)}` : "Σ pick sem dado neste lote"}
          {pickCheck ? (pickCheck.ok ? " · conservação estável" : " · alerta de conservação — leitura mantida") : ""}
          {errors != null ? ` · ${errors} falhas de fonte` : ""}
          {stale ? " · lote anterior preservado" : ""}
          <span className="text-mist"> · slot_share · unvalidated</span>
        </p>
      </IddZone>

      {/* Abas do dashboard: Heróis (grade) | Rankings (top 5) | Builds (por rota). Estado local, nunca em query key. */}
      <div className="flex items-center gap-1.5" role="tablist" aria-label="Visões do dashboard">
        {(["herois", "rankings", "builds"] as const).map((t) => {
          const on = dashTab === t;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setDashTab(t)}
              className={on
                ? "px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gold/15 text-gold border border-gold/50"
                : "px-3.5 py-1.5 rounded-xl text-xs font-semibold text-mist bg-abyss/40 border border-line hover:text-foam hover:border-gold/40 transition-colors"}
            >
              {t === "herois" ? "Heróis" : t === "rankings" ? "Rankings" : "Builds"}
            </button>
          );
        })}
        <span className="text-[10px] font-mono text-mist/70 ml-1">rankings = top 5 globais da faixa · builds = trincas e lifts por rota (1 request pequeno por lista, builds só com rota)</span>
      </div>

      {/* 2b · grade de heróis (todos do lote, θ̂ padrão, 50/pág) */}
      {dashTab === "herois" ? (
      <IddZone zone="data" capId="CAP-SHR-01" className="card p-4 bg-panel border-line space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foam">
            Todos os heróis na faixa
          </h3>
          <span className="text-[10px] font-mono text-mist" title="Total do servidor; unidade de exposição da fonte">
            {serverTotal} heróis · pág {safePage}/{gridTotalPages} · slot_share·unvalidated{refreshing ? " · atualizando…" : ""}
          </span>
        </div>
        {/* Filtro por rota: join client com o mapa /heroes/lanes
            (1 request extra por elo, stale 24h, sempre ligado — selos visíveis
            em qualquer filtro). A lista não tem `lane=` no servidor, então o
            filtro aplica-se à página atual. */}
        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filtro por rota (múltipla)">
          <span className="text-[11px] text-mist">Rota</span>
          <button
            key="todas"
            type="button"
            aria-pressed={gridLanes.length === 0}
            onClick={clearLanes}
            className={gridLanes.length === 0
              ? "px-2 py-1 rounded-lg text-[11px] font-mono border border-gold/60 text-gold bg-gold/10"
              : "px-2 py-1 rounded-lg text-[11px] font-mono border border-line text-mist bg-abyss/40 hover:border-gold/40 hover:text-foam transition-colors"}
          >
            todas
          </button>
          {(LANES as readonly string[]).map((l) => {
            const on = gridLanes.includes(l);
            return (
              <button
                key={l}
                type="button"
                aria-pressed={on}
                onClick={() => toggleLane(l)}
                className={on
                  ? "px-2 py-1 rounded-lg text-[11px] font-mono border border-gold/60 text-gold bg-gold/10"
                  : "px-2 py-1 rounded-lg text-[11px] font-mono border border-line text-mist bg-abyss/40 hover:border-gold/40 hover:text-foam transition-colors"}
              >
                {l}
              </button>
            );
          })}
          {lanesQuery.isLoading ? (
            <span className="text-[11px] text-mist/80" role="status">carregando rotas…</span>
          ) : null}
        </div>
        {laneActive ? (
          <p className="text-[11px] text-mist" role="note">
            filtro {gridLanes.join(" + ")} na página atual · {laneHidden} da página sem rota mapeada ocultos · herói sem lane aparece em “todas”
          </p>
        ) : null}
        {lanesEmpty ? (
          <p className="text-[11px] text-mist" role="note">mapa de rotas indisponível — lista sem filtro de rota</p>
        ) : null}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist" aria-hidden="true" />
            <input
              className="inp w-full pl-9"
              aria-label="Filtrar página por nome"
              placeholder="Filtrar na página por nome…"
              title="Filtro local: só a página atual"
              value={gridQ}
              onChange={(e) => { setGridQ(e.target.value); }}
            />
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-mist">
            Ordenar
            <select
              className="inp !py-1.5 font-mono"
              aria-label="Ordenar grade"
              value={gridSort}
              onChange={(e) => { setGridSort(e.target.value as GridSort); setGridPage(1); }}
            >
              <option value="theta">θ̂ estimado</option>
              <option value="win">win observado</option>
              <option value="pick">pick</option>
              <option value="ban">ban</option>
              <option value="nome">nome</option>
            </select>
          </label>
        </div>
        {!serverSorted ? (
          <p className="text-[11px] text-mist" role="note">ordena a página atual (sem sort no servidor p/ esta opção)</p>
        ) : null}
        {!gridPaged.length ? (
          <Empty title="Sem leitura" hint="Nenhum herói corresponde ao filtro nesta faixa." />
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Grade de heróis">
            {gridPaged.map((h) => (
              <li key={h.id}>
                <HeroCard hero={h} rank={rank} window={window} trust={trustOf(h)} lanes={laneBadges?.[h.id]} indexN={serverTotal} />
              </li>
            ))}
          </ul>
        )}
        {gridTotalPages > 1 ? (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              className="btn-ghost text-[11px]"
              disabled={safePage <= 1}
              onClick={() => setGridPage((p) => Math.max(1, p - 1))}
            >
              ← Anterior
            </button>
            <span className="text-[11px] font-mono text-mist" role="status">
              pág {safePage} de {gridTotalPages}
            </span>
            <button
              type="button"
              className="btn-ghost text-[11px]"
              disabled={safePage >= gridTotalPages}
              onClick={() => setGridPage((p) => Math.min(gridTotalPages, p + 1))}
            >
              Próxima →
            </button>
          </div>
        ) : null}
      </IddZone>
      ) : dashTab === "rankings" ? (
        <RankingsTab rank={rank} window={window} active={dashTab === "rankings"} />
      ) : (
        <BuildsTab rank={rank} window={window} active={dashTab === "builds"} />
      )}

      {/* Blocos do panorama (3, 4, 5, lote, picker): ocultos com a aba Builds ativa. */}
      {dashTab !== "builds" ? (<>
      {/* 3 · contador de inconclusivos por sensibilidade */}
      <IddZone zone="state" capId="CAP-CNF-02" className="card p-4 bg-panel border-line space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foam flex items-center gap-1.5">
            <Eye size={14} className="text-gold" /> Inconclusivos por sensibilidade
          </h3>
          <TrustSeal level="Inconclusivo" motive={`${inconclusivos.length} sem leitura · ${sensiveis.length} sensíveis à premissa c`} />
        </div>
        <p className="text-xs text-mist leading-relaxed">
          {inconclusivos.length} heróis sem leitura neste recorte
          {sensiveis.length ? ` · ${sensiveis.length} com veredito sensível à premissa c` : " · nenhum caso sensível à premissa c"}.
          Inconclusivo não é erro: é ausência de evidência suficiente.
        </p>
      </IddZone>

      {/* 4 · sinais persistentes (honesto sem histórico) */}
      <IddZone zone="data" capId="CAP-TMP-01" className="card p-4 bg-panel border-line space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foam flex items-center gap-1.5">
          <FlaskConical size={14} className="text-cyan-300" /> Sinais persistentes
        </h3>
        <p className="text-xs text-mist leading-relaxed">
          <b className="text-foam">Em investigação</b> — sinais iniciais recolhidos sem confirmação:
          persistência exige ao menos 2 snapshots não-sobrepostos, indisponíveis neste recorte.
          Nenhum rótulo de persistência é publicado aqui.
        </p>
      </IddZone>

      {/* 5 · Hidden Gem + inconclusivos (honesto) */}
      <IddZone zone="data" capId="CAP-DRF-01" className="card p-4 bg-panel border-line space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foam flex items-center gap-1.5">
          <Gem size={14} className="text-cyan-300" /> Hidden Gem + contingente inconclusivo
        </h3>
        {gemsQuery.isLoading ? (
          <Loading rows={2} />
        ) : gemsQuery.isError || !gems.length ? (
          <p className="text-xs text-mist leading-relaxed">
            <b className="text-foam">Em investigação</b> — nenhum candidato a Hidden Gem com persistência
            neste recorte. Candidatos isolados seguem sem rótulo, junto ao contingente de {inconclusivos.length} inconclusivos.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {gems.map((g) => (
              <li key={g.id}>
                <Link
                  to={`/hero/${g.id}?rank=${rank}&window=${window}`}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-abyss/60 border border-cyan-400/30 hover:border-cyan-300/60 transition-colors"
                  aria-label={`Abrir ficha de ${g.name} a partir do bloco Hidden Gem`}
                >
                  <Avatar src={g.head} name={g.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-foam truncate">{g.name}</span>
                    <span className="block text-[11px] text-mist truncate">{g.reason}</span>
                  </span>
                  <TierBadge tier={g.tier} />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!tiersQuery.isLoading && !tiersQuery.isError ? null : null}
      </IddZone>

      <SigmaBanCard
        sigmaBanSum={null}
        sigmaPickSum={sigmaPickSum}
        sigmaAlert={pickCheck ? !pickCheck.ok : false}
        pickFonte="appearance==pick"
        capId="CAP-EXP-01"
      />

      <IddZone zone="secondary" capId="CAP-SHR-01">
        <HeroPicker hero={hero || null} onPick={(id) => set("hero", id)} compact />
      </IddZone>
      </>
      ) : null}
    </section>
  );
}
