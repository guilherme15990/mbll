// Fonte ÚNICA de configuração da API (F2) + diretório de dados (F3).
//
// Regra: o processo NÃO sobe com valor inválido. Cada variável é validada no
// import e o erro aponta o nome e o valor recebido — sem fallback silencioso
// para NaN/undefined (era a causa de `ARENA_CONC=abc` virar fan-out vazio).
//
// `parseConfig(env)` é pura e testável; `config` é a leitura do process.env.
//
// F3: `DATA_DIR` ancora TODO estado persistente na raiz do repo (não no CWD).
// Antes, `SQLITE_FILE=./data/cache.sqlite` criava um banco por diretório de
// execução (data/, app/api/data, app/web/data, app/api/src/data).
//
// ── Variáveis de ambiente (ESTE bloco é a documentação; não há .env.example) ───
//
// O processo NÃO lê arquivo .env: os valores vêm do ambiente (`process.env`) e os
// DEFAULTS abaixo são o que roda sem nada setado. Variável de ambiente é para
// OPERAÇÃO (porta, caminho de dados, host externo) — regra de negócio não mora
// aqui. Como passar: PowerShell `$env:PORT="3001"; node app/api/src/index.js`
// ou Bash `PORT=3001 node app/api/src/index.js`. Booleano aceita 1/0, true/false,
// on/off, yes/no (case-insensitive).
//
// PORT                 int 3001                 porta HTTP (0..65535)
// DATA_DIR             <repo>/data             raiz de TODO estado local (SQLite); relativo à RAIZ DO REPO, não ao CWD
// SQLITE_FILE          $DATA_DIR/cache.sqlite  override explícito do arquivo (relativo ao CWD)
// SQLITE_CACHE         on                      "off" desliga o SQLite (fallback em memória)
// ARENA_BASE           https://arena.fastapicloud.dev   base do upstream
// ARENA_ALT_HOSTS      (vazio)                 allowlist de hosts de failover (o header x-alt-host só é seguido se o host estiver aqui); vazio = sem failover
// ARENA_CONC           int 4                   requisições paralelas à fonte (1..32; acima disso a fonte responde 429)
// LOG_LEVEL            info                    silent | error | warn | info | debug
// TRUST_PROXY          false                   confia em X-Forwarded-For p/ o rate limit — só ligue atrás de proxy conhecido
// RATE_LIMIT_OFF       false                   "1" desliga o rate limit por IP (útil em teste de carga local)
// RATE_LIMIT_RPS       int 20                  requisições/s por cliente (1..10000)
// RATE_LIMIT_BURST     int 60                  rajada por cliente (1..100000)
// SHUTDOWN_TIMEOUT_MS  int 10000               prazo do shutdown gracioso (100..120000)
// WEB_DIST             app/web/dist            diretório servido em produção (relativo à RAIZ DO REPO)
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // app/api/src/infra
const REPO_ROOT = resolve(HERE, "..", "..", "..", "..");
const DEFAULT_WEB_DIST = join(REPO_ROOT, "app", "web", "dist");
const DEFAULT_DATA_DIR = join(REPO_ROOT, "data");
const LOG_LEVELS = ["silent", "error", "warn", "info", "debug"];

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

// DATA_DIR relativo é relativo à RAIZ DO REPO (não ao CWD): é o que impede
// `node app/api/src/index.js` e `node src/index.js` de criarem bancos diferentes.
function dataDirOf(env) {
  const raw = env.DATA_DIR;
  if (raw === undefined || raw === "") return DEFAULT_DATA_DIR;
  return resolve(REPO_ROOT, String(raw));
}

// SQLITE_FILE é OVERRIDE explícito e mantém a semântica antiga (relativo ao CWD).
// O default, porém, é absoluto e vive em DATA_DIR.
function sqliteFileOf(env, dataDir) {
  const raw = env.SQLITE_FILE;
  if (raw === undefined || raw === "") return join(dataDir, "cache.sqlite");
  return resolve(String(raw));
}

export function parseConfig(env = process.env) {
  const dataDir = dataDirOf(env);
  return {
    repoRoot: REPO_ROOT,
    dataDir,
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
      file: sqliteFileOf(env, dataDir),
    },
    http: {
      webDist: env.WEB_DIST ? resolve(REPO_ROOT, String(env.WEB_DIST)) : DEFAULT_WEB_DIST,
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
