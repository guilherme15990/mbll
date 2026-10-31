import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";

// Só o hook de dados é mockado: o resto de `shared/api` (cx/num/ago) continua real.
vi.mock("../../src/shared/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useHeroDraftScore: vi.fn() };
});

import { useHeroDraftScore } from "../../src/shared/api";
import DraftScorePage from "../../src/features/draft-management/DraftScorePage";
import { renderRoute } from "./render";

/**
 * Caracterização da página de TESTE `/draft-score`.
 *
 * Não testa transporte nem o motor (cobertos em `contracts.test.js` na API e em
 * `hero-draft-score.test.js` no motor): olha o que a tela desenha dado o payload
 * de `/v1/heroes/draft-score` — a ordem pelo número, a superfície de UM número
 * por herói (sem colunas derivadas) e a ressalva de que não é probabilidade.
 */
type Row = {
  id: number;
  name: string;
  head: string | null;
  draft_score: number | null;
};

const rows: Row[] = [
  { id: 1, name: "Fanny", head: null, draft_score: 100 },
  { id: 2, name: "Miya", head: null, draft_score: 0 },
];

function mockData(over: Record<string, unknown> = {}) {
  vi.mocked(useHeroDraftScore).mockReturnValue({
    data: {
      version: "hero-draft-score-v1",
      rank: "mythic",
      days: 7,
      collectedAgoMs: 0,
      truncated: false,
      stale: false,
      ageMs: 0,
      rows,
      meta: { n_heroes: rows.length, with_data: 2, wr_min: 0.44, wr_max: 0.56, calibrated: false, note: "n" },
    },
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
    ...over,
  } as never);
}

function renderAt(entry = "/draft-score?rank=mythic&window=7") {
  return renderRoute(
    entry,
    <Routes>
      <Route path="/draft-score" element={<DraftScorePage />} />
    </Routes>,
  );
}

describe("DraftScorePage (teste do sistema)", () => {
  it("lista os heróis ordenados pelo número, uma linha por herói", () => {
    mockData();
    renderAt();
    const tableRows = screen.getAllByRole("row");
    expect(tableRows.length).toBe(3); // header + Fanny + Miya
    expect(within(tableRows[1]).getByText("Fanny")).toBeTruthy();
    expect(within(tableRows[2]).getByText("Miya")).toBeTruthy();
    expect(within(tableRows[1]).getByText("100")).toBeTruthy();
    expect(within(tableRows[2]).getByText("0")).toBeTruthy();
    expect(document.body.textContent).toContain("hero-draft-score-v1");
  });

  it("a superfície é UM número por herói (sem colunas derivadas)", () => {
    mockData();
    renderAt();
    const header = screen.getAllByRole("row")[0];
    const headers = within(header)
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual(["#", "Herói", "Draft Score"]);
  });

  it("declara a escala min–max (100 = maior WR, 0 = menor) e a ressalva de não-probabilidade", () => {
    mockData();
    renderAt();
    expect(document.body.textContent).toContain("maior WR");
    expect(document.body.textContent).toContain("menor WR");
    expect(document.body.textContent).toMatch(/não é probabilidade/i);
    expect(document.body.textContent).toMatch(/previsão/i);
  });

  it("herói sem WR no recorte aparece como travessão, nunca 0", () => {
    mockData({
      data: {
        version: "hero-draft-score-v1", rank: "mythic", days: 7, collectedAgoMs: 0,
        truncated: false, stale: false, ageMs: 0,
        rows: [{ id: 9, name: "Zilong", head: null, draft_score: null }],
        meta: { n_heroes: 1, with_data: 0, wr_min: null, wr_max: null, calibrated: false, note: "n" },
      },
    });
    renderAt();
    expect(within(screen.getAllByRole("row")[1]).getByText("—")).toBeTruthy();
  });

  it("rank=all pede elo em vez de calcular", () => {
    mockData();
    renderAt("/draft-score?rank=all");
    expect(screen.getByTestId("needs-rank")).toBeTruthy();
  });

  it("falha do lote mostra ErrBox e oferece retry", () => {
    mockData({ isError: true });
    renderAt();
    expect(screen.getByText(/não respondeu/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeTruthy();
  });
});
