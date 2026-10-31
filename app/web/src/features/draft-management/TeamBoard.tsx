import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { cx, num, pct } from "../../shared/api";
import { Avatar, TierBadge } from "../../shared/ui";
import {
  DRAFT_LANES,
  laneFitOf,
  type DraftHero,
  type DraftLane,
  type DraftSide,
  type DraftSlot,
  type HeroPool,
  type TeamPower,
} from "./model";
import { LANE_LABEL } from "./labels";
import SlotPicker from "./SlotPicker";

/**
 * Time em faixa horizontal (ADR-053 D1): bans acima, 5 slots lado a lado.
 * O destaque “mais forte/mais fraco” é o maior e o menor θ̂ entre os picks do
 * time — leitura do recorte, não win rate.
 */
const SIDE_TITLE: Record<DraftSide, string> = { us: "Meu time", them: "Time inimigo" };

function FitBadge({ fit, lane }: { fit: boolean | null; lane: DraftLane }) {
  if (fit == null) {
    return <span className="text-[9px] font-mono px-1 py-0.5 rounded border border-line text-mist/70">sem rota</span>;
  }
  return fit ? (
    <span className="text-[9px] font-mono px-1 py-0.5 rounded border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
      {LANE_LABEL[lane]}
    </span>
  ) : (
    <span className="text-[9px] font-mono px-1 py-0.5 rounded border border-amber-400/30 bg-amber-400/10 text-amber-300">
      fora
    </span>
  );
}

function strongestWeakest(slots: readonly DraftSlot[], pool: HeroPool) {
  const ranked = slots
    .map((slot) => (slot.heroId != null ? pool[slot.heroId] : undefined))
    .filter((hero): hero is DraftHero => Boolean(hero) && Number.isFinite(hero?.wrAdj))
    .sort((a, b) => (b.wrAdj as number) - (a.wrAdj as number));
  const strongest = ranked[0] ?? null;
  const weakest = ranked.length > 1 ? ranked[ranked.length - 1] : null;
  return { strongest, weakest };
}

