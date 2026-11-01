import { useEffect } from "react";
import { Search, X } from "lucide-react";
import { num } from "../../shared/api";
import { Avatar } from "../../shared/ui";
import type { DraftHero } from "./model";

/**
 * Modal de escolha de herói (pick, ban ou troca de slot).
 *
 * Não há seletor de lane: a rota não é um dado conhecido. A busca e a ordenação
 * vivem em quem abre o modal; aqui ficam só a camada modal (`role="dialog"`,
 * Escape e clique no fundo fecham) e a lista já filtrada. A lista mostra TODO o
 * pool disponível (rolável, sem paginação) e declara a contagem no cabeçalho.
 */
export default function SlotPicker({
  title,
  subtitle,
  currentHeroId,
  results,
  total,
  query,
  onQuery,
  onPick,
  onClear,
  onClose,
}: {
  title: string;
  subtitle: string;
  currentHeroId: number | null;
  results: DraftHero[];
  total: number;
  query: string;
  onQuery: (value: string) => void;
  onPick: (heroId: number) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Fechar seletor de herói"
        onClick={onClose}
        className="absolute inset-0 bg-abyss/80 backdrop-blur-sm cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${title} — ${subtitle}`}
        className="relative w-full max-w-md card p-3.5 space-y-2.5 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-foam">{title}</p>
            <p className="text-[10px] text-mist">{subtitle}</p>
            <p className="text-[9px] font-mono text-mist/60">
              {total === 0
                ? "sem herói disponível"
                : results.length < total
                  ? `${results.length} de ${total} heróis`
                  : `${total} herói${total === 1 ? "" : "s"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar seletor de herói"
            className="p-1.5 rounded-lg text-mist hover:text-foam hover:bg-panel2 transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </header>

        {currentHeroId != null && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-line/60 bg-abyss/40 px-2 py-1.5">
            <span className="text-[10px] text-mist">Já marcado</span>
            <button
              type="button"
              onClick={onClear}
              className="text-[10px] font-bold text-rose-300 hover:text-rose-200 transition-colors"
            >
              Remover herói
            </button>
          </div>
        )}

        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mist" />
          <input
            autoFocus
            className="inp w-full !py-1.5 pl-8 text-xs"
            placeholder="Buscar herói por nome…"
            aria-label="Buscar herói"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
        </div>

        <div className="max-h-[45vh] overflow-y-auto grid sm:grid-cols-2 gap-1 rounded-lg">
          {results.length === 0 ? (
            <p className="text-[11px] text-mist p-2">
              {query.trim() ? "Nenhum herói disponível com esse nome." : "Nenhum herói disponível para escolher."}
            </p>
          ) : (
            results.map((hero) => (
              <button
                key={hero.id}
                type="button"
                onClick={() => onPick(hero.id)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-panel text-left transition-colors border border-line/40"
              >
                <Avatar src={hero.head} name={hero.name ?? `Herói #${hero.id}`} size={24} />
                <span className="text-[11px] font-semibold text-foam truncate flex-1">{hero.name}</span>
                <span className="text-[9px] font-mono text-mist">θ̂ {num(hero.wrAdj, 3)}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
