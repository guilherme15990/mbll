import { num } from "../../format";

/** Barra de evidência: θ̂ com marcador, escala 0.35–0.65. */
export function ThetaBar({ value, median = 0.5 }: { value: number; median?: number }) {
  const lo = 0.35, hi = 0.65;
  const pos = (v: number) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
  const label = `theta estimado ${num(value, 3)} · mediana ${num(median, 3)} · escala 0,35 a 0,65`;
  return (
    <div
      role="img"
      aria-label={label}
      title={`θ̂ ${num(value, 3)} · mediana ${num(median, 3)}`}
      className="relative h-1.5 rounded-full bg-abyss border border-line min-w-[90px]"
    >
      <div className="absolute top-0 bottom-0 w-px bg-mist/60" style={{ left: `${pos(median)}%` }} />
      <div className="absolute w-2 h-2 rounded-full bg-gold -top-[3px] shadow-glow" style={{ left: `calc(${pos(value)}% - 4px)` }} />
    </div>
  );
}
