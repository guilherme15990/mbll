import { cx, pct } from "../../shared/api";
import { liftPp, liftTone } from "../../shared/format";
import type { CoreItem } from "../../shared/domain/buildManager";
import type { BuildRow } from "./useBuildDerivations";

/**
 * Átomos de apresentação do Build Management (ADR-047): o cartão de um item do
 * núcleo e o chip de uma build observada. Extraídos de `BuildManager.tsx`
 * (ADR-041: teto de 300 linhas).
 */
export function CoreCard({ item, total }: { item: CoreItem; total: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-line bg-abyss/30 p-2.5">
      {item.icon ? (
        <img src={item.icon} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-line bg-panel2 object-cover" loading="lazy" />
      ) : (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-abyss text-[9px] num text-mist">
          #{item.id}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foam">{item.name ?? `Item #${item.id}`}</p>
        <p className="text-[10px] text-mist">
          {item.builds} de {total} builds · {pct(item.share, 0)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="num text-xs font-bold text-foam">{pct(item.winMedian)}</p>
        <p className="text-[9px] text-mist">win mediano</p>
      </div>
    </div>
  );
}

export function BaseChip({ row, selected, onSelect }: { row: BuildRow; selected: boolean; onSelect: () => void }) {
  const lift = row.build.lift_vs_most_used;
  const tone = liftTone(lift);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title="Usar esta build observada como ponto de partida do quadro"
      className={cx(
        "min-w-[148px] shrink-0 rounded-xl border px-2.5 py-2 text-left transition-colors",
        selected ? "border-gold/60 bg-gold/10" : "border-line bg-abyss/35 hover:border-gold/35",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={cx(
          "grid h-5 w-5 place-items-center rounded border text-[9px] font-bold",
          selected ? "border-gold/40 bg-gold/15 text-gold" : "border-line bg-panel2 text-mist",
        )}>
          B{row.position + 1}
        </span>
        <span className="num text-sm font-black text-foam">{row.score.index == null ? "—" : row.score.index.toFixed(1)}</span>
      </span>
      <span className="mt-1 flex items-center gap-2 text-[10px] text-mist">
        <span>win {pct(row.build.win)}</span>
        <span>·</span>
        <span>pick {pct(row.build.pick, 1)}</span>
      </span>
      <span className={cx(
        "mt-0.5 block text-[10px] font-semibold",
        tone === "positive" ? "text-emerald-300" : tone === "negative" ? "text-rose-300" : "text-mist",
      )}>
        {tone === "unknown"
          ? "lift em aberto"
          : tone === "neutral"
            ? `sem diferença relevante (${liftPp(lift)})`
            : `${liftPp(lift)} vs mais usada`}
      </span>
    </button>
  );
}
