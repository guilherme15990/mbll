// Confrontos (counters/sinergias) e o proxy BPS derivado deles.
// O δ é efeito do par, nunca veredito; par ausente = desconhecido, nunca 0.
// O livro de pares vive em `application/matchupBook.js` (fonte única, cache C).
import { RANKS } from "../providers/arena/index.js";
import { cacheGet } from "../infra/cacheStore.js";
import { blindProxy } from "@radar/proprietary-engine";
import { isRank, isWindow, WINDOWS } from "../application/validation.js";
import {
  matchupBook, matchupBookCacheKey, loadMatchupBook,
} from "../application/matchupBook.js";

// GET /heroes/:id/matchups — counters + sinergias com δ, retratos e curva de duração
export async function matchupsRoute(sp, id) {
  const rank = sp.get("rank") ?? "mythic", days = Number(sp.get("days") ?? sp.get("window") ?? 7);
  if (!isRank(rank) || !isWindow(days)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank or days", ranks: RANKS, windows: [...WINDOWS] } };
  const r = await matchupBook(Number(id), rank, days);
  if (r.status !== 200) return r;
  return { status: 200, body: { ...r.body, stale: false } };
}

// GET /heroes/:id/blind?rank=&days= — BPS proxy sobre δ elegíveis
export async function blindRoute(sp, id) {
  const rank = sp.get("rank") ?? "mythic", days = Number(sp.get("days") ?? sp.get("window") ?? 7);
  if (!isRank(rank) || !isWindow(days)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank or days", ranks: RANKS, windows: [...WINDOWS] } };
  // O blind reaproveita qualquer hit do cache (mesmo stale) — comportamento histórico.
  const hit = cacheGet(matchupBookCacheKey(Number(id), rank, days), "C");
  let body = hit.hit ? hit.body : null;
  if (!body) {
    const r = await loadMatchupBook(Number(id), rank, days);
    if (r.status !== 200) return r;
    body = r.body;
  }
  const deltas = [...(body.countersUp ?? []), ...(body.countersDown ?? [])].map((p) => p.delta).filter(Number.isFinite);
  const proxy = blindProxy(deltas);
  const worst = [...(body.countersDown ?? []), ...(body.countersUp ?? [])].filter((p) => Number.isFinite(p.delta)).sort((a, b) => a.delta - b.delta)[0] ?? null;
  return { status: 200, body: { id: Number(id), rank, days, ...proxy, pair_coverage: "extremes-only", worst_counter: worst ? { id: worst.id, name: worst.name, delta: worst.delta, pair_key: worst.pair_key } : null, worst_observed: proxy.worst_observed } };
}