export default function TeamBoard({
  side,
  slots,
  power,
  bans,
  pool,
  used,
  nextIndex,
  isFirst,
  onPick,
  onLane,
  onBan,
}: {
  side: DraftSide;
  slots: DraftSlot[];
  power: TeamPower;
  bans: (number | null)[];
  pool: HeroPool;
  used: number[];
  nextIndex: number | null;
  isFirst: boolean;
  onPick: (index: number, heroId: number | null) => void;
  onLane: (index: number, lane: DraftLane) => void;
  onBan: (index: number, heroId: number | null) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const title = SIDE_TITLE[side];
  const slug = side === "us" ? "nosso" : "inimigo";
  const filled = slots.filter((slot) => slot.heroId != null).length;
  const { strongest, weakest } = useMemo(() => strongestWeakest(slots, pool), [slots, pool]);

  const banOptions = useMemo(
    () =>
      Object.values(pool)
        .sort((a, b) => (b.ban ?? -Infinity) - (a.ban ?? -Infinity) || (a.name ?? "").localeCompare(b.name ?? "")),
    [pool],
  );

  const lanes = open != null ? slots[open]?.lane : null;

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return Object.values(pool)
      .filter((hero) => !used.includes(hero.id))
      .filter((hero) => !needle || (hero.name ?? "").toLowerCase().includes(needle))
      .map((hero) => ({ hero, fit: lanes ? laneFitOf(hero, lanes) : null }))
      .sort(
        (a, b) =>
          Number(b.fit === true) - Number(a.fit === true) ||
          (b.hero.wrAdj ?? -Infinity) - (a.hero.wrAdj ?? -Infinity) ||
          (a.hero.name ?? "").localeCompare(b.hero.name ?? ""),
      )
      .slice(0, 12);
  }, [pool, used, query, lanes]);

  const close = () => {
    setOpen(null);
    setQuery("");
  };

  return (
    <article className="card p-3.5 space-y-2.5" aria-label={`Draft do ${slug} time`}>
      <header className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-foam font-sans flex items-center gap-1.5">
            {title}
            {isFirst && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-gold/40 bg-gold/10 text-gold">
                1º PICK
              </span>
            )}
          </h2>
          <p className="text-[11px] text-mist">
            {filled}/5 heróis · índice{" "}
            <b className="num text-foam">{power.index == null ? "—" : power.index.toFixed(1)}</b>
            {power.evidence === "parcial" && <span className="text-amber-300/90"> · parcial</span>}
          </p>
          {(strongest || weakest) && (
            <p
              className="text-[9px] font-mono text-mist truncate"
              title="maior e menor θ̂ entre os picks do time — leitura do recorte, não win rate"
            >
              {strongest && (
                <>
                  mais forte: <b className="text-emerald-300">{strongest.name}</b>
                </>
              )}
              {strongest && weakest && " · "}
              {weakest && (
                <>
                  mais fraco: <b className="text-rose-300">{weakest.name}</b>
                </>
              )}
            </p>
          )}
        </div>
        <span className="ctx-seal shrink-0">{side === "us" ? "NÓS" : "ELES"}</span>
      </header>

      <div className="flex items-center gap-2 flex-wrap border-y border-line/60 py-1.5">
        <span className="lbl text-[9px]">Bans</span>
        <div className="grid grid-cols-3 gap-1 flex-1 min-w-[180px] max-w-[360px]">
          {bans.map((heroId, index) => (
            <select
              key={index}
              className="sel !px-1 !py-1 text-[10px] w-full min-w-0"
              aria-label={`Ban ${index + 1} do ${slug} time`}
              value={heroId ?? ""}
              onChange={(event) => {
                const value = event.target.value ? Number(event.target.value) : null;
                onBan(index, value);
              }}
            >
              <option value="">—</option>
              {banOptions.map((hero) => (
                <option key={hero.id} value={hero.id} disabled={used.includes(hero.id) && hero.id !== heroId}>
                  {hero.name}
                </option>
              ))}
            </select>
          ))}
        </div>
        <span className="text-[9px] font-mono text-mist/60">{bans.filter((id) => id != null).length}/3</span>
      </div>

      <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
        {slots.map((slot, index) => {
          const hero = slot.heroId != null ? pool[slot.heroId] : undefined;
          const isOpen = open === index;
          const fit = hero ? laneFitOf(hero, slot.lane) : null;
          const isTop = hero != null && strongest?.id === hero.id;
          const isLow = hero != null && weakest?.id === hero.id;
          return (
            <li
              key={index}
              className={cx(
                "rounded-xl border bg-abyss/40 p-1.5 min-w-0",
                isTop
                  ? "border-emerald-400/50 ring-1 ring-emerald-400/30"
                  : isLow
                    ? "border-rose-400/50 ring-1 ring-rose-400/30"
                    : "border-line/70",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <select
                  className="sel !px-1 !py-0.5 text-[9px] font-mono max-w-[76px]"
                  aria-label={`Rota do slot ${index + 1} do ${slug} time`}
                  value={slot.lane}
                  onChange={(event) => onLane(index, event.target.value as DraftLane)}
                >
                  {DRAFT_LANES.map((lane) => (
                    <option key={lane} value={lane}>
                      {LANE_LABEL[lane]}
                    </option>
                  ))}
                </select>
                {hero && <button
                  type="button"
                  onClick={() => onPick(index, null)}
                  aria-label={`Remover ${hero.name} do ${slug} time`}
                  className="p-1 rounded-lg text-mist hover:text-rose-300 hover:bg-panel2 transition-colors shrink-0"
                >
                  <X size={12} />
                </button>}
              </div>

              {hero ? (
                <>
                  <div className="flex items-center gap-1.5 mt-1 min-w-0">
                    <Avatar src={hero.head} name={hero.name ?? `Herói #${hero.id}`} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-foam truncate leading-tight">{hero.name}</p>
                      <p className="text-[9px] text-mist font-mono truncate">
                        θ̂ {num(hero.wrAdj, 3)} · P {pct(hero.pick)} · B {pct(hero.ban)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    {isTop && (
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded border border-emerald-400/40 text-emerald-300 bg-emerald-400/10">
                        mais forte
                      </span>
                    )}
                    {isLow && (
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded border border-rose-400/40 text-rose-300 bg-rose-400/10">
                        mais fraco
                      </span>
                    )}
                    <FitBadge fit={fit} lane={slot.lane} />
                    {hero.tier && <TierBadge tier={hero.tier} />}
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(isOpen ? null : index);
                    setQuery("");
                  }}
                  aria-expanded={isOpen}
                  aria-label={`Escolher herói para o slot ${index + 1} (${LANE_LABEL[slot.lane]}) do ${slug} time`}
                  className={cx(
                    "mt-1 w-full min-h-[62px] flex flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] transition-colors border border-dashed",
                    nextIndex === index
                      ? "border-gold/50 text-gold bg-gold/5"
                      : "border-line text-mist hover:text-foam hover:border-line-bright",
                  )}
                >
                  <Plus size={14} aria-hidden="true" />
                  <span className="text-center leading-tight">
                    {nextIndex === index ? "Próximo pick" : "Escolher herói"}
                  </span>
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {open != null && (
        <SlotPicker
          slotIndex={open}
          lane={slots[open]?.lane ?? "exp"}
          results={results}
          query={query}
          onQuery={setQuery}
          onPick={(heroId) => {
            onPick(open, heroId);
            close();
          }}
          onClose={close}
        />
      )}
    </article>
  );
}
