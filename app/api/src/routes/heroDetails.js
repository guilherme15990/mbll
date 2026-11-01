// Ficha do herói e módulos derivados por herói (sem nova coleta quando possível).
//
// Sem Força/Confiança/Ranks/Tempo (ADR-048): /confidence, /rank-diff e
// /temporal saíram do fio HTTP junto com as abas e as rotas planas. O motor
// continua expondo as funções puras; a camada de apresentação não as consome.
import { getTrends } from "../providers/arena/index.js";
import { cacheGet, cacheSet } from "../infra/cacheStore.js";
import {
  distortionResidual, medianPickOf, medianBanOf, classOf,
} from "@radar/engine";
import { rankLot } from "../composition.js";
const { fetchRankAll } = rankLot;
import { scoreLot } from "../application/scoring.js";
import { isRank, isWindow, isDays } from "../application/validation.js";

// GET /heroes/:id
export async function heroRoute(sp, id) {
  const rank = sp.get("rank") ?? "mythic", window = Number(sp.get("window") ?? 7);
  if (!isRank(rank) || !isWindow(window)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank or window" } };
  const fetchedHero = await fetchRankAll({ days: window, rank });
  const lotH = scoreLot(fetchedHero.rows, { prior: fetchedHero.prior ?? null, gameVersion: fetchedHero.gameVersion ?? null });
  const hero = lotH.scored.find((h) => h.id === id);
  if (!hero) return { status: 404, body: { error: "hero_not_found", message: "Hero not found in this rank/window" } };
  let trends = [];
  try {
    const t = await getTrends({ id, rank, days: 30 });
    trends = t?.data?.records ?? [];
  } catch { trends = []; }
  return { status: 200, body: { data: hero, trends, rank, window, meta: lotH.meta } };
}

// GET /heroes/:id/distortion?rank=&window= — DRF pick/ban separados
export async function distortionRoute(sp, id) {
  const rank = sp.get("rank") ?? "mythic", window = Number(sp.get("window") ?? 7);
  if (!isRank(rank) || !isWindow(window)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank or window" } };
  const fetchedD = await fetchRankAll({ days: window, rank });
  const rows = fetchedD.rows;
  const lotD = scoreLot(rows, { prior: fetchedD.prior ?? null, gameVersion: fetchedD.gameVersion ?? null });
  const s = lotD.scored;
  const hero = s.find((h) => h.id === id);
  if (!hero) return { status: 404, body: { error: "hero_not_found", message: "Hero not found" } };
  // Medianas verdadeiras do motor (MIGRACAO §3: antes elemento superior em n par — pode
  // trocar ~meio degrau; mesmo corte de produto). μ/τ da meta (antes: s[0].mu/s[0].tau,
  // que o score nunca preenchia — sempre 0).
  const medPick = medianPickOf(rows), medBan = medianBanOf(rows);
  const muS = lotD.meta.mu ?? 0, tauS = lotD.meta.tau ?? 0; // μ/τ do M1 (score), não das linhas brutas
  const pick = distortionResidual({ observed: hero.pick, expected: medPick, kind: "pick" });
  const ban = distortionResidual({ observed: hero.ban, expected: medBan, kind: "ban" });
  // strength_d derivado NA BORDA ((θ̂−μ)/τ, 2 casas — mesmas casas de antes; d saiu do motor,
  // DESVIO (c)) p/ o fio não mudar de forma; strength_class via classOf (trust.js).
  const strengthD = tauS > 0 ? +((hero.wrAdj - muS) / tauS).toFixed(2) : 0;
  return { status: 200, body: { id: hero.id, rank, window, estimated_strength: hero.wrAdj, observed_win: hero.win, strength_q: hero.q, strength_d: strengthD, strength_class: classOf(hero), mu: muS, tau: tauS, pick, ban, classification_status: "provisional", note: "resíduo é discrepância, nunca erro da comunidade; pick e ban nunca somados" } };
}

// GET /heroes/:id/trends — série diária normalizada
export async function trendsRoute(sp, id) {
  const rank = sp.get("rank") ?? "mythic", days = Number(sp.get("days") ?? 30);
  if (!isRank(rank) || !isDays(days)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank or days" } };
  const key = `trends:${id}:${rank}:${days}`;
  const hit = cacheGet(key, "B");
  if (hit.hit && !hit.stale) return { status: 200, body: { ...hit.body, stale: false } };
  const raw = await getTrends({ id, rank, days }).catch(() => null);
  const series = raw?.data?.records?.[0]?.data?.win_rate ?? [];
  if (!series.length) return { status: 502, body: { error: "upstream_unavailable", message: "Upstream unavailable, try again" } };
  const data = series.map((p) => ({ date: p.date, win: p.win_rate, pick: p.app_rate, ban: p.ban_rate })).filter((p) => p.date && [p.win, p.pick, p.ban].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)); // INV-001 em trends
  if (!data.length) return { status: 502, body: { error: "upstream_unavailable", message: "Upstream unavailable, no valid series point" } };
  const body = { id: Number(id), rank, days, data };
  cacheSet(key, body);
  return { status: 200, body: { ...body, stale: false } };
}
