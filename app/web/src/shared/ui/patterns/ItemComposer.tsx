import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, LayoutGrid, Minus, Plus, Search, Sparkles, X } from "lucide-react";
import type { AggregateValueSource } from "../../api";
import { cx } from "../../domain/present";
import { pct, pp, signed } from "../../format";

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
 */

export type ComposerItem = {
  id: number;
  name: string | null;
  icon: string | null;
  archetype?: string | null;
  archetypeLabel?: string | null;
  evidence?: AggregateValueSource;
  valuePp?: number | null;
  valuePpEst?: number | null;
  adoption?: number | null;
  builds?: number;
  reason?: string | null;
};

export type ComposerSpell = {
  name: string;
  icon: string | null;
  desc?: string | null;
  evidence?: AggregateValueSource;
  valuePp?: number | null;
  valuePpEst?: number | null;
  adoption?: number | null;
  builds?: number;
  reason?: string | null;
};

export type ComposerPower = {
  /** Desvio em pontos do índice contra a média das builds observadas. */
  delta: number | null;
  /** Quantas builds entraram na média. */
  averageCount?: number;
  /** Nota curta abaixo do número. */
  note?: string;
};

export type ItemComposerProps = {
  items: readonly ComposerItem[];
  value: readonly number[];
  onPick: (id: number, index: number) => void;
  onRemove?: (index: number) => void;
  max?: number;
  blockReason?: (item: ComposerItem, index: number) => string | null;
  /** Feitiços disponíveis no recorte. Sem a prop, a categoria não aparece. */
  spells?: readonly ComposerSpell[];
  /** Feitiço selecionado (nome). `null` = sem feitiço. */
  spell?: string | null;
  onPickSpell?: (name: string | null) => void;
  spellBlockReason?: (spell: ComposerSpell) => string | null;
  /** Número único de poder: seta + desvio vs média. Sem a prop, não aparece. */
  power?: ComposerPower | null;
  /**
   * `inline` (padrão): slots + navbar + catálogo em modal interno.
   * `modal`: o componente é o próprio modal controlado (`open`/`onClose`),
   * usado quando a tela já tem os slots e só precisa do catálogo.
   */
  variant?: "inline" | "modal";
  open?: boolean;
  onClose?: () => void;
  /** Slot que recebe a escolha no variant `modal`. */
  targetIndex?: number;
  /** Candidatos com lastro, mostrados como primeira categoria do modal. */
  recommended?: readonly ComposerItem[];
  title?: string;
  label?: string;
  className?: string;
};

const CATEGORY_ALL = "all";
const CATEGORY_SPELL = "__spell__";
const CATEGORY_RECOMMENDED = "__recommended__";
const EMPTY_SPELLS: readonly ComposerSpell[] = [];
const EMPTY_ITEMS: readonly ComposerItem[] = [];

const CATEGORY_ORDER = [
  "physical_attack",
  "magic_attack",
  "physical_defense",
  "magic_defense",
  "hybrid_defense",
  "generic_defense",
  "movement",
  "roam",
  "jungle",
  "attack_utility",
  "magic_utility",
  "mixed",
  "unclassified",
] as const;

const CATEGORY_LABEL: Record<string, string> = {
  physical_attack: "Ataque físico",
  magic_attack: "Ataque mágico",
  physical_defense: "Defesa física",
  magic_defense: "Defesa mágica",
  hybrid_defense: "Defesa híbrida",
  generic_defense: "Defesa (HP)",
  movement: "Movimento",
  roam: "Roam",
  jungle: "Jungle",
  attack_utility: "Ataque utilitário",
  magic_utility: "Magia utilitária",
  mixed: "Misto",
  unclassified: "Não classificado",
};

const EVIDENCE_LABEL: Record<AggregateValueSource, string> = {
  observed: "observado",
  estimated: "estimado",
  descriptive: "descritivo",
  none: "sem contraste",
};

function categoryOf(item: ComposerItem): string {
  const key = item.archetype?.trim();
  return key ? key : "unclassified";
}

function categoryName(key: string, items: readonly ComposerItem[]): string {
  if (CATEGORY_LABEL[key]) return CATEGORY_LABEL[key];
  const fromItem = items.find((item) => categoryOf(item) === key && item.archetypeLabel)?.archetypeLabel;
  return fromItem ?? key.replace(/_/g, " ");
}

function itemName(item: ComposerItem): string {
  return item.name ?? `Item #${item.id}`;
}

