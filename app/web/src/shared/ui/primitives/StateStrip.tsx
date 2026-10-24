import type { ReactNode } from "react";

export type StateStripTone = "amber" | "slate" | "rose";

const STATE_STRIP_CLASS: Record<StateStripTone, string> = {
  amber: "bg-amber-400/10 border-amber-400/30 text-amber-200",
  slate: "bg-abyss/60 border-line text-mist",
  rose: "bg-rose-500/10 border-rose-400/30 text-rose-200",
};

export function StateStrip({
  tone,
  bleed = "banner",
  children,
}: {
  tone: StateStripTone;
  /** banner = dentro de HeroBanner (p-4/md:p-6) · capa = dentro da capa home (p-5/md:p-8). */
  bleed?: "banner" | "capa";
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className={`px-4 md:px-6 py-2 text-xs font-semibold border-y flex items-center gap-2 flex-wrap ${bleed === "capa" ? "-mx-5 md:-mx-8" : "-mx-4 md:-mx-6"} ${STATE_STRIP_CLASS[tone]}`}
    >
      {children}
    </div>
  );
}
