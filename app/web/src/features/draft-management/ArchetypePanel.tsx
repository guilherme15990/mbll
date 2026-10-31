import { Users, Info } from "lucide-react";
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
 * Mix de arquétipos e relação entre composições (ADR-053 D4).
 *
 * O perfil vem dos pares de cada herói (dominantProfileOf). Sem par com perfil
 * o herói sai do denominador — nunca vira “uniforme”. A relação descreve
 * janelas (cedo/tarde), não resultado.
 */
const TONE: Record<MixRelation["tone"], string> = {
  emerald: "border-emerald-400/30 bg-emerald-400/10",
  amber: "border-amber-400/30 bg-amber-400/10",
  slate: "border-line bg-abyss/60",
};

function SideMix({
  label,
  mix,
  ids,
  books,
  pool,
  bar,
}: {
  label: string;
  mix: TeamMix;
  ids: readonly number[];
  books: MatchupBooks;
  pool: HeroPool;
  bar: "sky" | "rose";
}) {
  return (
    <div className="space-y-1.5 min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold text-foam">{label}</span>
        <span className="text-[9px] font-mono text-mist/60">
          {mix.observed} com perfil{mix.semDado ? ` · ${mix.semDado} sem dado` : ""}
        </span>
      </div>
      {ARCHETYPES.map((archetype: Archetype) => {
        const count = mix.counts[archetype];
        const heroes = ids
          .filter((id) => heroArchetype(id, books)?.top === archetype)
          .map((id) => pool[id]?.name ?? `#${id}`);
        const width = mix.observed ? (count / mix.observed) * 100 : 0;
        return (
          <div key={archetype} className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-2 text-[10px]">
              <span className={cx("font-semibold", mix.dominant === archetype ? "text-gold" : "text-foam/80")}>
                {ARCHETYPE_LABEL[archetype]}
                {mix.dominant === archetype ? " · dominante" : ""}
              </span>
              <span className="font-mono text-mist" title={ARCHETYPE_NOTE[archetype]}>
                {count}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-abyss border border-line/50 overflow-hidden">
              <span
                className={cx("block h-full", bar === "sky" ? "bg-sky-400/80" : "bg-rose-400/80")}
                style={{ width: `${width}%` }}
                aria-hidden="true"
              />
            </div>
            {heroes.length > 0 && (
              <p className="text-[9px] text-mist/70 truncate" title={heroes.join(", ")}>
                {heroes.join(", ")}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

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
  return (
    <section className="card p-3.5 space-y-3" aria-label="Relação entre arquétipos">
      <header className="flex items-center justify-between gap-2">
        <p className="lbl flex items-center gap-1.5">
          <Users size={12} className="text-gold" aria-hidden="true" /> Arquétipos
        </p>
        <span className="text-[9px] font-mono text-mist/60">janela dos pares</span>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <SideMix label="Nós" mix={mix.ours} ids={teams.us} books={books} pool={pool} bar="sky" />
        <SideMix label="Eles" mix={mix.theirs} ids={teams.them} books={books} pool={pool} bar="rose" />
      </div>

      <div className={cx("rounded-xl border px-2.5 py-2 space-y-0.5", TONE[mix.relation.tone])}>
        <p className="text-[11px] font-bold text-foam">{mix.relation.label}</p>
        <p className="text-[10px] text-mist/85 leading-relaxed">{mix.relation.detail}</p>
        {mix.relation.target && (
          <p className="text-[10px] text-foam/90">
            contrapeso declarado: <b className="text-gold">{ARCHETYPE_LABEL[mix.relation.target]}</b>
          </p>
        )}
      </div>

      <p className="text-[9px] text-mist/70 flex items-start gap-1.5">
        <Info size={10} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          Perfil dominante dos pares de cada herói (n/total), como no selo da carta. Sem par → sem dado, nunca
          “uniforme” inventado. A leitura é de janela, não de resultado.
        </span>
      </p>
    </section>
  );
}
