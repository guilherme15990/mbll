// walkforward/walkforward — ADR-023 walk-forward: posterior de ontem = prior
// de hoje (corpo idêntico ao ex-engine, L2-WF-01..05).
// Funções puras, sem I/O. O prior é a NOSSA própria evidência passada
// (último snapshot VERIFICADO do mesmo rank+janela); priors comunitários seguem vetados.
// FATOR DE DESCONTO (L2-WF-02): WF_VERSION_BREAK_VARIANCE_FACTOR = 4.
// Justificativa: quebra de game_version (patch) = quebra de regime. Inflar a variância
// do prior por 4x ⇔ DP ×2 (o intervalo 95% do prior dobra): desconto honesto e calibrável.
// Nunca zera em silêncio (a história segue pesando via n descontado) nem carrega
// integralmente (o pull encolhe e o se alarga). 4 é inteiro pequeno, testável, e equivale
// a ~2 halvings exponenciais — conservador p/ patches, onde win rates deslocam vários pp.
// É o ÚNICO número novo do módulo; todo o resto reaproveita o M1 (ebShrink/obsVariance).
// Puro, sem I/O, zero dependências.
export const WF_VERSION_BREAK_VARIANCE_FACTOR = 4;

/** Validação na mão (JS puro, sem `any`): prior {mu, tau2, n, game_version}. */
export function isValidWalkPrior(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) return false;
  if (!Number.isFinite(p.mu) || p.mu < 0 || p.mu > 1) return false;
  if (!Number.isFinite(p.tau2) || !(p.tau2 > 0) || p.tau2 > 1) return false;
  if (!Number.isFinite(p.n) || !(p.n >= 1)) return false;
  if (typeof p.game_version !== "string" || !p.game_version) return false;
  return true;
}

/** Selo L2-WF-05: de onde veio a estabilidade. H = n do prior (profundidade de evidência). */
export function walkPriorStamp(prior) {
  if (!isValidWalkPrior(prior)) return "flat";
  return `walk-forward v${prior.n}`;
}

/**
 * Posterior resumido p/ a rodada seguinte (L2-WF-04, apêndice do snapshot).
 * Entradas escalares; nunca lê histórico (sem I/O — a API carrega e grava).
 * - mesma versão: prior pesa com n integral; tau_post = max(batch, prior) (nunca encolhe).
 * - quebra de versão: tau2_prior ×4 e n_prior descontado ⌊n/4⌋ (≥1); se alarga via tau_post.
 */
export function summarizeWalkPosterior({ muBatch, tau2Batch, nBatch, prior = null, gameVersion = null } = {}) {
  const gv = typeof gameVersion === "string" && gameVersion ? gameVersion : "desconhecida";
  const nB = Number.isFinite(nBatch) && nBatch >= 0 ? Math.floor(nBatch) : 0;
  const muB = Number.isFinite(muBatch) ? muBatch : 0.5;
  const t2B = Number.isFinite(tau2Batch) && tau2Batch > 0 ? tau2Batch : 1e-12;
  if (!isValidWalkPrior(prior)) return { mu: muB, tau2: t2B, n: nB, game_version: gv };
  const broken = gameVersion != null && String(prior.game_version) !== String(gameVersion);
  const K = WF_VERSION_BREAK_VARIANCE_FACTOR;
  const tau2eff = prior.tau2 * (broken ? K : 1);
  const nEff = broken ? Math.max(1, Math.floor(prior.n / K)) : Math.floor(prior.n);
  const denom = nEff + nB;
  const muPost = denom > 0 ? (nEff * prior.mu + nB * muB) / denom : muB;
  return { mu: muPost, tau2: Math.max(t2B, tau2eff), n: nEff + nB, game_version: gv };
}
