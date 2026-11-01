// Draft Score do herói (número único) — motor `hero-draft-score-v1`.
//
// Compõe o lote oficial (`fetchRankAll`: id + WR + exposição) e chama o motor
// puro — min–max da WR no recorte (melhor WR lê 100, pior lê 0). NÃO usa o livro
// de pares: sem fan-out de ~133×2 requests.
//
// Custo: uma coleta do lote (mesmo cache da tela `/heroes`); o resto é cálculo em
// memória. Falha do lote devolve 502 — sem WR não há número.
//
// A chave de cache carrega o recorte (`draft-score:<rank>:<days>`). A tabela
// `cache` é reconstruível; trocar a métrica exige limpar/invalidar as entradas
// antigas manualmente (sem carimbo de versão no payload — ADR-063).
import { scoreHeroDraftScore } from "@radar/engine";
import { cacheGet, cacheSet } from "../infra/cacheStore.js";
import { rankLot } from "../composition.js";
import { createSingleFlight } from "./singleFlight.js";

// F3: coleções concorrentes idênticas compartilham UMA execução.
const flights = createSingleFlight();
const { fetchRankAll } = rankLot;

export function heroDraftScoreBody(rank, days) {
  const key = `draft-score:${rank}:${days}`;
  return flights.run(key, () => heroDraftScoreBodyImpl(key, rank, days));
}

async function heroDraftScoreBodyImpl(key, rank, days) {
  const hit = cacheGet(key, "C");
  if (hit.hit) return { status: 200, body: { ...hit.body, stale: hit.stale, ageMs: hit.ageMs } };

  let fetched;
  try {
    fetched = await fetchRankAll({ days, rank });
  } catch {
    return { status: 502, body: { error: "upstream_unavailable", message: "Upstream unavailable, try again" } };
  }

  const rows = fetched.rows ?? [];
  const result = scoreHeroDraftScore({ heroes: rows.map((h) => ({ id: h.id, name: h.name, head: h.head, win: h.win })) });

  const body = {
    ...result,
    rank,
    days,
    collectedAgoMs: fetched.ageMs,
    truncated: !!fetched.truncated,
    stale: false,
  };
  cacheSet(key, body);
  return { status: 200, body: { ...body, stale: false, ageMs: 0 } };
}
