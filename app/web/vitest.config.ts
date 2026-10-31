import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Testes de componente da web (E1 da auditoria arquitetural).
 *
 * Config separada do `vite.config.ts` de propósito: aquele arquivo importa o
 * router da API (SQLite, providers) só para o dev server. Teste de UI não
 * precisa dessa pilha — e não deve depender dela para rodar.
 *
 * Escopo: `test/ui/**\/*.test.tsx`. Os testes de domínio e os guardiões
 * estáticos continuam em `node:test` (script `test`).
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/ui/setup.ts"],
    include: ["test/ui/**/*.test.tsx"],
    clearMocks: true,
    restoreMocks: true,
    css: false,
  },
});
