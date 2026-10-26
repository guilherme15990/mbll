import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Sparkles } from "lucide-react";
import { num, pct, useConfidence, useGems, useHero } from "../../shared/api";
import { PrimaryAction } from "../../shared/ui/patterns/PrimaryAction";
import {
  Avatar, ClassSeal, CtxBar, Empty, ErrBox,
  GhostNote, Loading, SectionTitle, StatusSeal, TierBadge
} from "../../shared/ui";
import type { HeroPanelProps } from "../../shared/ui/patterns/heroPanel";
import { interpretProbBand } from "@radar/proprietary-engine";

type ConfidenceTrio = {
  posterior_mean: number | null;
  credible_interval_95: [number, number] | null;
  posterior_prob_above_threshold: number | null;
  c_reference?: number;
  uncertainty_status?: string;
};

/** Faixas interpretativas oficiais PRD Confidence §8 — fonte única em `@radar/proprietary-engine`. */

/** CTX-CNF · painel reutilizado pela rota plana /confianca e pela aba confianca de /heroi. Mesmas keys ["hero"…] + ["confidence"…] + ["gems"…]. */
export default function ConfiancaPanel({ rank, window, hero, dossier, picker, ficha }: HeroPanelProps) {
  // Na ficha, Joias é descoberta global do elo — fica só na rota plana /confianca.
  const [sp, setSp] = useSearchParams();

  const pickHero = (id: string) => {
    sp.set("hero", id);
    setSp(sp);
  };

  const heroData = useHero(hero || null, rank, window);
  const trioData = useConfidence(hero || null, rank, window);
  const gems = useGems(rank, window);

  const trio = trioData.data as unknown as ConfidenceTrio | undefined;

  const band = interpretProbBand(trio?.posterior_prob_above_threshold);

  return (
    <section className="space-y-4">
      <CtxBar
        id="CNF"
        name="Confiança, Incerteza e Probabilidade Posterior"
        question="O sinal é estatisticamente sustentado ou sensível à premissa de escala c?"
        status="provisório (RF-CONF-02)"
        formula="Posterior m_i ± 1.96·se; P(θ_i > μ + Δ | dados) via normal acumulada com Δ=0.02; c único declarado (proxy); sem selo confirmatório sem n real"
        prdRef="PRD Confidence, Intervalo e Probabilidade Posterior"
      />

      {dossier}

      <SectionTitle
        kicker="Stream I · O Trio de Incerteza Separado (D-CONF-01)"
        title="Avaliação Inferencial por Herói"
        subtitle="Confiança da evidência, intervalo credível e probabilidade posterior nunca são misturados em um único score."
      />

      {picker}

      <PrimaryAction
        label="Copiar veredito c/ carimbos"
        to={`/confianca?hero=${hero}&rank=${rank}&window=${window}`}
        disabledReason={!hero ? "selecione o herói" : null}
      />

      {!hero ? (
        <Empty
          title="Selecione um herói para inspecionar o Trio de Incerteza"
          hint="O cálculo bayesiano de posterior mean, IC 95% e probabilidade posterior de superar o limiar Δ=0.02 é calculado especificamente por herói, elo e janela temporal."
          to={`/forca?rank=${rank}&window=${window}`}
          action="Voltar ao panorama de força"
        />
      ) : heroData.isLoading || trioData.isLoading ? (
        <Loading rows={4} />
      ) : heroData.isError || trioData.isError || !trio ? (
        <ErrBox onRetry={() => { heroData.refetch(); trioData.refetch(); }} />
      ) : (
        <div className="space-y-4">
          {/* Trio Cards Grid */}
          <div className="grid gap-3 md:grid-cols-3 p-1">
            {/* 1. Posterior Mean */}
            <div className="card p-4 bg-gradient-to-b from-panel via-panel2/40 to-panel border-line space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="lbl">1. Média Posterior (θ̂)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-abyss text-mist border border-line">
                  c_ref = {trio.c_reference ?? 100000}
                </span>
              </div>
              <p className="num text-2xl font-bold text-gold">
                {num(trio.posterior_mean, 4)}
              </p>
              <p className="text-[11px] text-mist leading-relaxed">
                Estimativa pontual da força latente condicional ao modelo e à premissa de escala c.
              </p>
            </div>

            {/* 2. Credible Interval 95% */}
            <div className="card p-4 bg-gradient-to-b from-panel via-panel2/40 to-panel border-line space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="lbl">2. Intervalo Credível 95%</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  Provisório
                </span>
              </div>
              <p className="num text-xl font-bold text-foam">
                {Array.isArray(trio.credible_interval_95)
                  ? `${num(trio.credible_interval_95[0], 4)} – ${num(trio.credible_interval_95[1], 4)}`
                  : "—"}
              </p>
              <p className="text-[11px] text-mist leading-relaxed">
                Faixa de valores plausíveis. <b>Atenção:</b> intervalo estreito não implica alta confiança, pois pode advir apenas da premissa de exposição.
              </p>
            </div>

            {/* 3. Posterior Probability */}
            <div className="card p-4 bg-gradient-to-b from-panel via-panel2/40 to-panel border-line space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="lbl">3. P(θ &gt; μ + 0.02 | dados)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  Δ = 0.02
                </span>
              </div>
              <p className="num text-2xl font-bold text-cyan-200">
                {num(trio.posterior_prob_above_threshold, 4)}
              </p>
              <p className={`text-[11px] font-semibold ${band.color}`}>
                {band.label}
              </p>
              {band.calibration_status != null && band.calibration_status !== "calibrated" && (
                <p className="text-[10px] text-mist italic">
                  faixas 0,95/0,80 são ponto de partida — modelo não calibrado (V2 §8.3).
                </p>
              )}
              <p className="text-[10px] text-mist italic">
                <b>Regra intransigente:</b> isto NUNCA é chance de vitória do jogador em partida.
              </p>
            </div>
          </div>

          {/* Premissa de exposição (v3: grade c podada — premissa única declarada) */}
          <div className="card p-4 border-line bg-panel2/40 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-gold" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-foam">
                  Premissa de exposição (c único declarado)
                </h4>
              </div>
              <StatusSeal
                ok
                good="c_ref declarado · sem grade"
                bad="Sem premissa"
              />
            </div>

            <p className="text-xs text-mist leading-relaxed">
              Posterior, intervalo e probabilidade são condicionais à premissa c = {trio.c_reference ?? 100000} (proxy, sem validação de exposição). Sem contagens reais, não há selo confirmatório — só Situacional ou Inconclusivo.
            </p>
          </div>

          {/* PRD Interpretive Framework */}
          <div className="card p-4 border-line bg-panel2/20 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foam">
              Eventos de Interesse por Decisão de Produto (PRD §9)
            </h4>
            <div className="grid md:grid-cols-2 gap-3 text-xs text-mist">
              <div className="p-2.5 rounded-lg bg-panel2/40 border border-line space-y-1">
                <p className="font-semibold text-foam">Pick Seguro:</p>
                <p>Força ajustada acima da referência com baixa dependência contextual. P alto sozinho não basta; exige estabilidade entre ranks.</p>
              </div>
              <div className="p-2.5 rounded-lg bg-panel2/40 border border-line space-y-1">
                <p className="font-semibold text-foam">Piores Picks:</p>
                <p>Probabilidade posterior de θ ficar abaixo de μ − Δ. Evita rotular injustamente como ruim quem está levemente abaixo da média.</p>
              </div>
              <div className="p-2.5 rounded-lg bg-panel2/40 border border-line space-y-1">
                <p className="font-semibold text-foam">Hidden Gem (Joia Escondida):</p>
                <p>Força ajustada alta + baixa popularidade + evidência suficiente. Nunca é preenchido para heróis inconclusivos.</p>
              </div>
              <div className="p-2.5 rounded-lg bg-panel2/40 border border-line space-y-1">
                <p className="font-semibold text-foam">Counter Pick:</p>
                <p>δ observado com direção validada e evidence_quality. Sem probabilidade numérica associada no M6 v1.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Gems Section (só na rota plana; na ficha é descoberta global, não veredito do herói) */}
      {!ficha ? (
      <section className="space-y-3 pt-3">
        <SectionTitle
          kicker="Descoberta · Força Alta com Pressão Reduzida"
          title={`Joias Escondidas Detectadas · ${rank.toUpperCase()} · ${window}d`}
          subtitle="Heróis com θ̂ acima da referência que sobreviveram ao shrinkage, com pick/ban reduzidos e evidência robusta."
        />

        {gems.isLoading ? (
          <Loading rows={3} />
        ) : gems.isError ? (
          <ErrBox onRetry={() => gems.refetch()} />
        ) : !(gems.data?.data?.length) ? (
          <div className="card p-6 text-center text-xs text-mist">
            Nenhuma joia escondida qualificada neste elo e janela (ou o mercado equilibrou a demanda ou o ruído venceu na grade de sensibilidade).
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {gems.data.data.map((g) => (
              <div
                key={g.id}
                onClick={() => pickHero(String(g.id))}
                className="card card-h p-4 flex gap-3.5 items-start cursor-pointer transition-all border-cyan-400/30 hover:border-cyan-400"
              >
                <Avatar src={g.head} name={g.name} size={54} />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-foam hover:text-cyan-200">{g.name}</span>
                    <ClassSeal cls="Joia" />
                    <TierBadge tier={g.tier} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-mist flex-wrap">
                    <span>θ̂ <b className="num text-gold font-bold">{num(g.wrAdj, 3)}</b></span>
                    <span>z <b className="num text-foam">{num(g.z, 2)}</b></span>
                    <span>q <b className="num text-foam">{num(g.q, 4)}</b></span>
                    <span>pick {pct(g.pick)}</span>
                  </div>
                  <GhostNote>{g.reason}</GhostNote>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      ) : null}
    </section>
  );
}
