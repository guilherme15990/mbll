// Cliente tipado da Rone Arena API — R-ING-1: timeout, retry backoff+jitter, concorrência.
// Base padrão: fastapicloud (respondeu 14/14 sem 429). rone.dev fica como alt host
// quando configurado em ARENA_ALT_HOSTS; o mirror devolve 500 HTML em rajada.
import { config } from "./config.js";

// F2: nenhuma leitura solta de process.env — tudo vem de config.js (fail-fast).
const BASE = config.arena.base;
// SEC H-01: failover só segue host alternativo explícito e permitido.
const ALT_ALLOW = new Set(config.arena.altHosts);
const CONC = config.arena.conc;
const BREAKER_THRESHOLD = 5;
const BREAKER_COOLDOWN_MS = 60_000;

let consecutiveFailures = 0;
let openUntil = 0;

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

export function arenaCircuitState() {
  return {
    consecutive_failures: consecutiveFailures,
    open: Date.now() < openUntil,
    open_until: openUntil || null,
  };
}

export function resetArenaCircuit() {
  consecutiveFailures = 0;
  openUntil = 0;
}

// HTML/não-JSON é erro de upstream — nunca JSON.parse cego (o mirror devolve página de erro).
// Fallback para `res.json()` mantém compatibilidade com mocks de teste que só expõem json().
async function readJson(res, path) {
  const ct = String(res.headers?.get?.("content-type") ?? "").toLowerCase();
  if (typeof res.text === "function") {
    const text = await res.text();
    if (ct.includes("text/html") || ct.includes("application/xhtml") || /^\s*</.test(text)) {
      throw new Error(`arena non-json em ${path}`);
    }
    try { return JSON.parse(text); } catch { throw new Error(`arena invalid json em ${path}`); }
  }
  return res.json();
}

export async function arenaGet(path, { timeoutMs = 12000, retries = 3 } = {}) {
  if (Date.now() < openUntil) throw new Error("arena circuit open");
  let url = BASE + path;
  let lastErr;
  let hopped = false;
  const baseOrigin = (() => { try { return new URL(BASE).origin; } catch { return null; } })();

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "radar-mlbb/0.1" } });
      if (res.status >= 500) {
        // 500/502/503/504: 1 hop para host alternativo explícito (allowlist) ou o próprio base.
        let host = null;
        try {
          const alt = res.headers?.get?.("x-alt-host");
          host = alt ? new URL(alt).origin : null;
        } catch { host = null; }
        if (!hopped && host && (host === baseOrigin || ALT_ALLOW.has(host))) {
          hopped = true;
          url = host + path;
          if (attempt < retries) { await sleep(200 + Math.random() * 150); continue; }
        }
        throw new Error(`arena ${res.status} em ${path}`);
      }
      if (!res.ok) throw new Error(`arena ${res.status} em ${path}`);
      const json = await readJson(res, path);
      consecutiveFailures = 0;
      return json;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await sleep(300 * 2 ** attempt + Math.random() * 200);
    } finally { clearTimeout(t); }
  }

  consecutiveFailures++;
  if (consecutiveFailures >= BREAKER_THRESHOLD) openUntil = Date.now() + BREAKER_COOLDOWN_MS;
  throw lastErr ?? new Error("arena indisponível");
}

// Mapa de concorrência simples
export async function mapConc(items, fn, conc = CONC) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(conc, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  });
  await Promise.all(workers);
  return out;
}

export const RANKS = ["all", "epic", "legend", "mythic", "honor", "glory"];
export const WINDOWS = [1, 3, 7, 15, 30];

export function rankPath({ days = 7, rank = "mythic", size = 50, index = 1 }) {
  const q = new URLSearchParams({ days: String(days), rank, size: String(size), index: String(index) });
  return `/api/heroes/rank?${q}`;
}
