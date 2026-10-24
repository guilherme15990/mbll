// Smoke manual (não roda no `npm test`): exercita ingestão real + score + cache.
// node ./test/live-smoke.mjs — exige internet; falha graciosa sem rede.
import { router } from "../src/routes.js";

const t0 = Date.now();
try {
  const r = await router("/heroes", new URLSearchParams({ rank: "mythic", window: "7", size: "2", index: "1" }));
  console.log(`status=${r.status} total=${r.body.total} ms=${Date.now() - t0}`);
  console.log(JSON.stringify(r.body.data[0], null, 1).slice(0, 600));
  const t1 = Date.now();
  const r2 = await router("/heroes", new URLSearchParams({ rank: "mythic", window: "7", size: "2", index: "1" }));
  console.log(`cache2 status=${r2.status} stale=${r2.body.stale} ms=${Date.now() - t1}`);
} catch (e) {
  console.log("SMOKE-SKIP (sem rede): " + String(e?.message ?? e).slice(0, 120));
}
