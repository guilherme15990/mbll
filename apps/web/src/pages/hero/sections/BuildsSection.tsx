import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LANES, cx, num, pct, useBuilds, useHeroLanes, type Build } from "../../../lib/api";
import { BUILD_TAG_CLASS } from "../../../lib/buildLabel";
import { getBuildTags, orderBuildsByLift, selectBuildsAboveMostUsed } from "@radar/proprietary-engine";
import { NeedsLane } from "../../../components/idd/NeedsRankLane";
import BuildLoadout from "../../../components/BuildLoadout";
import { Empty, ErrBox, Loading } from "../../../components/ui";

function signed(v: number, digits = 4): string {
  return `${v >= 0 ? "+" : ""}${num(v, digits)}`;
}

/** Barra L divergente: emerald + / rose −, zero = linha, escala fixa ±0,10. */
function LiftBar({ lift }: { lift: number | null | undefined }) {
  const has = lift != null && Number.isFinite(lift);
  const v = has ? (lift as number) : 0;
  const frac = Math.min(50, (Math.abs(v) / 0.1) * 50);
  return (
    <div
      role="img"
      aria-label={
        has
          ? `lift ${signed(v)} em pontos percentuais vs mais-usada — escala fixa de menos 0,10 a mais 0,10`
          : "lift sem referência — sem barra"
      }
      className="relative h-2 w-full rounded-full bg-abyss border border-line overflow-hidden"
    >
      <div className="absolute inset-y-0 left-1/2 w-px bg-mist/50" aria-hidden="true" />
      {has && (
        <div
          aria-hidden="true"
          className={`absolute inset-y-0 ${v >= 0 ? "left-1/2 bg-emerald-400/80" : "right-1/2 bg-rose-400/80"}`}
          style={{ width: `${frac}%` }}
        />
      )}
    </div>
  );
}

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

  const pickLane = (l: string) => {
    sp.set("lane", l);
    setSp(sp);
    try {
      localStorage.setItem("radar:lane", l);
    } catch {
      /* armazenamento privado */
    }
  };

  if (!heroId) return <Empty title="Sem herói" hint="Volte à visão geral e escolha um herói." />;

  if (!validLane) {
    return (
      <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Builds do herói">
        <div className="rounded-2xl border border-line bg-panel p-5 space-y-1.5">
          <p className="lbl">Builds · {rank.toUpperCase()}</p>
          <h2 className="text-lg font-extrabold tracking-tight text-foam">Selecione uma lane</h2>
          <p className="text-xs text-mist leading-relaxed">
            A lane define a referência usada para comparar as builds. Sem lane, não há lift.
          </p>
        </div>
        {autoLane ? (
          <p className="text-[11px] text-gold" role="status">
            Lane {heroLanes[0]} sugerida pela rota do herói — troque abaixo se quiser.
          </p>
        ) : null}
        <NeedsLane
          capId="CAP-BDL-01"
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
  const bestLift = ordered[0]?.lift_vs_most_used;
  const laneLabel = lane?.toUpperCase() ?? "—";

  return (
    <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Builds do herói">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <p className="lbl">Builds · {laneLabel} · {rank.toUpperCase()} · janela {window}d</p>
          <h2 className="text-xl font-extrabold tracking-tight text-foam">Builds na {laneLabel}</h2>
          <p className="text-xs text-mist">
            {ordered.length
              ? `${ordered.length} builds catalogadas · ${withLift.length} acima da referência`
              : "Nenhuma build catalogada nesta rota"}
          </p>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-line bg-panel2 text-mist">
          Lane {laneLabel} · {rank.toUpperCase()}
        </span>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi
          label="Acima da referência"
          value={ordered.length ? `${withLift.length}/${ordered.length}` : "—"}
          hint="builds com lift positivo"
        />
        <Kpi label="Ref. mais usada" value={pct(refWin)} hint="win rate da referência" />
        <Kpi label="Média do herói" value={pct(meanWin)} hint="win rate na lane e elo" />
        <Kpi
          label="Maior lift"
          value={bestLift != null && Number.isFinite(bestLift) ? signed(bestLift) : "—"}
          hint="vs build mais usada"
        />
      </div>

      <div className="rounded-2xl border border-line bg-panel px-3 py-2.5 flex items-center gap-3 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-mist">Lane</span>
        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Escolha a lane">
          {LANES.map((l) => (
            <button
              key={l}
              onClick={() => pickLane(l)}
              aria-pressed={lane === l}
              className={cx(
                "px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-colors min-h-[44px] md:min-h-[36px]",
                lane === l
                  ? "bg-gold text-abyss"
                  : "text-mist hover:text-foam hover:bg-panel2",
              )}
            >
              {l}
            </button>
          ))}
        </div>
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
            const liftOk = lift != null && Number.isFinite(lift);
            return (
              <article key={i} className="rounded-2xl border border-line bg-panel overflow-hidden">
                <div className="p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-4">
                      <span
                        className={cx(
                          "grid h-8 w-8 place-items-center rounded-lg border text-xs font-bold",
                          i === 0
                            ? "bg-gold/10 text-gold border-gold/30"
                            : "bg-panel2 text-mist border-line",
                        )}
                        aria-label={`posição ${i + 1} por lift`}
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
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {i === 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-gold/30 bg-gold/10 text-gold">
                          Maior lift
                        </span>
                      )}
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
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-mist">Lift vs mais usada</span>
                      <span
                        className={cx(
                          "num font-bold",
                          !liftOk ? "text-mist" : (lift as number) >= 0 ? "text-emerald-300" : "text-rose-300",
                        )}
                      >
                        {liftOk ? signed(lift as number) : "—"}
                      </span>
                    </div>
                    <LiftBar lift={lift} />
                    <div className="flex items-center justify-between gap-2 text-[11px] text-mist">
                      <span>
                        vs média{" "}
                        <b className="text-foam font-semibold">
                          {b.lift_vs_mean != null && Number.isFinite(b.lift_vs_mean) ? num(b.lift_vs_mean, 4) : "—"}
                        </b>
                      </span>
                      <span>ref {pct(b.reference_win ?? refWin)}</span>
                    </div>
                  </div>

                  <BuildLoadout build={b} />
                </div>
              </article>
            );
          })
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 flex-wrap pt-1">
        <p className="text-[11px] text-mist leading-relaxed max-w-xl">
          Lift = win da build − win da referência. Sem referência, o valor fica em aberto — nunca 0.
        </p>
        <Link
          to={`/builds?view=hero&hero=${heroId}&rank=${rank}&window=${window}&lane=${lane}`}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gold text-abyss text-sm font-bold hover:bg-gold-light transition-colors min-h-[44px]"
        >
          Abrir builds na rota plana →
        </Link>
      </footer>
    </section>
  );
}
