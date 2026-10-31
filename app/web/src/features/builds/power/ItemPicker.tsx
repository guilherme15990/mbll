import { Boxes, Minus, Plus, Search, X } from "lucide-react";
import { cx, pct } from "../../../shared/api";
import type { AggregateCombinerItem, AggregateTopBuild } from "../../../shared/api";
import { TOTAL_ITEM_SLOTS, freeItemSlots, valueText } from "../../../shared/domain/combiner";

/**
 * Seletor de item para completar uma build observada até 6 itens.
 *
 * É uma gaveta fixa no rodapé (não um modal com foco preso) — mantém a lista
 * visível atrás. Regras de escolha ficam aqui porque são do seletor: item já na
 * build, bota única, 6 slots.
 */
export function ItemPicker({
  rowKey, hero, build, extras, itemById, itemOptions, search,
  onSearch, onClose, onAdd, onRemove,
}: {
  rowKey: string;
  hero: { id: number | null; name: string | null };
  build: AggregateTopBuild;
  extras: number[];
  itemById: Map<number, AggregateCombinerItem>;
  itemOptions: AggregateCombinerItem[];
  search: string;
  onSearch: (value: string) => void;
  onClose: () => void;
  onAdd: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-2 sm:p-3">
      <div className="mx-auto max-w-3xl card p-3.5 bg-panel2/95 border-gold/40 shadow-2xl space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Boxes size={15} className="text-gold" />
          <span className="font-bold text-sm text-foam">
            Escolher item para {hero.name ?? `#${hero.id}`}
          </span>
          <span className="text-[11px] text-mist ml-auto">
            {freeItemSlots(build, extras)} slot(s) livre(s)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mist" />
            <input
              autoFocus
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Buscar item do recorte"
              className="w-full rounded-xl border border-line bg-abyss/60 text-xs text-foam pl-7 pr-2 py-2 min-h-[40px]"
            />
          </div>
          <button onClick={onClose} className="btn-ghost text-xs inline-flex items-center gap-1">
            <X size={13} /> fechar
          </button>
        </div>
        <p className="text-[10px] text-mist">Só itens observados neste recorte. Uma bota no máximo.</p>
        <div className="grid gap-1.5 md:grid-cols-2 max-h-[320px] overflow-auto">
          {itemOptions.map((item) => {
            const already = build.item_ids.includes(item.id) || extras.includes(item.id);
            const all = [...build.item_ids, ...extras];
            const bootsBlocked = item.archetype === "movement" && all.some((x) => itemById.get(x)?.archetype === "movement");
            const full = all.length >= TOTAL_ITEM_SLOTS;
            const disabled = already || bootsBlocked || full;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled && !extras.includes(item.id)}
                onClick={() => (extras.includes(item.id) ? onRemove(item.id) : onAdd(item.id))}
                className={cx(
                  "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors",
                  disabled && !extras.includes(item.id)
                    ? "border-line bg-abyss/20 opacity-50 cursor-not-allowed"
                    : extras.includes(item.id)
                      ? "border-gold/60 bg-gold/10"
                      : "border-line bg-abyss/40 hover:border-gold/40",
                )}
              >
                {item.icon ? (
                  <img src={item.icon} alt="" className="w-7 h-7 rounded border border-line" loading="lazy" />
                ) : (
                  <span className="w-7 h-7 rounded border border-line grid place-items-center text-[9px] num text-mist bg-abyss">#{item.id}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-foam truncate">{item.name ?? `#${item.id}`}</span>
                  <span className="block text-[10px] text-mist">
                    {item.archetype_label} · {pct(item.adoption, 0)} das builds · {valueText(item.value_pp_source, item.value_pp, item.value_pp_est)}
                  </span>
                </span>
                {extras.includes(item.id)
                  ? <Minus size={13} className="text-gold shrink-0" />
                  : already ? <span className="text-[9px] text-mist shrink-0">já na build</span>
                    : bootsBlocked ? <span className="text-[9px] text-mist shrink-0">já tem bota</span>
                      : full ? <span className="text-[9px] text-mist shrink-0">6/6</span>
                        : <Plus size={13} className="text-mist shrink-0" />}
              </button>
            );
          })}
          {itemOptions.length === 0 && <p className="text-[11px] text-mist md:col-span-2">Nenhum item do recorte casa com a busca.</p>}
        </div>
      </div>
    </div>
  );
}
