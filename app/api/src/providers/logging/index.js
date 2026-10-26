// Camada de logging do backend (ADR-045).
//
// Uma linha JSON por evento, zero-dep. O que ela garante:
//
// 1. **Contexto automático.** Todo evento emitido dentro de um request carrega
//    `requestId` (e, quando útil, método/rota) sem o chamador passar nada —
//    via `AsyncLocalStorage` em `context.js`.
// 2. **Nível declarado e filtrável.** `silent < error < warn < info < debug`.
//    `warn` existe porque falha de upstream não é erro de aplicação: é aviso
//    que precisa aparecer sem sujar o alerta de 500.
// 3. **Redação.** Campos sensíveis (`authorization`, `cookie`, `token`, ...)
//    nunca chegam ao sink, mesmo que alguém passe o objeto inteiro.
// 4. **Serialização à prova de ciclo.** `JSON.stringify` que lança não pode
//    derrubar o processo que estava apenas tentando logar.
// 5. **Logger configurável.** `configureLogging(logger)` é chamado pelo
//    servidor; módulos de application pedem `getLogger()` na hora de logar
//    (nunca guardam a referência), então o nível injetado em teste vale.
import { currentRequestContext } from "./context.js";

/** @typedef {"silent" | "error" | "warn" | "info" | "debug"} LogLevel */

const PRIORITY = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

// Chaves comparadas em minúsculas. Redação é rasa por design: o log não é
// depósito de payload, e varrer objeto profundo custa caro no caminho quente.
const SENSITIVE = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "token",
  "access_token",
  "password",
  "secret",
]);

/** Nomes de evento estáveis — evita divergência de string em busca/alertas. */
export const LOG_EVENTS = Object.freeze({
  REQUEST: "request",
  UNHANDLED_ERROR: "unhandled_error",
  ARENA_OK: "arena_ok",
  ARENA_FAILURE: "arena_failure",
  ARENA_CIRCUIT_OPEN: "arena_circuit_open",
  LANE_UNMAPPED: "lane_unmapped",
  SERVER_LISTENING: "server_listening",
  LISTEN_FAILED: "listen_failed",
  SHUTDOWN: "shutdown",
  SHUTDOWN_DONE: "shutdown_done",
});

/**
 * Campos de erro seguros para log. `Error` não serializa (`{}`), então
 * nome/mensagem/código/stack precisam ser extraídos explicitamente.
 *
 * @param {unknown} e
 * @returns {{ name: string, message: string, code?: string, stack?: string }}
 */
export function serializeError(e) {
  if (!(e instanceof Error)) return { name: "NonError", message: String(e) };
  const out = { name: e.name || "Error", message: e.message || "" };
  const code = /** @type {{ code?: unknown }} */ (e).code;
  if (typeof code === "string") out.code = code;
  if (e.stack) out.stack = e.stack;
  return out;
}

/**
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {unknown}
 */
