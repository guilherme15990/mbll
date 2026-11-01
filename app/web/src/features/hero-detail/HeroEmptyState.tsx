import { UserSearch } from "lucide-react";
import type { CatalogEntry } from "../../shared/api";
import { Avatar, Empty } from "../../shared/ui";

/**
 * Vazio orientado da ficha: sem herói válido nada é buscado, e a tela oferece
 * atalhos do catálogo em vez de um beco sem saída. Extraído de `HeroDetail.tsx`
 * (ADR-041: teto de 300 linhas).
 */
export default function HeroEmptyState({
  catalogMap,
  onPickHero,
}: {
  catalogMap: Record<string, CatalogEntry> | undefined;
  onPickHero: (id: string) => void;
}) {
  const shortcutHeroes = (() => {
    if (!catalogMap) return [];
    const all = Object.entries(catalogMap).map(([id, entry]) => ({ id, ...entry }));
    return ["yve", "aulus", "franco"]
      .map((n) => all.find((x) => x.name.toLowerCase().includes(n)))
      .filter((x): x is { id: string; name: string; head: string | null } => Boolean(x))
      .slice(0, 3);
  })();

  return (
    <div className="space-y-4">
      <Empty
        title="Escolha um herói para abrir a ficha"
        hint="nada foi buscado — detalhe exige herói válido. Selecione acima ou use um atalho."
      />
      {shortcutHeroes.length > 0 && (
        <div className="card p-4 border-line bg-panel2/30 space-y-3">
          <p className="text-xs font-bold text-foam flex items-center gap-2">
            <UserSearch size={14} className="text-gold" aria-hidden="true" /> Atalhos para abrir a ficha:
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {shortcutHeroes.map((s) => (
              <button
                key={s.id}
                onClick={() => onPickHero(s.id)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-abyss/60 hover:bg-panel2 border border-line hover:border-gold/40 text-xs text-mist hover:text-gold transition-colors min-h-[44px]"
                aria-label={`Abrir ficha de ${s.name}`}
              >
                <Avatar src={s.head} name={s.name} size={24} />
                <span className="font-semibold">{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
