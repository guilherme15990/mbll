import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, Users, X } from "lucide-react";
import { num, pct, useHero } from "../shared/api";
import HeroPicker from "../shared/ui/patterns/HeroPicker";
import { Avatar, TierBadge } from "../shared/ui";

/**
 * "Herói em foco" do cabeçalho (ADR-055): o seletor de herói + mini-dossiê que
 * vivia na sidebar agora é um controle compacto à direita da barra. Sincroniza a
 * escolha na URL (`?hero=`), como antes — é o mesmo contrato de filtro global.
 */

function MiniDossier({ heroId, rank, window }: { heroId: string; rank: string; window: string }) {
  const [sp, setSp] = useSearchParams();
  const heroQuery = useHero(heroId, rank, window);
  const h = heroQuery.data?.data;

  const clearHero = () => {
    const next = new URLSearchParams(sp);
    next.delete("hero");
    setSp(next, { replace: true });
  };

  return (
    <div className="flex items-center gap-2.5 p-2 rounded-xl bg-abyss/60 border border-line" aria-label={`Herói em foco: ${h?.name ?? `Herói #${heroId}`}`}>
      <Avatar src={h?.head ?? null} name={h?.name ?? `Herói #${heroId}`} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-xs text-foam truncate">
            {heroQuery.isLoading ? "Carregando…" : (h?.name ?? `Herói #${heroId}`)}
          </span>
          {h && <TierBadge tier={h.tier} />}
        </div>
        {h ? (
          <p className="text-[11px] text-mist font-mono truncate">
            θ̂ <b className="num text-gold">{num(h.wrAdj, 3)}</b> · pick {pct(h.pick)} · ban {pct(h.ban)}
          </p>
        ) : heroQuery.isError ? (
          <p className="text-[11px] text-mist">sem dado neste recorte</p>
        ) : null}
      </div>
      <button
        onClick={clearHero}
        aria-label="Desmarcar herói e ver panorama geral"
        title="Desmarcar herói e ver panorama geral"
        className="p-1.5 rounded-lg text-mist hover:text-foam hover:bg-panel2 border border-transparent hover:border-line transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function HeroFocus() {
  const [sp, setSp] = useSearchParams();
  const [open, setOpen] = useState(false);
  const rank = sp.get("rank") ?? "mythic";
  const window = sp.get("window") ?? "7";
  const hero = sp.get("hero") ?? "";

  const pickHero = (id: string) => {
    const next = new URLSearchParams(sp);
    if (!id) next.delete("hero");
    else next.set("hero", id);
    setSp(next);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="hero-focus-panel"
        aria-label="Herói em foco: buscar e destacar um herói"
        title="Herói em foco"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-line bg-panel/90 text-mist hover:text-foam hover:border-line-bright transition-colors text-xs font-semibold shadow-inner"
      >
        <Users size={14} />
        <span>Herói em foco</span>
        {hero && <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-abyss/80 border border-line/60 text-gold">#{hero}</span>}
        <ChevronDown size={13} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {open && (
        <div
          id="hero-focus-panel"
          className="absolute right-0 mt-2 z-50 w-[min(360px,calc(100vw-24px))] p-3 rounded-2xl border border-line/60 bg-surface shadow-2xl space-y-2"
        >
          <HeroPicker hero={hero || null} onPick={pickHero} compact />
          {hero && <MiniDossier heroId={hero} rank={rank} window={window} />}
        </div>
      )}
    </div>
  );
}
