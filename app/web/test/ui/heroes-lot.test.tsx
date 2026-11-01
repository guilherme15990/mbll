import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HEROES_PAGE_CAP, useAllHeroes } from "../../src/shared/api";

/**
 * Caracterização do `useAllHeroes`: o lote NÃO tem tamanho fixo no cliente.
 * A página 1 descobre `total` e o resto é paginado por `index`. O stub de fetch
 * serve páginas reais a partir de um `total` — é o próprio contrato do servidor.
 */

const hero = (id: number) => ({
  id,
  name: `H${id}`,
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
});

/** Página `index` de um lote de `total` itens, no tamanho pedido. */
function pageOf(total: number, index: number, size: number) {
  const start = (index - 1) * size;
  const count = Math.max(0, Math.min(size, total - start));
  return Array.from({ length: count }, (_, k) => hero(start + k + 1));
}

function stubPages(total: number) {
  const spy = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    const index = Number(url.searchParams.get("index") ?? 1);
    const size = Number(url.searchParams.get("size") ?? 50);
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: pageOf(total, index, size), total }),
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

function Probe() {
  const query = useAllHeroes("mythic", "7");
  if (query.isLoading) return <p>loading</p>;
  if (query.isError) return <p>error</p>;
  return <p role="status">{`${query.data?.data.length} de ${query.data?.total}`}</p>;
}

function renderProbe() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>,
  );
}

describe("useAllHeroes (lote completo, sem tamanho de lote fixo)", () => {
  it("lote dentro do teto do servidor cabe em 1 request", async () => {
    const spy = stubPages(60);
    const view = renderProbe();
    await waitFor(() => expect(view.getByRole("status")).toHaveTextContent("60 de 60"));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("lote acima do teto é paginado pelo total — o herói novo aparece", async () => {
    const total = HEROES_PAGE_CAP + 17;
    const spy = stubPages(total);
    const view = renderProbe();
    await waitFor(() => expect(view.getByRole("status")).toHaveTextContent(`${total} de ${total}`));
    expect(spy).toHaveBeenCalledTimes(2);
    // a 2ª página usa index=2 e o teto do SERVIDOR, nunca um número de lote do cliente
    const second = String(spy.mock.calls[1]?.[0]);
    expect(second).toContain("index=2");
    expect(second).toContain(`size=${HEROES_PAGE_CAP}`);
  });

  it("lote vazio devolve 0 sem disparar página extra", async () => {
    const spy = stubPages(0);
    const view = renderProbe();
    await waitFor(() => expect(view.getByRole("status")).toHaveTextContent("0 de 0"));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
