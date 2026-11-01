import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../../domain/present";
import ComposerSlots from "./ComposerSlots";
import ComposerNav from "./ComposerNav";
import ComposerPowerBar from "./ComposerPower";
import ComposerCatalog from "./ComposerCatalog";
import {
  CATEGORY_ALL,
  CATEGORY_RECOMMENDED,
  CATEGORY_SPELL,
  EMPTY_ITEMS,
  EMPTY_SPELLS,
  categoryName,
  categoryOf,
  categoryRows,
  itemName,
  spellKey,
  type ItemComposerProps,
} from "./composerModel";

export type { ComposerItem, ComposerSpell, ComposerPower, ItemComposerProps } from "./composerModel";

/**
 * Compositor de itens e feitiços reutilizável.
 *
 * Duas superfícies no mesmo componente:
 * 1. `inline`: os slots (6 itens por padrão + feitiço), que abrem o catálogo no
 *    alvo clicado, mais a navbar lateral por arquétipo;
 * 2. `modal`: o próprio componente é o modal controlado — usado quando a tela
 *    já tem os slots e só precisa do catálogo (recomendados → categorias →
 *    feitiços).
 *
 * O componente é dono só da interação (slot ativo, categoria, busca). A regra
 * de encaixe (duplicata, teto, uma bota) fica com o chamador via `blockReason`
 * — assim Build Management, Combinador e Preparar usam a mesma UI sem
 * duplicar invariantes.
 *
 * Este arquivo é o orquestrador: estado, efeitos e derivações. O desenho vive
 * nos irmãos `composerModel.ts` (tipos/constantes/leitura puras),
 * `ComposerSlots.tsx`, `ComposerNav.tsx`, `ComposerPower.tsx`,
 * `ComposerCatalog.tsx` e nas grades do catálogo (ADR-041: teto de 300 linhas).
 */
export default function ItemComposer({
  items,
  value,
  onPick,
  onRemove,
  max = 6,
  blockReason,
  spells,
  spell = null,
  onPickSpell,
  spellBlockReason,
  power,
  variant = "inline",
  open: openProp = false,
  onClose,
  targetIndex = 0,
  recommended,
  title,
  label = "Itens",
  className,
}: ItemComposerProps) {
  const isModal = variant === "modal";
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [inlineTarget, setInlineTarget] = useState(0);
  const [category, setCategory] = useState<string>(CATEGORY_ALL);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const open = isModal ? openProp : catalogOpen;
  const target = isModal ? Math.max(0, targetIndex) : inlineTarget;
  const recommendedList = recommended ?? EMPTY_ITEMS;

  const spellList = spells ?? EMPTY_SPELLS;
  const canPickSpell = !!onPickSpell;
  const hasSpells = canPickSpell && spellList.length > 0;
  const selectedSpellKey = spellKey(spell);
  const selectedSpell = spellList.find((row) => spellKey(row.name) === selectedSpellKey) ?? null;
  const isSpellCategory = category === CATEGORY_SPELL;
  const isRecommendedCategory = category === CATEGORY_RECOMMENDED;

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const categories = useMemo(() => categoryRows(items), [items]);

  const close = () => {
    if (isModal) onClose?.();
    else setCatalogOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => searchRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isModal, onClose]);

  // No modal controlado, abre em "Recomendados" (se houver) e sem busca.
  useEffect(() => {
    if (!isModal || !openProp) return;
    setQuery("");
    setCategory(recommendedList.length > 0 ? CATEGORY_RECOMMENDED : CATEGORY_ALL);
  }, [isModal, openProp, targetIndex, recommendedList.length]);

  const filledCount = value.filter((id) => itemById.has(id) || Number.isInteger(id)).length;
  const firstFree = value.length >= max ? 0 : value.length;

  const openAt = (index: number, categoryKey: string) => {
    setInlineTarget(index);
    setCategory(categoryKey);
    setQuery("");
    setCatalogOpen(true);
  };

  const openSlot = (index: number) => {
    const id = value[index];
    const meta = id == null ? undefined : itemById.get(id);
    openAt(index, meta ? categoryOf(meta) : CATEGORY_ALL);
  };

  const apply = (id: number) => {
    onPick(id, target);
    close();
  };

  const openSpellCatalog = () => {
    setCategory(CATEGORY_SPELL);
    setQuery("");
    if (!isModal) setCatalogOpen(true);
  };

  const applySpell = (name: string | null) => {
    onPickSpell?.(name);
    close();
  };

  const targetMeta = target < value.length ? itemById.get(value[target]) : undefined;
  const targetLabel = targetMeta ? itemName(targetMeta) : `slot ${target + 1}`;
  const activeCategory = isSpellCategory
    ? "Feitiços"
    : isRecommendedCategory
      ? "Recomendados do recorte"
      : category === CATEGORY_ALL
        ? "Todos os itens"
        : categoryName(category, items);
  const modalHint = isSpellCategory
    ? "A escolha entra no feitiço da composição."
    : isRecommendedCategory
      ? "Candidatos com lastro no recorte; a decisão é sua — isto não é recomendação."
      : `A escolha entra no ${targetLabel}.`;

  return (
    <div className={cx("space-y-2", className)} data-testid="item-composer">
      {!isModal ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="lbl text-[10px]">{label}</span>
            <span className="text-[10px] text-mist">
              {filledCount}/{max} · clique no slot para trocar
            </span>
          </div>

          <div className="flex items-stretch gap-2">
            <ComposerSlots
              value={value}
              max={max}
              itemById={itemById}
              onRemove={onRemove}
              onOpenSlot={openSlot}
              hasSpells={hasSpells}
              spell={spell}
              selectedSpell={selectedSpell}
              openSpellCatalog={openSpellCatalog}
              onPickSpell={onPickSpell}
            />
            <ComposerNav
              categories={categories}
              recommendedCount={recommendedList.length}
              itemCount={items.length}
              spellCount={spellList.length}
              hasSpells={hasSpells}
              firstFree={firstFree}
              onOpenAt={openAt}
              openSpellCatalog={openSpellCatalog}
            />
          </div>

          {power ? <ComposerPowerBar power={power} /> : null}
        </>
      ) : null}

      {open ? (
        <ComposerCatalog
          isModal={isModal}
          title={title}
          onClose={close}
          activeCategory={activeCategory}
          modalHint={modalHint}
          category={category}
          onSelectCategory={setCategory}
          categories={categories}
          hasSpells={hasSpells}
          spellCount={spellList.length}
          itemCount={items.length}
          recommended={recommendedList}
          items={items}
          spells={spellList}
          isSpellCategory={isSpellCategory}
          isRecommendedCategory={isRecommendedCategory}
          query={query}
          onQuery={setQuery}
          searchRef={searchRef}
          value={value}
          target={target}
          onRemove={onRemove}
          blockReason={blockReason}
          spellBlockReason={spellBlockReason}
          spell={spell}
          selectedSpellKey={selectedSpellKey}
          onApplyItem={apply}
          onApplySpell={applySpell}
        />
      ) : null}
    </div>
  );
}
