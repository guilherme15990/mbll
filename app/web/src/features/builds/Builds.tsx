import { useSearchParams } from "react-router-dom";
import { Package, Hammer, Boxes } from "lucide-react";
import { useFilters } from "../../app/filters";
import { cx } from "../../shared/api";
import HeroPicker from "../../shared/ui/patterns/HeroPicker";
import { HeroDossier } from "../../shared/ui/patterns/HeroDossier";
import BuildsPanel from "./BuildsPanel";
import BuildsAggregatePanel from "./BuildsAggregatePanel";
import BuildsPowerPanel from "./BuildsPowerPanel";

/**
 * CTX-BDL · rota plana (dona do dado).
 * `view=system` (default): agregado B0–B5 por lane — itens/pacotes, conjuntos,
 * runa e emblemas.
 * `view=power`: builds observadas completas em 6 itens + poder estimado (ADR-030).
 * `view=hero`: painel por herói existente, preservado.
 * A aba "Combinações" foi removida: era o mesmo payload filtrado, duplicando
 * a lista por herói (ADR-028). A aba "Combinador" foi removida junto com a
 * tela; a edição da composição vive no quadro (`/build/:id`, ADR-051).
 */
export default function Builds() {
  const { rank, window, hero } = useFilters();
  const [sp, setSp] = useSearchParams();
  const viewParam = sp.get("view");
  const view = viewParam === "hero" ? "hero" : viewParam === "power" ? "power" : "system";

  const setView = (nextView: "system" | "power" | "hero") => {
    const next = new URLSearchParams(sp);
    if (nextView === "system") next.delete("view");
    else next.set("view", nextView);
    setSp(next);
  };

  const pickHero = (id: string) => {
    const next = new URLSearchParams(sp);
    next.set("hero", id);
    next.set("view", "hero");
    setSp(next);
  };

  return (
    <div className="space-y-4">
      <div
        className="card p-1.5 bg-panel border-line inline-flex flex-wrap items-center gap-1"
        role="tablist"
        aria-label="Visão de builds"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "system"}
          onClick={() => setView("system")}
          className={cx(
            "px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all min-h-[40px]",
            view === "system" ? "bg-gold text-abyss shadow-sm" : "text-mist hover:text-foam",
          )}
        >
          <Package size={14} /> Sistema
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "power"}
          onClick={() => setView("power")}
          className={cx(
            "px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all min-h-[40px]",
            view === "power" ? "bg-gold text-abyss shadow-sm" : "text-mist hover:text-foam",
          )}
        >
          <Boxes size={14} /> Builds + poder
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "hero"}
          onClick={() => setView("hero")}
          className={cx(
            "px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all min-h-[40px]",
            view === "hero" ? "bg-gold text-abyss shadow-sm" : "text-mist hover:text-foam",
          )}
        >
          <Hammer size={14} /> Por herói
        </button>
      </div>

      {view === "system" && <BuildsAggregatePanel rank={rank} window={window} />}
      {view === "power" && <BuildsPowerPanel rank={rank} window={window} />}
      {view === "hero" && (
        <BuildsPanel
          rank={rank}
          window={window}
          hero={hero}
          dossier={hero ? <HeroDossier heroId={hero} activeContextId="BDL" rank={rank} window={window} /> : undefined}
          picker={<HeroPicker hero={hero} onPick={pickHero} />}
        />
      )}
    </div>
  );
}
