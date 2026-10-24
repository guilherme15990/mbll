// Selos e vereditos de confiança — FONTE ÚNICA. Puros, sem I/O.
// - confidenceToTrust ← heroSeal.ts (selo a partir do selo categórico do modelo)
// - trustOf ← Dashboard.tsx (selo da grade do panorama)
// - verdictSentence / verdictShort ← HeroDetails.tsx (frase + L3 curta)
// - classOf: taxonomia descritiva das flags de significância (experimental).
// `level` usa o vocabulário Situacional/Inconclusivo.
//
// v3 (poda): removidos os cortes de B em alta/media/baixa (CONF_HIGH/CONF_LOW —
// "alta" nunca disparava no regime proxy), os ramos "Robusto" (inalcançáveis sem
// denominador validado, V2 §8.2) e o teto proxy (morto junto com o Robusto).
// Resta o que diferencia de verdade: escasso (B<B_FLOOR, smallSample, degenerate)
// → Inconclusivo; senão Situacional. B segue no output como peso do dado.
// Contrato v3: hero-engine-v2.1.0.
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

  /** Selo a partir do selo categórico do modelo (sem número único). */
  confidenceToTrust(h) {
    if (!h) return { level: "Inconclusivo", motive: "sem dado do herói" };
    if (this.isScarce(h)) return { level: "Inconclusivo", motive: "amostra escassa (encolhido à média)" };
    if (h.confidence != null) return { level: "Situacional", motive: `confiança ${h.confidence}` };
    return { level: "Situacional", motive: `classe ${this.classOf(h)}` };
  }

  /** Selo da grade do panorama (Dashboard). */
  trustOf(h) {
    if (!h) return { level: "Inconclusivo", motive: "sem dado do herói" };
    if (this.isScarce(h)) {
      return { level: "Inconclusivo", motive: h.smallSample ? "amostra pequena" : "sem dado suficiente" };
    }
    return { level: "Situacional", motive: "leitura por faixa" };
  }

  /** Frase interpretativa (H-01): só com dado do próprio herói. */
  verdictSentence(h) {
    if (h == null) return "";
    if (this.isScarce(h)) return "Amostra escassa: leitura puxada à média — desconfie de picos.";
    return "Leitura situacional: confira a prova na aba antes de lockar.";
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
export function confidenceToTrust(h) {
  return defaultTrust.confidenceToTrust(h);
}
export function trustOf(h) {
  return defaultTrust.trustOf(h);
}
export function verdictSentence(h) {
  return defaultTrust.verdictSentence(h);
}
export function verdictShort(h) {
  return defaultTrust.verdictShort(h);
}
