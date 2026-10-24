// Limiares canônicos da engine proprietária — DONA ÚNICA de cada número.
// Cada conceito tem UM dono (este arquivo); os módulos consomem por import e
// reexportam seus nomes publicados com os MESMOS valores (semântica intacta,
// testes congelados continuam verdes). Números específicos de um modelo só
// (ex.: cauda blind -0.03, R² 0.35 do meta-trend) ficam no módulo dono.
// Puro, sem I/O, zero dependências.

export const THRESHOLDS_VERSION = "thresholds-v1";

// Relevância prática mínima p/ diferença de win rate / δ em logit (proporção
// 0–1, nunca %): abaixo disso o sinal é ruído. Donos consumidores: build-tags
// (situacional/abaixo-da-ref), build-quadrant (alta), tempo-signal
// (trendDirectionOf), rank-profile (default de Δr), lane-timing (movimento).
export const PRACTICAL_DELTA = 0.02;

// Sinal mínimo observável de lift/δ (proporção 0–1): piso do "emergente".
// Consumidores: counter (minAbs default), build-tags (emergente),
// itemsets (isEmergentAtomic).
export const MIN_LIFT_SIGNAL = 0.015;

// Pick que separa popular de raro (proporção 0–1). Popular = fato de
// frequência, nunca identidade. Consumidores: build-tags, build-quadrant.
export const POPULAR_PICK_MIN = 0.05;
export const RARE_PICK_MAX = 0.02;

// Piso de suporte mínimo (n de pares/partidas/janelas elegíveis, nunca
// partidas inventadas). Paralelo a RF-BLND-06. Consumidores: counter
// (n pares), blind-safety (n pares), playstyle (n partidas),
// personal-calibration (n partidas próprias).
export const MIN_SUPPORT_N = 5;

// Pior δ (proporção 0–1) que caracteriza counter duro/replicado. Donos:
// blind-safety (rótulo Counterável) e pick-favorability (first pick exposto).
export const SEVERE_COUNTER_DELTA = -0.03;
