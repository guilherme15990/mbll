import type { ReactNode } from "react";
import { cx } from "../../domain/present";

export function DomainStateBadge({
  status,
  label,
  icon,
}: {
  status: "solid" | "warning" | "inconclusive" | "neutral" | "gem" | "rank_state" | "temporal" | "safety" | "build" | "draft";
  label: string;
  icon?: ReactNode;
}) {
  const styles: Record<string, string> = {
    solid: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    inconclusive: "bg-slate-500/10 text-slate-300 border-slate-500/30",
    neutral: "bg-panel2 text-mist border-line",
    gem: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 shadow-[0_0_12px_rgba(34,211,238,0.15)]",
    rank_state: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
    temporal: "bg-sky-500/10 text-sky-300 border-sky-500/30",
    safety: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    build: "bg-orange-500/10 text-orange-300 border-orange-500/30",
    draft: "bg-violet-500/10 text-violet-300 border-violet-500/30",
  };
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border", styles[status] ?? styles.neutral)}>
      {icon}
      <span>{label}</span>
    </span>
  );
}
