import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";

/**
 * Render de teste com os dois providers que a árvore real exige.
 *
 * `staleTime: Infinity` + `fetch` stubado (ver `setup.ts`) impedem que um hook
 * não mockado abra rede: o teste de caracterização olha o que a tela mostra,
 * não o transporte.
 */
export function renderRoute(entry: string, ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
