// hero/scoring/constants — constantes do pipeline de pontuação de heróis.
// Dono único; as classes recebem estes valores por padrão e aceitam override por injeção.

/** Nível BH (FDR) do lote — spec §16. */
export const FDR_ALPHA = 0.05;
/** Joia = quartil inferior de pick E de ban — spec §16. */
export const GEM_QUANTILE = 0.25;
/** EC-004: abaixo deste nº de heróis válidos MAD/BH/tiers não se sustentam. */
export const MIN_LOT = 10;
/** Piso/teto numérico de μ (V2 §6.1). */
export const EPS = 1e-6;
/** Carimbos de versão do contrato de saída (V2 §19/§24). v3: sem banda-C, sem tiers de B, sem Robusto. */
export const MODEL_VERSION = "hero-engine-v2.1.0";
export const STRENGTH_MODEL = "eb_rate_proxy_v1";
export const NULL_MODEL_VERSION = "unvalidated_eb_z_v1";
