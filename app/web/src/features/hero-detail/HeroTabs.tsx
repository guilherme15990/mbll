import { useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Crosshair, Hammer, LayoutDashboard, Swords } from "lucide-react";

/**
 * Tablist da ficha do herói (4 abas + home) com roving tabindex.
 *
 * Cada aba tem um Contexto de Interface fixo (`contextId`). O `tabUrl` é
 * injetado porque a URL preserva rank/janela/lane/days — o componente só
 * monta o link. Extraído de `HeroDetail.tsx` (ADR-041: teto de 300 linhas).
 */
export type HeroContextId = "M6" | "DRF" | "BPS" | "BDL";

/**
 * Ordem de decisão: home → confrontos → draft (picks + pressão) → builds.
 * Cada aba tem um Contexto de Interface fixo, repetido em toda a ficha.
 */
export const HERO_TABS: { slug: string; label: string; contextId: HeroContextId; icon: ReactNode }[] = [
  { slug: "home", label: "Visão geral", contextId: "M6", icon: <LayoutDashboard size={13} aria-hidden="true" /> },
  { slug: "confrontos", label: "Confrontos", contextId: "M6", icon: <Swords size={13} aria-hidden="true" /> },
  { slug: "draft", label: "Draft", contextId: "DRF", icon: <Crosshair size={13} aria-hidden="true" /> },
  { slug: "builds", label: "Builds", contextId: "BDL", icon: <Hammer size={13} aria-hidden="true" /> },
];

export const TAB_SLUGS = HERO_TABS.map((t) => t.slug);

export default function HeroTabs({
  hero,
  heroValid,
  activeSlug,
  tabUrl,
}: {
  hero: string;
  heroValid: boolean;
  activeSlug: string;
  tabUrl: (slug: string) => string;
}) {
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);

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

  return (
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
  );
}
