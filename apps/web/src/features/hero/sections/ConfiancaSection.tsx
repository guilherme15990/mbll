import { Link } from "react-router-dom";
import { num } from "../../../lib/api";
import { useConfidence } from "../../../lib/api";
import {
  Empty, ErrBox, Loading, SectionTitle,
} from "../../../shared/ui";
import { interpretProbBand } from "@radar/proprietary-engine";
import { useHero } from "../../../lib/api";

type ConfidenceTrio = {
  posterior_mean: number | null;
  credible_interval_95: [number, number] | null;
  posterior_prob_above_threshold: number | null;
  c_reference?: number;
  uncertainty_status?: string;
};

/** Faixas interpretativas oficiais PRD Confidence §8 — fonte única em `@radar/proprietary-engine`. */

/**
 * Aba Confiança da ficha isolada — 1 busca de detalhe (trio) + herói compartilhado.
 * Banner: veredito da faixa + P(θ>μ+0,02) com aviso intransigente. Prova: trio medidores + grade-c.
 * Sem seção Joias (descoberta global, fica na rota plana). Nenhum % de confiança.
 */
export default function ConfiancaSection({
  heroId,
  rank,
  window,
}: {
  heroId: string;
  rank: string;
  window: string;
}) {
  const trioQuery = useConfidence(heroId || null, rank, window);
  const heroQuery = useHero(heroId || null, rank, window);

  if (!heroId) {
    return <Empty title="Sem herói" hint="Volte à visão geral e escolha um herói." />;
  }
  if (trioQuery.isLoading || heroQuery.isLoading) {
    return (
      <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Confiança do herói">
        <Loading rows={4} />
      </section>
    );
  }
  if (trioQuery.isError || heroQuery.isError) {
    return (
      <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Confiança do herói">
        <div className="card p-4 border-line bg-panel space-y-1">
          <p className="lbl">Confiança · elo {rank.toUpperCase()} · janela {window}d</p>
          <p className="text-sm font-bold text-foam">Confiança indisponível neste recorte</p>
          <p className="text-xs text-mist">A fonte não respondeu — o trio posterior não foi avaliado.</p>
        </div>
        <ErrBox onRetry={() => { trioQuery.refetch(); heroQuery.refetch(); }} />
      </section>
    );
  }

  const trio = trioQuery.data as unknown as ConfidenceTrio | undefined;
  if (!trio) {
    return (
      <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Confiança do herói">
        <div className="card p-4 border-line bg-panel space-y-1">
          <p className="lbl">Confiança · elo {rank.toUpperCase()} · janela {window}d</p>
          <p className="text-sm font-bold text-foam">Inconclusivo para a decisão</p>
          <p className="text-xs text-mist">Sem trio posterior neste recorte.</p>
        </div>
        <ErrBox onRetry={() => trioQuery.refetch()} />
      </section>
    );
  }

  // v3: sem Zona Yve/grade c — trio condicional à premissa única.
  const band = interpretProbBand(trio.posterior_prob_above_threshold);
  const p = trio.posterior_prob_above_threshold;
  const ci = Array.isArray(trio.credible_interval_95) ? trio.credible_interval_95 as [number, number] : null;

  return (
    <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Confiança do herói">
      <div id="prova-confianca" className="space-y-4 scroll-mt-4">
        <SectionTitle kicker="Prova" title="Trio como três medidores" subtitle="Média · intervalo · posterior com faixa interpretativa" />
        <div className="grid gap-3 md:grid-cols-3 p-1">
          <div className="card p-4 bg-panel border-line space-y-1.5">
            <span className="lbl">1. Média posterior</span>
            <p className="num text-2xl font-bold text-gold">{num(trio.posterior_mean, 4)}</p>
            <p className="text-[11px] text-mist">Força latente condicional ao modelo e à premissa c.</p>
          </div>
          <div className="card p-4 bg-panel border-line space-y-1.5">
            <span className="lbl">2. Intervalo credível 95%</span>
            <p className="num text-xl font-bold text-foam">
              {ci ? `${num(ci[0], 4)} – ${num(ci[1], 4)}` : "—"}
            </p>
            <p className="text-[11px] text-mist">Faixa plausível. Estreito não implica alta confiança.</p>
          </div>
          <div className="card p-4 bg-panel border-line space-y-1.5">
            <span className="lbl">3. P(θ &gt; μ + 0,02 | dados)</span>
            <p className="num text-2xl font-bold text-cyan-200">{num(p, 4)}</p>
            <p className={`text-[11px] font-semibold ${band.color}`}>{band.label}</p>
            {band.calibration_status != null && band.calibration_status !== "calibrated" && (
              <p className="text-[10px] text-mist italic">
                faixas 0,95/0,80 são ponto de partida — modelo não calibrado (V2 §8.3).
              </p>
            )}
            <p className="text-[10px] text-mist italic">
              Regra intransigente: isto NUNCA é chance de vitória em partida.
            </p>
          </div>
        </div>
      </div>

      <Link
        to={`/confianca?hero=${heroId}&rank=${rank}&window=${window}`}
        className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gold text-abyss text-sm font-bold hover:bg-gold-light transition-colors min-h-[44px]"
      >
        Abrir confiança na rota plana →
      </Link>
    </section>
  );
}
