import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { filtersQuery } from "./filters";

/**
 * Mapa de rotas da aplicação.
 *
 * F4a: cada página é um chunk próprio. O shell (header/sidebar/footer) pinta
 * imediatamente; só o módulo da rota é baixado quando ela abre. `HeroDetail`
 * é declarado uma vez e reaproveitado pelos três caminhos da ficha.
 *
 * Saiu do `App.tsx` para o shell não carregar o mapa junto: o App passou a ser
 * header + sidebar + footer; a lista de rotas é deste arquivo.
 */
const Dashboard = lazy(() => import("../features/dashboard/Dashboard"));
const HeroList = lazy(() => import("../features/hero-list/HeroList"));
const Strength = lazy(() => import("../features/strength/Strength"));
const Confidence = lazy(() => import("../features/confidence/Confidence"));
const Ranks = lazy(() => import("../features/ranks/Ranks"));
const Temporal = lazy(() => import("../features/temporal/Temporal"));
const Matchups = lazy(() => import("../features/matchups/Matchups"));
const Draft = lazy(() => import("../features/draft/Draft"));
const Blind = lazy(() => import("../features/blind/Blind"));
const Builds = lazy(() => import("../features/builds/Builds"));
const BuildManager = lazy(() => import("../features/build-manager/BuildManager"));
const Preparar = lazy(() => import("../features/loadout/Preparar"));
const Exposure = lazy(() => import("../features/exposure/Exposure"));
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
        <Route path="/forca" element={<Strength />} />
        <Route path="/confianca" element={<Confidence />} />
        <Route path="/ranks" element={<Ranks />} />
        <Route path="/tempo" element={<Temporal />} />
        <Route path="/confrontos" element={<Matchups />} />
        <Route path="/draft" element={<Draft />} />
        <Route path="/blind" element={<Blind />} />
        <Route path="/builds" element={<Builds />} />
        <Route path="/build" element={<BuildManager />} />
        <Route path="/build/:id" element={<BuildManager />} />
        <Route path="/preparar" element={<Preparar />} />
        <Route path="/exposicao" element={<Exposure />} />
        <Route path="/hero/:id" element={<HeroDetail />} />
        {/* Aliases permanentes da ficha (links antigos seguem válidos) */}
        <Route path="/hero/detalhes" element={<HeroDetail />} />
        <Route path="/heroi" element={<HeroDetail />} />
      </Routes>
    </Suspense>
  );
}
