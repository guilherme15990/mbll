import type { ReactNode } from "react";
import { cx } from "../../domain/present";

export type HeroBannerTone =
  | "gold" | "rose" | "emerald" | "amber" | "slate" | "cyan" | "sky" | "violet";

const HERO_BANNER_BORDER: Record<HeroBannerTone, string> = {
  gold: "border-l-gold/60",
  rose: "border-l-rose-400/60",
  emerald: "border-l-emerald-400/60",
  amber: "border-l-amber-400/60",
  slate: "border-l-slate-500/50",
  cyan: "border-l-cyan-400/60",
  sky: "border-l-sky-400/60",
  violet: "border-l-violet-400/60",
};

export function HeroBanner({
  kicker,
  title,
  subtitle,
  anchors,
  seal,
  stamp,
  strip,
  proofId,
  proofLabel = "ver prova ↓",
  tone = "gold",
  editorial = false,
  bare = false,
  className,
}: {
  kicker: string;
  title: string;
  subtitle?: ReactNode;
  anchors?: ReactNode;
  seal?: ReactNode;
  stamp?: string;
  strip?: ReactNode;
  proofId: string;
  proofLabel?: string;
  tone?: HeroBannerTone;
  editorial?: boolean;
  /** bare = sem caixa própria (vive dentro de uma capa maior). */
  bare?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        bare
          ? "space-y-2.5 motion-reduce:animate-none"
          : "rounded-2xl border border-line border-l-4 p-4 md:p-6 space-y-2.5 min-h-[148px] motion-reduce:animate-none",
        !bare && HERO_BANNER_BORDER[tone],
        !bare && (editorial ? "bg-gradient-to-br from-panel via-panel2/80 to-abyss" : "bg-panel"),
        className,
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-mist">{kicker}</p>
      <h1 className="text-[26px] leading-[1.15] md:text-[34px] font-extrabold tracking-tight text-foam break-words">
        {title}
      </h1>
      {subtitle ? (
        <p className="text-[13px] md:text-sm leading-relaxed text-foam/90">{subtitle}</p>
      ) : null}
      {anchors ? <div className="flex gap-4 md:gap-6 flex-wrap">{anchors}</div> : null}
      {seal || stamp ? (
        <div className="flex gap-2 flex-wrap items-center">
          {seal}
          {stamp ? (
            <span className="text-[10px] font-mono text-mist/70" title="Carimbo de recorte do veredito">
              {stamp}
            </span>
          ) : null}
        </div>
      ) : null}
      {strip}
      <a
        href={`#${proofId}`}
        aria-label={`${proofLabel} — rolar para a prova`}
        className="inline-flex items-center gap-1 text-[11px] font-bold text-gold hover:underline underline-offset-2 min-h-[44px]"
      >
        {proofLabel}
      </a>
    </div>
  );
}
