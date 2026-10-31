import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import type { ReactElement } from "react";

vi.mock("../../src/shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/shared/api")>();
  return { ...actual, useBuildsAggregate: vi.fn() };
});

import { useBuildsAggregate } from "../../src/shared/api";
import BuildsAggregatePanel from "../../src/features/builds/BuildsAggregatePanel";
import BuildsPowerPanel from "../../src/features/builds/BuildsPowerPanel";
import { aggregateFixture } from "./fixtures";
import { renderRoute } from "./render";

type QueryResult = ReturnType<typeof useBuildsAggregate>;

const result = (over: Record<string, unknown> = {}) =>
  ({
    isLoading: false,
    isError: false,
    isSuccess: true,
    data: undefined,
    refetch: vi.fn(),
    ...over,
  }) as unknown as QueryResult;

function renderAt(entry: string, ui: ReactElement) {
  return renderRoute(entry, ui);
}

describe("BuildsAggregatePanel", () => {
  it("sem rota no filtro global orienta a escolher em vez de buscar", () => {
    vi.mocked(useBuildsAggregate).mockReturnValue(result());
    renderAt("/builds", <BuildsAggregatePanel rank="mythic" window="7" />);
    expect(screen.getByText("Escolha uma rota no topo")).toBeInTheDocument();
  });

  it("com mais de uma rota marcada, pede uma só", () => {
    vi.mocked(useBuildsAggregate).mockReturnValue(result());
    renderAt("/builds?lanes=mid,gold", <BuildsAggregatePanel rank="mythic" window="7" />);
    expect(screen.getByText(/mais de uma marcada/)).toBeInTheDocument();
  });

  it("mostra carregamento quando uma rota está selecionada", () => {
    vi.mocked(useBuildsAggregate).mockReturnValue(result({ isLoading: true }));
    renderAt("/builds?lanes=mid", <BuildsAggregatePanel rank="mythic" window="7" />);
    expect(screen.getByText(/Carregando as builds de todos os heróis/)).toBeInTheDocument();
  });

  it("mostra erro com a rota no texto", () => {
    vi.mocked(useBuildsAggregate).mockReturnValue(result({ isError: true, error: new Error("boom") }));
    renderAt("/builds?lanes=mid", <BuildsAggregatePanel rank="mythic" window="7" />);
    expect(screen.getByText(/Não foi possível carregar as builds da lane MID/)).toBeInTheDocument();
  });

  it("renderiza as cinco seções com agregado vazio (sem o card de cobertura)", () => {
    vi.mocked(useBuildsAggregate).mockReturnValue(result({ data: aggregateFixture() }));
    renderAt("/builds?lanes=mid", <BuildsAggregatePanel rank="mythic" window="7" />);
    expect(screen.queryByText("Heróis com dados")).not.toBeInTheDocument();
    expect(screen.getByText("Itens que aparecem juntos")).toBeInTheDocument();
    expect(screen.getByText("Itens por tipo de build")).toBeInTheDocument();
    expect(screen.getByText("Winrate por emblema na rota")).toBeInTheDocument();
    expect(screen.getByText("Nenhum trio com dados suficientes")).toBeInTheDocument();
  });

  it("avisa quando alguns heróis não carregaram (carga parcial)", () => {
    const data = aggregateFixture({
      partial: true,
      coverage: { ...aggregateFixture().coverage, heroes_requested: 12, cells_error: 1 },
      cells: [
        { hero_id: 7, hero_name: "Fanny", status: "error", builds: 0, reason: "timeout", stale: false, age_ms: null },
      ],
    });
    vi.mocked(useBuildsAggregate).mockReturnValue(result({ data }));
    renderAt("/builds?lanes=mid", <BuildsAggregatePanel rank="mythic" window="7" />);
    expect(screen.getByText(/Alguns heróis não carregaram/)).toBeInTheDocument();
    expect(screen.getByText(/Fanny/)).toBeInTheDocument();
  });
});

describe("BuildsPowerPanel", () => {
  it("sem lane orienta a escolher", () => {
    vi.mocked(useBuildsAggregate).mockReturnValue(result());
    renderAt("/builds?view=power", <BuildsPowerPanel rank="mythic" window="7" />);
    expect(screen.getByText("Escolha uma lane para listar as builds")).toBeInTheDocument();
  });

  it("com recorte vazio, mantém filtros e informa zero builds", () => {
    vi.mocked(useBuildsAggregate).mockReturnValue(result({ data: aggregateFixture() }));
    renderAt("/builds?view=power&lane=mid", <BuildsPowerPanel rank="mythic" window="7" />);
    expect(screen.getByText("Escolha o que listar")).toBeInTheDocument();
    expect(screen.getByText(/0 builds observadas/)).toBeInTheDocument();
  });

  it("sem bloco de componentes, explica em vez de inventar índice", () => {
    const semCombiner = aggregateFixture();
    // @ts-expect-error — cenário defensivo: payload antigo sem `combiner`.
    delete semCombiner.combiner;
    vi.mocked(useBuildsAggregate).mockReturnValue(result({ data: semCombiner }));
    renderAt("/builds?view=power&lane=mid", <BuildsPowerPanel rank="mythic" window="7" />);
    expect(screen.getByText("Este recorte veio sem os valores por componente")).toBeInTheDocument();
  });
});
