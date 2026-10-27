import { useEffect, useRef } from "react";
import { Link, NavLink, useSearchParams } from "react-router-dom";
import {
  Activity, ArrowUpRight, FlaskConical, Gem, Hammer, HeartPulse,
  LayoutDashboard, LayoutGrid, LineChart as LineIcon, Radar, Swords, Users, Wrench, X,
} from "lucide-react";
import { cx, num, pct, useHero, useHeroes, useMeta } from "../shared/api";
import HeroPicker from "../shared/ui/patterns/HeroPicker";
import { Avatar, FreshLine, TierBadge } from "../shared/ui";
import { SigmaBanCard } from "../shared/ui/patterns/SigmaBanCard";

const navTabClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    "relative flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 group w-full",
    isActive
      ? "bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent text-gold border border-gold/40 shadow-sm"
      : "text-mist hover:text-foam hover:bg-panel2/60 border border-transparent"
  );

/** 9 Bounded Contexts + Build Management: Builds e Gerir build ficam na Visão geral. */
const STREAMS = [
  {
    name: "Inferência & Força",
    badge: "M1 Engine",
    contexts: [
      { to: "/forca", label: "Força", id: "SHR", icon: <LayoutGrid size={13} />, subtitle: "Shrinkage M1" },
      { to: "/confianca", label: "Confiança", id: "CNF", icon: <Gem size={13} />, subtitle: "Trio & selos" },
      { to: "/ranks", label: "Ranks", id: "RNK", icon: <Activity size={13} />, subtitle: "Heterogeneidade" },
      { to: "/tempo", label: "Tempo", id: "TMP", icon: <LineIcon size={13} />, subtitle: "Patches" },
    ],
  },
  {
    name: "Inteligência de Draft",
    badge: "M6 & Tactical",
    contexts: [
      { to: "/confrontos", label: "Confrontos", id: "M6", icon: <Swords size={13} />, subtitle: "Matchups M6" },
      { to: "/draft", label: "Distorção", id: "DRF", icon: <Radar size={13} />, subtitle: "Pressão" },
      { to: "/blind", label: "Blind Pick", id: "BPS", icon: <FlaskConical size={13} />, subtitle: "Robustez p10" },
    ],
  },
  {
    name: "Governança",
    badge: "Auditoria",
    contexts: [
      { to: "/exposicao", label: "Exposição", id: "EXP", icon: <HeartPulse size={13} />, subtitle: "Denominador" },
    ],
  },
];

