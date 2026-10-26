import type { PickFavorability } from "@radar/proprietary-engine";

const TONE_CLASS: Record<PickFavorability["tone"], string> = {
  emerald: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  amber: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  rose: "text-rose-300 border-rose-400/30 bg-rose-400/10",
  slate: "text-mist border-line bg-abyss",
};

/** Cor do Evento: verde = favorável, âmbar = situacional, vermelho = desfavorável, neutro = sem dado. */
export function pickToneClass(tone: PickFavorability["tone"]): string {
  return TONE_CLASS[tone];
}

const TONE_TEXT_CLASS: Record<PickFavorability["tone"], string> = {
  emerald: "text-emerald-300",
  amber: "text-amber-300",
  rose: "text-rose-300",
  slate: "text-mist",
};

/** Veredito em texto simples (sem borda/fundo) — mesmo estilo do valor do card de Pressão. */
export function PickVerdictText({ verdict }: { verdict: PickFavorability }) {
  return <p className={`text-sm font-bold ${TONE_TEXT_CLASS[verdict.tone]}`}>{verdict.label}</p>;
}

/** Pílula do veredito (Favorável / Situacional / Desfavorável / Sem dado). */
export function PickVerdictPill({
  verdict,
  size = "md",
}: {
  verdict: PickFavorability;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-bold whitespace-nowrap ${TONE_CLASS[verdict.tone]} ${
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
      }`}
    >
      {verdict.label}
    </span>
  );
}

export type PickMetric = { label: string; value: string; hint?: string };

/** Card de análise de UM tipo de pick (blind ou first pick). */
export function PickVerdictCard({
  title,
  subtitle,
  verdict,
  metrics,
}: {
  title: string;
  subtitle: string;
  verdict: PickFavorability;
  metrics: PickMetric[];
}) {
  return (
    <article className="card p-4 bg-panel border-line space-y-3" aria-label={`Análise de ${title}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foam font-sans">{title}</h3>
          <p className="text-[11px] text-mist">{subtitle}</p>
        </div>
        <PickVerdictPill verdict={verdict} />
      </div>

      <p className="text-[13px] text-foam/90 leading-relaxed">{verdict.motive}</p>

      <dl className="grid grid-cols-3 gap-2 pt-2 border-t border-line/60">
        {metrics.map((m) => (
          <div key={m.label} className="min-w-0">
            <dt className="text-[10px] text-mist">{m.label}</dt>
            <dd className="font-mono tabular-nums text-sm font-bold text-foam leading-tight truncate" title={m.value}>{m.value}</dd>
            {m.hint ? <dd className="text-[10px] text-mist/70 leading-tight truncate" title={m.hint}>{m.hint}</dd> : null}
          </div>
        ))}
      </dl>
    </article>
  );
}
