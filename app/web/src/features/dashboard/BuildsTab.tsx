import { Empty, ErrBox } from "../../shared/ui";
import { withLanes } from "../../app/filters";
import { BuildCardSkeleton, HeroBuildCard } from "./builds/HeroBuildCard";
import { RouteBuildsHeader } from "./builds/RouteBuildsHeader";
import { useLaneBuilds } from "./builds/useLaneBuilds";

/**
 * Aba Builds do /dashboard — composição por rota, sem herói fixo.
 *
 * A tela é um recorte do top-N θ̂ da rota escolhida no filtro global. Não há
 * seletor de rota local, ranking de builds entre heróis nem bloco de itemsets:
 * a leitura é "quais builds os heróis mais fortes da rota usam". Lift e
 * referências ficam na ficha do herói.
 *
 * Orçamento (builds-global-brief §2): R1 mapa de lanes + R2 lista top 25 +
 * R3–R5 no máximo 3 GETs de builds. Sem rota escolhida, 0 requests de builds.
 * Tab local, nunca em query key.
 */
export default function BuildsTab({ rank, window, active, lanes }: {
  rank: string;
  window: string;
  active: boolean;
  lanes: string[];
}) {
  const data = useLaneBuilds({ rank, window, active, lanes });

  if (!data.validLane) {
    return (
      <div role="tabpanel" id="panel-builds" aria-labelledby="tab-builds">
        <Empty
          title="Escolha a rota no filtro global"
          hint="A rota desta aba vem do filtro global do header (botões Rota). Selecione exp, mid, roam, jungle ou gold. Nenhum build é buscado sem rota — lifts só existem dentro de rank+rota (0 requests até escolher)."
        />
      </div>
    );
  }

  const { laneKey, listQuery, heroes, cards, total, routeUnvalidated } = data;
  const loading = data.lanesLoading || listQuery.isLoading;
  const listError = listQuery.isError;
  const noHeroes = !loading && !listError && heroes.length === 0;
  const fallbackNoHeroes = data.lanesEmpty || data.lanesError;

  const fichaHref = (heroId: number) =>
    withLanes(`/hero/${heroId}?rank=${rank}&window=${window}&lane=${laneKey}&tab=builds`, lanes);

  return (
    <section
      className="card overflow-hidden bg-panel border-line"
      role="tabpanel"
      id="panel-builds"
      aria-labelledby="tab-builds"
      aria-busy={loading}
    >
      <RouteBuildsHeader
        laneKey={laneKey}
        total={total}
        routeUnvalidated={routeUnvalidated}
      />

      <div className="p-4">
        {loading ? (
          <div className="grid gap-2.5 lg:grid-cols-3" aria-label="carregando builds da rota">
            {Array.from({ length: total }).map((_, i) => (
              <BuildCardSkeleton key={i} position={i + 1} />
            ))}
          </div>
        ) : listError ? (
          <ErrBox onRetry={() => listQuery.refetch()} />
        ) : noHeroes ? (
          <Empty
            title={fallbackNoHeroes
              ? "Nenhum herói no recorte"
              : `Nenhum herói da rota ${laneKey} no topo do recorte`}
            hint={fallbackNoHeroes
              ? "A lista de heróis voltou vazia para este elo/janela. Troque o recorte e tente de novo."
              : `A lista é o top 25 por θ̂, sem filtro de rota no servidor; nenhum dos 25 primeiros joga ${laneKey} neste elo/janela. Troque o recorte ou abra a ficha pelo herói.`}
          />
        ) : (
          <ul className="grid gap-2.5 lg:grid-cols-3" aria-label={`Top-${total} da rota com builds`}>
            {cards.map((state, i) => (
              <li key={state.hero.id}>
                <HeroBuildCard
                  state={state}
                  position={i + 1}
                  href={fichaHref(state.hero.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
