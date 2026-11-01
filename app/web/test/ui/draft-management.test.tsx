import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";

vi.mock("../../src/features/draft-management/useDraftData", () => ({
  useDraftData: vi.fn(),
}));

import { useDraftData } from "../../src/features/draft-management/useDraftData";
import DraftManagement from "../../src/features/draft-management/DraftManagement";
import { renderRoute } from "./render";

// Fixtures no formato que `useDraftData` entrega (pool + books + baseline).
type HeroFixture = {
  id: number;
  name: string;
  head: string | null;
  wrAdj: number | null;
  pick: number | null;
  ban: number | null;
  B: number | null;
  tier: string | null;
  credible: [number, number] | null;
  smallSample: boolean;
  lanes: string[];
};

const hero = (id: number, name: string, over: Partial<HeroFixture> = {}): HeroFixture => ({
  id,
  name,
  head: null,
  wrAdj: 0.5,
  pick: 0.05,
  ban: 0.02,
  B: 0.6,
  tier: "Médio",
  credible: null,
  smallSample: false,
  lanes: [],
  ...over,
});

const pool = {
  1: hero(1, "Fanny", { wrAdj: 0.7, pick: 0.12, ban: 0.2, B: 0.8, tier: "Forte", credible: [0.6, 0.8], lanes: ["jungle"] }),
  2: hero(2, "Tigreal", { wrAdj: 0.45, pick: 0.08, ban: 0.1, B: 0.9, credible: [0.38, 0.52], lanes: ["roam"] }),
  3: hero(3, "Miya", { wrAdj: 0.52, pick: 0.1, ban: 0.04, B: 0.7, credible: [0.44, 0.6], lanes: ["gold"] }),
  4: hero(4, "Lancelot", { wrAdj: 0.58, pick: 0.09, ban: 0.06, B: 0.6, tier: "Forte", lanes: ["exp"] }),
  5: hero(5, "Bruno", { wrAdj: 0.6, pick: 0.07, ban: 0.05, B: 0.7, lanes: ["gold", "mid"] }),
  6: hero(6, "Chou", { wrAdj: 0.55, pick: 0.06, ban: 0.03, B: 0.5, lanes: ["exp"] }),
  7: hero(7, "Atlas", { wrAdj: 0.5, pick: 0.04, ban: 0.02, B: 0.6, lanes: ["gold"] }),
};

const curve = [
  { label: "6-8", mid: 7, win: 0.53 },
  { label: "8-10", mid: 9, win: 0.56 },
];

const books = {
  1: {
    id: 1,
    countersUp: [],
    countersDown: [],
    synergiesUp: [{ id: 3, delta: 0.03, profile: "snowball", curve }],
    synergiesDown: [],
  },
  2: {
    id: 2,
    countersUp: [{ id: 1, delta: 0.04, profile: "scaling" }],
    countersDown: [],
    synergiesUp: [{ id: 4, delta: 0.02, profile: "scaling", curve: [{ label: "6-8", mid: 7, win: 0.47 }, { label: "8-10", mid: 9, win: 0.44 }] }],
    synergiesDown: [],
  },
  4: {
    id: 4,
    countersUp: [{ id: 2, delta: 0.04, profile: "scaling", curve }],
    countersDown: [],
    synergiesUp: [],
    synergiesDown: [],
  },
};

function mockData(over: Record<string, unknown> = {}) {
  vi.mocked(useDraftData).mockReturnValue({
    pool,
    books,
    baseline: 0.5,
    meta: { mu: 0.5 },
    loading: false,
    error: false,
    bookErrors: 0,
    bookCount: 10,
    stale: false,
    truncated: false,
    refetch: vi.fn(),
    ...over,
  } as never);
}

function renderAt(entry: string) {
  return renderRoute(
    entry,
    <Routes>
      <Route path="/draft" element={<DraftManagement />} />
    </Routes>,
  );
}

const DRAFTED = "d=1@jungle,3@gold,,,|2@roam,4@exp,,,";

