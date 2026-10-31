import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";

vi.mock("../../src/shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/shared/api")>();
  return {
    ...actual,
    useHero: vi.fn(),
    useCatalog: vi.fn(),
    useHeroLanes: vi.fn(),
    useBuilds: vi.fn(),
    useBlind: vi.fn(),
    useDistortion: vi.fn(),
  };
});

import {
  useBlind,
  useBuilds,
  useCatalog,
  useDistortion,
  useHero,
  useHeroLanes,
} from "../../src/shared/api";
import HeroDetail from "../../src/features/hero-detail/HeroDetail";
import { heroFixture } from "./fixtures";
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

function mockBase() {
  vi.mocked(useCatalog).mockReturnValue(
    ok({ data: { data: { 42: { id: 42, name: "Akai", head: null } } } }),
  );
  vi.mocked(useHero).mockReturnValue(ok({ data: { data: heroFixture(), meta: { mu: 0.5 } } }));
  vi.mocked(useHeroLanes).mockReturnValue(ok({ data: { data: { 42: ["mid"] } } }));
  vi.mocked(useBuilds).mockReturnValue(ok({ data: { id: 42, rank: "mythic", lane: "mid", data: [] } }));
  vi.mocked(useBlind).mockReturnValue(ok());
  vi.mocked(useDistortion).mockReturnValue(ok());
}

function renderAt(entry: string) {
  return renderRoute(
    entry,
    <Routes>
      <Route path="/hero/:id" element={<HeroDetail />} />
    </Routes>,
  );
}

describe("HeroDetail (caracterização das abas)", () => {
  it("abre a visão geral com métricas do herói", () => {
    mockBase();
    renderAt("/hero/42");
    expect(screen.getByLabelText("Ficha do herói")).toBeInTheDocument();
    expect(screen.getByText("Força θ̂")).toBeInTheDocument();
    expect(screen.getByText("Akai")).toBeInTheDocument();
  });

  it("preserva as quatro abas e nenhuma das removidas", () => {
    mockBase();
    renderAt("/hero/42");
    const nav = screen.getByRole("tablist", { name: /ficha do herói/i });
    expect(nav).toHaveTextContent("Visão geral");
    expect(nav).toHaveTextContent("Confrontos");
    expect(nav).toHaveTextContent("Draft");
    expect(nav).toHaveTextContent("Builds");
    expect(nav).not.toHaveTextContent("Força");
    expect(nav).not.toHaveTextContent("Confiança");
    expect(nav).not.toHaveTextContent("Ranks");
    expect(nav).not.toHaveTextContent("Tempo");
  });

  it("?tab=draft renderiza a seção de draft do herói", () => {
    mockBase();
    renderAt("/hero/42?tab=draft");
    expect(screen.getByLabelText("Draft do herói")).toBeInTheDocument();
    expect(screen.getByText("Blind pick")).toBeInTheDocument();
    expect(screen.getByText("First pick")).toBeInTheDocument();
  });

  it("herói fora do catálogo não dispara detalhe e orienta a escolher", () => {
    mockBase();
    renderAt("/hero/999");
    expect(screen.getByText(/fora do catálogo/)).toBeInTheDocument();
    expect(useHero).toHaveBeenCalledWith(null, "mythic", "7");
  });
});
