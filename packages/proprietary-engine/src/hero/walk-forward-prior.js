// hero/scoring/walk-forward-prior — prior walk-forward (ADR-023) como objeto de valor.
import { isValidWalkPrior, walkPriorStamp, WF_VERSION_BREAK_VARIANCE_FACTOR } from "../walkforward/walkforward.js";

/**
 * Prior opcional {mu, tau2, n, game_version}: o último posterior VERIFICADO do mesmo rank+janela.
 *
 * Encapsula as três regras do ADR-023 que antes viviam espalhadas em `scoreBatch`:
 *  1. Prior inválido/ausente ⇒ inativo (fallback "flat", nada muda).
 *  2. Quebra de `game_version` (patch) ⇒ variância do prior × K (desconto honesto, nunca zera).
 *  3. O prior estabiliza SÓ a estimativa pontual; o `se` nunca encolhe (L2-WF-03).
 */
export class WalkForwardPrior {
  #prior;
  #gameVersion;

  /**
   * @param {object|null|undefined} rawPrior  Prior candidato (validado aqui).
   * @param {string|null} [gameVersion]       Versão do jogo do lote corrente.
   */
  constructor(rawPrior, gameVersion = null) {
    this.#prior = isValidWalkPrior(rawPrior) ? rawPrior : null;
    this.#gameVersion = gameVersion ?? null;
  }

  /** Há prior válido em uso? */
  get active() {
    return this.#prior !== null;
  }

  /** Mudou a versão do jogo? Sem `gameVersion` informado NÃO há quebra (quem chama deve passá-la). */
  get versionBroken() {
    return this.#prior !== null && this.#gameVersion != null && String(this.#prior.game_version) !== String(this.#gameVersion);
  }

  /** Variância efetiva do prior para o pull (0 se inativo). */
  get tau2Effective() {
    if (!this.#prior) return 0;
    return this.#prior.tau2 * (this.versionBroken ? WF_VERSION_BREAK_VARIANCE_FACTOR : 1);
  }

  /** Selo de proveniência: "flat" ou "walk-forward v<n>". */
  get stamp() {
    return walkPriorStamp(this.#prior);
  }

  /**
   * Estabiliza a média posterior: m* = (m·τ²eff + μ_prior·V)/(V + τ²eff).
   * Herói incerto (V grande) puxa mais para o prior; confiante quase não move.
   * @param {number} m  Média posterior do lote.
   * @param {number} V  Variância posterior do lote.
   */
  pullPoint(m, V) {
    const t2 = this.tau2Effective;
    if (this.#prior && Number.isFinite(V) && V > 0 && Number.isFinite(t2) && t2 > 0) {
      return (m * t2 + this.#prior.mu * V) / (V + t2);
    }
    return m;
  }

  /**
   * Erro-padrão final. Sem prior: o do lote. Com prior: mesma versão ⇒ idêntico; quebra ⇒ V × K.
   * @param {number} V       Variância posterior do lote.
   * @param {number} baseSe  Erro-padrão do lote.
   */
  standardError(V, baseSe) {
    if (!this.#prior) return baseSe;
    return Math.sqrt(Math.max(this.versionBroken ? V * WF_VERSION_BREAK_VARIANCE_FACTOR : V, 1e-12));
  }
}
