import { useMemo, useState } from "react";
import { Ban, Plus, X } from "lucide-react";
import { cx, num, pct } from "../../shared/api";
import { Avatar } from "../../shared/ui";
import type { DraftHero, DraftSide, HeroPool } from "./model";
import { heroOptions } from "./heroOptions";
import SlotPicker from "./SlotPicker";

/**
 * Seção horizontal de bans, acima dos times.
 *
 * Mesmo modelo dos slots de herói: cada ban é um card clicável que abre o modal
 * (`SlotPicker`) já ordenado pela taxa de ban. Os bans são os 3 de cada lado,
 * na ordem em que foram marcados.
 */
const SIDE_LABEL: Record<DraftSide, string> = { us: "Meu time", them: "Time inimigo" };
const SIDE_SLUG: Record<DraftSide, string> = { us: "nosso", them: "inimigo" };

function BanSlot({
  side,
  index,
  hero,
  onOpen,
  onClear,
}: {
  side: DraftSide;
  index: number;
  hero: DraftHero | undefined;
  onOpen: () => void;
  onClear: () => void;
}) {
  const slug = SIDE_SLUG[side];
  return (
    <li className="relative rounded-xl border border-line/70 bg-abyss/40 p-1.5 min-w-0">
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label={
          hero
            ? `Trocar ban ${index + 1} do ${slug} time (${hero.name})`
            : `Banir herói no ban ${index + 1} do ${slug} time`
        }
        className={cx(
          "w-full text-left rounded-lg transition-colors",
          !hero &&
            "min-h-[42px] flex items-center justify-center gap-1.5 rounded-lg px-2 text-[10px] border border-dashed border-line text-mist hover:text-foam hover:border-line-bright",
        )}
      >
        {hero ? (
          <div className="flex items-center gap-1.5 min-w-0 pr-4">
            <Avatar src={hero.head} name={hero.name ?? `Herói #${hero.id}`} size={24} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-foam truncate leading-tight">{hero.name}</p>
              <p className="text-[9px] text-mist font-mono truncate">
                θ̂ {num(hero.wrAdj, 3)} · P {pct(hero.pick)} · B {pct(hero.ban)}
              </p>
            </div>
          </div>
        ) : (
          <>
            <Plus size={12} aria-hidden="true" />
            <span className="leading-tight">Banir herói</span>
          </>
        )}
      </button>

      {hero && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Remover ${hero.name} do ban ${index + 1} do ${slug} time`}
          className="absolute top-1 right-1 p-1 rounded-lg bg-abyss/80 text-mist hover:text-rose-300 hover:bg-panel2 transition-colors"
        >
          <X size={11} />
        </button>
      )}
    </li>
  );
}

export default function BanBoard({
  usBans,
  themBans,
  pool,
  used,
  onBan,
}: {
  usBans: (number | null)[];
  themBans: (number | null)[];
  pool: HeroPool;
  used: number[];
  onBan: (side: DraftSide, index: number, heroId: number | null) => void;
}) {
  const [active, setActive] = useState<{ side: DraftSide; index: number } | null>(null);
  const [query, setQuery] = useState("");

  const currentHeroId = active ? (active.side === "us" ? usBans[active.index] : themBans[active.index]) ?? null : null;
  const marked = [...usBans, ...themBans].filter((id) => id != null).length;

  const { options: results, total } = useMemo(() => heroOptions(pool, used, query, "ban"), [pool, used, query]);

  const close = () => {
    setActive(null);
    setQuery("");
  };

  const commit = (heroId: number | null) => {
    if (!active) return;
    onBan(active.side, active.index, heroId);
    close();
  };

  return (
    <section className="card p-3.5 space-y-2" aria-label="Bans do draft">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <p className="lbl flex items-center gap-1.5">
          <Ban size={12} className="text-gold" aria-hidden="true" /> Bans
        </p>
        <span className="text-[9px] font-mono text-mist/60">{marked}/6 marcados</span>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {(["us", "them"] as const).map((side) => {
          const bans = side === "us" ? usBans : themBans;
          return (
            <div key={side} className="min-w-0 space-y-1">
              <p className="text-[9px] uppercase font-bold tracking-wider text-mist/70">{SIDE_LABEL[side]}</p>
              <ol className="grid grid-cols-3 gap-1.5">
                {bans.map((heroId, index) => (
                  <BanSlot
                    key={index}
                    side={side}
                    index={index}
                    hero={heroId != null ? pool[heroId] : undefined}
                    onOpen={() => {
                      setActive({ side, index });
                      setQuery("");
                    }}
                    onClear={() => onBan(side, index, null)}
                  />
                ))}
              </ol>
            </div>
          );
        })}
      </div>

      {active && (
        <SlotPicker
          title="Banir herói"
          subtitle={`Ban ${active.index + 1} · ${SIDE_SLUG[active.side]} time`}
          currentHeroId={currentHeroId}
          results={results}
          total={total}
          query={query}
          onQuery={setQuery}
          onPick={commit}
          onClear={() => commit(null)}
          onClose={close}
        />
      )}
    </section>
  );
}
