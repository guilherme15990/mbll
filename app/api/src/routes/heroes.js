// GET /heroes — lote pontuado com paginação/ordenação no servidor.
import { cacheGet } from "../infra/cacheStore.js";
import { checkPickSum, walkPriorStamp, STRENGTH_INDEX_VERSION } from "@radar/engine";
import { rankLot } from "../composition.js";
const { fetchRankAll, lastVerifiedPosterior } = rankLot;
import { qHeroes, scoreLot, paginate } from "../application/scoring.js";
import { versions, patchFlag, currentGameVersion } from "../application/versions.js";
import { markLayerOk, markLayerError } from "../application/health.js";

export async function heroesRoute(sp) {
  const q = qHeroes(sp);
  if (q.error) return { status: 400, body: q };
  try {
    const fetched = await fetchRankAll({ days: q.window, rank: q.rank });
    markLayerOk();
    // ADR-023 L2-WF-01/WF-05: pontua com o prior da série; carimbo no payload.
    const { scored, meta } = scoreLot(fetched.rows, { prior: fetched.prior ?? null, gameVersion: fetched.gameVersion ?? null });
    const pickSum = checkPickSum(fetched.rows.map((h) => h.pick));
    const page = paginate(scored, q);
    const vers = await versions();
    return { status: 200, body: { data: page.data, total: page.total, rank: q.rank, window: q.window, collectedAgoMs: fetched.ageMs, stale: fetched.stale, truncated: !!fetched.truncated, totalFonte: fetched.totalFonte ?? page.total, pickSumCheck: pickSum, exposure: { unit: "slot_share", status: "unvalidated" }, meta, prior: walkPriorStamp(fetched.prior ?? null), index_basis: { method: STRENGTH_INDEX_VERSION, n: page.total }, ...patchFlag(vers) } };
  } catch (e) {
    markLayerError(e);
    const hit = cacheGet(`rank:${q.rank}:${q.window}`, "A");
    // EC-009: fallback aplica o mesmo filtro/ordem/página sobre o último dado válido
    if (hit.hit) {
      const fbPrior = lastVerifiedPosterior({ fonte: "heroes", rank: q.rank, janela: q.window });
      const fbGv = currentGameVersion();
      const fb = scoreLot(hit.body, { prior: fbPrior, gameVersion: fbGv });
      const page = paginate(fb.scored, q);
      return { status: 200, body: { data: page.data, total: page.total, stale: true, fallback: true, collectedAgoMs: hit.ageMs, rank: q.rank, window: q.window, pickSumCheck: checkPickSum((hit.body ?? []).map((h) => h.pick)), exposure: { unit: "slot_share", status: "unvalidated" }, meta: fb.meta, prior: walkPriorStamp(fbPrior), index_basis: { method: STRENGTH_INDEX_VERSION, n: page.total } } };
    }
    return { status: 502, body: { error: "upstream_unavailable", message: "Upstream unavailable, try again" } };
  }
}
