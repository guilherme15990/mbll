import { NavLink } from "react-router-dom";
import { Compass, Hammer, LayoutDashboard, Users, Wrench } from "lucide-react";
import { cx } from "../shared/api";

/**
 * Menu horizontal do sistema (ADR-055): a navegação que antes vivia numa sidebar
 * agora é uma barra no topo, logo abaixo do cabeçalho. Cada aba preserva o
 * contexto global (elo/janela/rota/herói) via `getNavUrl`.
 *
 * Escopo: as cinco seções primárias (Dashboard, Heróis, Builds, Gerenciar build,
 * Draft management). O agrupador "Inteligência de Draft" (Draft Score, Confrontos)
 * saiu do menu (ADR-066); as rotas seguem existindo no router.
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

export function TopNav({ getNavUrl }: { getNavUrl: (baseTo: string) => string }) {
  return (
    <nav aria-label="Navegação do Radar" className="border-t border-line/60">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1.5 py-1.5">
        {/* Faixa rolável no mobile. */}
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
      </div>
    </nav>
  );
}
