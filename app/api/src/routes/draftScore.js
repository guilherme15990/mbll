// GET /heroes/draft-score?rank=&window= — Draft Score do herói (número ÚNICO).
//
// UM número 0–100 por herói: min–max da WR no recorte (melhor WR lê 100, pior lê
// 0). A matemática vive no motor (`hero-draft-score-v1`); aqui só a validação de
// query e o encaminhamento ao caso de uso.
import { RANKS } from "../providers/arena/index.js";
import { isRank, isWindow, WINDOWS } from "../application/validation.js";
import { heroDraftScoreBody } from "../application/heroDraftScore.js";

export async function heroDraftScoreRoute(sp) {
  const rank = sp.get("rank") ?? "mythic";
  const days = Number(sp.get("window") ?? sp.get("days") ?? 7);
  if (!isRank(rank) || !isWindow(days)) {
    return { status: 400, body: { error: "rank_invalid", message: "Invalid rank or window", ranks: RANKS, windows: [...WINDOWS] } };
  }
  return heroDraftScoreBody(rank, days);
}