function valueLabel(row: { valuePp?: number | null; valuePpEst?: number | null }): string {
  if (row.valuePp != null && Number.isFinite(row.valuePp)) return pp(row.valuePp);
  if (row.valuePpEst != null && Number.isFinite(row.valuePpEst)) return `${pp(row.valuePpEst)} est.`;
  return "sem contraste";
}

function spellKey(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

function spellValueLabel(spell: ComposerSpell): string {
  return valueLabel(spell);
}

function evidenceClass(evidence: AggregateValueSource | undefined): string {
  if (evidence === "observed") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (evidence === "estimated") return "border-amber-300/30 bg-amber-300/10 text-amber-200";
  if (evidence === "descriptive") return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  return "border-line bg-abyss/60 text-mist";
}

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

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const key = categoryOf(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const known = CATEGORY_ORDER.filter((key) => counts.has(key));
    const extra = [...counts.keys()].filter((key) => !(CATEGORY_ORDER as readonly string[]).includes(key)).sort();
    return [...known, ...extra].map((key) => ({
      key,
      label: categoryName(key, items),
      count: counts.get(key) ?? 0,
    }));
  }, [items]);

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

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    const source = category === CATEGORY_RECOMMENDED ? recommendedList : items;
    return source
      .filter(
        (item) =>
          category === CATEGORY_ALL || category === CATEGORY_RECOMMENDED || categoryOf(item) === category,
      )
      .filter((item) => !q || itemName(item).toLowerCase().includes(q))
      .sort(
        (a, b) =>
          (b.valuePp ?? b.valuePpEst ?? -Infinity) - (a.valuePp ?? a.valuePpEst ?? -Infinity) ||
          (b.adoption ?? -Infinity) - (a.adoption ?? -Infinity) ||
          itemName(a).localeCompare(itemName(b)),
      );
  }, [items, recommendedList, category, q]);

  const visibleSpells = useMemo(() => {
    return spellList
      .filter((row) => !q || row.name.toLowerCase().includes(q) || (row.desc ?? "").toLowerCase().includes(q))
      .sort(
        (a, b) =>
          (b.valuePp ?? b.valuePpEst ?? -Infinity) - (a.valuePp ?? a.valuePpEst ?? -Infinity) ||
          (b.adoption ?? -Infinity) - (a.adoption ?? -Infinity) ||
          a.name.localeCompare(b.name),
      );
  }, [spellList, q]);

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

  const powerDelta = power?.delta ?? null;
  const powerTone = powerDelta == null ? "unknown" : powerDelta >= 0.05 ? "up" : powerDelta <= -0.05 ? "down" : "flat";
  const PowerIcon = powerTone === "up" ? ArrowUp : powerTone === "down" ? ArrowDown : Minus;
  const powerToneClass =
    powerTone === "up"
      ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-200"
      : powerTone === "down"
        ? "border-rose-300/35 bg-rose-300/10 text-rose-200"
        : "border-line bg-abyss/40 text-mist";

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
                    onClick={() => openSlot(index)}
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

        <nav
          aria-label="Categorias do catálogo de itens e feitiços"
          className="flex w-[96px] shrink-0 flex-col gap-1 sm:w-[112px]"
        >
          {recommendedList.length > 0 ? (
            <button
              type="button"
              onClick={() => openAt(firstFree, CATEGORY_RECOMMENDED)}
              className="flex min-h-[32px] items-center gap-1.5 rounded-lg border border-emerald-400/35 bg-emerald-400/10 px-2 text-left text-[10px] font-bold text-emerald-100 transition-colors hover:border-emerald-400/55"
            >
              <Sparkles size={11} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">Recomendados</span>
              <span className="num text-[9px] text-emerald-100/70">{recommendedList.length}</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => openAt(firstFree, CATEGORY_ALL)}
            className="flex min-h-[32px] items-center gap-1.5 rounded-lg border border-gold/35 bg-gold/10 px-2 text-left text-[10px] font-bold text-gold hover:bg-gold/15"
          >
            <LayoutGrid size={11} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">Todos</span>
            <span className="num text-[9px] text-gold/70">{items.length}</span>
          </button>

          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-0.5">
            {categories.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => openAt(firstFree, row.key)}
                className="flex min-h-[30px] items-center gap-1 rounded-lg border border-line bg-abyss/35 px-2 text-left text-[9px] font-semibold text-mist transition-colors hover:border-gold/35 hover:text-foam"
              >
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
                <span className="num text-[9px] text-mist/60">{row.count}</span>
              </button>
            ))}
          </div>

          {hasSpells ? (
            <button
              type="button"
              onClick={openSpellCatalog}
              className="flex min-h-[32px] items-center gap-1.5 rounded-lg border border-sky-400/25 bg-sky-400/5 px-2 text-left text-[10px] font-bold text-sky-100 transition-colors hover:border-sky-400/50"
            >
              <span className="min-w-0 flex-1 truncate">Feitiços</span>
              <span className="num text-[9px] text-sky-100/70">{spellList.length}</span>
            </button>
          ) : null}
        </nav>
      </div>

      {power ? (
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
      ) : null}
        </>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-abyss/70 p-2 sm:items-center sm:p-4" role="presentation">
          <button type="button" aria-label="Fechar catálogo" className="absolute inset-0 cursor-default" onClick={close} />

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
                  onClick={() => { onRemove(target); close(); }}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-line bg-abyss/60 px-2.5 text-[11px] font-semibold text-mist hover:border-rose-300/50 hover:text-rose-200"
                >
                  <Minus size={13} /> Remover
                </button>
              ) : null}
              <button
                type="button"
                onClick={close}
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
                {recommendedList.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setCategory(CATEGORY_RECOMMENDED)}
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
                    <span className="num text-[9px] opacity-70">{recommendedList.length}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setCategory(CATEGORY_ALL)}
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
                  <span className="num text-[9px] opacity-70">{items.length}</span>
                </button>
                {categories.map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => setCategory(row.key)}
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
                    onClick={() => setCategory(CATEGORY_SPELL)}
                    aria-pressed={category === CATEGORY_SPELL}
                    className={cx(
                      "flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-lg border px-2 text-left text-[10px] font-bold transition-colors sm:shrink",
                      category === CATEGORY_SPELL
                        ? "border-sky-400/50 bg-sky-400/10 text-sky-100"
                        : "border-sky-400/25 bg-sky-400/5 text-sky-100/90 hover:border-sky-400/50",
                    )}
                  >
                    <span className="flex-1 whitespace-nowrap sm:whitespace-normal">Feitiços</span>
                    <span className="num text-[9px] opacity-70">{spellList.length}</span>
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
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={isSpellCategory ? "Buscar feitiço…" : "Buscar item nesta categoria…"}
                      className="w-full rounded-xl border border-line bg-abyss/60 py-2 pl-8 pr-2 text-xs text-foam placeholder:text-mist/60"
                      aria-label={isSpellCategory ? "Buscar feitiço" : "Buscar item"}
                    />
                  </label>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
                  {isSpellCategory ? (
                    <>
                      <button
                        type="button"
                        onClick={() => applySpell(null)}
                        aria-pressed={!spell}
                        className={cx(
                          "mb-2 flex w-full items-center gap-2 rounded-xl border px-2 py-2 text-left transition-colors",
                          !spell
                            ? "border-gold/60 bg-gold/10"
                            : "border-dashed border-line bg-abyss/40 hover:border-gold/40",
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

                      {visibleSpells.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-line bg-abyss/30 px-3 py-4 text-center text-[11px] text-mist">
                          Nenhum feitiço nesta busca. O catálogo só mostra o que existe no recorte.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {visibleSpells.map((row) => {
                            const selected = spellKey(row.name) === selectedSpellKey && !!selectedSpellKey;
                            const reason = spellBlockReason?.(row) ?? null;
                            const disabled = !!reason;
                            return (
                              <button
                                key={row.name}
                                type="button"
                                onClick={() => applySpell(row.name)}
                                disabled={disabled}
                                aria-pressed={selected}
                                title={reason ?? row.reason ?? undefined}
                                className={cx(
                                  "flex min-h-[64px] items-center gap-2 rounded-xl border px-2 py-2 text-left transition-colors",
                                  selected
                                    ? "border-sky-400/60 bg-sky-400/10"
                                    : "border-line bg-abyss/40 hover:border-sky-400/40",
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
                  ) : visible.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-line bg-abyss/30 px-3 py-4 text-center text-[11px] text-mist">
                      Nenhum item nesta categoria/busca. O catálogo só mostra o que existe no recorte.
                    </p>
                  ) : (
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
                            onClick={() => apply(item.id)}
                            disabled={disabled}
                            aria-pressed={selectedAt === target}
                            title={reason ?? item.reason ?? undefined}
                            className={cx(
                              "flex min-h-[64px] items-center gap-2 rounded-xl border px-2 py-2 text-left transition-colors",
                              selectedAt === target
                                ? "border-gold/60 bg-gold/10"
                                : "border-line bg-abyss/40 hover:border-gold/40",
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
      ) : null}
    </div>
  );
}
