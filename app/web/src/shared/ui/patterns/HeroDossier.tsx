import { Link, useSearchParams } from "react-router-dom";
import { num, pct, useHero } from "../../api";
import { Avatar } from "../primitives/Avatar";
import { ClassSeal } from "../primitives/ClassSeal";
import { TierBadge } from "../primitives/TierBadge";
import { classOf } from "@radar/proprietary-engine";
import { Hammer, Radar, Swords, X } from "lucide-react";
interface HeroDossierProps {
  heroId: string | null;
  activeContextId: "M6" | "BDL";
  rank: string;
  window: string;
}

const CONTEXT_LINKS = [
  { id: "M6", to: "/confrontos", label: "Confrontos", icon: Swords },
  { id: "DRF", to: "/hero", label: "Draft", icon: Radar },
  { id: "BDL", to: "/builds", label: "Builds", icon: Hammer },
];

/** Draft (DRF/BPS) vive só na ficha: a rota aponta para a aba, não para página plana. */
function contextHref(c: { id: string; to: string }, heroId: string, rank: string, window: string) {
  if (c.id === "DRF") return `/hero/${heroId}?tab=draft&rank=${rank}&window=${window}`;
  return `${c.to}?hero=${heroId}&rank=${rank}&window=${window}${c.id === "BDL" ? "&view=hero" : ""}`;
}

export function HeroDossier({ heroId, activeContextId, rank, window }: HeroDossierProps) {
  const [sp, setSp] = useSearchParams();
  const heroQuery = useHero(heroId, rank, window);

  if (!heroId) return null;

  const h = heroQuery.data?.data;

  const clearHero = () => {
    sp.delete("hero");
    setSp(sp, { replace: true });
  };

  return (
    <div className="card p-3.5 bg-gradient-to-r from-panel via-panel2/80 to-panel border-gold/30 shadow-lg">
      <div className="flex items-center gap-3.5 flex-wrap">
        <div className="flex items-center gap-3 p-1">
          <Avatar src={h?.head ?? null} name={h?.name ?? `Herói #${heroId}`} size={46} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-foam">{h?.name ?? `Herói #${heroId}`}</span>
              {h && <TierBadge tier={h.tier} />}
              {h && <ClassSeal cls={classOf(h)} />}
            </div>
            <div className="flex items-center gap-3 text-xs text-mist mt-0.5 flex-wrap">
              <span>Elo: <b className="text-foam uppercase">{rank}</b></span>
              <span>Janela: <b className="text-foam">{window}d</b></span>
              {h && (
                <>
                  <span>θ̂ <b className="num text-gold">{num(h.wrAdj, 3)}</b> <span className="text-mist/70">(obs {num(h.win, 3)})</span></span>
                  <span>pick <b className="num text-foam">{pct(h.pick)}</b></span>
                  <span>ban <b className="num text-cyan-200">{pct(h.ban)}</b></span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          <span className="text-[11px] text-mist/80 mr-1 hidden sm:inline">Explorar herói em:</span>
          {CONTEXT_LINKS.map((c) => {
            const Icon = c.icon;
            const isCurrent = c.id === activeContextId;
            return (
              <Link
                key={c.id}
                to={contextHref(c, heroId, rank, window)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all ${
                  isCurrent
                    ? "bg-gold text-abyss font-bold shadow-sm"
                    : "bg-abyss/60 text-mist hover:text-foam hover:bg-panel2 border border-line"
                }`}
                title={`Ver ${h?.name || "herói"} no contexto ${c.id}`}
              >
                <Icon size={12} />
                <span>{c.label}</span>
              </Link>
            );
          })}
          <button
            onClick={clearHero}
            className="p-1 rounded-lg text-mist hover:text-foam hover:bg-abyss/80 border border-transparent hover:border-line transition-colors ml-1"
            title="Desmarcar herói e ver panorama geral"
            aria-label="Desmarcar herói e ver panorama geral"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
