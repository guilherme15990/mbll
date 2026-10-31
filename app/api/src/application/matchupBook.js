// Livro de pares por herói (counters + sinergias com δ), cacheado na camada C.
//
// Fonte ÚNICA do livro para `/heroes/:id/matchups` e `/heroes/:id/blind`: mesma
// chave de cache e mesma direção de δ. O δ é efeito do par, nunca veredito; par
// ausente = desconhecido, nunca 0.
import { getCounters, getCompatibility } from "../providers/arena/index.js";
import { cacheGet, cacheSet } from "../infra/cacheStore.js";
import {
  durationCurve, classifyDuration, makePairKey, evidenceQuality,
} from "@radar/proprietary-engine";
import { catalogMap } from "./catalogs.js";

/**
 * @param {any} s
 * @param {Record<number, { name?: string|null, head?: string|null }>} cat
 * @param {string} [rel]
 * @param {number} [heroId]
 */
function pairRow(s, cat, rel = "counter", heroId = 0) {
  const id = Number(s.heroid);
  if (!Number.isFinite(id)) return null;
  const curve = durationCurve(s);
  const pair_key = makePairKey(heroId, id, rel);
  const ev = evidenceQuality({ coverage: "extremes", stable: null, hetero: null });
  const rawDelta = Number(s.increase_win_rate);
  const delta = Number.isFinite(rawDelta) ? rawDelta : null; // par sem δ = NULL, nunca 0/NaN (INV-102)
  const rawWin = Number(s.hero_win_rate);
  return {
    id, name: cat[id]?.name ?? `Hero ${id}`, head: s?.hero?.data?.head ?? cat[id]?.head ?? null,
    delta, effect_raw: delta,
    effect_unit_status: "pp_hypothesis_strong", effect_direction: rel === "counter" ? "vantagem-do-avaliado" : "vantagem-com-aliado",
    pair_key, relationship_type: rel, coverage_status: "extremes-only",
    win: Number.isFinite(rawWin) ? rawWin : null, pick: Number.isFinite(Number(s.hero_appearance_rate)) ? Number(s.hero_appearance_rate) : null,
    curve, profile: classifyDuration(curve),
    evidence_quality: ev.quality, evidence_reasons: ev.reasons,
    exposure_status: "unvalidated", interval_status: "indisponivel", causal_status: "nao-avaliado",
  };
}

/** Chave de cache do livro de pares (camada C) — dona única. */
export function matchupBookCacheKey(id, rank, days) {
  return `matchups:${id}:${rank}:${days}`;
}

/**
 * Busca o livro no upstream e grava no cache C. NUNCA lança por falha do
 * upstream: devolve `{ status: 200, body }` com o livro ou `{ status: 502 }`
 * quando nenhum lado traz dado (mesma degradação da rota antiga).
 *
 * @param {number} id
 * @param {string} rank
 * @param {number} days
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function loadMatchupBook(id, rank, days) {
  const [ct, cp, cat] = await Promise.all([
    getCounters({ id, rank, days }).catch(() => null),
    getCompatibility({ id, rank, days }).catch(() => null),
    catalogMap(),
  ]);
  const c0 = ct?.data?.records?.[0]?.data ?? {};
  const p0 = cp?.data?.records?.[0]?.data ?? {};
  const body = {
    id: Number(id), rank, days,
    hero: { name: c0?.main_hero?.data?.name ?? p0?.main_hero?.data?.name ?? `Hero ${id}`, head: c0?.main_hero?.data?.head ?? p0?.main_hero?.data?.head ?? null },
    // Semântica de increase_win_rate em quarentena (Fase 0 item 2): exibido como efeito δ com aviso
    countersUp: (c0.sub_hero ?? []).map((s) => pairRow(s, cat, "counter", Number(id))).filter(Boolean),
    countersDown: (c0.sub_hero_last ?? []).map((s) => pairRow(s, cat, "counter", Number(id))).filter(Boolean),
    synergiesUp: (p0.sub_hero ?? []).map((s) => pairRow(s, cat, "teammate", Number(id))).filter(Boolean),
    synergiesDown: (p0.sub_hero_last ?? []).map((s) => pairRow(s, cat, "teammate", Number(id))).filter(Boolean),
    semanticsNote: "Direção do increase_win_rate em validação (Fase 0). δ = efeito do par, não veredito. Par ausente = desconhecido, nunca 0.",
  };
  if (!body.countersUp.length && !body.synergiesUp.length) {
    return { status: 502, body: { error: "upstream_unavailable", message: "Upstream unavailable, try again" } };
  }
  cacheSet(matchupBookCacheKey(id, rank, days), body);
  return { status: 200, body };
}

/**
 * Livro de pares pronto para consumo: cache C quente (não stale) ou coleta nova.
 *
 * @param {number} id
 * @param {string} rank
 * @param {number} days
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function matchupBook(id, rank, days) {
  const hit = cacheGet(matchupBookCacheKey(id, rank, days), "C");
  if (hit.hit && !hit.stale) return { status: 200, body: hit.body };
  return loadMatchupBook(id, rank, days);
}
