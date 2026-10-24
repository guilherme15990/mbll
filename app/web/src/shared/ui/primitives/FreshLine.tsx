import { ago } from "../../format";
import { cx } from "../../domain/present";
import { CtxSeal } from "./CtxSeal";

export function FreshLine({ stale, ageMs, postPatch }: { stale?: boolean; ageMs?: number; postPatch?: boolean }) {
  return (
    <p className="text-xs text-mist flex items-center gap-2 flex-wrap">
      <span className={cx("inline-block w-1.5 h-1.5 rounded-full", stale ? "bg-amber-400" : "bg-emerald-400")} />
      {stale ? `dados de ${ago(ageMs)} (fonte instável, último válido)` : `atualizado ${ago(ageMs)}`}
      {postPatch && <CtxSeal>janela pós-patch</CtxSeal>}
    </p>
  );
}
