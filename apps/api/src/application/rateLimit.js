// Rate limit em memória (token bucket) — zero-dep e sem timer de fundo.
// Chave = cliente (IP). Cada bucket reabastece `rps` tokens/s até `burst`.
//
// O relógio é injetável para teste determinístico. O mapa tem teto (`maxKeys`):
// ao atingir, remove primeiro buckets cheios (ociosos) e depois os mais antigos,
// para que um ataque de IPs forjados não cresça a memória sem limite.
export function createRateLimiter({ rps, burst, now = Date.now, maxKeys = 10_000 } = {}) {
  if (!(rps > 0)) throw new Error("rateLimit: rps deve ser > 0");
  if (!(burst > 0)) throw new Error("rateLimit: burst deve ser > 0");
  const buckets = new Map(); // key -> { tokens, at }

  function prune(t) {
    for (const [key, b] of buckets) {
      const idleMs = t - b.at;
      if (b.tokens >= burst && idleMs > (burst / rps) * 1000) buckets.delete(key);
      if (buckets.size < maxKeys) return;
    }
    // ainda cheio: derruba os mais antigos (Map preserva ordem de inserção)
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (buckets.size < maxKeys) return;
    }
  }

  function take(key) {
    const t = now();
    let b = buckets.get(key);
    if (!b) {
      if (buckets.size >= maxKeys) prune(t);
      b = { tokens: burst, at: t };
      buckets.set(key, b);
    } else {
      const elapsedSec = Math.max(0, t - b.at) / 1000;
      b.tokens = Math.min(burst, b.tokens + elapsedSec * rps);
      b.at = t;
    }
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return { allowed: true, remaining: Math.floor(b.tokens), limit: burst, retryAfterMs: 0 };
    }
    const retryAfterMs = Math.max(1, Math.ceil(((1 - b.tokens) / rps) * 1000));
    return { allowed: false, remaining: 0, limit: burst, retryAfterMs };
  }

  return {
    take,
    get size() { return buckets.size; },
  };
}
