import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { LANES, useBlind, useCatalog, useDistortion, useHero, useHeroLanes } from "../../shared/api";
import { PickVerdictText } from "../../shared/ui/patterns/PickVerdict";
import { getDraftPatterns } from "@radar/engine";
import { classifyBlindPick, classifyFirstPick } from "@radar/engine";
import { NeedsLane, NeedsRank } from "../../shared/ui/patterns/NeedsRankLane";
import { ErrBox } from "../../shared/ui";
import { HeroDataCard } from "../../shared/ui/patterns/HeroDataCard";
import ConfrontosSection from "./sections/ConfrontosSection";
import ConfrontosPreview from "./sections/ConfrontosPreview";
import DraftSection from "./sections/DraftSection";
import BuildsSection from "./sections/BuildsSection";
import HeroTabs, { HERO_TABS, TAB_SLUGS } from "./HeroTabs";
import LaneBuilds from "./sections/LaneBuilds";
import HeroEmptyState from "./HeroEmptyState";

/**
 * Ficha isolada /hero/:id — responsabilidade única: listar os detalhes do herói.
 * Identidade + métricas vivem no MESMO card (sem banner de veredito separado).
 * Home = mesmos hooks/keys das abas (cache hit, custo marginal 0 ao navegar).
 * Sem ?tab= (ou inválida) cai na home, sem redirect. `tab` fora da chave de cache.
 *
 * O tablist vive em `HeroTabs.tsx`, o vazio orientado em `HeroEmptyState.tsx` e
 * a seção de builds por lane em `sections/LaneBuilds.tsx` (ADR-041: teto de 300
 * linhas). Aqui ficam as derivações do herói e a montagem das faixas da home.
 */
