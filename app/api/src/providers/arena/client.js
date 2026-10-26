// Transporte da API externa (Rone Arena) + taxonomia de erro (ADR-045).
//
// Continua sendo o único lugar que faz `fetch` para fora. O que mudou:
// - erro tipado (`ArenaError`) com `kind`/`status`/`attempts` — a rota decide
//   502 vs 504 sem parsear string de mensagem;
// - log estruturado de tentativa e de falha final, herdando `requestId` do
//   contexto (`providers/logging`);
// - cliente instanciável (`createArenaClient`) para teste, mantendo o singleton
//   `arena` usado em produção.
//
// Regras preservadas: timeout, retry com backoff+jitter, 1 hop para host
// alternativo explicitamente permitido, breaker de 5 falhas/60 s e recusa de
// HTML no lugar de JSON.
import { config } from "../../infra/config.js";
import { getLogger, LOG_EVENTS } from "../logging/index.js";

/** @typedef {"circuit_open" | "timeout" | "network" | "upstream_status" | "non_json" | "invalid_json" | "unknown"} ArenaErrorKind */

export class ArenaError extends Error {
  /**
   * @param {string} message
   * @param {{ kind?: ArenaErrorKind, status?: number | null, path?: string, attempts?: number, cause?: unknown }} [opts]
   */
  constructor(message, { kind = "unknown", status = null, path = "", attempts = 1, cause = null } = {}) {
    super(message);
    this.name = "ArenaError";
    this.kind = kind;
    this.status = status;
    this.path = path;
    this.attempts = attempts;
    if (cause != null) this.cause = cause;
  }
}

/** @param {unknown} e @returns {ArenaErrorKind} */
function kindOf(e) {
  if (e instanceof ArenaError) return e.kind;
  if (e && typeof e === "object") {
    const err = /** @type {{ name?: string, code?: string }} */ (e);
    if (err.name === "AbortError" || err.code === "ABORT_ERR") return "timeout";
  }
  return "network";
}

/**
 * @template T, R
 * @param {T[]} items
 * @param {(item: T, index: number) => Promise<R>} fn
 * @param {number} [conc]
 * @returns {Promise<R[]>}
 */
export async function mapConc(items, fn, conc = config.arena.conc) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(conc, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k], k);
    }
  });
  await Promise.all(workers);
  return out;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {Response} res
 * @param {string} path
 * @returns {Promise<any>}
 */
async function readJson(res, path) {
  const ct = String(res.headers?.get?.("content-type") ?? "").toLowerCase();
  if (typeof res.text === "function") {
    const text = await res.text();
    if (ct.includes("text/html") || ct.includes("application/xhtml") || /^\s*</.test(text)) {
      throw new ArenaError(`arena non-json em ${path}`, { kind: "non_json", path });
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new ArenaError(`arena invalid json em ${path}`, { kind: "invalid_json", path, cause: e });
    }
  }
  return res.json();
}

/**
 * Cria um cliente independente (estado de breaker próprio). Produção usa o
 * singleton `arena` no fim deste arquivo; teste usa este com `fetchImpl`.
 *
 * @param {{
 *   base?: string,
 *   altHosts?: string[],
 *   conc?: number,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 *   retries?: number,
 * }} [opts]
 */
