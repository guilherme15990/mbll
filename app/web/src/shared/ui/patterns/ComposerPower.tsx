import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cx } from "../../domain/present";
import { signed } from "../../format";
import type { ComposerPower } from "./composerModel";

/**
 * Número único de poder da composição: desvio (pts) contra a média das builds
 * observadas. NÃO é win rate. Extraído de `ItemComposer.tsx` (ADR-041: teto de
 * 300 linhas).
 */
export default function ComposerPowerBar({ power }: { power: ComposerPower }) {
  const powerDelta = power.delta ?? null;
  const powerTone = powerDelta == null ? "unknown" : powerDelta >= 0.05 ? "up" : powerDelta <= -0.05 ? "down" : "flat";
  const PowerIcon = powerTone === "up" ? ArrowUp : powerTone === "down" ? ArrowDown : Minus;
  const powerToneClass =
    powerTone === "up"
      ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-200"
      : powerTone === "down"
        ? "border-rose-300/35 bg-rose-300/10 text-rose-200"
        : "border-line bg-abyss/40 text-mist";

  return (
    <div
      className="flex items-center gap-2.5 rounded-xl border border-line bg-abyss/35 px-2.5 py-2"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg border", powerToneClass)}>
        <PowerIcon size={18} aria-hidden="true" />
      </span>
      <span className="num text-2xl font-black leading-none text-foam">
        {powerDelta == null ? "—" : signed(powerDelta, 1)}
      </span>
      <span className="self-end pb-0.5 text-[10px] font-bold text-mist">pts</span>
      <span className="ml-auto text-right text-[10px] leading-tight text-mist">
        {powerDelta == null
          ? "sem média de builds"
          : power.averageCount != null
            ? `vs média das ${power.averageCount} build${power.averageCount === 1 ? "" : "s"} observada${power.averageCount === 1 ? "" : "s"}`
            : "vs média das builds observadas"}
        <span className="block text-[9px] text-mist/60">{power.note ?? "índice relativo · não é winrate"}</span>
      </span>
    </div>
  );
}
