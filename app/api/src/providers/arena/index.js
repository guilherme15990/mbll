// Fachada tipada da API externa (ADR-045).
//
// Quem consome (application/routes) NUNCA monta path nem lê `raw.data.records`
// na mão: chama um método com nome de caso de uso e recebe o tipo do contrato
// externo (`./types.js`). O path e a query ficam encapsulados aqui.
//
// Regra de dependência: `providers` não importa `application`, `routes` nem
// `http`. É a base da pilha (gate em `tools/check-boundaries.mjs`).
import {
  arena, arenaGet, arenaCircuitState, resetArenaCircuit, mapConc,
  rankPath, RANKS, WINDOWS, ArenaError, createArenaClient,
} from "./client.js";

export {
  arena, arenaGet, arenaCircuitState, resetArenaCircuit, mapConc,
  rankPath, RANKS, WINDOWS, ArenaError, createArenaClient,
};

// ── rank / heróis ───────────────────────────────────────────────────────────

/**
 * @param {{ days?: number, rank?: string, size?: number, index?: number, timeoutMs?: number, retries?: number }} [opts]
 * @returns {Promise<import("./types.js").ArenaPage<import("./types.js").ArenaRankRecord>>}
 */
export function getRankPage({ days = 7, rank = "mythic", size = 50, index = 1, timeoutMs, retries } = {}) {
  return arena.get(rankPath({ days, rank, size, index }), { timeoutMs, retries });
}

/**
 * @param {{ size?: number, index?: number, timeoutMs?: number, retries?: number }} [opts]
 * @returns {Promise<import("./types.js").ArenaPage<import("./types.js").ArenaCatalogHeroRecord>>}
 */
export function getHeroesPage({ size = 133, index = 1, timeoutMs, retries } = {}) {
  return arena.get(`/api/heroes?size=${size}&index=${index}`, { timeoutMs, retries });
}

/**
 * @param {{ size?: number, index?: number, timeoutMs?: number, retries?: number }} [opts]
 * @returns {Promise<import("./types.js").ArenaPage<import("./types.js").ArenaEquipmentRecord>>}
 */
export function getEquipmentPage({ size = 100, index = 1, timeoutMs, retries } = {}) {
  return arena.get(`/api/academy/equipment?size=${size}&index=${index}`, { timeoutMs, retries });
}

/**
 * @param {{ size?: number, index?: number, timeoutMs?: number, retries?: number }} [opts]
 * @returns {Promise<import("./types.js").ArenaPage<import("./types.js").ArenaEquipmentRecord>>}
 */
export function getExpandedEquipment({ size = 200, index = 1, timeoutMs, retries } = {}) {
  return arena.get(`/api/academy/equipment/expanded?size=${size}&index=${index}`, { timeoutMs, retries });
}

// ── catálogos de talento/feitiço ────────────────────────────────────────────

/**
 * @param {{ size?: number, index?: number, timeoutMs?: number, retries?: number }} [opts]
 * @returns {Promise<import("./types.js").ArenaPage<import("./types.js").ArenaEmblemRecord>>}
 */
export function getEmblems({ size = 200, index = 1, timeoutMs, retries } = {}) {
  return arena.get(`/api/academy/emblems?size=${size}&index=${index}`, { timeoutMs, retries });
}

/**
 * @param {{ size?: number, index?: number, timeoutMs?: number, retries?: number }} [opts]
 * @returns {Promise<import("./types.js").ArenaPage<import("./types.js").ArenaSpellRecord>>}
 */
export function getSpells({ size = 200, index = 1, timeoutMs, retries } = {}) {
  return arena.get(`/api/academy/spells?size=${size}&index=${index}`, { timeoutMs, retries });
}

/**
 * @param {{ size?: number, index?: number, timeoutMs?: number, retries?: number }} [opts]
 * @returns {Promise<import("./types.js").ArenaPage<import("./types.js").ArenaPositionRecord>>}
 */
export function getPositions({ size = 200, index = 1, timeoutMs, retries } = {}) {
  return arena.get(`/api/heroes/positions?size=${size}&index=${index}`, { timeoutMs, retries });
}

// ── ficha do herói ──────────────────────────────────────────────────────────

/**
 * @param {string | number} id
 * @param {{ timeoutMs?: number, retries?: number }} [opts]
 * @returns {Promise<import("./types.js").ArenaPage<import("./types.js").ArenaLaneRecord>>}
 */
export function getHeroLane(id, { timeoutMs, retries } = {}) {
  return arena.get(`/api/academy/heroes/${Number(id)}/lane`, { timeoutMs, retries });
}

/**
 * @param {{ id: string | number, lane: string, rank: string, size?: number, index?: number, timeoutMs?: number, retries?: number }} opts
 * @returns {Promise<import("./types.js").ArenaPage<import("./types.js").ArenaBuildRecord>>}
 */
export function getHeroBuilds({ id, lane, rank, size = 6, index = 1, timeoutMs, retries }) {
  return arena.get(
    `/api/academy/heroes/${Number(id)}/builds?lane=${encodeURIComponent(lane)}&rank=${encodeURIComponent(rank)}&size=${size}&index=${index}`,
    { timeoutMs, retries },
  );
}

/**
 * @param {{ id: string | number, rank: string, days: number, timeoutMs?: number, retries?: number }} opts
 * @returns {Promise<import("./types.js").ArenaPage<import("./types.js").ArenaTrendRecord>>}
 */
export function getTrends({ id, rank, days, timeoutMs, retries }) {
  return arena.get(
    `/api/heroes/${Number(id)}/trends?rank=${encodeURIComponent(rank)}&past-days=${days}&size=${days}&index=1`,
    { timeoutMs, retries },
  );
}

/**
 * @param {{ id: string | number, rank: string, days: number, size?: number, timeoutMs?: number, retries?: number }} opts
 * @returns {Promise<import("./types.js").ArenaPage<import("./types.js").ArenaMatchupRecord>>}
 */
export function getCounters({ id, rank, days, size = 20, timeoutMs, retries }) {
  return arena.get(
    `/api/heroes/${Number(id)}/counters?days=${days}&rank=${encodeURIComponent(rank)}&size=${size}&index=1`,
    { timeoutMs, retries },
  );
}

/**
 * @param {{ id: string | number, rank: string, days: number, size?: number, timeoutMs?: number, retries?: number }} opts
 * @returns {Promise<import("./types.js").ArenaPage<import("./types.js").ArenaMatchupRecord>>}
 */
export function getCompatibility({ id, rank, days, size = 20, timeoutMs, retries }) {
  return arena.get(
    `/api/heroes/${Number(id)}/compatibility?days=${days}&rank=${encodeURIComponent(rank)}&size=${size}&index=1`,
    { timeoutMs, retries },
  );
}

/**
 * @param {{ size?: number, index?: number, timeoutMs?: number, retries?: number }} [opts]
 * @returns {Promise<import("./types.js").ArenaListOrPage<import("./types.js").ArenaVersionRecord>>}
 */
export function getVersion({ size = 5, index = 1, timeoutMs, retries } = {}) {
  return arena.get(`/api/academy/meta/version?size=${size}&index=${index}`, { timeoutMs, retries });
}

// ── utilitário p/ endpoints ainda não promovidos ─────────────────────────────

/**
 * Escape hatch explícito. Não use em código novo: se o caso de uso é recorrente,
 * adicione um método tipado acima.
 *
 * @param {string} path
 * @param {{ timeoutMs?: number, retries?: number }} [opts]
 * @returns {Promise<any>}
 */
export function getRaw(path, opts) {
  return arena.get(path, opts);
}
