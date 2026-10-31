import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, vi } from "vitest";

// Nenhum teste de UI abre rede: hook não mockado fica em `isLoading` para
// sempre, e o teste observa o estado que a tela desenha nesse estado.
//
// `ResizeObserver` não existe no jsdom; o `ResponsiveContainer` do recharts
// (curva de duração) precisaria dele. O stub mantém o container montado sem
// medir nada — os testes leem os rótulos ao redor do gráfico.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach(() => cleanup());
