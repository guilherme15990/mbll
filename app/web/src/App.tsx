import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Compass, Eye, Menu, Radar } from "lucide-react";
import { IddProvider, useIdd } from "./shared/idd";
import { IddModal } from "./shared/idd/IddModal";
import { Sidebar } from "./app/Sidebar";
import { filtersQuery, useFilters } from "./app/filters";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { AppRoutes } from "./app/router";

function AppContent() {
  const { rank, window, hero, set } = useFilters();
  const location = useLocation();
  const [isIddOpen, setIsIddOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { inspectorEnabled, toggleInspector } = useIdd();

  const getNavUrl = (baseTo: string) => `${baseTo}?${filtersQuery({ rank, window, hero })}`;

  return (
    <div className="min-h-screen bg-abyss flex flex-col font-sans selection:bg-gold/30 selection:text-gold-light">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-surface/90 border-b border-line shadow-lg">
        {/* Row 1: Hamburger, Brand, Status, Global Controls & Actions */}
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap">
          {/* Hamburger (drawer <1024) + Brand & System Status */}
          <div className="flex items-center gap-3">
            <button
              id="sidebar-hamburger"
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-expanded={sidebarOpen}
              aria-controls="hero-sidebar"
              aria-label={sidebarOpen ? "Fechar navegação" : "Abrir navegação"}
              className="lg:hidden p-2 rounded-xl border border-line text-mist hover:text-foam hover:border-line-bright transition-colors"
            >
              <Menu size={18} />
            </button>
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-700/10 border border-gold/40 text-gold shadow-glow">
              <Radar size={19} className="animate-spin-slow" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-abyss" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm md:text-base tracking-tight text-foam">
                  Radar <span className="gradient-text font-black">MLBB</span>
                </h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/40">
                  IDD Platform
                </span>
              </div>
              <p className="text-[11px] text-mist flex items-center gap-1.5 font-medium">
                <span>Interface Domain Design · 9 Contextos</span>
                <span className="text-mist/40">·</span>
                <span className="text-emerald-400/90 font-mono text-[10px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  API Operacional
                </span>
              </p>
            </div>
          </div>

          {/* Global Filter Capsule & IDD Triggers */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Global Context Capsule */}
            <div className="flex items-center gap-2 bg-panel/90 border border-line p-1 rounded-2xl shadow-inner">
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
            </div>

            {/* Quick Live IDD Inspector Toggle */}
            <button
              onClick={toggleInspector}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                inspectorEnabled
                  ? "bg-emerald-500/15 border-emerald-400 text-emerald-300 shadow-sm"
                  : "bg-panel2/60 border-line hover:border-line-bright text-mist hover:text-foam"
              }`}
              title="Alterna o inspetor visual das 6 Zonas IDD e etiquetas de capacidade na tela"
            >
              <Eye size={13} className={inspectorEnabled ? "text-emerald-400 animate-pulse" : ""} />
              <span className="hidden sm:inline">Zonas IDD</span>
            </button>

            {/* Interface Domain Designer (IDD) Modal Button */}
            <button
              onClick={() => setIsIddOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500/15 to-amber-600/10 hover:from-amber-500/25 hover:to-amber-600/20 border border-gold/50 text-gold-light hover:text-gold transition-all shadow-sm active:scale-[0.98]"
            >
              <Compass size={14} className="text-gold" />
              <span>Interface Domain Designer (IDD)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Shell: sidebar fixa/drawer + main */}
      <div className="w-full max-w-7xl mx-auto px-4 flex gap-6 items-start flex-1">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} getNavUrl={getNavUrl} onOpenIdd={() => setIsIddOpen(true)} />
        {/* Main App Container */}
        <main className="flex-1 min-w-0 py-6 flex flex-col gap-6">
          {/* key = pathname: navegar para outra rota limpa o erro da anterior. */}
          <ErrorBoundary key={location.pathname}>
            <AppRoutes rank={rank} window={window} />
          </ErrorBoundary>
        </main>
      </div>

      {/* Enterprise SaaS Footer */}
      <footer className="border-t border-line/80 bg-surface/60 backdrop-blur-md py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-4 flex-wrap text-xs text-mist">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gold" />
            <span className="font-medium text-foam">Radar de Balanceamento MLBB</span>
            <span className="text-mist/40">·</span>
            <span className="text-mist/80">Interface Domain Design (IDD) Canonical Framework</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono text-mist/70">
            <span>Rone Arena API</span>
            <span>·</span>
            <button
              onClick={() => setIsIddOpen(true)}
              className="text-mist hover:text-gold transition-colors underline flex items-center gap-1"
            >
              <Compass size={12} className="text-gold" />
              <span>Mapa de Capacidades & Job Map IDD</span>
            </button>
            <span>·</span>
            <span>v1.0 Produção</span>
          </div>
        </div>
      </footer>

      {/* Interactive Interface Domain Designer (IDD) Modal */}
      <IddModal isOpen={isIddOpen} onClose={() => setIsIddOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <IddProvider>
      <AppContent />
    </IddProvider>
  );
}
