import { useLocation } from "react-router-dom";
import { Radar } from "lucide-react";
import { TopNav } from "./app/TopNav";
import { HeroFocus } from "./app/HeroFocus";
import { filtersQuery, useFilters } from "./app/filters";
import { LANES } from "./shared/api/queries/filters";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { AppRoutes } from "./app/router";

function AppContent() {
  const { rank, window, hero, lanes, set, toggleLane, setLanes } = useFilters();
  const location = useLocation();

  const getNavUrl = (baseTo: string) => `${baseTo}?${filtersQuery({ rank, window, hero, lanes })}`;

  return (
    <div className="min-h-screen bg-abyss flex flex-col font-sans selection:bg-gold/30 selection:text-gold-light">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-surface/90 border-b border-line shadow-lg">
        {/* Row 1: Brand, Status, Global Controls & Herói em foco */}
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap">
          {/* Brand & System Status */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-700/10 border border-gold/40 text-gold shadow-glow">
              <Radar size={19} className="animate-spin-slow" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-abyss" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm md:text-base tracking-tight text-foam">
                  Radar <span className="gradient-text font-black">MLBB</span>
                </h1>
              </div>
              <p className="text-[11px] text-mist flex items-center gap-1.5 font-medium">
                <span>Panorama competitivo</span>
                <span className="text-mist/40">·</span>
                <span className="text-emerald-400/90 font-mono text-[10px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  API Operacional
                </span>
              </p>
            </div>
          </div>

          {/* Cápsula de contexto global: elo, janela e rotas (multi-seleção) +
              Herói em foco. Rota vive aqui (não na página) para o contexto
              sobreviver à navegação e ficar ao lado dos outros filtros globais. */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-panel/90 border border-line p-1 rounded-2xl shadow-inner flex-wrap">
              <div className="flex items-center gap-1 px-2 text-xs text-mist">
                <span className="text-[10px] uppercase font-bold tracking-wider text-mist/70">Elo</span>
                <select
                  className="bg-transparent font-bold text-foam text-xs cursor-pointer focus:outline-none hover:text-gold transition-colors"
                  value={rank}
                  onChange={(e) => set("rank", e.target.value)}
                >
                  {["all", "epic", "legend", "mythic", "honor", "glory"].map((r) => (
                    <option key={r} value={r} className="bg-panel text-foam">
                      {r.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="h-4 w-px bg-line" />

              <div className="flex items-center gap-1 px-2 text-xs text-mist">
                <span className="text-[10px] uppercase font-bold tracking-wider text-mist/70">Janela</span>
                <select
                  className="bg-transparent font-bold text-foam text-xs cursor-pointer focus:outline-none hover:text-gold transition-colors font-mono"
                  value={window}
                  onChange={(e) => set("window", e.target.value)}
                >
                  {["1", "3", "7", "15", "30"].map((w) => (
                    <option key={w} value={w} className="bg-panel text-foam">
                      {w} dias
                    </option>
                  ))}
                </select>
              </div>

              <div className="h-4 w-px bg-line" />

              <div
                className="flex items-center gap-1 px-1 flex-wrap"
                role="group"
                aria-label="Rota (filtro global, múltipla)"
                title="Filtro global de rota: vale para a grade de heróis (Visão geral e Heróis). Vazio = todas."
              >
                <span className="text-[10px] uppercase font-bold tracking-wider text-mist/70">Rota</span>
                <button
                  type="button"
                  aria-pressed={lanes.length === 0}
                  onClick={() => setLanes([])}
                  className={lanes.length === 0
                    ? "px-1.5 py-0.5 rounded-md text-[10px] font-mono border border-gold/60 text-gold bg-gold/10"
                    : "px-1.5 py-0.5 rounded-md text-[10px] font-mono border border-line text-mist/80 hover:border-gold/40 hover:text-foam transition-colors"}
                >
                  todas
                </button>
                {(LANES as readonly string[]).map((l) => {
                  const on = lanes.includes(l);
                  return (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleLane(l)}
                      className={on
                        ? "px-1.5 py-0.5 rounded-md text-[10px] font-mono border border-gold/60 text-gold bg-gold/10"
                        : "px-1.5 py-0.5 rounded-md text-[10px] font-mono border border-line text-mist/80 hover:border-gold/40 hover:text-foam transition-colors"}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>

            <HeroFocus />
          </div>
        </div>

        {/* Row 2: menu horizontal do sistema (substitui a antiga sidebar). */}
        <TopNav getNavUrl={getNavUrl} />
      </header>

      {/* Main: largura cheia (a sidebar saiu do shell). */}
      <div className="w-full max-w-7xl mx-auto px-4 flex-1">
        <main className="min-w-0 py-6 flex flex-col gap-6">
          {/* key = pathname: navegar para outra rota limpa o erro da anterior. */}
          <ErrorBoundary key={location.pathname}>
            <AppRoutes rank={rank} window={window} lanes={lanes} />
          </ErrorBoundary>
        </main>
      </div>

      {/* Enterprise SaaS Footer */}
      <footer className="border-t border-line/80 bg-surface/60 backdrop-blur-md py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-4 flex-wrap text-xs text-mist">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gold" />
            <span className="font-medium text-foam">Radar de Balanceamento MLBB</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono text-mist/70">
            <span>Rone Arena API</span>
            <span>·</span>
            <span>v1.0 Produção</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
