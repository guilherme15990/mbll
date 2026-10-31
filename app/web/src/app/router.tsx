import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { filtersQuery } from "./filters";

/**
 * Mapa de rotas da aplicação.
 *
 * F4a: cada página é um chunk próprio. O shell (header/menu horizontal/footer)
 * pinta imediatamente; só o módulo da rota é baixado quando ela abre.
 *
 * Saiu do `App.tsx` para o shell não carregar o mapa junto: o App passou a ser
 * header + menu horizontal + footer; a lista de rotas é deste arquivo.
 */
const Dashboard = lazy(() => import("../features/dashboard/Dashboard"));
const HeroList = lazy(() => import("../features/hero-list/HeroList"));
const Matchups = lazy(() => import("../features/matchups/Matchups"));
const DraftManagement = lazy(() => import("../features/draft-management/DraftManagement"));
const DraftScore = lazy(() => import("../features/draft-management/DraftScorePage"));
const Builds = lazy(() => import("../features/builds/Builds"));
const BuildManager = lazy(() => import("../features/build-manager/BuildManager"));
const Preparar = lazy(() => import("../features/loadout/Preparar"));
const HeroDetail = lazy(() => import("../features/hero-detail/HeroDetail"));

function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="card p-6 flex items-center gap-3 text-mist"
      data-testid="route-loading"
    >
      <span className="w-4 h-4 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
      <span className="text-sm">Carregando módulo…</span>
    </div>
  );
}

export function AppRoutes({ rank, window, lanes }: { rank: string; window: string; lanes: string[] }) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to={`/dashboard?${filtersQuery({ rank, window, hero: "", lanes })}`} replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/hero" element={<HeroList />} />
        <Route path="/confrontos" element={<Matchups />} />
        <Route path="/draft" element={<DraftManagement />} />
        <Route path="/draft-score" element={<DraftScore />} />
        <Route path="/builds" element={<Builds />} />
        <Route path="/build" element={<BuildManager />} />
        <Route path="/build/:id" element={<BuildManager />} />
        <Route path="/preparar" element={<Preparar />} />
        <Route path="/hero/:id" element={<HeroDetail />} />
        {/* Aliases permanentes da ficha (links antigos seguem válidos) */}
        <Route path="/hero/detalhes" element={<HeroDetail />} />
        <Route path="/heroi" element={<HeroDetail />} />
      </Routes>
    </Suspense>
  );
}
