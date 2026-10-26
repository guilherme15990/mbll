// GET /views/:view — visões agregadas (semana, elo, tier).
import { mapConc, RANKS } from "../providers/arena/index.js";
import { fetchRankAll } from "../application/rankLot.js";
import { score } from "../application/scoring.js";

export async function viewsRoute(path, sp) {
  const m = /^\/views\/(semana|elo|tier)$/.exec(path);
  if (!m) return { status: 410, body: { error: "view_not_supported", message: "View not supported in Phase 1" } };
  const view = m[1];
  const rank = sp.get("rank") ?? "mythic", window = Number(sp.get("window") ?? 7);
  if (view === "elo") {
    // EC-007: um elo falho não derruba os outros — marca parcial
    const perRank = await mapConc(RANKS.filter((r) => r !== "all"), async (r) => {
      try {
        const fetchedR = await fetchRankAll({ days: window, rank: r });
        return { rank: r, top: score(fetchedR.rows, { prior: fetchedR.prior ?? null, gameVersion: fetchedR.gameVersion ?? null }).sort((a, b) => b.z - a.z).slice(0, 10) };
      } catch (e) {
        return { rank: r, error: "upstream_unavailable", top: [] };
      }
    });
    const partial = perRank.some((r) => r.error);
    return { status: partial ? 206 : 200, body: { data: perRank, partial } };
  }
  const fetchedV = await fetchRankAll({ days: window, rank });
  const s = score(fetchedV.rows, { prior: fetchedV.prior ?? null, gameVersion: fetchedV.gameVersion ?? null });
  if (view === "semana") return { status: 200, body: { data: { strongest: [...s].sort((a, b) => b.z - a.z).slice(0, 10), weakest: [...s].sort((a, b) => a.z - b.z).slice(0, 10) }, rank, window } };
  const byTier = { S: [], A: [], B: [], C: [], D: [] };
  s.forEach((h) => byTier[h.tier].push(h));
  return { status: 200, body: { data: byTier, rank, window } };
}
