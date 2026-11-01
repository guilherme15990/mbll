import { Plus, X } from "lucide-react";
import { cx } from "../../domain/present";
import { itemName, type ComposerItem, type ComposerSpell } from "./composerModel";

/**
 * Slots de itens (6 por padrão) + slot de feitiço da superfície `inline`.
 *
 * Só desenha: quem manda no encaixe é o chamador via `blockReason`. Extraído de
 * `ItemComposer.tsx` (ADR-041: teto de 300 linhas).
 */
export default function ComposerSlots({
  value,
  max,
  itemById,
  onRemove,
  onOpenSlot,
  hasSpells,
  spell,
  selectedSpell,
  openSpellCatalog,
  onPickSpell,
}: {
  value: readonly number[];
  max: number;
  itemById: Map<number, ComposerItem>;
  onRemove?: (index: number) => void;
  onOpenSlot: (index: number) => void;
  hasSpells: boolean;
  spell: string | null;
  selectedSpell: ComposerSpell | null;
  openSpellCatalog: () => void;
  onPickSpell?: (name: string | null) => void;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {Array.from({ length: max }).map((_, index) => {
          const id = value[index];
          const item = id == null ? undefined : itemById.get(id);
          const empty = id == null;
          const name = item ? itemName(item) : empty ? `Item ${index + 1}` : `Item #${id}`;
          return (
            <div key={`item-slot-${index}`} className="relative">
              <button
                type="button"
                onClick={() => onOpenSlot(index)}
                aria-label={empty ? `Slot de item ${index + 1} vazio — abrir catálogo` : `Item ${index + 1}: ${name} — trocar`}
                className={cx(
                  "group flex min-h-[82px] w-full flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-center transition-colors",
                  "hover:border-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40",
                  empty ? "border-dashed border-line/80 bg-panel2/20" : "border-line bg-abyss/40",
                )}
              >
                {item?.icon ? (
                  <img
                    src={item.icon}
                    alt=""
                    className="h-9 w-9 rounded-lg border border-line bg-panel2 object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span
                    className={cx(
                      "grid h-9 w-9 place-items-center rounded-lg border text-mist/70",
                      empty ? "border-dashed border-line/70 bg-panel2/20" : "border-line bg-abyss",
                    )}
                  >
                    {empty ? <Plus size={15} aria-hidden="true" /> : <span className="text-[9px] font-bold">#{id}</span>}
                  </span>
                )}
                <span className={cx("w-full truncate text-[10px]", empty ? "text-mist/70" : "text-foam")}>{name}</span>
              </button>

              {!empty && onRemove ? (
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  aria-label={`Remover ${name} do slot ${index + 1}`}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-line bg-panel text-mist transition-colors hover:border-rose-300/50 hover:text-rose-200"
                >
                  <X size={11} />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {hasSpells ? (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-abyss/35 p-1.5">
          <span className="lbl shrink-0 text-[9px]">Feitiço</span>
          <button
            type="button"
            onClick={openSpellCatalog}
            aria-label={
              selectedSpell || spell
                ? `Feitiço: ${selectedSpell?.name ?? spell} — trocar`
                : "Slot de feitiço vazio — abrir catálogo de feitiços"
            }
            className={cx(
              "flex min-h-[36px] min-w-0 flex-1 items-center gap-2 rounded-lg border px-1.5 text-left transition-colors",
              selectedSpell || spell
                ? "border-sky-400/25 bg-sky-400/5 hover:border-sky-400/50"
                : "border-dashed border-line/80 bg-panel2/20 hover:border-gold/40",
            )}
          >
            {selectedSpell?.icon ? (
              <img
                src={selectedSpell.icon}
                alt=""
                className="h-7 w-7 shrink-0 rounded-lg border border-line bg-panel2 object-cover"
                loading="lazy"
              />
            ) : (
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-dashed border-line/70 bg-panel2/20 text-mist/60">
                <Plus size={13} aria-hidden="true" />
              </span>
            )}
            <span className={cx("min-w-0 flex-1 truncate text-[10px]", selectedSpell || spell ? "text-foam" : "text-mist/70")}>
              {selectedSpell?.name ?? spell ?? "Escolher feitiço"}
            </span>
          </button>
          {selectedSpell || spell ? (
            <button
              type="button"
              onClick={() => onPickSpell?.(null)}
              aria-label="Remover feitiço"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line bg-panel text-mist transition-colors hover:border-rose-300/50 hover:text-rose-200"
            >
              <X size={11} />
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="mt-1.5 text-[10px] text-mist/70">
        {value.length >= max
          ? "Composição cheia: escolher pelo catálogo substitui o item do slot indicado."
          : "Use a navbar ao lado para abrir o catálogo já filtrado por categoria."}
      </p>
    </div>
  );
}