function MiniDossier({ heroId, rank, window }: { heroId: string; rank: string; window: string }) {
  const [sp, setSp] = useSearchParams();
  const heroQuery = useHero(heroId, rank, window);
  const h = heroQuery.data?.data;

  const clearHero = () => {
    sp.delete("hero");
    setSp(sp, { replace: true });
  };

  return (
    <div className="flex items-center gap-2.5 p-2 rounded-xl bg-abyss/60 border border-line" aria-label={`Herói em foco: ${h?.name ?? `Herói #${heroId}`}`}>
      <Avatar src={h?.head ?? null} name={h?.name ?? `Herói #${heroId}`} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-xs text-foam truncate">
            {heroQuery.isLoading ? "Carregando…" : (h?.name ?? `Herói #${heroId}`)}
          </span>
          {h && <TierBadge tier={h.tier} />}
        </div>
        {h ? (
          <p className="text-[11px] text-mist font-mono truncate">
            θ̂ <b className="num text-gold">{num(h.wrAdj, 3)}</b> · pick {pct(h.pick)} · ban {pct(h.ban)}
          </p>
        ) : heroQuery.isError ? (
          <p className="text-[11px] text-mist">sem dado neste recorte</p>
        ) : null}
      </div>
      <button
        onClick={clearHero}
        aria-label="Desmarcar herói e ver panorama geral"
        title="Desmarcar herói e ver panorama geral"
        className="p-1.5 rounded-lg text-mist hover:text-foam hover:bg-panel2 border border-transparent hover:border-line transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}

type PickCheck = { sum: number; ok: boolean };

function LotSeal({ rank, window }: { rank: string; window: string }) {
  // Seletor puro sobre o cache ["heroes",rank,window] + ["meta"]: sem useQuery nova.
  const heroesQuery = useHeroes(rank, window);
  const metaQuery = useMeta();
  const pickCheck = (heroesQuery.data as unknown as { pickSumCheck?: PickCheck } | undefined)?.pickSumCheck;
  const sigmaPickSum = typeof pickCheck?.sum === "number" ? pickCheck.sum : null;
  const ageMs = heroesQuery.data?.collectedAgoMs ?? (metaQuery.data as { collectedAgoMs?: number } | undefined)?.collectedAgoMs;

  return (
    <div className="space-y-2">
      <SigmaBanCard
        sigmaBanSum={null}
        sigmaPickSum={sigmaPickSum}
        sigmaAlert={pickCheck ? !pickCheck.ok : false}
        pickFonte="appearance==pick"
      />
      <FreshLine stale={heroesQuery.data?.stale} ageMs={ageMs} />
    </div>
  );
}

function SidebarBody({ getNavUrl, onNavigate }: { getNavUrl: (baseTo: string) => string; onNavigate: () => void }) {
  const [sp, setSp] = useSearchParams();
  const rank = sp.get("rank") ?? "mythic";
  const window = sp.get("window") ?? "7";
  const hero = sp.get("hero") ?? "";

  const pickHero = (id: string) => {
    if (!id) sp.delete("hero");
    else sp.set("hero", id);
    setSp(sp);
  };

  return (
    <div className="flex flex-col gap-4 p-3">
      {/* Entrada: Dashboard + Heróis + Builds */}
      <section aria-labelledby="sb-home" className="space-y-1">
        <h2 id="sb-home" className="text-[10px] uppercase font-bold tracking-wider text-mist/70 px-1">
          Visão geral
        </h2>
        <nav aria-label="Entrada do Radar">
          <ul className="space-y-0.5">
            <li>
              <NavLink
                to={getNavUrl("/dashboard")}
                onClick={onNavigate}
                className={navTabClass}
                title="Dashboard · panorama do meta"
                aria-label="Dashboard, panorama do meta"
              >
                <span className="text-current opacity-80 group-hover:opacity-100"><LayoutDashboard size={13} /></span>
                <span>Dashboard</span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-abyss/80 border border-line/60 text-mist group-hover:text-foam ml-auto">
                  T1
                </span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to={getNavUrl("/hero")}
                onClick={onNavigate}
                className={navTabClass}
                title="Heróis · lista de entrada"
                aria-label="Heróis, lista de entrada"
              >
                <span className="text-current opacity-80 group-hover:opacity-100"><Users size={13} /></span>
                <span>Heróis</span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-abyss/80 border border-line/60 text-mist group-hover:text-foam ml-auto">
                  T2
                </span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to={getNavUrl("/builds")}
                onClick={onNavigate}
                className={navTabClass}
                title="Builds · visão do sistema e por herói"
                aria-label="Builds, visão do sistema e por herói"
              >
                <span className="text-current opacity-80 group-hover:opacity-100"><Hammer size={13} /></span>
                <span>Builds</span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-abyss/80 border border-line/60 text-mist group-hover:text-foam ml-auto">
                  BDL
                </span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to={getNavUrl("/build")}
                onClick={onNavigate}
                className={navTabClass}
                title="Gerenciar build · núcleo, builds e slots do herói"
                aria-label="Gerenciar build, núcleo, builds e slots do herói"
              >
                <span className="text-current opacity-80 group-hover:opacity-100"><Wrench size={13} /></span>
                <span>Gerenciar build</span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-abyss/80 border border-line/60 text-mist group-hover:text-foam ml-auto">
                  BMS
                </span>
              </NavLink>
            </li>
          </ul>
        </nav>
      </section>

      {/* S0 · Herói em foco */}
      <section aria-labelledby="sb-s0" className="space-y-2">
        <h2 id="sb-s0" className="text-[10px] uppercase font-bold tracking-wider text-mist/70 px-1">
          Herói em foco
        </h2>
        <HeroPicker hero={hero || null} onPick={pickHero} compact />
        {hero && <MiniDossier heroId={hero} rank={rank} window={window} />}
      </section>

      {/* S1–S3 · Streams (8 contextos; Builds fica na Visão geral) */}
      <div className="space-y-2">
        {STREAMS.map((stream, si) => (
          <details key={stream.name} open className="rounded-2xl border border-line/60 bg-panel/40">
            <summary
              className="px-3 py-2 cursor-pointer list-none flex items-center justify-between gap-2"
              aria-label={`Stream ${stream.name}, ${stream.badge}`}
              title={stream.badge}
            >
              <span id={`sb-stream-${si}`} className="text-[10px] uppercase font-bold tracking-wider text-mist/80">
                {stream.name}
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-abyss/80 border border-line/60 text-mist">
                {stream.badge}
              </span>
            </summary>
            <nav aria-labelledby={`sb-stream-${si}`} className="px-2 pb-2">
              <ul className="space-y-0.5">
                {stream.contexts.map((t) => (
                  <li key={t.to}>
                    <NavLink
                      to={getNavUrl(t.to)}
                      onClick={onNavigate}
                      className={navTabClass}
                      title={`${t.label} · ${t.subtitle}`}
                      aria-label={`${t.label}, ${t.subtitle}`}
                    >
                      <span className="text-current opacity-80 group-hover:opacity-100">{t.icon}</span>
                      <span>{t.label}</span>
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-abyss/80 border border-line/60 text-mist group-hover:text-foam ml-auto">
                        {t.id}
                      </span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </details>
        ))}
      </div>

      {/* S4 · Ver herói em… (só se ?hero=) */}
      {hero && (
        <section aria-labelledby="sb-s4">
          <h2 id="sb-s4" className="sr-only">Ver herói no dossiê</h2>
          <Link
            to={getNavUrl(`/hero/${hero}`)}
            onClick={onNavigate}
            aria-label="Abrir dossiê do herói"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-gold/15 text-gold border border-gold/40 hover:bg-gold/25 transition-all"
          >
            <ArrowUpRight size={14} />
            <span>Ver herói no dossiê</span>
          </Link>
        </section>
      )}

      {/* S5 · Selo do lote (footer) */}
      <section aria-labelledby="sb-s5" className="border-t border-line/60 pt-3 space-y-2.5">
        <h2 id="sb-s5" className="text-[10px] uppercase font-bold tracking-wider text-mist/70 px-1 pb-2">
          Selo do lote
        </h2>
        <LotSeal rank={rank} window={window} />
        <NavLink
          to={getNavUrl("/exposicao")}
          onClick={onNavigate}
          className={navTabClass}
          title="Fonte e exposição · saúde do lote"
          aria-label="Fonte e exposição, saúde do lote"
        >
          <span className="text-current opacity-80 group-hover:opacity-100"><HeartPulse size={13} /></span>
          <span>Fonte / Exposição</span>
          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-abyss/80 border border-line/60 text-mist group-hover:text-foam ml-auto">
            EXP
          </span>
        </NavLink>
      </section>
    </div>
  );
}

export function Sidebar({
  open,
  onClose,
  getNavUrl,
}: {
  open: boolean;
  onClose: () => void;
  getNavUrl: (baseTo: string) => string;
}) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // sem fetch: trava o scroll do body enquanto o drawer está aberto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open ]);

  // sem fetch: move o foco para a busca (S0) ao abrir o drawer
  useEffect(() => {
    if (!open) return;
    drawerRef.current?.querySelector("input")?.focus();
  }, [open ]);

  // sem fetch: Escape fecha (qualquer foco dentro) + armadilha de Tab dentro do drawer
  const onDrawerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      document.getElementById("sidebar-hamburger")?.focus();
      return;
    }
    if (e.key !== "Tab" || !drawerRef.current) return;
    const items = Array.from(
      drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.getClientRects().length > 0);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && (active === first || !drawerRef.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      {/* Desktop: sidebar fixa */}
      <aside className="hidden lg:block w-[248px] xl:w-[272px] shrink-0 sticky top-24 self-start my-6 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-line/60 bg-surface/60">
        <nav aria-label="Contextos do Radar">
          <SidebarBody getNavUrl={getNavUrl} onNavigate={() => undefined} />
        </nav>
      </aside>

      {/* Mobile/tablet: drawer overlay */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar navegação"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-abyss/60 lg:hidden cursor-default"
          />
          <div
            ref={drawerRef}
            id="hero-sidebar"
            role="dialog"
            aria-modal="true"
            aria-label="Navegação e herói em foco"
            onKeyDown={onDrawerKeyDown}
            className="fixed inset-y-0 left-0 z-50 w-[min(320px,calc(100vw-48px))] min-w-[280px] overflow-y-auto bg-surface border-r border-line shadow-2xl lg:hidden motion-safe:transition-transform motion-safe:duration-200"
          >
            <div className="sticky top-0 flex items-center justify-between px-3 py-2 bg-surface/95 border-b border-line/60 backdrop-blur">
              <span className="text-xs font-bold text-foam">Navegação e herói em foco</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  document.getElementById("sidebar-hamburger")?.focus();
                }}
                aria-label="Fechar navegação e voltar ao cabeçalho"
                className="p-2 rounded-xl border border-line text-mist hover:text-foam hover:border-line-bright"
              >
                <X size={16} />
              </button>
            </div>
            <nav aria-label="Contextos do Radar">
              <SidebarBody getNavUrl={getNavUrl} onNavigate={onClose} />
            </nav>
          </div>
        </>
      )}
    </>
  );
}
