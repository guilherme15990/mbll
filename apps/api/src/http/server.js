// Servidor HTTP zero-dep: /health, /v1/* (router) e estáticos do apps/web/dist.
//
// F2: request-id + log estruturado, taxonomia de erro (500 ≠ 502), rate limit
// por cliente, estático binário-safe com cache/ETag e shutdown gracioso.
// As dependências (router, dist, relógio/limite, logger) são injetáveis para
// teste — produção usa os defaults de config.js.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { router as defaultRouter } from "./router.js";
import { send, sendBuffer, sendEmpty } from "./respond.js";
import { serveStatic } from "./static.js";
import { HTTP, errorBody, toErrorResponse } from "./errors.js";
import { createLogger } from "./log.js";
import { createRateLimiter } from "../application/rateLimit.js";
import { config } from "../config.js";

const REQUEST_ID = /^[A-Za-z0-9._:-]{1,64}$/;

function requestIdOf(req) {
  const raw = req.headers["x-request-id"];
  if (typeof raw === "string" && REQUEST_ID.test(raw)) return raw;
  return randomUUID();
}

function clientKey(req, trustProxy) {
  if (trustProxy) {
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string") {
      const first = xff.split(",")[0].trim();
      if (first) return first;
    }
  }
  return req.socket.remoteAddress ?? "unknown";
}

export function createApiServer({
  router = defaultRouter,
  webDist = config.http.webDist,
  logLevel = config.http.logLevel,
  trustProxy = config.http.trustProxy,
  rateLimit = config.http.rateLimit,
  logger,
} = {}) {
  const log = logger ?? createLogger(logLevel);
  const limiter = rateLimit?.enabled
    ? createRateLimiter({ rps: rateLimit.rps, burst: rateLimit.burst })
    : null;

  return createServer(async (req, res) => {
    const started = process.hrtime.bigint();
    const url = new URL(req.url ?? "/", "http://x");
    const requestId = requestIdOf(req);

    res.setHeader("x-request-id", requestId);
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("referrer-policy", "no-referrer");
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      log.info("request", {
        requestId, method: req.method, path: url.pathname,
        status: res.statusCode, ms: Math.round(ms),
      });
    });

    if (req.method === "OPTIONS") return send(res, 204, "");

    if (req.method === "GET" && url.pathname === "/health") {
      res.setHeader("cache-control", "no-store");
      return send(res, 200, { ok: true });
    }

    const m = /^\/v1(\/.*)$/.exec(url.pathname);
    if (m) {
      res.setHeader("cache-control", "no-store");
      if (limiter) {
        const rl = limiter.take(clientKey(req, trustProxy));
        res.setHeader("x-ratelimit-limit", String(rl.limit));
        res.setHeader("x-ratelimit-remaining", String(rl.remaining));
        if (!rl.allowed) {
          res.setHeader("retry-after", String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))));
          return send(res, HTTP.TOO_MANY_REQUESTS, errorBody("rate_limited", "Too many requests", { retry_after_ms: rl.retryAfterMs }));
        }
      }
      try {
        const out = await router(m[1], url.searchParams);
        return send(res, out.status, out.body);
      } catch (e) {
        const { status, body } = toErrorResponse(e);
        if (status >= HTTP.INTERNAL) {
          log.error("unhandled_error", {
            requestId, method: req.method, path: url.pathname,
            err: String(e?.message ?? e), stack: e?.stack,
          });
        }
        return send(res, status, { ...body, requestId });
      }
    }

    if (await serveStatic(req, res, url.pathname, { webDist })) return;

    res.setHeader("cache-control", "no-store");
    return send(res, HTTP.NOT_FOUND, { error: "not_found", message: "Not found", requestId });
  });
}

// Fecha o servidor e espera as conexões em andamento; após `timeoutMs` força o
// encerramento (closeAllConnections) em vez de travar o processo para sempre.
export function stopServer(server, { timeoutMs = config.http.shutdownTimeoutMs } = {}) {
  return new Promise((resolve) => {
    if (!server.listening) return resolve({ forced: false });
    let forced = false;
    const timer = setTimeout(() => {
      forced = true;
      server.closeAllConnections?.();
      server.close();
    }, timeoutMs);
    timer.unref?.();
    server.close(() => {
      clearTimeout(timer);
      resolve({ forced });
    });
  });
}

export function startServer({ port = config.port, ...opts } = {}) {
  const log = opts.logger ?? createLogger(opts.logLevel ?? config.http.logLevel);
  const server = createApiServer({ ...opts, logger: log });

  server.on("error", (e) => {
    log.error("listen_failed", { err: String(e?.message ?? e), code: e?.code ?? null });
    process.exitCode = 1;
  });

  // Loga a porta EFETIVA (com PORT=0 o SO escolhe uma), não a solicitada.
  server.listen(port, () => log.info("server_listening", { port: server.address()?.port ?? port, zeroDep: true }));

  let stopping = false;
  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    log.info("shutdown", { signal, timeoutMs: config.http.shutdownTimeoutMs });
    const { forced } = await stopServer(server);
    log.info("shutdown_done", { signal, forced });
    process.exit(forced ? 1 : 0);
  };
  process.once("SIGINT", () => { void shutdown("SIGINT"); });
  process.once("SIGTERM", () => { void shutdown("SIGTERM"); });

  return server;
}
