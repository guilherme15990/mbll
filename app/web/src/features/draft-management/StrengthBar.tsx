import { Gauge, Info } from "lucide-react";
import { cx } from "../../shared/api";
import { num } from "../../shared/format";
import type { DraftAnalysis, TeamPower } from "./model";

/**
 * Força dos times em percentual (ADR-053 D2).
 *
 * `share = índice / (índice_nós + índice_eles)`. É a divisão do índice somado,
 * NÃO é probabilidade: só aparece com os dois índices presentes e o rótulo
 * acompanha o número.
 */
function indexText(power: TeamPower): string {
  return power.index == null ? "—" : num(power.index, 1);
}

function SideBlock({ label, power, tone }: { label: string; power: TeamPower; tone: "sky" | "rose" }) {
  return (
    <div className={tone === "rose" ? "text-right" : undefined}>
      <p className="text-[10px] uppercase tracking-wider text-mist">{label}</p>
      <p className="text-[10px] text-mist/70 font-mono">
        índice <b className="text-foam">{indexText(power)}</b> · {power.filled}/5
      </p>
      <p className="text-[10px] text-mist/60 font-mono">{power.evidence}</p>
    </div>
  );
}

export default function StrengthBar({ analysis }: { analysis: DraftAnalysis }) {
  const { ourPower, theirPower, share, verdict } = analysis;
  const ours = share ? Math.round(share.ours) : null;
  const theirs = share ? Math.round(share.theirs) : null;

  return (
    <section className="card p-3.5 space-y-2.5" aria-label="Força dos times">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <p className="lbl flex items-center gap-1.5">
          <Gauge size={12} className="text-gold" aria-hidden="true" /> Força dos times
        </p>
        <span className="text-[9px] font-mono text-mist/60">índice 0–100 · 50 = neutro</span>
      </header>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <div>
          <p className="num text-3xl font-black leading-none text-sky-300">{ours == null ? "—" : `${ours}%`}</p>
          <SideBlock label="Meu time" power={ourPower} tone="sky" />
        </div>
        <span className="text-[10px] font-mono text-mist/50 pb-6" aria-hidden="true">
          ×
        </span>
        <div className="flex flex-col items-end">
          <p className="num text-3xl font-black leading-none text-rose-300">{theirs == null ? "—" : `${theirs}%`}</p>
          <SideBlock label="Inimigo" power={theirPower} tone="rose" />
        </div>
      </div>

      <div
        className="relative h-2.5 rounded-full bg-abyss border border-line/60 overflow-hidden"
        role="img"
        aria-label={
          share
            ? `divisão do índice: meu time ${ours}%, inimigo ${theirs}%`
            : "divisão do índice indisponível — falta índice de um dos lados"
        }
      >
        {share ? (
          <>
            <span className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-500/70 to-sky-400" style={{ width: `${share.ours}%` }} />
            <span className="absolute inset-y-0 right-0 bg-gradient-to-l from-rose-500/70 to-rose-400" style={{ width: `${share.theirs}%` }} />
            <span className="absolute inset-y-0 left-1/2 w-px bg-abyss/80" aria-hidden="true" />
          </>
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-mist/60">
            falta índice de um dos lados
          </span>
        )}
      </div>

      <p className="text-[10px] text-mist flex items-start gap-1.5">
        <Info size={11} className="mt-0.5 shrink-0 text-gold/80" aria-hidden="true" />
        <span>
          <b className="text-foam/90">Divisão do índice somado</b> — não é probabilidade nem previsão. Os dois índices são
          relativos ao recorte e ficam em 50 = neutro.
        </span>
      </p>

      <div
        className={cx(
          "rounded-xl border px-2.5 py-1.5 flex items-center justify-between gap-2",
          verdict.tone === "emerald"
            ? "border-emerald-400/30 bg-emerald-400/10"
            : verdict.tone === "rose"
              ? "border-rose-400/30 bg-rose-400/10"
              : verdict.tone === "amber"
                ? "border-amber-400/30 bg-amber-400/10"
                : "border-line bg-abyss/60",
        )}
      >
        <span className="text-[11px] font-bold text-foam">{verdict.label}</span>
        <span className="text-[10px] font-mono text-mist">{verdict.detail}</span>
      </div>
    </section>
  );
}
