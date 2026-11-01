import { cx } from "../../shared/api";
import type { CombinerScore } from "../../shared/domain/combiner";
import { signed } from "../../shared/format";

type Props = {
  score: CombinerScore | null;
  baseScore: CombinerScore | null;
};

export default function CompositionPower({ score, baseScore }: Props) {
  const index = score?.index ?? null;
  const baseIndex = baseScore?.index ?? null;
  const delta = index != null && baseIndex != null ? +(index - baseIndex).toFixed(1) : null;

  return (
    <div className="card space-y-3 border-line bg-panel p-3.5">
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
      </div>
    </div>
  );
}
