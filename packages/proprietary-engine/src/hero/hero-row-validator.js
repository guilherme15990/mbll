// hero/scoring/hero-row-validator — validação, deduplicação e separação por exposição.
/**
 * Resultado da validação de um lote bruto.
 * @typedef {Object} ValidationResult
 * @property {object[]} exposed          Linhas válidas com pick > 0 (participam do ajuste).
 * @property {object[]} noExposure       Linhas válidas com pick = 0 (viram stub; não votam em μ/τ/BH).
 * @property {{id: *, reason: string}[]} droppedReasons  Quarentena com motivo (inclui `duplicate_id`).
 * @property {number} duplicatesDropped  Quantas linhas foram descartadas por id repetido.
 */

/**
 * Valida o lote bruto ANTES de qualquer estatística.
 *
 * Responsabilidade única (SRP): decidir quais linhas entram no ajuste. Não calcula nada.
 * Ordem correta (EC-011/EC-001/EC-013, P1 auditoria): VALIDAR → DEDUPAR (só a 1ª ocorrência
 * VÁLIDA vence) → SEPARAR sem-exposição. Taxa fora de [0,1], ausente ou string nunca entra
 * (V2 §5.1-5.3): vai para quarentena com motivo, jamais vira zero.
 */
export class HeroRowValidator {
  /**
   * @param {object[]|null|undefined} rawHeroes  Linhas `{id, win, pick, ban, ...}`.
   * @returns {ValidationResult}
   */
  validate(rawHeroes) {
    const seen = new Set();
    const exposed = [];
    const noExposure = [];
    const droppedReasons = [];
    let duplicatesDropped = 0;
    let rowIdx = 0;
    for (const h of rawHeroes ?? []) {
      rowIdx++;
      const reason = this.#reasonToDrop(h);
      if (reason) {
        droppedReasons.push({ id: h && typeof h === "object" ? (h.id ?? h.hero_id ?? null) : null, reason });
        continue;
      }
      const key = this.#identityKey(h, rowIdx);
      if (seen.has(key)) {
        duplicatesDropped++;
        droppedReasons.push({ id: h.id ?? h.hero_id ?? null, reason: "duplicate_id" });
        continue;
      }
      seen.add(key);
      (h.pick > 0 ? exposed : noExposure).push(h);
    }
    return { exposed, noExposure, droppedReasons, duplicatesDropped };
  }

  /** Chave de identidade; sem id, o índice da linha evita colapsar linhas distintas (MEDIUM). */
  #identityKey(h, rowIdx) {
    const hasId = h.id != null || h.hero_id != null;
    return hasId ? String(h.id ?? h.hero_id) : `__row${rowIdx}:${JSON.stringify([h.win, h.pick, h.ban])}`;
  }

  /** Motivo de quarentena, ou null se a linha é válida. */
  #reasonToDrop(h) {
    if (!h || typeof h !== "object") return "invalid_row";
    for (const k of ["win", "pick", "ban"]) {
      const v = h[k];
      if (v == null || (typeof v === "string" && v !== "") || Number.isNaN(v)) return `rate_missing:${k}`;
      if (!Number.isFinite(v)) return `rate_nonfinite:${k}`;
      if (v < 0 || v > 1) return `rate_out_of_range:${k}`;
    }
    return null;
  }
}