export default function HeroDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();

  const rank = sp.get("rank") ?? "mythic";
  const window = sp.get("window") ?? "7";
  // Identidade vem do path (:id); ?hero= só como fallback (aliases /heroi, /hero/detalhes).
  const hero = params.id ?? sp.get("hero") ?? "";
  const rawTab = sp.get("tab");
  // Compat: links antigos ?tab=blind e ?tab=picks caem na aba Draft fundida.
  const normalizedTab = rawTab === "blind" || rawTab === "picks" ? "draft" : rawTab;

  const activeSlug = normalizedTab && TAB_SLUGS.includes(normalizedTab) ? normalizedTab : "home";
  const activeTab = HERO_TABS.find((t) => t.slug === activeSlug) ?? HERO_TABS[0];

  const pickHero = (id: string) => {
    if (!id) {
      navigate(`/hero?rank=${rank}&window=${window}`);
      return;
    }
    // Troca de herói = navega para a ficha isolada (preserva rank/janela).
    navigate(`/hero/${id}?rank=${rank}&window=${window}`);
  };

  // Herói fora do catálogo: vazio orientado, 0 buscas de detalhe (nada monta sem herói válido).
  const catalog = useCatalog();
  const catalogMap = catalog.data?.data;
  const catalogReady = !catalog.isLoading && catalogMap != null;
  const heroValid = !hero || !catalogReady || Boolean(catalogMap?.[hero]);

  const heroQuery = useHero(heroValid ? hero || null : null, rank, window);
  const lanesQuery = useHeroLanes(rank);
  // Home rica: mesmos hooks/keys das abas (cache hit, custo marginal 0 ao navegar).
  const homeOn = activeSlug === "home" && heroValid && hero !== "";
  const laneParam = sp.get("lane");
  const days = sp.get("days") ?? window;
  const validHomeLane =
    laneParam != null && (LANES as readonly string[]).includes(laneParam);
  const bQuery = useBlind(homeOn && rank !== "all" ? hero || null : null, rank, days);
  // Pressão entra na home para o card Draft listar a operação completa (picks + pressão).
  const dQuery = useDistortion(homeOn && rank !== "all" ? hero || null : null, rank, window);

  const h = heroQuery.data?.data;
  const lanes: string[] = (hero && lanesQuery.data?.data?.[hero]) || [];
  // Cada lane do herói é uma seção de builds; a lane da URL abre primeiro.
  const homeLanes = validHomeLane && !lanes.includes(laneParam as string)
    ? [laneParam as string, ...lanes]
    : validHomeLane
      ? [laneParam as string, ...lanes.filter((l) => l !== laneParam)]
      : lanes;
  const catEntry = hero && catalogMap ? catalogMap[hero] : undefined;
  const heroName = h?.name ?? catEntry?.name ?? (hero ? `Herói #${hero}` : "—");
  const heroHead = h?.head ?? catEntry?.head ?? null;
  const escasso = h != null && (h.smallSample || h.degenerate || (h.B ?? 1) < 0.25);
  // Rotas do próprio herói passadas adiante: sem ?lane=, a primeira rota mapeada
  // assume (visível e trocável) — vale para a home e viaja para a aba Builds.
  useEffect(() => {
    if (sp.get("lane") == null && lanesQuery.isSuccess && lanes.length > 0) {
      const next = new URLSearchParams(sp);
      next.set("lane", lanes[0]);
      setSp(next, { replace: true });
    }
  }, [sp, setSp, lanesQuery.isSuccess, lanes]);
  // Selo blind + top builds (ordenação client por lift, corte 3, refs obrigatórias).
  const blindData = bQuery.data as unknown as {
    classification_status?: string; robustness_status?: string;
    worst_observed?: number; worst_counter?: { name?: string; delta?: number | null } | null;
    adverse_p10?: number | null; n_pairs?: number; pair_coverage?: string;
  } | undefined;
  // Dois vereditos independentes (fonte única no motor): blind pick x first pick.
  const blindVerdict = classifyBlindPick({ blind: blindData });
  const firstVerdict = classifyFirstPick({ hero: h, blind: blindData, baseline: heroQuery.data?.meta?.mu });
  // Pressão de draft no card da home — mesmo hook/key da aba Draft (cache hit).
  const distData = dQuery.data as unknown as { strength_class?: string; pick?: { residual?: number } | null; ban?: { residual?: number } | null } | undefined;
  const homePattern = dQuery.isError || !distData ? undefined : getDraftPatterns(distData).find((p) => p.ativo);
  const pressureLabel = dQuery.isLoading ? "…" : dQuery.isError || !distData ? "Sem dado" : homePattern ? homePattern.caso : "Alinhada";
  const pressureTone = dQuery.isError || !distData ? "text-mist" : homePattern ? "text-amber-300" : "text-emerald-300";
  const tabUrl = (slug: string, laneOverride?: string) => {
    const p = new URLSearchParams();
    p.set("rank", rank);
    p.set("window", window);
    for (const k of ["a", "b", "lane", "days"]) {
      const v = sp.get(k);
      if (v != null) p.set(k, v);
    }
    if (laneOverride) p.set("lane", laneOverride);
    p.set("tab", slug);
    return `/hero/${hero}?${p.toString()}`;
  };

  return (
    <section className="space-y-5" aria-label="Ficha do herói">
      {hero && !heroValid && catalogReady && (
        <div className="card p-3.5 border-amber-300/40 bg-amber-400/5 text-xs text-foam" role="status">
          Herói #{hero} fora do catálogo — escolha abaixo.
        </div>
      )}

      <div className="space-y-2">
        {/* CARD DO HERÓI — identidade fixa no topo, vale para todas as abas.
            Nome/avatar vêm do catálogo (sem esperar useHero); selos entram quando o dado chega. */}
        {hero && heroValid ? (
          <HeroDataCard
            name={heroName}
            head={heroHead}
            tier={h?.tier ?? null}
            metrics={h ?? null}
            window={window}
            loading={!h}
            scarce={escasso}
            aside={
              lanes.length > 0 ? (
                <div
                  role="group"
                  aria-label="Lanes do herói"
                  className="w-full md:w-auto md:pl-4 md:border-l md:border-line space-y-1.5"
                >
                  <p className="text-[11px] text-mist">{lanes.length > 1 ? `${lanes.length} lanes` : "Lane"}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {lanes.map((l) => (
                      <Link
                        key={l}
                        to={tabUrl("builds", l)}
                        aria-label={`Abrir builds de ${heroName} na lane ${l}`}
                        className="text-[11px] font-bold uppercase px-2.5 rounded-lg border border-line bg-abyss/60 text-mist hover:text-foam hover:border-gold/40 transition-colors min-h-[44px] md:min-h-[32px] inline-flex items-center focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:outline-none"
                      >
                        {l}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null
            }
          />
        ) : null}

        {/* Tablist das 4 abas + home (roving tabindex preservado) */}
        <HeroTabs hero={hero} heroValid={heroValid} activeSlug={activeSlug} tabUrl={tabUrl} />
      </div>

      {/* Conteúdo: home-capa (veredito executivo) ou 1 aba de detalhe */}
      {!hero || !heroValid ? (
        <HeroEmptyState catalogMap={catalogMap} onPickHero={pickHero} />
      ) : activeSlug === "home" ? (
        <div id="hero-tabpanel" role="tabpanel" aria-label="Visão geral da ficha do herói" className="space-y-4 animate-fadeIn motion-reduce:animate-none">
          <div id="prova-home" className="space-y-3 scroll-mt-4">
            {/* FAIXA 1 — CONFRONTOS (prévia: pior contra + melhor com) */}
            <ConfrontosPreview
              heroId={hero}
              heroName={heroName}
              rank={rank}
              window={window}
              to={tabUrl("confrontos")}
              onPickRank={(r) => {
                const next = new URLSearchParams(sp);
                next.set("rank", r);
                setSp(next);
              }}
            />

            {/* FAIXA 2 — DRAFT (fundida): blind pick + first pick + pressão na aba */}
            <Link
              to={tabUrl("draft")}
              aria-label={`Abrir Draft de ${heroName}`}
              className="block rounded-2xl border border-line bg-panel p-3.5 hover:border-gold/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs font-bold uppercase tracking-wider text-foam">
                  Draft <span className="text-mist font-normal normal-case tracking-normal">· blind, first pick e pressão</span>
                </p>
                <span className="text-[11px] text-gold font-bold" aria-hidden="true">ver na aba →</span>
              </div>
              {rank === "all" ? (
                <div className="mt-1.5" onClick={(e) => e.preventDefault()}>
                  <NeedsRank onPick={(r) => { sp.set("rank", r); setSp(sp); }} />
                </div>
              ) : bQuery.isLoading ? (
                <p className="text-[11px] text-mist mt-1.5" role="status">avaliando blind e first pick…</p>
              ) : bQuery.isError || !blindData ? (
                <div className="mt-1.5" onClick={(e) => e.preventDefault()}><ErrBox onRetry={() => bQuery.refetch()} /></div>
              ) : (
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-abyss/60 border border-line p-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-foam">Blind pick</span>
                    </div>
                    <PickVerdictText verdict={blindVerdict} />
                    <p className="text-[10px] text-mist">sem ver o inimigo</p>
                  </div>
                  <div className="rounded-xl bg-abyss/60 border border-line p-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-foam">First pick</span>
                    </div>
                    <PickVerdictText verdict={firstVerdict} />
                    <p className="text-[10px] text-mist">trava primeiro</p>
                  </div>
                  <div className="rounded-xl bg-abyss/60 border border-line p-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-foam">Pressão</span>
                    </div>
                    <p className={`text-sm font-bold ${pressureTone}`}>{pressureLabel}</p>
                    <p className="text-[10px] text-mist">{dQuery.isError || !distData ? "indisponível neste recorte" : homePattern ? "padrão operacional ativo" : "pick e ban vs força"}</p>
                  </div>
                </div>
              )}
            </Link>

            {/* FAIXA 3 — BUILDS: uma seção por lane do herói */}
            {homeLanes.length === 0 ? (
              <div className="rounded-2xl border border-line bg-panel p-3.5 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-foam">Builds</p>
                <p className="text-[13px] text-foam font-sans">Escolha a lane — sem lane, sem lift.</p>
                <NeedsLane onPick={(l) => { const n = new URLSearchParams(sp); n.set("lane", l); setSp(n); }} />
              </div>
            ) : (
              homeLanes.map((l) => (
                <LaneBuilds key={l} hero={hero} rank={rank} lane={l} heroName={heroName} to={tabUrl("builds", l)} />
              ))
            )}
          </div>
        </div>
      ) : (
        <div id="hero-tabpanel" role="tabpanel" aria-label={`Painel ${activeTab.label} da ficha do herói`} className="animate-fadeIn motion-reduce:animate-none">
          {activeSlug === "confrontos" && <ConfrontosSection heroId={hero} rank={rank} window={window} />}
          {activeSlug === "draft" && <DraftSection heroId={hero} rank={rank} window={window} hero={h} meta={heroQuery.data?.meta} />}
          {activeSlug === "builds" && <BuildsSection heroId={hero} rank={rank} window={window} />}
        </div>
      )}
    </section>
  );
}
