import { useSearchParams } from "react-router-dom";
import { Clock, Info, LineChart } from "lucide-react";
import { ago, num, useMeta, useTemporal, useTrends } from "../../shared/api";
import { PrimaryAction } from "../../shared/ui/patterns/PrimaryAction";
import {
  CtxBar, Empty, ErrBox, Loading,
  SectionTitle
} from "../../shared/ui";
import { TrendChart } from "../../shared/ui/patterns/charts";
import { getSignalStateBadge } from "@radar/proprietary-engine";
import type { HeroPanelProps } from "../../shared/ui/patterns/heroPanel";

type TemporalView = {
  delta?: number;
  delta_logit?: number;
  interval_95?: number[];
  temporal_status?: string;
  patch_association_status?: string;
};

type MetaVersion = { data?: { game_version?: string }; createdAt?: string };

/** Mapeamento formal dos estados do sinal (PRD Temporal §6) — fonte única em `@radar/proprietary-engine`. */

/** CTX-TMP · painel reutilizado pela rota plana /tempo e pela aba tempo de /heroi. Mesmas keys ["temporal"…] + ["trends"…]. */
export default function TempoPanel({ rank, window, hero, dossier, picker }: HeroPanelProps) {
  const [sp, setSp] = useSearchParams();

  const pickHero = (id: string) => {
    sp.set("hero", id);
    setSp(sp);
  };

  const temporalQuery = useTemporal(hero || null, rank, window);
  const trendSeries = useTrends(hero || null, rank);
  const meta = useMeta();

  const tData = temporalQuery.data as unknown as TemporalView | undefined;
  const signalState = getSignalStateBadge(tData?.temporal_status);

  return (
    <section className="space-y-4">
      <CtxBar
        id="TMP"
        name="Dinâmica Temporal e Resposta a Patches"
        question="O sinal de força persiste no tempo? A variação pós-patch é real ou ruído de adaptação?"
        status="experimental (T0/T1/T2)"
        formula="Δ = θ(t2) − θ(t1) em escala logit (log-odds ≠ pp); Sinal → Alerta → Causal; Janelas sobrepostas não são independentes; Walk-forward"
        prdRef="PRD Estabilidade Temporal e Resposta a Patches"
      />

      {dossier}

      <SectionTitle
        kicker="Stream I · Estabilidade & Ciclo de Vida do Sinal (PRD §6)"
        title="Monitoramento Temporal e Patches"
        subtitle="Diferença estimada entre janelas móveis com magnitude, incerteza e persistência sem alegação causal apressada."
      />

      {picker}

      <PrimaryAction
        label="Copiar série CSV"
        to={`/tempo?hero=${hero}&rank=${rank}&window=${window}`}
        disabledReason={!hero ? "selecione um herói" : null}
      />

      {!hero ? (
        <Empty
          title="Selecione um herói para acompanhar sua série temporal"
          hint="O módulo calcula a variação temporal de força (Δ), o estado do sinal (inicial, persistente ou revertido) e exibe o histórico diário de 30 dias."
          to={`/forca?rank=${rank}&window=${window}`}
          action="Voltar à Força"
        />
      ) : temporalQuery.isLoading ? (
        <Loading rows={3} />
      ) : temporalQuery.isError || !tData ? (
        <ErrBox onRetry={() => temporalQuery.refetch()} />
      ) : (
        <div className="space-y-4">
          {/* Signal Status and Delta Cards */}
          <div className="grid gap-3 md:grid-cols-2">
            {/* Left Card: Delta and Uncertainty */}
            <div className="card p-4 bg-gradient-to-br from-panel to-panel2/60 border-line space-y-2">
              <div className="flex items-center justify-between">
                <span className="lbl">Δ de Força Estimada (7d vs 30d)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-abyss text-mist border border-line">
                  Escala Logit (Log-Odds)
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="num text-2xl font-bold text-gold">
                  {num(tData.delta, 4)}
                </p>
                <span className="text-xs text-mist font-mono">
                  (logit: {num(tData.delta_logit, 4)})
                </span>
              </div>
              <p className="text-[11px] text-mist leading-relaxed">
                IC 95%:{" "}
                <span className="text-foam font-mono">
                  {tData.interval_95?.map((v: number) => num(v, 4)).join(" – ") ?? "—"}
                </span>
                {" "}· <b>Regra D-TEMP-03:</b> Log-odds nunca são interpretados como pontos percentuais sem referência explícita.
              </p>
            </div>

            {/* Right Card: Signal State */}
            <div className="card p-4 bg-gradient-to-br from-panel to-panel2/60 border-line space-y-2">
              <div className="flex items-center justify-between">
                <span className="lbl">Estado do Sinal no Ciclo de Vida</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${signalState.color}`}>
                  {signalState.label}
                </span>
              </div>
              <p className="text-xs text-foam font-semibold">
                Status de Associação: {tData.patch_association_status ?? "temporal_association"}
              </p>
              <p className="text-[11px] text-mist leading-relaxed">
                {signalState.desc}
              </p>
            </div>
          </div>

          {/* Daily Trend Chart (30d) */}
          <div className="card p-4 space-y-3 border-line bg-panel2/30">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <LineChart size={16} className="text-gold" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-foam">
                  Série Histórica Diária · 30 Dias (Win Rate & Ban Rate)
                </h4>
              </div>
              <span className="text-[11px] text-mist font-mono">
                Pontos diários contínuos (não agregados)
              </span>
            </div>

            {trendSeries.isLoading ? (
              <Loading rows={2} />
            ) : trendSeries.isError || !trendSeries.data?.data?.length ? (
              <div className="p-6 text-center text-xs text-mist">
                Sem histórico diário disponível para este herói no elo {rank}.
              </div>
            ) : (
              <div className="pt-2">
                <TrendChart data={trendSeries.data.data} />
                <div className="flex items-center justify-center gap-6 text-[11px] text-mist pt-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-gold inline-block" /> Win Rate Observado Diário
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-mist inline-block border-dashed" /> Ban Rate Diário
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Methodological Principles: Signal -> Alert -> Causal */}
          <div className="grid md:grid-cols-2 gap-3 text-xs">
            <div className="card p-3.5 bg-panel2/40 border-line space-y-1.5">
              <div className="flex items-center gap-2 text-gold font-semibold">
                <Info size={14} />
                <span>Princípio Sinal → Alerta → Causal (PRD §1):</span>
              </div>
              <p className="text-mist leading-relaxed">
                Uma variação observada gera um <b>Sinal</b>. Apenas se confirmada como estatisticamente robusta e persistente gera um <b>Alerta</b>. Declarar que uma mudança foi <b>causada pelo patch</b> exige análise contrafactual com grupo de controle pré-patch. O Radar não anuncia heróis como "quebrados" baseando-se unicamente em reações iniciais de primeiro snapshot.
              </p>
            </div>

            <div className="card p-3.5 bg-panel2/40 border-line space-y-1.5">
              <div className="flex items-center gap-2 text-foam font-semibold">
                <Clock size={14} />
                <span>Ledger de Versões e Atualizações:</span>
              </div>
              {meta.isLoading ? (
                <p className="text-mist">Carregando histórico do servidor...</p>
              ) : meta.isError ? (
                <p className="text-mist">Histórico de versões indisponível.</p>
              ) : (
                <ul className="space-y-1 text-mist font-mono text-[11px]">
                  {(((meta.data as unknown as { versions?: MetaVersion[] } | undefined)?.versions) ?? []).slice(0, 4).map((v: MetaVersion, i: number) => (
                    <li key={i} className="flex items-center justify-between">
                      <span className="text-foam font-bold">
                        Versão {v?.data?.game_version ?? "?"}
                      </span>
                      <span className="text-mist/70">
                        {v?.createdAt ? ago(Date.now() - new Date(v.createdAt).getTime()) : "sem data"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[10px] text-mist/70 pt-1">
                Janelas curtas reagem rápido mas sofrem ruído; janelas longas misturam partidas pré e pós-patch.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
