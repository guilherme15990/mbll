import { cx, pct, type Build } from "../../shared/api";
import type { CombinerScore } from "../../shared/domain/combiner";
import { liftPp, liftTone, signed } from "../../shared/format";

type Props = {
  score: CombinerScore | null;
  baseScore: CombinerScore | null;
  sameAsBase: boolean;
  base: Build | null;
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
}: Props) {
  const index = score?.index ?? null;
  const baseIndex = baseScore?.index ?? null;
  const delta = index != null && baseIndex != null ? +(index - baseIndex).toFixed(1) : null;
  const lift = base?.lift_vs_most_used ?? null;
  const tone = liftTone(lift);

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
    </div>
  );
}
