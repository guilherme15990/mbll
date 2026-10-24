import { useSearchParams } from "react-router-dom";
import { Hammer } from "lucide-react";
import { LANES, cx, num, pct, useBuilds, useHeroes } from "../../shared/api";
import { BUILD_TAG_CLASS } from "../../shared/domain/buildLabel";
import { getBuildTags } from "@radar/proprietary-engine";
import BuildLoadout from "../../shared/ui/patterns/BuildLoadout";
import {
  Avatar, CtxBar, Empty, ErrBox, IddZone, Loading,
  SectionTitle, TierBadge
} from "../../shared/ui";
import { PrimaryAction } from "../../shared/idd/cards/PrimaryAction";
import { NeedsLane } from "../../shared/idd/cards/NeedsRankLane";
import type { HeroPanelProps } from "../../shared/ui/patterns/heroPanel";

/** CTX-BDL · painel reutilizado pela rota plana /builds e pela aba builds de /heroi. Lane via URL (?lane=, sem default). Mesma key ["builds",id,rank,lane]. */
export default function BuildsPanel({ rank, window, hero, dossier, picker }: HeroPanelProps) {
  const [sp, setSp] = useSearchParams();
  const lane = sp.get("lane");

  const pickHero = (id: string) => {
    sp.set("hero", id);
    setSp(sp);
  };

  const pickLane = (l: string) => {
    sp.set("lane", l);
    setSp(sp);
    try {
      localStorage.setItem("radar:lane", l);
    } catch {
      /* storage privado */
    }
  };

  const buildsQuery = useBuilds(hero || null, rank, lane ?? "");
  const heroesQuery = useHeroes(rank, window);
  const validLane = lane != null && (LANES as readonly string[]).includes(lane);

  const suggestedHeroes = (heroesQuery.data?.data ?? [])
    .slice(0, 6);

  return (
    <section className="space-y-5">
      <CtxBar
        id="BDL"
        name="Build Lift e Otimização de Itens"
        question="Qual build está associada a maior rendimento relativo a uma referência comparável?"
        status="camada A (associação descritiva)"
        formula="L = WR_build − WR_ref; Referências: Mais Usada e Média do Herói; Lane obrigatória; Alerta de causalidade reversa (seleção de build)"
        prdRef="PRD Build Lift"
      />

      {dossier}

      <SectionTitle
        kicker="Stream 2 · Associação de Itens & Referências (PRD §4)"
        title="Build Lift: Desempenho por Lane"
        subtitle="Mede o lift relativo associado a cada conjunto de itens comparado à referência padrão do herói."
      />

      {picker}

      <PrimaryAction
        contextId="BDL"
        capId="CAP-BDL-01"
        label="Fixar build de referência"
        to={`/builds?view=hero&hero=${hero}&rank=${rank}&window=${window}${lane ? `&lane=${lane}` : ""}`}
        disabledReason={!hero ? "selecione um herói" : !validLane ? "escolha a lane" : null}
      />

      {/* Mandatory Lane Selector */}
      <div className="card p-3.5 bg-panel border-line flex items-center gap-3 flex-wrap">
        <span className="lbl text-xs font-semibold text-foam">
          Lane Obrigatória (Regra INV-BDL-01):
        </span>
        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Escolha a lane">
          {LANES.map((l) => (
            <button
              key={l}
              onClick={() => pickLane(l)}
              aria-pressed={lane === l}
              className={cx(
                "px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all",
                lane === l
                  ? "bg-gold text-abyss shadow-sm"
                  : "bg-abyss/60 text-mist hover:text-foam border border-line"
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-mist ml-auto hidden sm:inline">
          Sem default silencioso · builds comparadas exclusivamente dentro da mesma rota.
        </span>
      </div>

      {!hero ? (
        <div className="space-y-4">
          <div className="card p-6 border-line bg-panel2/30 space-y-3 text-center">
            <span className="p-3 rounded-2xl bg-panel inline-flex text-orange-300 border border-orange-400/30">
              <Hammer size={24} />
            </span>
            <h3 className="font-bold text-base text-foam">
              Selecione um Herói para Analisar Builds{lane ? ` na Rota ${lane.toUpperCase()}` : " — escolha a lane abaixo"}
            </h3>
            <p className="text-xs text-mist max-w-lg mx-auto leading-relaxed">
              O cálculo de Build Lift exige um herói e a rota correspondente. Selecione um herói acima ou clique em uma das sugestões{lane ? ` para a rota ${lane.toUpperCase()}` : ""}:
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 text-left">
              {suggestedHeroes.map((sh) => (
                <div
                  key={sh.id}
                  onClick={() => pickHero(String(sh.id))}
                  className="card card-h p-3 cursor-pointer bg-panel border-line hover:border-gold/40 transition-all flex items-center gap-3"
                >
                  <Avatar src={sh.head} name={sh.name} size={38} />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-xs text-foam truncate hover:text-gold block">{sh.name}</span>
                    <span className="text-[11px] text-mist font-mono">
                      θ̂ <b className="text-gold">{num(sh.wrAdj, 3)}</b> · pick {pct(sh.pick)}
                    </span>
                  </div>
                  <TierBadge tier={sh.tier} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : !validLane ? (
        <IddZone zone="state" capId="CAP-BDL-01">
          <NeedsLane
            capId="CAP-BDL-01"
            onPick={(l) => {
              sp.set("lane", l);
              setSp(sp);
            }}
          />
        </IddZone>
      ) : buildsQuery.isLoading ? (
        <Loading rows={4} />
      ) : buildsQuery.isError || !buildsQuery.data?.data?.length ? (
        buildsQuery.isError ? (
          <ErrBox onRetry={() => buildsQuery.refetch()} />
        ) : (
          <Empty
            title="Nenhuma build catalogada para este herói nesta lane"
            hint="A API não possui registros com volume suficiente de partidas para a combinação de herói, elo e lane selecionados."
            to={`/builds?view=hero&hero=${hero}&rank=${rank}&window=${window}&lane=exp`}
            action="Experimentar outra Lane"
          />
        )
      ) : (
        <div className="space-y-4">
          {/* Reference Statistics Banner */}
          {buildsQuery.data.references && (
            <div className="flex items-center gap-4 text-xs text-mist font-mono bg-panel2/40 p-3 rounded-xl border border-line">
              <span>
                Referência Mais Usada:{" "}
                <b className="text-foam font-bold">
                  {pct(buildsQuery.data.references.mostUsed?.win)}
                </b>
              </span>
              <span>·</span>
              <span>
                Média Geral do Herói na Lane:{" "}
                <b className="text-gold font-bold">
                  {pct(buildsQuery.data.references.heroMean)}
                </b>
              </span>
            </div>
          )}

          {/* Builds List */}
          <div className="space-y-3">
            {buildsQuery.data.data.map((b, i) => {
              const tags = getBuildTags(b);
              const lift = b.lift_vs_most_used;
              const liftOk = lift != null && Number.isFinite(lift);
              const isPositiveLift = liftOk && (lift as number) >= 0;

              return (
                <div
                  key={i}
                  className="card p-4 bg-panel border-line hover:border-gold/30 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="space-y-1 min-w-[110px]">
                        <span className="lbl">Win rate</span>
                        <p className="num text-xl font-bold text-gold leading-none">
                          {pct(b.win)}
                        </p>
                        <p className="text-[11px] text-mist font-mono">
                          pick {pct(b.pick, 2)}
                        </p>
                      </div>

                      <div className="space-y-1 min-w-[160px] border-l border-line pl-4">
                        <span className="lbl">Lift</span>
                        <p className="text-sm font-mono font-bold">
                          vs mais usada:{" "}
                          <span className={!liftOk ? "text-mist" : isPositiveLift ? "text-emerald-300" : "text-rose-300"}>
                            {liftOk
                              ? `${isPositiveLift ? "+" : ""}${num(lift, 4)}`
                              : "—"}
                          </span>
                        </p>
                        <p className="text-[11px] text-mist font-mono">
                          vs média:{" "}
                          <span className="text-foam">
                            {b.lift_vs_mean != null && Number.isFinite(b.lift_vs_mean) ? num(b.lift_vs_mean, 4) : "—"}
                          </span>
                        </p>
                      </div>
                    </div>

                    {tags.length ? (
                      <div className="flex items-center gap-1.5 flex-wrap" role="list" aria-label="Marcas da build">
                        {tags.map((t) => (
                          <span
                            key={t.key}
                            role="listitem"
                            title={t.title}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-block ${BUILD_TAG_CLASS[t.tone]}`}
                          >
                            {t.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <BuildLoadout build={b} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
