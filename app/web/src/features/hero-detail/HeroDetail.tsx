import { useEffect, useRef, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Crosshair, Hammer, LayoutDashboard, Swords, TriangleAlert, UserSearch,
} from "lucide-react";
import { LANES, num, pct, useBlind, useBuilds, useCatalog, useDistortion, useHero, useHeroLanes } from "../../shared/api";
import { BUILD_TAG_CLASS } from "../../shared/domain/buildLabel";
import { PickVerdictText } from "../../shared/ui/patterns/PickVerdict";
import BuildLoadout from "../../shared/ui/patterns/BuildLoadout";
import { getBuildTags, getDraftPatterns } from "@radar/proprietary-engine";
import { classifyBlindPick, classifyFirstPick } from "@radar/proprietary-engine";
import { NeedsLane, NeedsRank } from "../../shared/ui/patterns/NeedsRankLane";
import {
  Avatar, Empty, ErrBox, TierBadge,
} from "../../shared/ui";
import { selectTopBuildsByLift } from "@radar/proprietary-engine";
import ConfrontosSection from "./sections/ConfrontosSection";
import ConfrontosPreview from "./sections/ConfrontosPreview";
import DraftSection from "./sections/DraftSection";
import BuildsSection from "./sections/BuildsSection";

type HeroContextId = "M6" | "DRF" | "BPS" | "BDL";

/**
 * Ordem de decisão: home → confrontos → draft (picks + pressão) → builds.
 * Cada aba tem um Contexto de Interface fixo, repetido em toda a ficha.
 */
const HERO_TABS: { slug: string; label: string; contextId: HeroContextId; icon: ReactNode }[] = [
  { slug: "home", label: "Visão geral", contextId: "M6", icon: <LayoutDashboard size={13} aria-hidden="true" /> },
  { slug: "confrontos", label: "Confrontos", contextId: "M6", icon: <Swords size={13} aria-hidden="true" /> },
  { slug: "draft", label: "Draft", contextId: "DRF", icon: <Crosshair size={13} aria-hidden="true" /> },
  { slug: "builds", label: "Builds", contextId: "BDL", icon: <Hammer size={13} aria-hidden="true" /> },
];

const TAB_SLUGS = HERO_TABS.map((t) => t.slug);

/** Frase interpretativa e L3 curta em `@radar/proprietary-engine` (fonte única). */

/** Seção de builds de UMA lane: hook próprio (nº de lanes varia por herói). Mesma key da aba Builds → cache hit. */
function LaneBuilds({ hero, rank, lane, heroName, to }: { hero: string; rank: string; lane: string; heroName: string; to: string }) {
  const q = useBuilds(hero || null, rank, lane);
  // Top-3 por lift em `@radar/proprietary-engine` (selectTopBuildsByLift).
  const top = selectTopBuildsByLift([...(q.data?.data ?? [])], 3);
  const refWin = q.data?.references?.mostUsed?.win;
  return (
    <Link
      to={to}
      aria-label={`Abrir Builds de ${heroName} na lane ${lane}`}
      className="block rounded-2xl border border-line bg-panel p-4 hover:border-gold/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-foam">Builds · {lane}</p>
          <p className="text-[11px] text-mist">
            Top {top.length || 3} por lift · referência {pct(refWin)}
          </p>
        </div>
        <span className="text-[11px] text-gold font-bold" aria-hidden="true">ver na aba →</span>
      </div>

      {q.isLoading ? (
        <p className="text-[11px] text-mist mt-3" role="status">carregando builds…</p>
      ) : q.isError || !top.length ? (
        <div className="mt-3" onClick={(e) => e.preventDefault()}>
          <ErrBox onRetry={() => q.refetch()} />
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {top.map((b, i) => {
            const lift = b.lift_vs_most_used;
            const liftOk = lift != null && Number.isFinite(lift);
            return (
              <div key={i} className="rounded-xl border border-line bg-abyss/30 p-3 space-y-2.5">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="grid h-6 w-6 place-items-center rounded-md border border-line bg-panel2 text-[10px] font-bold text-mist">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[10px] text-mist">Win</p>
                      <p className="num text-lg font-bold text-foam leading-none">{pct(b.win)}</p>
                    </div>
                    <div className="pl-3 border-l border-line">
                      <p className="text-[10px] text-mist">Lift</p>
                      <p
                        className={`num text-xs font-bold ${
                          !liftOk ? "text-mist" : (lift as number) >= 0 ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        {liftOk ? `${(lift as number) >= 0 ? "+" : ""}${num(lift, 4)}` : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {getBuildTags(b).map((t) => (
                      <span
                        key={t.key}
                        title={t.title}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-block ${BUILD_TAG_CLASS[t.tone]}`}
                      >
                        {t.label}
                      </span>
                    ))}
                    <span className="text-[10px] text-mist font-mono">pick {pct(b.pick, 2)}</span>
                  </div>
                </div>
                <BuildLoadout build={b} />
              </div>
            );
          })}
        </div>
      )}
    </Link>
  );
}

/** Métrica compacta do card de identidade — metadata junto da identidade, sem seção separada. */
function HeroMetric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-mist">{label}</dt>
      <dd className="font-mono tabular-nums text-sm font-bold text-foam leading-tight truncate">{value}</dd>
      {hint ? <dd className="text-[10px] text-mist/60 leading-tight truncate">{hint}</dd> : null}
    </div>
  );
}

