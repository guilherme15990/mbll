import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LANES, cx, pct, useBuilds, useHeroLanes, type Build } from "../../../shared/api";
import { BUILD_TAG_CLASS } from "../../../shared/domain/buildLabel";
import { getBuildTags, orderBuildsByLift, selectBuildsAboveMostUsed } from "@radar/proprietary-engine";
import { NeedsLane } from "../../../shared/ui/patterns/NeedsRankLane";
import BuildLoadout from "../../../shared/ui/patterns/BuildLoadout";
import { Empty, ErrBox, Loading } from "../../../shared/ui";

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-3 py-2.5 space-y-0.5">
      <p className="text-[11px] text-mist">{label}</p>
      <p className="num text-base font-bold text-foam leading-tight">{value}</p>
      {hint && <p className="text-[10px] text-mist/70">{hint}</p>}
    </div>
  );
}

/**
 * Aba Builds da ficha isolada — 1 busca de detalhe (com lane) + herói compartilhado.
 * Lane obrigatória: sem lane, NeedsLane e 0 buscas (hook desabilitado sem lane válida).
 * Lift sempre com referência por linha + tags; silêncio no inconclusivo.
 */
export default function BuildsSection({
  heroId,
  rank,
  window,
}: {
  heroId: string;
  rank: string;
  window: string;
}) {
  const [sp, setSp] = useSearchParams();
  const lane = sp.get("lane");
  const validLane = lane != null && (LANES as readonly string[]).includes(lane);
  // Rotas do próprio herói (mesma key do mapa global — cache hit, 0 request extra):
  // sem ?lane=, a primeira rota mapeada do herói é passada adiante (visível e trocável).
  const lanesQuery = useHeroLanes(rank);
  const heroLanes = ((lanesQuery.data?.data as Record<string, string[]> | undefined)?.[heroId] ?? [])
    .filter((l) => (LANES as readonly string[]).includes(l));
  useEffect(() => {
    if (sp.get("lane") == null && lanesQuery.isSuccess && heroLanes.length > 0) {
      const next = new URLSearchParams(sp);
      next.set("lane", heroLanes[0]);
      setSp(next, { replace: true });
    }
  }, [sp, setSp, lanesQuery.isSuccess, heroLanes]);
  const autoLane = !validLane && heroLanes.length > 0;
  const q = useBuilds(heroId || null, rank, lane ?? "");

  if (!heroId) return <Empty title="Sem herói" hint="Volte à visão geral e escolha um herói." />;

  if (!validLane) {
    return (
      <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Builds do herói">
        <div className="rounded-2xl border border-line bg-panel p-5 space-y-1.5">
          <p className="lbl">Builds · {rank.toUpperCase()}</p>
          <h2 className="text-lg font-extrabold tracking-tight text-foam">Selecione uma lane</h2>
          <p className="text-xs text-mist leading-relaxed">
            A lane define a referência usada para comparar as builds. Sem lane, não há comparação.
          </p>
        </div>
        {autoLane ? (
          <p className="text-[11px] text-gold" role="status">
            Lane {heroLanes[0]} sugerida pela rota do herói — troque abaixo se quiser.
          </p>
        ) : null}
        <NeedsLane
          onPick={(l) => {
            sp.set("lane", l);
            setSp(sp);
          }}
        />
        <Link
          to={`/builds?view=hero&hero=${heroId}&rank=${rank}&window=${window}`}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-line bg-panel2 text-sm font-semibold text-mist hover:text-foam transition-colors min-h-[44px]"
        >
          Abrir builds na rota plana →
        </Link>
      </section>
    );
  }

  if (q.isLoading) {
    return (
      <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Builds do herói">
        <Loading rows={4} />
      </section>
    );
  }
  if (q.isError) {
    return (
      <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Builds do herói">
        <div className="rounded-2xl border border-line bg-panel p-5 space-y-1">
          <p className="lbl">Builds · {lane?.toUpperCase()} · {rank.toUpperCase()}</p>
          <p className="text-sm font-bold text-foam">Fonte indisponível neste recorte</p>
          <p className="text-xs text-mist">A fonte não respondeu — nenhuma build foi avaliada.</p>
        </div>
        <ErrBox onRetry={() => q.refetch()} />
      </section>
    );
  }

  const rows = q.data?.data ?? [];
  const refs = q.data?.references;
  // Ordenação client + seleção acima-da-ref em `@radar/proprietary-engine`.
  const ordered = orderBuildsByLift(rows);
  const withLift = selectBuildsAboveMostUsed(ordered);
  const refWin = refs?.mostUsed?.win;
  const meanWin = refs?.heroMean;
  const picks = rows
    .map((r: Build) => r.pick)
    .filter((p): p is number => p != null && Number.isFinite(p));
  const maxPick = picks.length ? Math.max(...picks) : null;
  const laneLabel = lane?.toUpperCase() ?? "—";

  return (
    <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Builds do herói">
      <header>
        <h2 className="text-xl font-extrabold tracking-tight text-foam">Builds na {laneLabel}</h2>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi
          label="Acima da referência"
          value={ordered.length ? `${withLift.length}/${ordered.length}` : "—"}
          hint="builds que vencem mais que o normal"
        />
        <Kpi label="Ref. mais usada" value={pct(refWin)} hint="win rate da referência" />
        <Kpi label="Média do herói" value={pct(meanWin)} hint="win rate na lane e elo" />
        <Kpi label="Maior pick" value={pct(maxPick)} hint="pick mais alto observado" />
      </div>

      <div id="prova-builds" className="space-y-3 scroll-mt-4">
        {!ordered.length ? (
          <Empty
            title="Nenhuma build catalogada para este herói nesta lane"
            hint="Sem volume suficiente para herói + elo + lane. Experimente outra lane."
          />
        ) : (
          ordered.map((b: Build, i: number) => {
            const tags = getBuildTags(b);
            const lift = b.lift_vs_most_used;
            const liftOk = lift != null && Number.isFinite(lift) && lift !== 0;
            const positive = liftOk && (lift as number) > 0;
            return (
              <article key={i} className="rounded-2xl border border-line bg-panel overflow-hidden">
                <div className="p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span
                        className={cx(
                          "grid h-8 w-8 place-items-center rounded-lg border text-xs font-bold",
                          i === 0
                            ? "bg-gold/10 text-gold border-gold/30"
                            : "bg-panel2 text-mist border-line",
                        )}
                        aria-label={`posição ${i + 1}`}
                      >
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-[11px] text-mist">Win rate</p>
                        <p className="num text-2xl font-extrabold text-foam leading-none">{pct(b.win)}</p>
                      </div>
                      <div className="pl-4 border-l border-line">
                        <p className="text-[11px] text-mist">Pick</p>
                        <p className="num text-sm font-semibold text-foam">{pct(b.pick, 2)}</p>
                      </div>
                      {tags.map((t) => (
                        <span
                          key={t.key}
                          title={t.title}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-block ${BUILD_TAG_CLASS[t.tone]}`}
                        >
                          {t.label}
                        </span>
                      ))}
                    </div>
                    {liftOk && (
                      <span className={cx("text-[11px] font-semibold", positive ? "text-emerald-300" : "text-rose-300")}>
                        {positive ? "▲ Vence mais que o normal" : "▼ Vence menos que o normal"}
                      </span>
                    )}
                  </div>

                  <BuildLoadout build={b} />
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
