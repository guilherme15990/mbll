import { useMemo, useState } from "react";
import { Search, Sparkles, X } from "lucide-react";
import { useCatalog, type CatalogEntry } from "../lib/api";
import { Avatar } from "./ui";

const PRD_KEY_HEROES = ["Yve", "Franco", "Fanny", "Aulus", "Masha", "Miya"];

/** Seletor de herói interativo (usa /catalog). Herói escolhido sincroniza na URL via ?hero=. */
export default function HeroPicker({
  hero,
  onPick,
  compact = false,
}: {
  hero: string | null;
  onPick: (id: string) => void;
  compact?: boolean;
}) {
  const cat = useCatalog();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const catalogMap: Record<string, CatalogEntry> = cat.data?.data ?? {};

  const currentHero = useMemo(() => {
    return hero && catalogMap[hero] ? { id: hero, ...catalogMap[hero] } : null;
  }, [catalogMap, hero]);

  const filteredHeroes = useMemo(() => {
    const all = Object.entries(catalogMap).map(([id, entry]) => ({ id, ...entry }));
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return all.slice(0, 10);
    return all.filter((h) => h.name.toLowerCase().includes(trimmed)).slice(0, 10);
  }, [catalogMap, query]);

  const keyHeroEntries = useMemo(() => {
    const all = Object.entries(catalogMap).map(([id, entry]) => ({ id, ...entry }));
    return all.filter((h) => PRD_KEY_HEROES.some((k) => h.name.toLowerCase().includes(k.toLowerCase())));
  }, [catalogMap]);

  return (
    <div className={compact ? "card p-2.5 bg-panel border-line space-y-2" : "card p-3.5 bg-panel border-line space-y-2.5"}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist" />
          <input
            className="inp w-full pl-9 pr-8"
            aria-label="Buscar herói por nome"
            aria-expanded={query.length > 0 || (isFocused && !currentHero)}
            placeholder={currentHero ? `Herói ativo: ${currentHero.name} (digite para buscar outro...)` : "Buscar herói por nome (ex: Yve, Aulus, Franco)..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={(e) => { if (e.key === "Escape") { setQuery(""); setIsFocused(false); } }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mist hover:text-foam p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {currentHero && (
          <button
            onClick={() => { onPick(""); setQuery(""); }}
            className="btn-ghost !py-1.5 !px-3 text-xs shrink-0 flex items-center gap-1.5"
            title="Desmarcar herói"
          >
            <X size={12} />
            <span>Desmarcar ({currentHero.name})</span>
          </button>
        )}
      </div>

      {/* Hero Search Results Dropdown / Panel */}
      {(query || (isFocused && !currentHero)) && (
        <div className="p-2 rounded-xl bg-panel2/80 border border-line space-y-1 animate-fadeIn max-h-56 overflow-y-auto">
          {cat.isLoading ? (
            <p className="text-xs text-mist p-2">Carregando catálogo oficial...</p>
          ) : !filteredHeroes.length ? (
            <p className="text-xs text-mist p-2">Nenhum herói correspondente no catálogo.</p>
          ) : (
            filteredHeroes.map((h) => (
              <button
                key={h.id}
                onClick={() => {
                  onPick(h.id);
                  setQuery("");
                  setIsFocused(false);
                }}
                className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-panel text-left transition-colors"
              >
                <Avatar src={h.head} name={h.name} size={32} />
                <span className="text-xs font-semibold text-foam">{h.name}</span>
                <span className="text-[10px] text-mist font-mono ml-auto">ID #{h.id}</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Quick Casos de Estudo do PRD suggestions */}
      {!currentHero && !query && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1 border-t border-line/40">
          <span className="text-[11px] text-mist flex items-center gap-1 mr-1">
            <Sparkles size={12} className="text-gold" /> Casos de Estudo dos PRDs:
          </span>
          {keyHeroEntries.map((kh) => (
            <button
              key={kh.id}
              onClick={() => onPick(kh.id)}
              className="px-2 py-0.5 rounded-lg bg-abyss/60 hover:bg-panel2 border border-line text-[11px] text-mist hover:text-gold transition-colors font-mono"
            >
              {kh.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
