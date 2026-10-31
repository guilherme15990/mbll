import { cx, pct } from "../../../shared/api";
import { pp } from "../../../shared/format";
import type { AggregateDeltaStatus } from "../../../shared/api";

/**
 * Peças de leitura do agregado: selo de diferença e barra de adoção.
 *
 * São as mesmas em todos os cards — por isso moram juntas. Nenhuma faz fetch.
 */

/** Diferença em pontos percentuais, com o vocabulário do produto. */
export function DeltaValue({ value, status, detailed = false, compact = false }: {
  value: number | null | undefined;
  status: AggregateDeltaStatus;
  detailed?: boolean;
  compact?: boolean;
}) {
  if (status === "insufficient" || value == null || !Number.isFinite(value)) {
    return <span className="text-mist">Poucos dados</span>;
  }
  if (status === "no_practical_difference") {
    if (compact) return <span className="text-mist" title="Sem diferença relevante">—</span>;
    return detailed ? <span className="text-mist">Sem diferença relevante</span> : null;
  }
  const positive = value > 0;
  if (compact) {
    return (
      <span
        title={positive ? "Vence mais que o normal do herói" : "Vence menos que o normal do herói"}
        className={cx("font-bold", positive ? "text-emerald-300" : "text-rose-300")}
      >
        {positive ? "▲" : "▼"}
      </span>
    );
  }
  if (detailed) {
    return (
      <span className={cx("font-mono font-bold", positive ? "text-emerald-300" : "text-rose-300")}>
        {pp(value)}
      </span>
    );
  }
  return (
    <span className={cx("font-semibold", positive ? "text-emerald-300" : "text-rose-300")}>
      {positive ? "▲" : "▼"} {positive ? "Vence mais que o normal" : "Vence menos que o normal"}
    </span>
  );
}

export function AdoptionBar({ value }: { value: number | null | undefined }) {
  const v = value == null || !Number.isFinite(value) ? null : Math.max(0, Math.min(1, value));
  return (
    <div className="flex items-center gap-2 min-w-[120px] flex-1">
      <div className="h-1.5 flex-1 rounded-full bg-abyss overflow-hidden" aria-hidden="true">
        <div className="h-full rounded-full bg-gold/70" style={{ width: `${(v ?? 0) * 100}%` }} />
      </div>
      <span className="num text-[11px] text-foam w-10 text-right">{v == null ? "—" : pct(v, 0)}</span>
    </div>
  );
}
