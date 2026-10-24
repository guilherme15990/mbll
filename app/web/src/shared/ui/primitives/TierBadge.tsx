import { cx } from "../../domain/present";

const TIER_STYLE: Record<string, string> = {
  S: "border-gold/70 text-gold bg-gold/15 shadow-[0_0_12px_rgba(240,180,41,0.2)]",
  A: "border-violet-400/60 text-violet-300 bg-violet-400/15 shadow-[0_0_12px_rgba(167,139,250,0.15)]",
  B: "border-sky-400/50 text-sky-300 bg-sky-400/10",
  C: "border-line text-mist bg-abyss/60",
  D: "border-line text-mist/60 bg-abyss/60",
  "?": "border-line text-mist bg-abyss/60",
};

export function TierBadge({ tier }: { tier: string }) {
  return <span className={cx("text-[11px] font-bold px-2 py-0.5 rounded-md border", TIER_STYLE[tier] ?? TIER_STYLE["?"])}>{tier}</span>;
}
