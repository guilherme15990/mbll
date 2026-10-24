// Rate limit (F2): token bucket puro, sem timer e com relógio injetado.
// Cobre o contrato que o servidor usa: allowed/remaining/limit/retryAfterMs,
// isolamento por chave, recarga por tempo e teto de memória (maxKeys).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../src/application/rateLimit.js";

function clock(start = 0) {
  const state = { t: start };
  return { now: () => state.t, advance: (ms) => { state.t += ms; } };
}

describe("rate limit: token bucket", () => {
  it("permite burst inicial e bloqueia o excedente com retryAfterMs", () => {
    const c = clock();
    const rl = createRateLimiter({ rps: 2, burst: 3, now: c.now });
    const results = [1, 2, 3].map(() => rl.take("ip"));
    assert.deepEqual(results.map((r) => r.allowed), [true, true, true]);
    assert.deepEqual(results.map((r) => r.remaining), [2, 1, 0]);
    assert.equal(results[0].limit, 3);

    const blocked = rl.take("ip");
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
    assert.equal(blocked.retryAfterMs, 500); // 1 token a 2/s
  });

  it("recarrega proporcionalmente ao tempo (sem estourar o burst)", () => {
    const c = clock();
    const rl = createRateLimiter({ rps: 2, burst: 3, now: c.now });
    for (let i = 0; i < 3; i++) rl.take("ip");

    c.advance(500); // +1 token
    assert.equal(rl.take("ip").allowed, true);
    assert.equal(rl.take("ip").allowed, false);

    c.advance(60_000); // muito tempo: satura em burst, não acumula infinito
    const after = [1, 2, 3, 4].map(() => rl.take("ip"));
    assert.deepEqual(after.map((r) => r.allowed), [true, true, true, false]);
  });

  it("isola chaves diferentes", () => {
    const c = clock();
    const rl = createRateLimiter({ rps: 1, burst: 1, now: c.now });
    assert.equal(rl.take("a").allowed, true);
    assert.equal(rl.take("a").allowed, false);
    assert.equal(rl.take("b").allowed, true); // b tem o próprio bucket
    assert.equal(rl.size, 2);
  });

  it("relógio que anda para trás não gera token negativo", () => {
    const c = clock(10_000);
    const rl = createRateLimiter({ rps: 1, burst: 1, now: c.now });
    rl.take("ip");
    c.advance(-5_000);
    assert.equal(rl.take("ip").allowed, false);
  });

  it("respeita maxKeys (proteção contra IPs forjados)", () => {
    const c = clock();
    const rl = createRateLimiter({ rps: 1, burst: 1, maxKeys: 3, now: c.now });
    for (const key of ["a", "b", "c", "d", "e", "f"]) rl.take(key);
    assert.ok(rl.size <= 3, `size=${rl.size}`);
  });

  it("args inválidos falham cedo", () => {
    assert.throws(() => createRateLimiter({ rps: 0, burst: 1 }), /rps/);
    assert.throws(() => createRateLimiter({ rps: 1, burst: 0 }), /burst/);
  });
});
