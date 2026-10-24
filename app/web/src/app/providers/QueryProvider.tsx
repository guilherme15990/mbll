import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { shouldRetry } from "../../shared/api/errors";

/**
 * Cliente único do TanStack Query.
 *
 * Extraído do `main.tsx` (que ficou só com o mount) e com a política de retry
 * em um lugar só: 4xx não repete, o resto repete até 2×. Antes `retry: 2` cego
 * repetia 404 — três requests para o mesmo "não existe".
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60e3,
      gcTime: 30 * 60e3,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
  },
});

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
