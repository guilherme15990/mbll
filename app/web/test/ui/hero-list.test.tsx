import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

vi.mock("../../src/shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/shared/api")>();
  return {
    ...actual,
    useAllHeroes: vi.fn(),
    useCatalog: vi.fn(),
    useHeroLanes: vi.fn(),
  };
});

import { useAllHeroes, useCatalog, useHeroLanes } from "../../src/shared/api";
import HeroList from "../../src/features/hero-list/HeroList";
import { renderRoute } from "./render";

/**
 * /hero — a lista mostra o LOTE INTEIRO (nada de `size` fixo): a contagem e os
 * cartões seguem o `total`/`data` que `useAllHeroes` entrega, e o truncamento
 * da fonte é declarado. Ordenação por nome é client-side.
 */

const ok = (over: Record<string, unknown> = {}) =>
  ({ isLoading: false, isError: false, isSuccess: true, data: undefined, refetch: vi.fn(), ...over }) as never;

const hero = (id: number, name: string, over: Record<string, unknown> = {}) => ({
  id,
  name,
  head: null,
  win: 0.5,
  pick: 0.05,
  ban: 0.02,
  wrAdj: 0.5,
  z: 0,
  q: 0,
  tier: "A",
  isGem: false,
  degenerate: false,
  smallSample: false,
  strength_index: id,
  ...over,
});

function mockList(total: number, heroes: unknown[], truncated = false) {
  vi.mocked(useAllHeroes).mockReturnValue(ok({ data: { data: heroes, total, truncated } }));
  vi.mocked(useCatalog).mockReturnValue(ok({ data: { data: {} } }));
  vi.mocked(useHeroLanes).mockReturnValue(ok({ data: { data: {} } }));
}

const cardNames = () =>
  screen
    .getAllByRole("link", { name: /^Abrir ficha de/ })
    .map((link) => link.getAttribute("aria-label"));

describe("HeroList (/hero) lista o lote inteiro", () => {
  it("mostra todos os heróis do lote, por nome, e declara a contagem", () => {
    mockList(3, [hero(3, "Cátia"), hero(1, "Ana"), hero(2, "Bruno")]);
    renderRoute("/hero?rank=mythic&window=7", <HeroList />);

    expect(screen.getByRole("status")).toHaveTextContent("3 de 3 heróis no recorte");
    expect(cardNames()).toEqual([
      "Abrir ficha de Ana",
      "Abrir ficha de Bruno",
      "Abrir ficha de Cátia",
    ]);
    // o lote completo vem do hook, com o recorte do filtro — sem `size` fixo
    expect(useAllHeroes).toHaveBeenCalledWith("mythic", "7");
  });

  it("declara truncamento quando a fonte corta o lote", () => {
    mockList(150, [hero(1, "Ana"), hero(2, "Bruno")], true);
    renderRoute("/hero?rank=mythic&window=7", <HeroList />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "2 de 150 heróis no recorte · lote truncado na fonte",
    );
  });

  it("filtro de rota esconde, mas nunca inventa herói", () => {
    mockList(3, [hero(1, "Ana"), hero(2, "Bruno"), hero(3, "Cátia")]);
    vi.mocked(useHeroLanes).mockReturnValue(ok({ data: { data: { 1: ["mid"], 2: ["gold"] } } }));
    renderRoute("/hero?rank=mythic&window=7&lanes=mid", <HeroList />);

    expect(screen.getByRole("status")).toHaveTextContent("1 de 3 heróis no recorte · filtro de rota");
    expect(cardNames()).toEqual(["Abrir ficha de Ana"]);
  });
});
