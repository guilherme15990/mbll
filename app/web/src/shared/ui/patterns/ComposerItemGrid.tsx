import { useMemo } from "react";
import { Check } from "lucide-react";
import { cx } from "../../domain/present";
import { pct } from "../../format";
import {
  CATEGORY_LABEL,
  EVIDENCE_LABEL,
  categoryOf,
  evidenceClass,
  itemName,
  valueLabel,
  visibleItems,
  type ComposerItem,
} from "./composerModel";

/**
 * Grade de itens do catálogo: filtra por categoria/busca e desenha cada
 * candidato com motivo de bloqueio, peso e adoção. Extraído de
 * `ItemComposer.tsx` (ADR-041: teto de 300 linhas).
 */
export default function ComposerItemGrid({
  items,
  recommended,
  category,
  query,
  value,
  target,
  blockReason,
  onApply,
}: {
  items: readonly ComposerItem[];
  recommended: readonly ComposerItem[];
  category: string;
  query: string;
  value: readonly number[];
  target: number;
  blockReason?: (item: ComposerItem, index: number) => string | null;
  onApply: (id: number) => void;
}) {
  const visible = useMemo(() => visibleItems(items, recommended, category, query), [items, recommended, category, query]);

  if (visible.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-abyss/30 px-3 py-4 text-center text-[11px] text-mist">
        Nenhum item nesta categoria/busca. O catálogo só mostra o que existe no recorte.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {visible.map((item) => {
        const selectedAt = value.indexOf(item.id);
        const isInBuild = selectedAt >= 0;
        const duplicate = isInBuild && selectedAt !== target;
        const reason = duplicate ? "já está na composição" : blockReason?.(item, target) ?? null;
        const disabled = !!reason;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onApply(item.id)}
            disabled={disabled}
            aria-pressed={selectedAt === target}
            title={reason ?? item.reason ?? undefined}
            className={cx(
              "flex min-h-[64px] items-center gap-2 rounded-xl border px-2 py-2 text-left transition-colors",
              selectedAt === target ? "border-gold/60 bg-gold/10" : "border-line bg-abyss/40 hover:border-gold/40",
              disabled && "cursor-not-allowed opacity-45 hover:border-line",
            )}
          >
            {item.icon ? (
              <img
                src={item.icon}
                alt=""
                className="h-9 w-9 shrink-0 rounded-lg border border-line bg-panel2 object-cover"
                loading="lazy"
              />
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-abyss text-[9px] font-bold text-mist">
                #{item.id}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <span className="truncate text-[11px] font-semibold text-foam">{itemName(item)}</span>
                {selectedAt === target ? <Check size={11} className="shrink-0 text-gold" aria-label="selecionado" /> : null}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[9px] text-mist">
                <span className="truncate">{item.archetypeLabel ?? CATEGORY_LABEL[categoryOf(item)] ?? categoryOf(item)}</span>
                {item.evidence ? (
                  <span className={cx("rounded-full border px-1 py-0.5 font-bold", evidenceClass(item.evidence))}>
                    {EVIDENCE_LABEL[item.evidence]}
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-[9px] text-mist/80">
                <span className="num">{valueLabel(item)}</span>
                {item.adoption != null && Number.isFinite(item.adoption) ? (
                  <span>· {pct(item.adoption, 0)} das builds</span>
                ) : null}
              </span>
              {reason ? <span className="mt-0.5 block text-[9px] text-amber-200">{reason}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