function redact(value, depth = 0) {
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object" && depth < 3) {
    if (value instanceof Error) return serializeError(value);
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE.has(k.toLowerCase()) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * @typedef {Object} Logger
 * @property {string} level
 * @property {(fields: Record<string, unknown>) => Logger} child
 * @property {(msg: string, fields?: Record<string, unknown>) => void} error
 * @property {(msg: string, fields?: Record<string, unknown>) => void} warn
 * @property {(msg: string, fields?: Record<string, unknown>) => void} info
 * @property {(msg: string, fields?: Record<string, unknown>) => void} debug
 */

/**
 * Cria um logger. `sink` é injetável em teste (`{ log, error }`).
 *
 * @param {LogLevel | string} [level]
 * @param {{ log: (line: string) => void, error?: (line: string) => void }} [sink]
 * @param {Record<string, unknown>} [base] campos fixos do logger (ex.: `{ provider: "arena" }`)
 * @returns {Logger}
 */
export function createLogger(level = "info", sink = console, base = {}) {
  const min = PRIORITY[/** @type {LogLevel} */ (level)] ?? PRIORITY.info;

  const emit = (lvl, msg, fields = {}) => {
    if (PRIORITY[/** @type {LogLevel} */ (lvl)] > min) return;
    const ctx = currentRequestContext();
    const event = {
      ts: new Date().toISOString(),
      level: lvl,
      msg,
      ...(ctx?.requestId ? { requestId: ctx.requestId } : {}),
      ...base,
      .../** @type {Record<string, unknown>} */ (redact(fields)),
    };
    let line;
    try {
      line = JSON.stringify(event);
    } catch {
      // Ciclo ou BigInt: o log nunca derruba o processo.
      line = JSON.stringify({ ts: event.ts, level: lvl, msg, log_error: "serialization_failed" });
    }
    if (lvl === "error" && typeof sink.error === "function") sink.error(line);
    else sink.log(line);
  };

  return {
    level,
    child: (fields) => createLogger(level, sink, { ...base, ...fields }),
    error: (msg, fields) => emit("error", msg, fields),
    warn: (msg, fields) => emit("warn", msg, fields),
    info: (msg, fields) => emit("info", msg, fields),
    debug: (msg, fields) => emit("debug", msg, fields),
  };
}

/** @type {Logger | null} */
let configured = null;

/**
 * Adapta um logger mínimo (teste/observador) ao contrato completo.
 *
 * O servidor aceita `{ info, error }` desde antes da ADR-045. Em vez de exigir
 * que todo teste implemente `child`/`warn`, completamos os métodos ausentes
 * aqui: `warn` cai em `info` (mesma linha, nível diferente não é inventado) e
 * `child` devolve o próprio logger — o teste que só observa não precisa de
 * herança de campos.
 *
 * @param {{
 *   level?: string,
 *   child?: Function,
 *   error: Function,
 *   warn?: Function,
 *   info: Function,
 *   debug?: Function,
 * }} logger
 * @returns {Logger}
 */
export function normalizeLogger(logger) {
  const complete = typeof logger.warn === "function" && typeof logger.child === "function";
  if (complete) return /** @type {Logger} */ (logger);
  const noop = () => {};
  // Logger injetado não passa pelo `emit` de `createLogger`, mas ainda precisa
  // carregar o requestId — senão um adapter externo (pino/winston) perderia a
  // correlação justamente em produção.
  const enrich = (fields) => {
    const ctx = currentRequestContext();
    if (!ctx?.requestId) return fields;
    return { requestId: ctx.requestId, ...fields };
  };
  return {
    level: typeof logger.level === "string" ? logger.level : "info",
    child: (fields) =>
      typeof logger.child === "function"
        ? normalizeLogger(logger.child(fields))
        : normalizeLogger(logger),
    error: (msg, fields) => logger.error(msg, enrich(fields)),
    warn: typeof logger.warn === "function" ? (msg, fields) => logger.warn(msg, enrich(fields)) : (msg, fields) => logger.info(msg, enrich(fields)),
    info: (msg, fields) => logger.info(msg, enrich(fields)),
    debug: typeof logger.debug === "function" ? (msg, fields) => logger.debug(msg, enrich(fields)) : noop,
  };
}

/**
 * Instala o logger do processo. Chamado pelo servidor HTTP com o logger
 * efetivo (inclusive o espião de teste). Idempotente.
 *
 * @param {{
 *   level?: string,
 *   child?: Function,
 *   error: Function,
 *   warn?: Function,
 *   info: Function,
 *   debug?: Function,
 * }} logger
 */
export function configureLogging(logger) {
  configured = normalizeLogger(logger);
}

/** Instância única do fallback: `getLogger()` não aloca por chamada. */
const SILENT = createLogger("silent");

/**
 * Logger atual. O default é `silent` para que importar um módulo de application
 * em teste/script não imprima nada; produção configura no boot.
 *
 * @returns {Logger}
 */
export function getLogger() {
  return configured ?? SILENT;
}
