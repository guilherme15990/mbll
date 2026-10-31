import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";

vi.mock("../../src/shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/shared/api")>();
  return {
    ...actual,
    useHero: vi.fn(),
    useHeroLanes: vi.fn(),
    useBuilds: vi.fn(),
    useBuildsAggregate: vi.fn(),
  };
});

import {
  useBuilds,
  useBuildsAggregate,
  useHero,
  useHeroLanes,
} from "../../src/shared/api";
import BuildManager from "../../src/features/build-manager/BuildManager";
import { aggregateFixture, buildFixture, heroFixture } from "./fixtures";
import { renderRoute } from "./render";

const ok = (over: Record<string, unknown> = {}) =>
  ({
    isLoading: false,
    isError: false,
    isSuccess: true,
    data: undefined,
    refetch: vi.fn(),
    ...over,
  }) as never;

function mockBase(builds: unknown[] = []) {
  vi.mocked(useHero).mockReturnValue(ok({ data: { data: heroFixture(), meta: { mu: 0.5 } } }));
  vi.mocked(useHeroLanes).mockReturnValue(ok({ data: { data: { 42: ["mid"] } } }));
  vi.mocked(useBuilds).mockReturnValue(ok({ data: { id: 42, rank: "mythic", lane: "mid", data: builds } }));
  vi.mocked(useBuildsAggregate).mockReturnValue(ok({ data: aggregateFixture() }));
}

function renderAt(entry: string) {
  return renderRoute(
    entry,
    <Routes>
      <Route path="/build" element={<BuildManager />} />
      <Route path="/build/:id" element={<BuildManager />} />
    </Routes>,
  );
}

describe("BuildManager (caracterização)", () => {
  it("sem herói, pede a escolha e não busca build", () => {
    mockBase();
    renderAt("/build");
    expect(screen.getByText("Escolha um herói para começar")).toBeInTheDocument();
    expect(screen.getByText("Nenhum herói em foco")).toBeInTheDocument();
    expect(useBuilds).toHaveBeenCalledWith(null, "mythic", "");
  });

  it("com herói e lane sem builds, explica o recorte vazio", () => {
    mockBase([]);
    renderAt("/build?hero=42&lane=mid");
    expect(screen.getByText("Nenhuma build observada neste recorte")).toBeInTheDocument();
  });

  it("com uma build observada, monta núcleo e quadro de decisão", () => {
    mockBase([buildFixture()]);
    renderAt("/build?hero=42&lane=mid");
    expect(screen.getByText(/Núcleo de Akai/)).toBeInTheDocument();
    expect(screen.getByText(/1 build observada/)).toBeInTheDocument();
  });
});