describe("DraftManagement (caracterização v2)", () => {
  it("draft vazio explica por onde começar e não inventa índice", () => {
    mockData();
    renderAt("/draft?rank=mythic&window=7&first=us");
    expect(screen.getByText("Monte o draft e leia o que os sinais sustentam")).toBeInTheDocument();
    expect(screen.getAllByText(/não é probabilidade, não é previsão/).length).toBeGreaterThan(0);
    // Percentual não existe com um lado vazio: mostra o aviso, nunca 100%.
    expect(screen.getByText("falta índice de um dos lados")).toBeInTheDocument();
  });

  it("com picks dos dois lados mostra as seções da v2", () => {
    mockData();
    renderAt(`/draft?rank=mythic&window=7&first=us&${DRAFTED}`);

    expect(screen.getAllByText("Fanny").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tigreal").length).toBeGreaterThan(0);
    expect(screen.getByText("Força dos times")).toBeInTheDocument();
    expect(screen.getByText("Confronto 5×5")).toBeInTheDocument();
    expect(screen.getByText("Arquétipos")).toBeInTheDocument();
    expect(screen.getByText("Evolução por duração")).toBeInTheDocument();
    expect(screen.getByText("Detalhe do índice")).toBeInTheDocument();
    // Índice dos dois lados existe (nenhum "—" nos cards de poder).
    expect(screen.getAllByText(/^\d+\.\d$/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Força média")).toBeInTheDocument();
    expect(screen.getByText("Sinergia observada")).toBeInTheDocument();
    expect(screen.getByText("Confronto por par")).toBeInTheDocument();
    // A seção de ordem do draft saiu da tela.
    expect(screen.queryByText(/Ordem do draft/i)).not.toBeInTheDocument();
    // Destaque dos extremos de θ̂ do time (Fanny forte, Miya fraca).
    expect(screen.getAllByText("mais forte").length).toBeGreaterThan(0);
    expect(screen.getAllByText("mais fraco").length).toBeGreaterThan(0);
  });

  it("a divisão em % é rotulada e não vira promessa", () => {
    mockData();
    renderAt(`/draft?rank=mythic&window=7&first=us&${DRAFTED}`);
    expect(screen.getByRole("img", { name: /divisão do índice/ })).toBeInTheDocument();
    expect(screen.getAllByText(/não é probabilidade, não é previsão/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/chance de vitória|probabilidade de vitória/i)).not.toBeInTheDocument();
  });

  it("card maior e todos os candidatos têm Pick e Ban", () => {
    mockData();
    renderAt(`/draft?rank=mythic&window=7&first=us&lane=gold&${DRAFTED}`);

    expect(screen.getByText("Mais indicado agora")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Pickar / }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole("button", { name: /^Banir / }).length).toBeGreaterThanOrEqual(2);
  });

  it("Pick do card grava no próximo slot nosso e some da lista", () => {
    mockData();
    renderAt(`/draft?rank=mythic&window=7&first=us&lane=gold&${DRAFTED}`);

    const before = screen.getAllByRole("button", { name: /^Pickar / }).length;
    const picks = screen.getAllByRole("button", { name: /^Pickar / });
    const label = picks[0].getAttribute("aria-label") ?? "";
    fireEvent.click(picks[0]);

    const name = label.replace("Pickar ", "");
    expect(screen.getAllByRole("button", { name: /^Pickar / }).length).toBe(before - 1);
    // O herói escolhido agora aparece no nosso draft (3/5 heróis).
    expect(screen.getAllByText(name).length).toBeGreaterThan(0);
  });

  it("trocar a lane grava ?lane= e reflete no chip", () => {
    mockData();
    renderAt(`/draft?rank=mythic&window=7&first=us&${DRAFTED}`);

    const mid = screen.getByRole("button", { name: "Mid" });
    expect(mid).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(mid);
    // aria-pressed vem de `?lane=`, então o clique prova a gravação na URL.
    expect(screen.getByRole("button", { name: "Mid" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Exp" })).toHaveAttribute("aria-pressed", "false");
  });

  it("matriz conta pares e curva se declara proxy dos pares", () => {
    mockData();
    renderAt(`/draft?rank=mythic&window=7&first=us&${DRAFTED}`);
    expect(screen.getByLabelText("Matriz de confronto 5 por 5")).toBeInTheDocument();
    expect(screen.getByText(/não soma efeitos/)).toBeInTheDocument();
    expect(screen.getAllByText(/média das curvas das duplas/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/não win rate do time/)).toBeInTheDocument();
    expect(screen.getByText(/uma dupla = um valor na faixa, não um ponto/)).toBeInTheDocument();
    // Uma dupla por lado: 1+3 (nós) e 2+4 (eles).
    expect(screen.getByText("nós (1 duplas)")).toBeInTheDocument();
    expect(screen.getByText("eles (1 duplas)")).toBeInTheDocument();
  });

  it("clicar no slot abre o modal e escolhe o herói", () => {
    mockData();
    renderAt(`/draft?rank=mythic&window=7&${DRAFTED}`);

    fireEvent.click(screen.getByRole("button", { name: "Escolher herói para o slot 3 do nosso time" }));
    const dialog = screen.getByRole("dialog", { name: /Escolher herói.*Slot 3.*nosso time/ });
    expect(dialog).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole("textbox", { name: "Buscar herói" }), { target: { value: "Chou" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Chou/ }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trocar Chou no slot 3 do nosso time" })).toBeInTheDocument();
  });

  it("seção de bans marca ban pelo modal, no mesmo modelo dos heróis", () => {
    mockData();
    renderAt(`/draft?rank=mythic&window=7&${DRAFTED}`);

    fireEvent.click(screen.getByRole("button", { name: "Banir herói no ban 1 do nosso time" }));
    const dialog = screen.getByRole("dialog", { name: /Banir herói.*Ban 1.*nosso time/ });

    fireEvent.change(within(dialog).getByRole("textbox", { name: "Buscar herói" }), { target: { value: "Chou" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Chou/ }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Trocar ban 1 do nosso time \(Chou\)/ })).toBeInTheDocument();
  });

  it("elo ALL não calcula proxy: pede elo explícito", () => {
    mockData();
    renderAt("/draft?rank=all&window=7");
    expect(screen.getByTestId("needs-rank")).toBeInTheDocument();
    expect(screen.getByText("Draft exige elo explícito")).toBeInTheDocument();
  });

  it("erro do lote vira ErrBox em vez de índice vazio", () => {
    mockData({ error: true });
    renderAt("/draft?rank=mythic&window=7");
    expect(screen.getByText(/O lote de heróis não respondeu/)).toBeInTheDocument();
  });

  it("carregando não mostra índice", () => {
    mockData({ loading: true });
    renderAt("/draft?rank=mythic&window=7");
    expect(screen.queryByText("Força média")).not.toBeInTheDocument();
  });
});
