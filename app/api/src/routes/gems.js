// GET /gems — heróis com sinal acima da mediana e pressão baixa de pick/ban.
import { rankLot } from "../composition.js";
const { fetchRankAll } = rankLot;
import { score } from "../application/scoring.js";

export async function gemsRoute(sp) {
  const rank = sp.get("rank") ?? "mythic", window = Number(sp.get("window") ?? 7);
  const fetchedG = await fetchRankAll({ days: window, rank });
  const gems = score(fetchedG.rows, { prior: fetchedG.prior ?? null, gameVersion: fetchedG.gameVersion ?? null }).filter((h) => h.isGem).sort((a, b) => b.z - a.z);
  return { status: 200, body: { data: gems.map((g) => ({ ...g, reason: `win ${g.win} acima da mediana, pick ${g.pick} e ban baixos` })), rank, window } };
}
