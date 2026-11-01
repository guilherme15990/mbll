import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { cx } from "../../domain/present";
import { pct } from "../../format";
import {
  EVIDENCE_LABEL,
  evidenceClass,
  spellKey,
  spellValueLabel,
  visibleSpells,
  type ComposerSpell,
} from "./composerModel";

/**
 * Grade de feitiços do catálogo + opção "Sem feitiço". Extraído de
 * `ItemComposer.tsx` (ADR-041: teto de 300 linhas).
 */
export default function ComposerSpellGrid({
  spells,
  query,
  spell,
  selectedSpellKey,
  spellBlockReason,
  onApplySpell,
}: {
  spells: readonly ComposerSpell[];
  query: string;
  spell: string | null;
  selectedSpellKey: string;
  spellBlockReason?: (spell: ComposerSpell) => string | null;
  onApplySpell: (name: string | null) => void;
}) {
  const visible = useMemo(() => visibleSpells(spells, query), [spells, query]);

  return (
    <>
      <button
        type="button"
        onClick={() => onApplySpell(null)}
        aria-pressed={!spell}
        className={cx(
          "mb-2 flex w-full items-center gap-2 rounded-xl border px-2 py-2 text-left transition-colors",
          !spell ? "border-gold/60 bg-gold/10" : "border-dashed border-line bg-abyss/40 hover:border-gold/40",
        )}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-abyss text-mist">
          <X size={13} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold text-foam">Sem feitiço</span>
          <span className="block text-[9px] text-mist">remove o feitiço da composição</span>
        </span>
        {!spell ? <Check size={11} className="shrink-0 text-gold" aria-label="selecionado" /> : null}
      </button>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-abyss/30 px-3 py-4 text-center text-[11px] text-mist">
          Nenhum feitiço nesta busca. O catálogo só mostra o que existe no recorte.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visible.map((row) => {
            const selected = spellKey(row.name) === selectedSpellKey && !!selectedSpellKey;
            const reason = spellBlockReason?.(row) ?? null;
            const disabled = !!reason;
            return (
              <button
                key={row.name}
                type="button"
                onClick={() => onApplySpell(row.name)}
                disabled={disabled}
                aria-pressed={selected}
                title={reason ?? row.reason ?? undefined}
                className={cx(
                  "flex min-h-[64px] items-center gap-2 rounded-xl border px-2 py-2 text-left transition-colors",
                  selected ? "border-sky-400/60 bg-sky-400/10" : "border-line bg-abyss/40 hover:border-sky-400/40",
                  disabled && "cursor-not-allowed opacity-45 hover:border-line",
                )}
              >
                {row.icon ? (
                  <img
                    src={row.icon}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-lg border border-line bg-panel2 object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-abyss text-[9px] font-bold text-mist">
                    {row.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="truncate text-[11px] font-semibold text-foam">{row.name}</span>
                    {selected ? <Check size={11} className="shrink-0 text-sky-200" aria-label="selecionado" /> : null}
                  </span>
                  {row.desc ? (
                    <span className="mt-0.5 line-clamp-2 block text-[9px] leading-snug text-mist">{row.desc}</span>
                  ) : null}
                  <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[9px] text-mist/80">
                    {row.evidence ? (
                      <span className={cx("rounded-full border px-1 py-0.5 font-bold", evidenceClass(row.evidence))}>
                        {EVIDENCE_LABEL[row.evidence]}
                      </span>
                    ) : null}
                    <span className="num">{spellValueLabel(row)}</span>
                    {row.adoption != null && Number.isFinite(row.adoption) ? (
                      <span>· {pct(row.adoption, 0)} das builds</span>
                    ) : null}
                  </span>
                  {reason ? <span className="mt-0.5 block text-[9px] text-amber-200">{reason}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