/**
 * Ficha isolada /hero/:id — responsabilidade única: listar os detalhes do herói.
 * Identidade + métricas vivem no MESMO card (sem banner de veredito separado).
 * Home = mesmos hooks/keys das abas (cache hit, custo marginal 0 ao navegar).
 * Sem ?tab= (ou inválida) cai na home, sem redirect. `tab` fora da chave de cache.
 */
export default function HeroDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);

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

  const onTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (idx + 1) % HERO_TABS.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + HERO_TABS.length) % HERO_TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = HERO_TABS.length - 1;
    if (next != null) {
      e.preventDefault();
      tabRefs.current[next]?.focus();
    }
  };

  const shortcutHeroes = (() => {
    if (!catalogMap) return [];
    const all = Object.entries(catalogMap).map(([id, entry]) => ({ id, ...entry }));
    return ["yve", "aulus", "franco"]
      .map((n) => all.find((x) => x.name.toLowerCase().includes(n)))
      .filter((x): x is { id: string; name: string; head: string | null } => Boolean(x))
      .slice(0, 3);
  })();

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
          <div className="rounded-2xl border border-line bg-panel p-4 md:p-5">
            <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
              <Avatar src={heroHead} name={heroName} size={64} />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-[22px] md:text-[28px] leading-tight font-extrabold tracking-tight text-foam font-sans">
                  {heroName}
                </p>
                {h ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <TierBadge tier={h.tier} />
                  </div>
                ) : (
                  <div className="flex items-center gap-2" role="status" aria-label="carregando selos do herói">
                    <span className="h-6 w-14 rounded-full bg-panel2/60 animate-pulse motion-reduce:animate-none" />
                    <span className="h-6 w-20 rounded-full bg-panel2/60 animate-pulse motion-reduce:animate-none" />
                    <span className="h-6 w-24 rounded-full bg-panel2/60 animate-pulse motion-reduce:animate-none" />
                  </div>
                )}
              </div>

              {lanes.length > 0 && (
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
              )}
            </div>

            {/* Métricas do herói no MESMO card — sem seção/banner separado. */}
            {h ? (
              <>
                <dl className="mt-4 pt-3 border-t border-line grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-2">
                  <HeroMetric label="Força θ̂" value={num(h.wrAdj, 3)} hint="ajustada" />
                  <HeroMetric label="WR obs" value={num(h.win, 3)} hint={`janela ${window}d`} />
                  <HeroMetric label="Pick" value={pct(h.pick)} hint="slot share" />
                  <HeroMetric label="Ban" value={pct(h.ban)} hint="fração" />
                  <HeroMetric label="Shrinkage B" value={num(h.B, 2)} hint="peso do dado" />
                </dl>
                <div className="mt-2 flex items-start justify-between gap-2 flex-wrap">
                  {escasso && (
                    <p className="text-[11px] text-amber-200 flex items-center gap-1.5 flex-wrap">
                      <TriangleAlert size={12} aria-hidden="true" />
                      Amostra escassa — número puxado à média.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-4 pt-3 border-t border-line grid grid-cols-2 sm:grid-cols-5 gap-2" role="status" aria-label="carregando métricas do herói">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className="h-9 rounded-lg bg-panel2/50 animate-pulse motion-reduce:animate-none" />
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Tablist das 4 abas + home (roving tabindex preservado) */}
        <div
          role="tablist"
          aria-label="Seções da ficha do herói"
          className="flex items-center gap-1 overflow-x-auto bg-surface/80 p-1 rounded-2xl border border-line/80 shadow-sm"
        >
          {HERO_TABS.map((t, idx) => {
            const selected = hero !== "" && t.slug === activeSlug;
            if (!hero || !heroValid) {
              return (
                <span
                  key={t.slug}
                  role="tab"
                  aria-selected="false"
                  aria-disabled="true"
                  tabIndex={0}
                  title="selecione um herói acima"
                  aria-label={`${t.label} — selecione um herói acima`}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-mist/50 border border-transparent whitespace-nowrap cursor-not-allowed inline-flex items-center gap-1.5"
                >
                  {t.icon}
                  {t.label}
                </span>
              );
            }
            return (
              <Link
                key={t.slug}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                role="tab"
                aria-selected={selected}
                aria-controls="hero-tabpanel"
                tabIndex={selected ? 0 : -1}
                to={tabUrl(t.slug)}
                onKeyDown={(e) => onTabKeyDown(e, idx)}
                aria-label={`Aba ${t.label} da ficha do herói`}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap min-h-[44px] inline-flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:outline-none ${
                  selected
                    ? "bg-gold text-abyss font-bold shadow-sm"
                    : "text-mist hover:text-foam hover:bg-panel2/60 border border-transparent"
                }`}
              >
                {t.icon}
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Conteúdo: home-capa (veredito executivo) ou 1 aba de detalhe */}
      {!hero || !heroValid ? (
        <div className="space-y-4">
          <Empty
            title="Escolha um herói para abrir a ficha"
            hint="nada foi buscado — detalhe exige herói válido. Selecione acima ou use um atalho."
          />
          {shortcutHeroes.length > 0 && (
            <div className="card p-4 border-line bg-panel2/30 space-y-3">
              <p className="text-xs font-bold text-foam flex items-center gap-2">
                <UserSearch size={14} className="text-gold" aria-hidden="true" /> Atalhos para abrir a ficha:
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {shortcutHeroes.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => pickHero(s.id)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-abyss/60 hover:bg-panel2 border border-line hover:border-gold/40 text-xs text-mist hover:text-gold transition-colors min-h-[44px]"
                    aria-label={`Abrir ficha de ${s.name}`}
                  >
                    <Avatar src={s.head} name={s.name} size={24} />
                    <span className="font-semibold">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
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
