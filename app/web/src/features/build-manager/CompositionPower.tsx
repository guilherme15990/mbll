import { ArrowRight, Info, RotateCcw, Sparkles } from "lucide-react";
import { cx, num, pct, type Build } from "../../shared/api";
import { valueText, type CombinerScore } from "../../shared/domain/combiner";
import { liftPp, liftTone, signed } from "../../shared/format";

type Props = {
  score: CombinerScore | null;
  baseScore: CombinerScore | null;
  sameAsBase: boolean;
  base: Build | null;
  canOptimize: boolean;
  onOptimize: () => void;
  onReset: () => void;
};

const LIFT_TONE_CLASS = {
  unknown: "text-mist",
  neutral: "text-mist",
  positive: "text-emerald-300",
  negative: "text-rose-300",
} as const;

function liftText(build: Build): string {
  const lift = build.lift_vs_most_used;
  const tone = liftTone(lift);
  if (tone === "unknown") return "sem referência";
  if (tone === "neutral") return `sem diferença relevante (${liftPp(lift)})`;
  return liftPp(lift);
}

export default function CompositionPower({
  score,
  baseScore,
  sameAsBase,
  base,
  canOptimize,
  onOptimize,
  onReset,
}: Props) {
  const index = score?.index ?? null;
  const baseIndex = baseScore?.index ?? null;
  const delta = index != null && baseIndex != null ? +(index - baseIndex).toFixed(1) : null;
  const lift = base?.lift_vs_most_used ?? null;
  const tone = liftTone(lift);
  const contributions = [...(score?.contributions ?? [])]
    .sort((a, b) => Math.abs(b.points ?? 0) - Math.abs(a.points ?? 0))
    .slice(0, 6);

  return (
    <div className="card space-y-3 border-line bg-panel p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="lbl text-[10px]">Poder relativo da composição</p>
          <div className="mt-0.5 flex items-end gap-2" aria-live="polite" aria-atomic="true">
            <span className="num text-3xl font-black leading-none text-gold">{index == null ? "—" : index.toFixed(1)}</span>
            {delta != null && Math.abs(delta) >= 0.05 ? (
              <span
                className={cx(
                  "num mb-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold",
                  delta >= 0
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                    : "border-rose-300/30 bg-rose-300/10 text-rose-200",
                )}
              >
                {delta >= 0 ? "▲" : "▼"} {signed(delta, 1)} vs base
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[10px] text-mist">
            {score ? (
              <>
                {score.withData} de {score.total} componentes com peso · cobertura {Math.round(score.coverage * 100)}%
                {score.descriptive ? ` · ${score.descriptive} descritivo` : ""}
              </>
            ) : (
              "Sem bloco de pesos: o índice fica em aberto."
            )}
          </p>
        </div>
        <span className="rounded-full border border-line bg-abyss/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-mist">
          índice ≠ winrate
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded-xl border border-line bg-abyss/40 px-2 py-1.5">
          <p className="lbl text-[9px]">Win da base</p>
          <p className="num text-sm font-bold text-foam">{sameAsBase ? pct(base?.win) : "—"}</p>
        </div>
        <div className="rounded-xl border border-line bg-abyss/40 px-2 py-1.5">
          <p className="lbl text-[9px]">Pick da base</p>
          <p className="num text-sm font-bold text-foam">{sameAsBase ? pct(base?.pick, 2) : "—"}</p>
        </div>
        <div className="rounded-xl border border-line bg-abyss/40 px-2 py-1.5">
          <p className="lbl text-[9px]">Lift vs mais usada</p>
          <p className={cx("num text-sm font-bold", sameAsBase ? LIFT_TONE_CLASS[tone] : "text-mist")}>
            {base ? liftText(base) : "—"}
          </p>
        </div>
      </div>

      {!sameAsBase && base ? (
        <p className="rounded-xl border border-amber-300/25 bg-amber-300/5 px-2.5 py-1.5 text-[10px] text-amber-100">
          Sua composição divergiu da base. Win, pick e lift acima são <b>da base observada</b> — não da sua versão.
        </p>
      ) : null}

      {score && score.total > 0 ? (
        <details className="rounded-xl border border-line bg-abyss/30 px-2.5 py-2">
          <summary className="cursor-pointer text-[11px] font-semibold text-foam/90">
            De onde vem este índice ({score.withData}/{score.total})
          </summary>
          <div className="mt-1.5 space-y-1">
            {contributions.map((row) => (
              <div key={row.key} className="flex items-center gap-1.5 text-[10px]">
                {row.icon ? <img src={row.icon} alt="" className="h-5 w-5 rounded border border-line" loading="lazy" /> : null}
                <span className="min-w-0 flex-1 truncate text-foam/90">{row.label}</span>
                <span className="text-mist">{valueText(row.evidence, row.valuePp, row.valuePpEst)}</span>
                <span className="w-[54px] text-right text-mist">{row.points == null ? "—" : signed(row.points, 1, " pts")}</span>
              </div>
            ))}
            {score.total > contributions.length ? (
              <p className="text-[10px] text-mist/70">+ {score.total - contributions.length} componente(s) no cálculo completo.</p>
            ) : null}
          </div>
        </details>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onOptimize}
          disabled={!canOptimize}
          title={canOptimize ? "Monta a composição de maior índice relativo no recorte. Não é recomendação nem winrate." : "Sem pesos do recorte para montar por índice."}
          className={cx(
            "inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 text-[11px] font-bold transition-colors",
            canOptimize
              ? "border-gold/50 bg-gold/10 text-gold hover:bg-gold/15"
              : "cursor-not-allowed border-line bg-abyss/50 text-mist",
          )}
        >
          <Sparkles size={13} /> Montar maior índice
        </button>
        {!sameAsBase ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-line bg-panel2 px-3 text-[11px] font-semibold text-mist hover:text-foam"
          >
            <RotateCcw size={13} /> Voltar à base
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-200">
            <ArrowRight size={12} /> composição idêntica à base
          </span>
        )}
      </div>

      <p className="flex items-start gap-1.5 text-[10px] text-mist/80">
        <Info size={12} className="mt-0.5 shrink-0" />
        Índice relativo = base + pontos por pp × média dos componentes com peso. Não é previsão, não é probabilidade e
        não é o número interno do jogo. Adicionar componente muda a média e a cobertura.
      </p>

      {base ? (
        <p className="text-[10px] text-mist/70">
          Referência da base: win {pct(base.reference_win ?? base.references?.most_used_win)} da build mais usada
          {baseScore != null ? ` · índice da base ${num(baseScore.index, 1)}` : ""}.
        </p>
      ) : (
        <p className="text-[10px] text-mist/70">Sem build observada neste recorte; o quadro usa os itens do núcleo como ponto de partida.</p>
      )}

      <p className="text-[10px] text-mist/60">
        Evidências: {score ? `${score.observed} observada(s) · ${score.estimated} estimada(s)` : "sem dados"}.
        Emblema é descritivo e não entra na média do índice.
      </p>
    </div>
  );
}
