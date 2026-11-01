import type { RefObject } from "react";
import { LayoutGrid, Minus, Search, Sparkles, X } from "lucide-react";
import { cx } from "../../domain/present";
import ComposerItemGrid from "./ComposerItemGrid";
import ComposerSpellGrid from "./ComposerSpellGrid";
import {
  CATEGORY_ALL,
  CATEGORY_RECOMMENDED,
  CATEGORY_SPELL,
  type ComposerCategory,
  type ComposerItem,
  type ComposerSpell,
} from "./composerModel";

/**
 * Modal do catálogo: navbar por categoria + busca + grade (itens ou feitiços) +
 * rodapé com a ressalva. Controlado pelo `ItemComposer` (inline abre no slot,
 * `modal` é o próprio catálogo). Extraído de `ItemComposer.tsx` (ADR-041: teto
 * de 300 linhas).
 */
export default function ComposerCatalog({
  isModal,
  title,
  onClose,
  activeCategory,
  modalHint,
  category,
  onSelectCategory,
  categories,
  hasSpells,
  spellCount,
  itemCount,
  recommended,
  items,
  spells,
  isSpellCategory,
  isRecommendedCategory,
  query,
  onQuery,
  searchRef,
  value,
  target,
  onRemove,
  blockReason,
  spellBlockReason,
  spell,
  selectedSpellKey,
  onApplyItem,
  onApplySpell,
}: {
  isModal: boolean;
  title?: string;
  onClose: () => void;
  activeCategory: string;
  modalHint: string;
  category: string;
  onSelectCategory: (key: string) => void;
  categories: readonly ComposerCategory[];
  hasSpells: boolean;
  spellCount: number;
  itemCount: number;
  recommended: readonly ComposerItem[];
  items: readonly ComposerItem[];
  spells: readonly ComposerSpell[];
  isSpellCategory: boolean;
  isRecommendedCategory: boolean;
  query: string;
  onQuery: (q: string) => void;
  searchRef: RefObject<HTMLInputElement>;
  value: readonly number[];
  target: number;
  onRemove?: (index: number) => void;
  blockReason?: (item: ComposerItem, index: number) => string | null;
  spellBlockReason?: (spell: ComposerSpell) => string | null;
  spell: string | null;
  selectedSpellKey: string;
  onApplyItem: (id: number) => void;
  onApplySpell: (name: string | null) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-abyss/70 p-2 sm:items-center sm:p-4" role="presentation">
      <button type="button" aria-label="Fechar catálogo" className="absolute inset-0 cursor-default" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-composer-title"
        className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gold/35 bg-panel2 shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="lbl text-[10px]">{title ?? (isModal ? "Montar equipamento" : "Catálogo de itens e feitiços")}</p>
            <h2 id="item-composer-title" className="truncate text-sm font-bold text-foam">
              {activeCategory}
            </h2>
            <p className="truncate text-[10px] text-mist">{modalHint}</p>
          </div>
          {isModal && onRemove && target < value.length ? (
            <button
              type="button"
              onClick={() => {
                onRemove(target);
                onClose();
              }}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-line bg-abyss/60 px-2.5 text-[11px] font-semibold text-mist hover:border-rose-300/50 hover:text-rose-200"
            >
              <Minus size={13} /> Remover
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid min-h-[38px] min-w-[38px] place-items-center rounded-xl border border-line bg-abyss/60 text-mist hover:text-foam"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[146px_minmax(0,1fr)]">
          <nav
            aria-label="Filtrar por categoria"
            className="flex gap-1 overflow-x-auto border-b border-line p-2 sm:flex-col sm:overflow-y-auto sm:border-b-0 sm:border-r"
          >
            {recommended.length > 0 ? (
              <button
                type="button"
                onClick={() => onSelectCategory(CATEGORY_RECOMMENDED)}
                aria-pressed={category === CATEGORY_RECOMMENDED}
                className={cx(
                  "flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-lg border px-2 text-left text-[10px] font-bold transition-colors sm:shrink",
                  category === CATEGORY_RECOMMENDED
                    ? "border-emerald-400/55 bg-emerald-400/10 text-emerald-100"
                    : "border-emerald-400/30 bg-emerald-400/5 text-emerald-100/90 hover:border-emerald-400/55",
                )}
              >
                <Sparkles size={11} />
                <span className="flex-1 whitespace-nowrap sm:whitespace-normal">Recomendados</span>
                <span className="num text-[9px] opacity-70">{recommended.length}</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onSelectCategory(CATEGORY_ALL)}
              aria-pressed={category === CATEGORY_ALL}
              className={cx(
                "flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-lg border px-2 text-left text-[10px] font-bold transition-colors",
                category === CATEGORY_ALL
                  ? "border-gold/50 bg-gold/10 text-gold"
                  : "border-line bg-abyss/40 text-mist hover:text-foam",
              )}
            >
              <LayoutGrid size={11} />
              <span className="flex-1 whitespace-nowrap">Todos</span>
              <span className="num text-[9px] opacity-70">{itemCount}</span>
            </button>
            {categories.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => onSelectCategory(row.key)}
                aria-pressed={category === row.key}
                className={cx(
                  "flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-lg border px-2 text-left text-[10px] font-semibold transition-colors sm:shrink",
                  category === row.key
                    ? "border-gold/50 bg-gold/10 text-gold"
                    : "border-line bg-abyss/40 text-mist hover:text-foam",
                )}
              >
                <span className="flex-1 whitespace-nowrap sm:whitespace-normal">{row.label}</span>
                <span className="num text-[9px] opacity-70">{row.count}</span>
              </button>
            ))}
            {hasSpells ? (
              <button
                type="button"
                onClick={() => onSelectCategory(CATEGORY_SPELL)}
                aria-pressed={category === CATEGORY_SPELL}
                className={cx(
                  "flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-lg border px-2 text-left text-[10px] font-bold transition-colors sm:shrink",
                  category === CATEGORY_SPELL
                    ? "border-sky-400/50 bg-sky-400/10 text-sky-100"
                    : "border-sky-400/25 bg-sky-400/5 text-sky-100/90 hover:border-sky-400/50",
                )}
              >
                <span className="flex-1 whitespace-nowrap sm:whitespace-normal">Feitiços</span>
                <span className="num text-[9px] opacity-70">{spellCount}</span>
              </button>
            ) : null}
          </nav>

          <div className="flex min-h-0 flex-col">
            <div className="border-b border-line px-2.5 py-2">
              <label className="relative block">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mist" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => onQuery(event.target.value)}
                  placeholder={isSpellCategory ? "Buscar feitiço…" : "Buscar item nesta categoria…"}
                  className="w-full rounded-xl border border-line bg-abyss/60 py-2 pl-8 pr-2 text-xs text-foam placeholder:text-mist/60"
                  aria-label={isSpellCategory ? "Buscar feitiço" : "Buscar item"}
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
              {isSpellCategory ? (
                <ComposerSpellGrid
                  spells={spells}
                  query={query}
                  spell={spell}
                  selectedSpellKey={selectedSpellKey}
                  spellBlockReason={spellBlockReason}
                  onApplySpell={onApplySpell}
                />
              ) : (
                <ComposerItemGrid
                  items={items}
                  recommended={recommended}
                  category={category}
                  query={query}
                  value={value}
                  target={target}
                  blockReason={blockReason}
                  onApply={onApplyItem}
                />
              )}
            </div>

            <p className="border-t border-line px-3 py-2 text-[10px] text-mist/75">
              {isRecommendedCategory
                ? "Candidatos com lastro no recorte. Ordem é peso → adoção → builds; a decisão é sua — sugestão não é recomendação."
                : isSpellCategory
                  ? "Feitiços ficam na categoria própria; o peso é relativo ao recorte. Sem contraste não vira zero — vira “sem contraste”."
                  : "Categoria vem do arquétipo do item. Peso é relativo ao recorte; sem contraste não vira zero — vira “sem contraste”."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
