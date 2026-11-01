import { LayoutGrid, Sparkles } from "lucide-react";
import { CATEGORY_ALL, CATEGORY_RECOMMENDED, type ComposerCategory } from "./composerModel";

/**
 * Navbar lateral por categoria da superfície `inline`: abre o catálogo já
 * filtrado no slot livre. Extraído de `ItemComposer.tsx` (ADR-041: teto de 300
 * linhas).
 */
export default function ComposerNav({
  categories,
  recommendedCount,
  itemCount,
  spellCount,
  hasSpells,
  firstFree,
  onOpenAt,
  openSpellCatalog,
}: {
  categories: readonly ComposerCategory[];
  recommendedCount: number;
  itemCount: number;
  spellCount: number;
  hasSpells: boolean;
  firstFree: number;
  onOpenAt: (index: number, categoryKey: string) => void;
  openSpellCatalog: () => void;
}) {
  return (
    <nav
      aria-label="Categorias do catálogo de itens e feitiços"
      className="flex w-[96px] shrink-0 flex-col gap-1 sm:w-[112px]"
    >
      {recommendedCount > 0 ? (
        <button
          type="button"
          onClick={() => onOpenAt(firstFree, CATEGORY_RECOMMENDED)}
          className="flex min-h-[32px] items-center gap-1.5 rounded-lg border border-emerald-400/35 bg-emerald-400/10 px-2 text-left text-[10px] font-bold text-emerald-100 transition-colors hover:border-emerald-400/55"
        >
          <Sparkles size={11} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">Recomendados</span>
          <span className="num text-[9px] text-emerald-100/70">{recommendedCount}</span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => onOpenAt(firstFree, CATEGORY_ALL)}
        className="flex min-h-[32px] items-center gap-1.5 rounded-lg border border-gold/35 bg-gold/10 px-2 text-left text-[10px] font-bold text-gold hover:bg-gold/15"
      >
        <LayoutGrid size={11} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">Todos</span>
        <span className="num text-[9px] text-gold/70">{itemCount}</span>
      </button>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-0.5">
        {categories.map((row) => (
          <button
            key={row.key}
            type="button"
            onClick={() => onOpenAt(firstFree, row.key)}
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
          <span className="num text-[9px] text-sky-100/70">{spellCount}</span>
        </button>
      ) : null}
    </nav>
  );
}
