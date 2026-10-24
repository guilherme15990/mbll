// Fonte ÚNICA de configuração da API (F2).
//
// Regra: o processo NÃO sobe com valor inválido. Cada variável é validada no
// import e o erro aponta o nome e o valor recebido — sem fallback silencioso
// para NaN/undefined (era a causa de `ARENA_CONC=abc` virar fan-out vazio).
//
// `parseConfig(env)` é pura e testável; `config` é a leitura do process.env.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // apps/api/src
const DEFAULT_WEB_DIST = join(HERE, "..", "..", "web", "dist");
const LOG_LEVELS = ["silent", "error", "info", "debug"];

function fail(name, value, expected) {
  throw new Error(`config inválida: ${name}=${JSON.stringify(value)} (esperado: ${expected})`);
}

function int(env, name, def, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = env[name];
  if (raw === undefined || raw === "") return def;
  if (!/^-?\d+$/.test(String(raw))) fail(name, raw, "inteiro");
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) fail(name, raw, `inteiro entre ${min} e ${max}`);
  return n;
}

function bool(env, name, def) {
  const raw = env[name];
  if (raw === undefined || raw === "") return def;
  const v = String(raw).trim().toLowerCase();
  if (["1", "true", "on", "yes"].includes(v)) return true;
  if (["0", "false", "off", "no"].includes(v)) return false;
  fail(name, raw, "booleano (1/0, true/false, on/off)");
}

function urlString(env, name, def) {
  const raw = env[name];
  if (raw === undefined || raw === "") return def;
  let u;
  try { u = new URL(String(raw)); } catch { fail(name, raw, "URL absoluta"); }
  if (u.protocol !== "http:" && u.protocol !== "https:") fail(name, raw, "URL http(s)");
  return String(raw).replace(/\/+$/, "");
}

function altHosts(env) {
  const raw = env.ARENA_ALT_HOSTS;
  if (raw === undefined || raw === "") return [];
  return String(raw).split(",").map((s) => s.trim()).filter(Boolean).map((item) => {
    let u;
    try { u = new URL(item); } catch { fail("ARENA_ALT_HOSTS", item, "URL absoluta por host"); }
    if (u.protocol !== "http:" && u.protocol !== "https:") fail("ARENA_ALT_HOSTS", item, "URL http(s)");
    return u.origin;
  });
}

function logLevel(env) {
  const raw = env.LOG_LEVEL;
  if (raw === undefined || raw === "") return "info";
  const v = String(raw).trim().toLowerCase();
  if (!LOG_LEVELS.includes(v)) fail("LOG_LEVEL", raw, LOG_LEVELS.join("|"));
  return v;
}

export function parseConfig(env = process.env) {
  const webDist = env.WEB_DIST ? resolve(String(env.WEB_DIST)) : DEFAULT_WEB_DIST;
  return {
    port: int(env, "PORT", 3001, { min: 0, max: 65535 }),
    arena: {
      base: urlString(env, "ARENA_BASE", "https://arena.fastapicloud.dev"),
      altHosts: altHosts(env),
      // fan-out concorrente: 1..32. Acima disso a fonte externa passa a 429.
      conc: int(env, "ARENA_CONC", 4, { min: 1, max: 32 }),
    },
    cache: {
      // compat: só "off" desliga o SQLite; qualquer outro valor mantém ligado.
      sqlite: env.SQLITE_CACHE !== "off",
      file: env.SQLITE_FILE || "./data/cache.sqlite",
    },
    http: {
      webDist,
      logLevel: logLevel(env),
      // X-Forwarded-For só é confiável atrás de proxy conhecido.
      trustProxy: bool(env, "TRUST_PROXY", false),
      rateLimit: {
        enabled: !bool(env, "RATE_LIMIT_OFF", false),
        rps: int(env, "RATE_LIMIT_RPS", 20, { min: 1, max: 10_000 }),
        burst: int(env, "RATE_LIMIT_BURST", 60, { min: 1, max: 100_000 }),
      },
      shutdownTimeoutMs: int(env, "SHUTDOWN_TIMEOUT_MS", 10_000, { min: 100, max: 120_000 }),
    },
  };
}

export const config = parseConfig(process.env);