export function createArenaClient({
  base = config.arena.base,
  altHosts = config.arena.altHosts,
  conc = config.arena.conc,
  fetchImpl = null,
  timeoutMs = 12000,
  retries = 3,
} = {}) {
  const altAllow = new Set(altHosts);
  const baseOrigin = (() => {
    try { return new URL(base).origin; } catch { return null; }
  })();

  let consecutiveFailures = 0;
  let openUntil = 0;

  /**
   * @param {string} path
   * @param {{ timeoutMs?: number, retries?: number }} [opts]
   * @returns {Promise<any>}
   */
  async function get(path, { timeoutMs: tmo = timeoutMs, retries: tries = retries } = {}) {
    const log = getLogger();
    if (Date.now() < openUntil) {
      log.warn(LOG_EVENTS.ARENA_CIRCUIT_OPEN, { provider: "arena", path, openUntil });
      throw new ArenaError("arena circuit open", { kind: "circuit_open", path, attempts: 0 });
    }

    const started = Date.now();
    let url = base + path;
    let lastErr = null;
    let hopped = false;
    // `fetchImpl` é opcional, mas o default é resolvido A CADA chamada: testes
    // substituem `globalThis.fetch` depois do import e precisam ser respeitados.
    const doFetch = fetchImpl ?? globalThis.fetch;

    for (let attempt = 0; attempt <= tries; attempt++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), tmo);
      try {
        const res = await doFetch(url, {
          signal: ctrl.signal,
          headers: { "User-Agent": "radar-mlbb/0.1" },
        });

        if (res.status >= 500) {
          // 500/502/503/504: 1 hop para host alternativo explícito (allowlist).
          let host = null;
          try {
            const alt = res.headers?.get?.("x-alt-host");
            host = alt ? new URL(alt).origin : null;
          } catch { host = null; }
          if (!hopped && host && (host === baseOrigin || altAllow.has(host))) {
            hopped = true;
            url = host + path;
            if (attempt < tries) {
              await sleep(200 + Math.random() * 150);
              continue;
            }
          }
          throw new ArenaError(`arena ${res.status} em ${path}`, {
            kind: "upstream_status", status: res.status, path,
          });
        }
        if (!res.ok) {
          throw new ArenaError(`arena ${res.status} em ${path}`, {
            kind: "upstream_status", status: res.status, path,
          });
        }

        const json = await readJson(res, path);
        consecutiveFailures = 0;
        log.debug(LOG_EVENTS.ARENA_OK, {
          provider: "arena", path, status: res.status, attempt: attempt + 1, ms: Date.now() - started,
        });
        return json;
      } catch (e) {
        lastErr = e;
        if (attempt < tries) await sleep(300 * 2 ** attempt + Math.random() * 200);
      } finally {
        clearTimeout(t);
      }
    }

    consecutiveFailures++;
    if (consecutiveFailures >= 5) openUntil = Date.now() + 60_000;

    const err = lastErr instanceof ArenaError
      ? new ArenaError(lastErr.message, {
          kind: lastErr.kind,
          status: lastErr.status,
          path: lastErr.path || path,
          attempts: tries + 1,
          cause: lastErr.cause ?? lastErr,
        })
      : new ArenaError(String(/** @type {{ message?: unknown }} */ (lastErr)?.message ?? lastErr), {
          kind: kindOf(lastErr), path, attempts: tries + 1, cause: lastErr,
        });

    log.warn(LOG_EVENTS.ARENA_FAILURE, {
      provider: "arena",
      path,
      kind: err.kind,
      status: err.status,
      attempts: tries + 1,
      ms: Date.now() - started,
    });
    throw err;
  }

  return {
    get,
    circuitState: () => ({
      consecutive_failures: consecutiveFailures,
      open: Date.now() < openUntil,
      open_until: openUntil || null,
    }),
    resetCircuit: () => { consecutiveFailures = 0; openUntil = 0; },
    config: { base, conc },
  };
}

/** Cliente de produção. Estado de breaker compartilhado por todo o processo. */
export const arena = createArenaClient();

/**
 * Compatibilidade: chamada crua por path. Prefira os métodos tipados de
 * `providers/arena/index.js` — este aqui existe para casos pontuais e teste.
 *
 * @param {string} path
 * @param {{ timeoutMs?: number, retries?: number }} [opts]
 * @returns {Promise<any>}
 */
export function arenaGet(path, opts) {
  return arena.get(path, opts);
}

export function arenaCircuitState() {
  return arena.circuitState();
}

export function resetArenaCircuit() {
  arena.resetCircuit();
}

/** Valores aceitos pela fonte. Ficam aqui porque são o contrato de query dela. */
export const RANKS = ["all", "epic", "legend", "mythic", "honor", "glory"];
export const WINDOWS = [1, 3, 7, 15, 30];

/**
 * @param {{ days?: number, rank?: string, size?: number, index?: number }} [opts]
 * @returns {string}
 */
export function rankPath({ days = 7, rank = "mythic", size = 50, index = 1 } = {}) {
  const q = new URLSearchParams({ days: String(days), rank, size: String(size), index: String(index) });
  return `/api/heroes/rank?${q}`;
}
