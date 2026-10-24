import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
// O router do backend é zero-dep (só stdlib): roda DENTRO do Vite em dev.
// Uma porta só (:5173) serve app + /v1/* + /health. Em prod, app/api faz o mesmo.
import { router } from "../api/src/routes.js";

/** Monta /v1/* e /health no próprio dev server (sem segundo processo/proxy). */
function radarApi(): Plugin {
  return {
    name: "radar-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const url = new URL(req.url ?? "/", "http://x");
          if (url.pathname === "/health" && req.method === "GET") {
            res.writeHead(200, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: true, mode: "vite" }));
            return;
          }
          const m = /^\/v1(\/.*)$/.exec(url.pathname);
          if (!m || (req.method !== "GET" && req.method !== "OPTIONS")) return next();
          if (req.method === "OPTIONS") {
            res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,OPTIONS" });
            res.end("");
            return;
          }
          const out = await router(m[1], url.searchParams);
          res.writeHead(out.status, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify(out.body));
        } catch {
          res.writeHead(502, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "Fonte indisponível", detail: "Tentar de novo" }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), radarApi()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { outDir: "dist", sourcemap: true, chunkSizeWarningLimit: 900 },
});
