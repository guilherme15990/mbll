// Rótulos de confiança — FONTE ÚNICA. Puros, sem I/O.
// - classOf: taxonomia descritiva das flags de significância (experimental).
// - verdictShort ← HeroDetail.tsx (frase curta).
// (confidenceToTrust/trustOf/verdictSentence removidos: sem consumidor.)
// Escasso = smallSample, degenerate ou B abaixo do piso → número encolhido.
const B_FLOOR = 0.25;

/**
 * Política de confiança do herói (V2 §8, sem selo público confirmatório).
 * Sem estado — reutilizável.
 */
export class HeroTrustPolicy {
  /** Leitura puxada à média: amostra pequena, taxa degenerada ou B abaixo do piso. */
  isScarce(h) {
    return Boolean(h == null ? false : h.smallSample || h.degenerate || (h.B ?? 1) < B_FLOOR);
  }

  /** Taxonomia descritiva (rótulos da UI) derivada das flags de significância. */
  classOf(h) {
    if (!h) return null;
    if (h.smallSample) return "Amostra pequena";
    // MOTIVO: Joia ANTES de Forte. isGem ⊂ strong, então na ordem antiga ("Forte" primeiro) o
    // ramo "Joia" era inalcançável.
    if (h.isGem) return "Joia";
    if (h.strong) return "Forte";
    if (h.weak) return "Fraco";
    return "Na media";
  }

  /** L3 curta para o H1 da capa (HeroDetails §1.1). */
  verdictShort(h) {
    if (h == null) return "sem dado neste recorte";
    if (this.isScarce(h)) return "número encolhido à média, desconfie de picos";
    return "não locke cego, veja quem countera";
  }
}

const defaultTrust = new HeroTrustPolicy();

/** Shims compatíveis. */
export function classOf(h) {
  return defaultTrust.classOf(h);
}
export function verdictShort(h) {
  return defaultTrust.verdictShort(h);
}
