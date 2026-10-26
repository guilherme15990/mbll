import { Link } from "react-router-dom";
import { num, pct, type Hero } from "../../../shared/api";
import { Avatar, TierBadge } from "../../../shared/ui";
import { BuildRow } from "./BuildRow";
import { LINES_PER_HERO, type BuildCardState } from "./useLaneBuilds";

function HeroIdentity({ hero, position }: { hero: Hero; position: number }) {
  return (
    <header className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-line bg-abyss text-[10px] font-bold text-mist"
      >
        {position}
      </span>
      <Avatar src={hero.head} name={hero.name} size={34} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-bold text-foam">{hero.name}</span>
          <TierBadge tier={hero.tier} />
        </div>
        <p className="text-[10px] font-mono text-mist">
          θ̂ <b className="font-bold text-gold">{num(hero.wrAdj, 3)}</b>
          {" · "}win {pct(hero.win)}
          {" · "}pick {pct(hero.pick)}
        </p>
      </div>
    </header>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      <div className="h-[82px] animate-pulse rounded-xl bg-abyss/50" />
      <div className="h-[82px] animate-pulse rounded-xl bg-abyss/50" />
    </div>
  );
}

/** Card de um herói do topo da rota — um estado isolado por herói. */
export function HeroBuildCard({ state, position, href }: {
  state: BuildCardState;
  position: number;
  href: string;
}) {
  const { hero } = state;
  return (
    <article
      aria-label={`${position}º herói do topo: ${hero.name}`}
      className="flex h-full flex-col gap-2.5 rounded-2xl border border-line/80 bg-panel2/30 p-3.5"
    >
      <HeroIdentity hero={hero} position={position} />

      {state.kind === "loading" ? <CardSkeleton /> : null}

      {state.kind === "error" ? (
        <div className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-2.5">
          <p className="text-[11px] leading-relaxed text-amber-200">
            Builds indisponíveis para este herói nesta rota.
          </p>
          <button type="button" onClick={state.onRetry} className="btn-ghost w-full text-[11px]">
            Tentar novamente
          </button>
        </div>
      ) : null}

      {state.kind === "empty" ? (
        <p className="flex-1 text-[11px] leading-relaxed text-mist">{state.motive}</p>
      ) : null}

      {state.kind === "ready" ? (
        <>
          <ol className="space-y-2" aria-label={`Builds de ${hero.name} nesta rota`}>
            {state.builds.slice(0, LINES_PER_HERO).map((build, i) => (
              <li key={i}>
                <BuildRow build={build} />
              </li>
            ))}
          </ol>
          {state.builds.length > LINES_PER_HERO ? (
            <p className="text-[10px] font-mono text-mist/70">
              {LINES_PER_HERO} de {state.builds.length} builds — as demais ficam na ficha.
            </p>
          ) : null}
        </>
      ) : null}

      <Link to={href} className="btn-ghost mt-auto w-full text-[11px]">
        Ver ficha de {hero.name} nesta rota →
      </Link>
    </article>
  );
}

/** Placeholder do grid antes de a lista/mapa de rotas assentarem. */
export function BuildCardSkeleton({ position }: { position: number }) {
  return (
    <div className="flex h-full flex-col gap-2.5 rounded-2xl border border-line/80 bg-panel2/30 p-3.5">
      <div className="flex items-center gap-2.5">
        <div className="h-6 w-6 animate-pulse rounded-lg bg-abyss/60" />
        <div className="h-[34px] w-[34px] animate-pulse rounded-xl bg-abyss/60" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2.5 w-24 animate-pulse rounded bg-abyss/60" />
          <div className="h-2 w-32 animate-pulse rounded bg-abyss/50" />
        </div>
      </div>
      <CardSkeleton />
      <span className="sr-only">Carregando {position}º herói do topo</span>
    </div>
  );
}
