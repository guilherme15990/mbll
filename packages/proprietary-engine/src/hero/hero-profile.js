// Perfil dominante do herói (snowball/scaling/uniforme) — FONTE ÚNICA. Puro, sem I/O.
// Agregado honesto dos pares listados em confrontos; perfil existe por PAR, nunca na lista.
// Sem pares → null (sem selo).
//
// Spec V2 §13: perfis de duração/rota (`early/mid/late/flat`) só com cobertura suficiente
// e sem alegar causalidade; aqui a mesma disciplina vale para o agregado de pares:
// ausência de dado vira null, nunca um perfil "normal" inventado.

// MOTIVO: a ordem desta lista É a regra de desempate (antes: quem aparecesse primeiro no input,
// ou seja, dependia da ordem de iteração).
const VALID_PROFILES = ["snowball", "scaling", "uniforme"];

/**
 * Agregador de perfis por par. Sem estado — reutilizável.
 */
export class HeroProfile {
  /**
   * @param profiles (readonly string[]) perfis por par (brutos, podem vir misturados)
   * @returns {{ top: string, n: number, total: number } | null}
   */
  dominantProfileOf(profiles) {
    const counts = VALID_PROFILES.map(() => 0);
    let total = 0;
    for (const p of profiles ?? []) {
      const i = VALID_PROFILES.indexOf(p);
      if (i >= 0) {
        counts[i]++;
        total++;
      }
    }
    if (!total) return null;
    let best = 0;
    for (let i = 1; i < counts.length; i++) if (counts[i] > counts[best]) best = i; // estrito: empate fica com o primeiro
    return { top: VALID_PROFILES[best], n: counts[best], total };
  }
}

const defaultProfile = new HeroProfile();

/** Shim compatível. */
export function dominantProfileOf(profiles) {
  return defaultProfile.dominantProfileOf(profiles);
}
