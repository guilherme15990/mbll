// hero/score-heroes — FACADE fina sobre o pipeline em classes (./scoring/).
// Motivo: testes, apps e web importam scoreBatch/scoreHeroes/HERO_CONTRACT daqui;
// a lógica vive nas classes (SRP/OCP/DIP), este módulo só preserva o contrato público.
// Modelo preservado: y_i | θ_i ~ N(θ_i, s_i²), s_i² = μ(1−μ)/(c·pick_i), θ_i ~ N(μ, τ²).
import { HeroScorer } from "./hero-scorer.js";

/**
 * CONTRATO DE SAÍDA POR HERÓI v3 (19 campos do motor + eco do input).
 * Famílias (regra crítica: nunca misturar escalas; vistas usam SÓ θ̂):
 *   vista        — monotônica em θ̂, RELATIVA AO LOTE (rodar só tanks muda tier; θ̂ não muda)
 *   incerteza    — θ̂ + se; PODE discordar de θ̂ (é o ponto)
 *   significancia— θ̂ + se + n + BH (+ quantis de exposição na joia); PODE discordar de θ̂.
 *                  strong/weak/isGem são CANDIDATOS experimentais (nulo não validado, V2 §9).
 *   guarda       — sobre o INPUT bruto/lote; suprime significância, nunca altera θ̂
 * Eco do input (id, name, win, pick, ban e extras da UI) passa por `...h` e NÃO é campo do motor.
 * Metadados de lote (μ, τ, c, versões, prior, contagens) vivem em `meta`, nunca por herói.
 */
export const HERO_CONTRACT = Object.freeze({
  wrAdj: "vista", //                    θ̂: média posterior (única grandeza absoluta)
  tier: "vista", //                     S/A/B/C/D por posição de θ̂ no lote ("?" = amostra pequena)
  strength_index: "vista", //           0–100 pela MESMA posição de θ̂ (100 = mais forte)
  se: "incerteza", //                   erro-padrão posterior (se* sob walk-forward)
  B: "incerteza", //                    peso do dado τ²/(τ²+s²) do lote; 1 − B = encolhimento
  credible_interval_95: "incerteza", // IC 95% de θ (trio)
  posterior_prob_above_threshold: "incerteza", // P(θ > limiar prático) (trio)
  uncertainty_status: "incerteza", //   rótulo de incerteza (trio do LOTE, nunca mascarado pelo prior)
  q: "significancia", //                q-valor BH experimental (FDR)
  strong: "significancia", //           candidato experimental: q ≤ α, θ̂ > μ, sem guarda
  weak: "significancia", //             candidato experimental: q ≤ α, θ̂ < μ, sem guarda
  isGem: "significancia", //            strong ∧ pick e ban no quartil inferior (⊂ strong)
  degenerate: "guarda", //              win 0/1 (ruído)
  smallSample: "guarda", //             lote < MIN_LOT
  data_status: "guarda", //             ok | insufficient_exposure (pick≤0) — V2 §6.1/EC-002
  sample_size_method: "guarda", //     not_provided_by_api — ativa o teto proxy do trust (§8.2)
  inference_status: "guarda", //        experimental_candidates_only até validar o nulo (P1)
  // DESVIO (a): posterior_mean PERMANECE no topo (o CONTRATO manda p/ debug, mas a
  // ConfiancaSection EXIBE posterior+trio por exigência do PRD — sem ele a aba quebra).
  posterior_mean: "incerteza", //       média posterior do trio (m*; = θ̂ sem prior)
  // DESVIO (b): z PERMANECE no topo (computado de graça p/ q; views/semana ordenam por ele).
  z: "significancia", //                (θ̂ − μ)/se — estatística por trás de q
});

const scorer = new HeroScorer();

/**
 * Pontua um lote (elo + janela). Retorna { heroes, meta }.
 * @param rawHeroes [{id,name,win,pick,ban,...}]
 * @param opts { c, prior, gameVersion|game_version, cohortKey|cohort_key, debug }
 */
export function scoreBatch(rawHeroes, opts = {}) {
  return scorer.score(rawHeroes, opts);
}

/**
 * Assinatura pública histórica: devolve só o array por herói. Use scoreBatch para obter `meta`.
 */
export function scoreHeroes(rawHeroes, opts = {}) {
  return scorer.score(rawHeroes, opts).heroes;
}
