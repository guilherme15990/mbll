// Servidor HTTP zero-dep: /health, /v1/* (router) e estáticos do apps/web/dist.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, normalize, resolve, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { router } from "./router.js";
import { send } from "./respond.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "..", "..", "..", "web", "dist");
const PORT = Number(process.env.PORT ?? 3001);
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".map": "application/json", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };

export function createApiServer() {
  return createServer(async (req, res) => {
    if (req.method === "OPTIONS") return send(res, 204, "");
    const url = new URL(req.url ?? "/", "http://x");
    if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true });
    const m = /^\/v1(\/.*)$/.exec(url.pathname);
    if (m) {
      try {
        const out = await router(m[1], url.searchParams);
        return send(res, out.status, out.body);
      } catch {
        return send(res, 502, { error: "upstream_unavailable", message: "Upstream unavailable, try again" });
      }
    }
    if (req.method === "GET") {
      // SEC M-01: contenção por resolve + prefixo (normalize sozinho não basta)
      const rel = normalize(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^[/\\]+/, "");
      const file = resolve(DIST, rel);
      if (!rel.startsWith("..") && (file === DIST || file.startsWith(DIST + sep)) && existsSync(file)) {
        try {
          const buf = await readFile(file, "utf8");
          return send(res, 200, buf, MIME[extname(file)] ?? "application/octet-stream");
        } catch { /* 404 abaixo */ }
      }
    }
    return send(res, 404, { error: "not_found", message: "Not found" });
  });
}

export function startServer() {
  const server = createApiServer();
  server.listen(PORT, () => console.log(`api em :${PORT} (zero-dep)`));
  return server;
}
