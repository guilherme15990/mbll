// Ficha do herói e módulos derivados por herói (sem nova coleta quando possível).
import { getTrends } from "../providers/arena/index.js";
import { cacheGet, cacheSet } from "../infra/cacheStore.js";
import { listSnapshots } from "../infra/snapshotHistory.js";
import {
  confidenceTrio, rankDifference, temporalDelta, assessSeries,
  distortionResidual, medianPickOf, medianBanOf, classOf, C_REFERENCE,
} from "@radar/proprietary-engine";
import { fetchRankAll } from "../application/rankLot.js";
import { score, scoreLot } from "../application/scoring.js";
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

// GET /heroes/:id/confidence — trio CNF provisório
export async function confidenceRoute(sp, id) {
  const rank = sp.get("rank") ?? "mythic", window = Number(sp.get("window") ?? 7);
  if (!isRank(rank) || !isWindow(window)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank or window" } };
  const fetchedC = await fetchRankAll({ days: window, rank });
  const lotC = scoreLot(fetchedC.rows, { prior: fetchedC.prior ?? null, gameVersion: fetchedC.gameVersion ?? null });
  const hero = lotC.scored.find((h) => h.id === id);
  if (!hero) return { status: 404, body: { error: "hero_not_found", message: "Hero not found in this rank/window" } };
  // μ do lote vem da meta (antes: hero.mu, que o score nunca preenchia — caía no fallback).
  const trio = confidenceTrio({ wrAdj: hero.wrAdj, med: lotC.meta.mu ?? 0.5, se: hero.se ?? 0.02, c: C_REFERENCE });
  return { status: 200, body: { id: hero.id, rank, window, observed_win: hero.win, shrinkage_B: hero.B, ...trio, note: "M1 normal-normal: V=(1/s²+1/τ²)⁻¹, m=V(y/s²+μ/τ²), s²=μ(1−μ)/(c·pick). Probabilidade posterior ≠ chance de vitória" } };
}

// GET /heroes/:id/rank-diff?a=mythic&b=glory — diferença RNK
export async function rankDiffRoute(sp, id) {
  const a = sp.get("a") ?? "mythic", b = sp.get("b") ?? "glory";
  const window = Number(sp.get("window") ?? 7);
  if (!isRank(a) || !isRank(b) || !isWindow(window)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank a/b or window" } };
  const [ra, rb] = await Promise.all([fetchRankAll({ days: window, rank: a }), fetchRankAll({ days: window, rank: b })]);
  const ha = score(ra.rows, { prior: ra.prior ?? null, gameVersion: ra.gameVersion ?? null }).find((h) => h.id === id);
  const hb = score(rb.rows, { prior: rb.prior ?? null, gameVersion: rb.gameVersion ?? null }).find((h) => h.id === id);
  if (!ha || !hb) return { status: 404, body: { error: "hero_not_found", message: "Hero missing in one of the ranks", classification_status: "unavailable" } };
  const diff = rankDifference({ thetaA: ha.wrAdj, thetaB: hb.wrAdj, seA: ha.se ?? 0.02, seB: hb.se ?? 0.02 });
  return { status: 200, body: { id, a, b, window, thetaA: ha.wrAdj, thetaB: hb.wrAdj, seA: ha.se, seB: hb.se, s_ref: "s=θ−μ_rank; D=s_a−s_b (força relativa, não bruta)", ...diff, note: "sem atribuição causal" } };
}

// GET /heroes/:id/temporal?rank=&base=30 — delta TMP (janelas sobrepostas não são replicação)
export async function temporalRoute(sp, id) {
  const rank = sp.get("rank") ?? "mythic";
  const nowW = Number(sp.get("window") ?? 7), baseW = Number(sp.get("base") ?? 30);
  if (!isRank(rank) || !isWindow(nowW) || !isWindow(baseW)) return { status: 400, body: { error: "rank_invalid", message: "Invalid rank, window or base" } };
  const [rn, rb] = await Promise.all([fetchRankAll({ days: nowW, rank }), fetchRankAll({ days: baseW, rank })]);
  const hn = score(rn.rows, { prior: rn.prior ?? null, gameVersion: rn.gameVersion ?? null }).find((h) => h.id === id);
  const hb = score(rb.rows, { prior: rb.prior ?? null, gameVersion: rb.gameVersion ?? null }).find((h) => h.id === id);
  if (!hn || !hb) return { status: 404, body: { error: "hero_not_found", message: "Hero missing in one of the windows" } };
  const seC = Math.sqrt((hn.se ?? 0.02) ** 2 + (hb.se ?? 0.02) ** 2);
  const t = temporalDelta({ thetaNow: hn.wrAdj, thetaBase: hb.wrAdj, se: seC, confirmed: false });
  // T5 consome a SnapshotHistory (INV4-015): ≥2 verificados não-sobrepostos + span ≥14d.
  // Com <14d ou 1 snapshot → serie_curta/inconclusivo; o delta segue visível p/ inspeção, sem veredito.
  // Contrato p/ o frontend: chamar /snapshots?fonte=heroes&rank=&janela= p/ a série e
  // /snapshots/:ts/diff p/ C-105; nunca inferir persistência de janelas sobrepostas.
  let serie = { n_snapshots: 0, n_distintos: 0, span_dias: 0, nao_sobrepostos: false, lacunas: 0, status: "serie_curta", motivo: "sem histórico próprio ainda" };
  try {
    serie = assessSeries(listSnapshots({ fonte: "heroes", rank, limit: 1000 })
      .map((s) => ({ coletado_em: s.coletado_em, janela: s.janela, payload_hash: s.payload_hash, status: s.status })));
  } catch { /* série indisponível ⇒ mantém serie_curta */ }
  const base = {
    id, rank, nowW, baseW, thetaNow: hn.wrAdj, thetaBase: hb.wrAdj, ...t,
    serie, serie_contrato: "T5: persistente|revertido exige ≥2 snapshots verificados não-sobrepostos, span ≥14d (INV4-015); <14d ou 1 snapshot = serie_curta/inconclusivo",
  };
  if (serie.status !== "avaliavel") {
    return { status: 200, body: { ...base, temporal_status: "inconclusive", patch_association_status: "not_evaluated", motivo_serie: serie.motivo, note: "série curta/sobreposta — T5 inconclusivo (INV4-015); delta exibido p/ inspeção, sem veredito; série própria em /snapshots" } };
  }
  return { status: 200, body: { ...base, note: "associação temporal — não causal; janelas sobrepostas não são independentes; veredito T5 exige a série própria (/snapshots)" } };
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
