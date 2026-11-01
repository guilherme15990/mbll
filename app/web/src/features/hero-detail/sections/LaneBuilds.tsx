import { Link } from "react-router-dom";
import { getBuildTags, selectTopBuildsByLift } from "@radar/engine";
import { num, pct, useBuilds } from "../../../shared/api";
import { BUILD_TAG_CLASS } from "../../../shared/domain/buildLabel";
import { ErrBox } from "../../../shared/ui";
import BuildLoadout from "../../../shared/ui/patterns/BuildLoadout";

/**
 * Seção de builds de UMA lane da visão geral da ficha.
 *
 * Hook próprio (o nº de lanes varia por herói) na MESMA key da aba Builds →
 * cache hit ao navegar. Top-3 por lift vem do motor (`selectTopBuildsByLift`).
 * Extraído de `HeroDetail.tsx` (ADR-041: teto de 300 linhas).
 */
export default function LaneBuilds({ hero, rank, lane, heroName, to }: { hero: string; rank: string; lane: string; heroName: string; to: string }) {
  const q = useBuilds(hero || null, rank, lane);
  // Top-3 por lift em `@radar/engine` (selectTopBuildsByLift).
  const top = selectTopBuildsByLift([...(q.data?.data ?? [])], 3);
  const refWin = q.data?.references?.mostUsed?.win;
  return (
    <Link
      to={to}
      aria-label={`Abrir Builds de ${heroName} na lane ${lane}`}
      className="block rounded-2xl border border-line bg-panel p-4 hover:border-gold/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-foam">Builds · {lane}</p>
          <p className="text-[11px] text-mist">
            Top {top.length || 3} por lift · referência {pct(refWin)}
          </p>
        </div>
        <span className="text-[11px] text-gold font-bold" aria-hidden="true">ver na aba →</span>
      </div>

      {q.isLoading ? (
        <p className="text-[11px] text-mist mt-3" role="status">carregando builds…</p>
      ) : q.isError || !top.length ? (
        <div className="mt-3" onClick={(e) => e.preventDefault()}>
          <ErrBox onRetry={() => q.refetch()} />
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {top.map((b, i) => {
            const lift = b.lift_vs_most_used;
            const liftOk = lift != null && Number.isFinite(lift);
            return (
              <div key={i} className="rounded-xl border border-line bg-abyss/30 p-3 space-y-2.5">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="grid h-6 w-6 place-items-center rounded-md border border-line bg-panel2 text-[10px] font-bold text-mist">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[10px] text-mist">Win</p>
                      <p className="num text-lg font-bold text-foam leading-none">{pct(b.win)}</p>
                    </div>
                    <div className="pl-3 border-l border-line">
                      <p className="text-[10px] text-mist">Lift</p>
                      <p
                        className={`num text-xs font-bold ${
                          !liftOk ? "text-mist" : (lift as number) >= 0 ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        {liftOk ? `${(lift as number) >= 0 ? "+" : ""}${num(lift, 4)}` : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {getBuildTags(b).map((t) => (
                      <span
                        key={t.key}
                        title={t.title}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-block ${BUILD_TAG_CLASS[t.tone]}`}
                      >
                        {t.label}
                      </span>
                    ))}
                    <span className="text-[10px] text-mist font-mono">pick {pct(b.pick, 2)}</span>
                  </div>
                </div>
                <BuildLoadout build={b} />
              </div>
            );
          })}
        </div>
      )}
    </Link>
  );
}
