// @radar/engine · core/config — configuração versionada de pesos e lanes canônicas.
// Consolidado (ADR-061): reúne utils/config.js.
// Barrel público: src/index.js (nenhum nome público muda).


// ── utils/config.js ──
// utils/config — dona única da premissa c, referência, versão, delta default,
// faixas de duração e lanes. Puro, sem I/O, zero dependências.
// v3: grade c (C_GRID/C_GRADE_VERSION) REMOVIDA — nunca diferenciou nada no regime
// proxy; a premissa é um único c declarado (C_REFERENCE) até calibração (V2 §6.1).
// requireLane vive aqui (dono do LANES; evita ciclo engine→prop p/ validar).
// Puro, sem I/O, zero dependências.
export const C_REFERENCE = 1e5;
export const DELTA_DEFAULT = 0.02;
export const LANES = ["exp", "mid", "roam", "jungle", "gold"];

/** Lane obrigatória (API 422 sem lane). Retorna {ok, lane} ou {ok:false}. */
export function requireLane(lane) {
  if (LANES.includes(lane)) return { ok: true, lane };
  return { ok: false, allowed: LANES };
}

// Faixas de duração (S7): rótulos p/ a curva (pontos médios ficam em counters/duration.js).
export const DURATION_BANDS = ["<6", "6–8", "8–10", "10–12", "12–14", "14–16", "16–18", "18–20", "20+"];
