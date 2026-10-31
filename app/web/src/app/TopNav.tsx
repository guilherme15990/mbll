import { useRef } from "react";
import { NavLink } from "react-router-dom";
import { ChevronDown, Compass, FlaskConical, Hammer, LayoutDashboard, Swords, Users, Wrench } from "lucide-react";
import { cx } from "../shared/api";

/**
 * Menu horizontal do sistema (ADR-055): a navegação que antes vivia numa sidebar
 * agora é uma barra no topo, logo abaixo do cabeçalho. Cada aba preserva o
 * contexto global (elo/janela/rota/herói) via `getNavUrl`.
 *
 * Escopo: as cinco seções primárias (Dashboard, Heróis, Builds, Gerenciar build,
 * Draft management). Os contextos secundários de draft (Draft Score, Confrontos)
 * vivem num agrupador à direita da barra.
 */

/** Classe de cada aba. Horizontal: sem `w-full`, com `whitespace-nowrap`. */
const tabClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    "group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 border shrink-0",
    isActive
      ? "bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent text-gold border-gold/40 shadow-sm"
      : "text-mist hover:text-foam hover:bg-panel2/60 border-transparent",
  );

const badgeClass = "text-[9px] font-mono px-1 py-0.5 rounded bg-abyss/80 border border-line/60 text-mist group-hover:text-foam";

/** Contextos secundários de draft, agrupados no menu da direita. */
const DRAFT_CONTEXTS = [
  { to: "/draft-score", label: "Draft Score", id: "DSV", icon: <FlaskConical size={13} />, subtitle: "Teste da métrica (0–100)" },
  { to: "/confrontos", label: "Confrontos", id: "M6", icon: <Swords size={13} />, subtitle: "Matchups M6" },
];

export function TopNav({ getNavUrl }: { getNavUrl: (baseTo: string) => string }) {
  const groupRef = useRef<HTMLDetailsElement>(null);
  const closeGroup = () => {
    if (groupRef.current) groupRef.current.open = false;
  };

  return (
    <nav aria-label="Navegação do Radar" className="border-t border-line/60">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1.5 py-1.5">
        {/* Faixa rolável no mobile; o dropdown fica FORA dela para não ser cortado. */}
        <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 flex-1">
          <NavLink
            to={getNavUrl("/dashboard")}
            className={tabClass}
            title="Dashboard · panorama do meta"
            aria-label="Dashboard, panorama do meta"
          >
            <span className="opacity-80 group-hover:opacity-100"><LayoutDashboard size={13} /></span>
            <span>Dashboard</span>
            <span className={badgeClass}>T1</span>
          </NavLink>
          <NavLink
            to={getNavUrl("/hero")}
            className={tabClass}
            title="Heróis · lista de entrada"
            aria-label="Heróis, lista de entrada"
          >
            <span className="opacity-80 group-hover:opacity-100"><Users size={13} /></span>
            <span>Heróis</span>
            <span className={badgeClass}>T2</span>
          </NavLink>
          <NavLink
            to={getNavUrl("/builds")}
            className={tabClass}
            title="Builds · visão do sistema e por herói"
            aria-label="Builds, visão do sistema e por herói"
          >
            <span className="opacity-80 group-hover:opacity-100"><Hammer size={13} /></span>
            <span>Builds</span>
            <span className={badgeClass}>BDL</span>
          </NavLink>
          <NavLink
            to={getNavUrl("/build")}
            className={tabClass}
            title="Gerenciar build · núcleo, builds e slots do herói"
            aria-label="Gerenciar build, núcleo, builds e slots do herói"
          >
            <span className="opacity-80 group-hover:opacity-100"><Wrench size={13} /></span>
            <span>Gerenciar build</span>
            <span className={badgeClass}>BMS</span>
          </NavLink>
          <NavLink
            to={getNavUrl("/draft")}
            className={tabClass}
            title="Draft management · composição e poder"
            aria-label="Draft management, composição e poder"
          >
            <span className="opacity-80 group-hover:opacity-100"><Compass size={13} /></span>
            <span>Draft management</span>
            <span className={badgeClass}>DMP</span>
          </NavLink>
        </div>

        <details ref={groupRef} className="relative shrink-0">
          <summary
            className="list-none cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap text-mist hover:text-foam hover:bg-panel2/60 border border-transparent transition-all duration-200"
            title="Draft Score e Confrontos"
          >
            <span>Inteligência de Draft</span>
            <ChevronDown size={13} />
          </summary>
          <ul className="absolute right-0 mt-1 z-40 w-56 p-1 rounded-2xl border border-line/60 bg-surface shadow-2xl">
            {DRAFT_CONTEXTS.map((t) => (
              <li key={t.to}>
                <NavLink
                  to={getNavUrl(t.to)}
                  end
                  onClick={closeGroup}
                  className={tabClass}
                  title={`${t.label} · ${t.subtitle}`}
                  aria-label={`${t.label}, ${t.subtitle}`}
                >
                  <span className="opacity-80 group-hover:opacity-100">{t.icon}</span>
                  <span>{t.label}</span>
                  <span className={cx(badgeClass, "ml-auto")}>{t.id}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </nav>
  );
}
