import { useMemo } from "react";
import { Users } from "lucide-react";
import { cx } from "../../shared/api";
import {
  ARCHETYPES,
  ARCHETYPE_LABEL,
  ARCHETYPE_NOTE,
  heroArchetype,
  type Archetype,
  type HeroPool,
  type MatchupBooks,
  type MixRelation,
  type TeamMix,
} from "./model";

/**
 * Mix de arquétipos em barras divergentes de mesma escala: o nome fica no meio,
 * a barra do meu time pende para a esquerda e a do inimigo para a direita, com
 * o valor em cada ponta. Escala única (`max` = maior contagem do painel) para
 * comparar valores próximos.
 *
 * O perfil vem dos pares de cada herói (dominantProfileOf). Sem par com perfil
 * o herói sai do denominador — nunca vira “uniforme”.
 */
export default function ArchetypePanel({
  mix,
  teams,
  books,
  pool,
}: {
  mix: { ours: TeamMix; theirs: TeamMix; relation: MixRelation };
  teams: { us: number[]; them: number[] };
  books: MatchupBooks;
  pool: HeroPool;
}) {
  const max = useMemo(() => {
    const counts = ARCHETYPES.flatMap((archetype) => [mix.ours.counts[archetype], mix.theirs.counts[archetype]]);
    return Math.max(1, ...counts);
  }, [mix]);

  const heroesOf = (ids: readonly number[], archetype: Archetype) =>
    ids
      .filter((id) => heroArchetype(id, books)?.top === archetype)
      .map((id) => pool[id]?.name ?? `#${id}`);

  return (
    <section className="card p-3.5 space-y-2.5" aria-label="Relação entre arquétipos">
      <header className="flex items-center justify-between gap-2">
        <p className="lbl flex items-center gap-1.5">
          <Users size={12} className="text-gold" aria-hidden="true" /> Arquétipos
        </p>
      </header>

      <div className="space-y-2">
        {ARCHETYPES.map((archetype: Archetype) => {
          const us = mix.ours.counts[archetype];
          const them = mix.theirs.counts[archetype];
          const usDominant = mix.ours.dominant === archetype;
          const themDominant = mix.theirs.dominant === archetype;
          const usHeroes = heroesOf(teams.us, archetype);
          const themHeroes = heroesOf(teams.them, archetype);
          return (
            <div key={archetype} className="space-y-1">
              <p
                className={cx(
                  "text-center text-[10px] font-semibold",
                  usDominant || themDominant ? "text-gold" : "text-foam/80",
                )}
                title={ARCHETYPE_NOTE[archetype]}
              >
                {ARCHETYPE_LABEL[archetype]}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-4 text-right text-[9px] font-mono text-mist shrink-0">{us}</span>
                <div className="flex-1 flex justify-end min-w-0" title={usHeroes.join(", ") || "sem herói com perfil"}>
                  <span
                    className="h-1.5 rounded-l-full bg-sky-400/80"
                    style={{ width: `${(us / max) * 100}%` }}
                    aria-hidden="true"
                  />
                </div>
                <span className="w-px h-3 bg-line shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0" title={themHeroes.join(", ") || "sem herói com perfil"}>
                  <span
                    className="block h-1.5 rounded-r-full bg-rose-400/80"
                    style={{ width: `${(them / max) * 100}%` }}
                    aria-hidden="true"
                  />
                </div>
                <span className="w-4 text-[9px] font-mono text-mist shrink-0">{them}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
