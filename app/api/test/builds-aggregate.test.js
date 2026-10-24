import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Cache em memória: o teste não deve gravar um corpo sintético no SQLite local.
process.env.SQLITE_CACHE = "off";
const { cacheSet } = await import("../src/infra/cacheStore.js");
const { router, aggCacheKey } = await import("../src/routes.js");

describe("validação da rota de agregado sem tocar no upstream", () => {
  it("lane obrigatória, population=pro fora do MVP, top só 10/20", async () => {
    assert.equal((await router("/builds/aggregate", new URLSearchParams())).status, 422);
    const pro = await router("/builds/aggregate", new URLSearchParams({ lane: "gold", population: "pro" }));
    assert.equal(pro.status, 400);
    assert.equal(pro.body.error, "population_not_supported");
    assert.equal((await router("/builds/aggregate", new URLSearchParams({ lane: "gold", top: "50" }))).status, 400);
    assert.equal((await router("/builds/aggregate", new URLSearchParams({ lane: "gold", rank: "xyz" }))).status, 400);
    assert.equal((await router("/builds/aggregate", new URLSearchParams({ lane: "gold", window: "2" }))).status, 400);
  });

  it("corpo parcial em cache responde 200 + partial=true (não 206)", async () => {
    const key = aggCacheKey({ rank: "mythic", lane: "roam", top: 20, population: "ranked", window: 30 });
    cacheSet(key, {
      partial: true,
      context: { rank: "mythic", lane: "roam", window: 30, top: 20, population: "ranked" },
      sources: {},
      cells: [{ status: "error" }],
    });
    const res = await router("/builds/aggregate", new URLSearchParams({
      lane: "roam", rank: "mythic", top: "20", window: "30",
    }));
    assert.equal(res.status, 200);
    assert.equal(res.body.partial, true);
    assert.equal(res.body.context.cache_hit, true);
  });
});
