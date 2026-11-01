import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { cx, num, pct } from "../../shared/api";
import { Avatar, TierBadge } from "../../shared/ui";
import type { DraftHero, DraftSide, DraftSlot, HeroPool, TeamPower } from "./model";
import { heroOptions } from "./heroOptions";
import SlotPicker from "./SlotPicker";

/**
 * Time em coluna vertical: 5 slots empilhados, bans ficam na seção horizontal
 * acima dos times.
 *
 * A rota do slot não é um dado conhecido, então não há seletor nem selo de lane:
 * clicar no slot (vazio ou preenchido) abre o modal de escolha de herói. O
 * destaque “mais forte/mais fraco” é o maior e o menor θ̂ entre os picks do
 * time — leitura do recorte, não win rate.
 */
const SIDE_TITLE: Record<DraftSide, string> = { us: "Meu time", them: "Time inimigo" };

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
  pool,
  used,
  nextIndex,
  isFirst,
  onPick,
}: {
  side: DraftSide;
  slots: DraftSlot[];
  power: TeamPower;
  pool: HeroPool;
  used: number[];
  nextIndex: number | null;
  isFirst: boolean;
  onPick: (index: number, heroId: number | null) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const title = SIDE_TITLE[side];
  const slug = side === "us" ? "nosso" : "inimigo";
  const filled = slots.filter((slot) => slot.heroId != null).length;
  const { strongest, weakest } = useMemo(() => strongestWeakest(slots, pool), [slots, pool]);

  const { options: results, total } = useMemo(() => heroOptions(pool, used, query, "pick"), [pool, used, query]);

  const openPicker = (index: number) => {
    setOpen(index);
    setQuery("");
  };

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

      <ol className="space-y-1.5">
        {slots.map((slot, index) => {
          const hero = slot.heroId != null ? pool[slot.heroId] : undefined;
          const isTop = hero != null && strongest?.id === hero.id;
          const isLow = hero != null && weakest?.id === hero.id;
          return (
            <li
              key={index}
              className={cx(
                "relative rounded-xl border bg-abyss/40 p-1.5 min-w-0",
                isTop
                  ? "border-emerald-400/50 ring-1 ring-emerald-400/30"
                  : isLow
                    ? "border-rose-400/50 ring-1 ring-rose-400/30"
                    : "border-line/70",
              )}
            >
              <button
                type="button"
                onClick={() => openPicker(index)}
                aria-haspopup="dialog"
                aria-label={
                  hero
                    ? `Trocar ${hero.name} no slot ${index + 1} do ${slug} time`
                    : `Escolher herói para o slot ${index + 1} do ${slug} time`
                }
                className={cx(
                  "w-full text-left rounded-lg transition-colors",
                  !hero &&
                    "min-h-[46px] flex items-center justify-center gap-1.5 rounded-lg px-2 text-[10px] border border-dashed",
                  !hero &&
                    (nextIndex === index
                      ? "border-gold/50 text-gold bg-gold/5"
                      : "border-line text-mist hover:text-foam hover:border-line-bright"),
                )}
              >
                {hero ? (
                  <>
                    <div className="flex items-center gap-2 min-w-0 pr-5">
                      <Avatar src={hero.head} name={hero.name ?? `Herói #${hero.id}`} size={30} />
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
                      {hero.tier && <TierBadge tier={hero.tier} />}
                    </div>
                  </>
                ) : (
                  <>
                    <Plus size={13} aria-hidden="true" />
                    <span className="leading-tight">{nextIndex === index ? "Próximo pick" : "Escolher herói"}</span>
                  </>
                )}
              </button>

              {hero && (
                <button
                  type="button"
                  onClick={() => onPick(index, null)}
                  aria-label={`Remover ${hero.name} do ${slug} time`}
                  className="absolute top-1 right-1 p-1 rounded-lg bg-abyss/80 text-mist hover:text-rose-300 hover:bg-panel2 transition-colors"
                >
                  <X size={11} />
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {open != null && (
        <SlotPicker
          title={slots[open]?.heroId != null ? "Trocar herói" : "Escolher herói"}
          subtitle={`Slot ${open + 1} · ${slug} time`}
          currentHeroId={slots[open]?.heroId ?? null}
          results={results}
          total={total}
          query={query}
          onQuery={setQuery}
          onPick={(heroId) => {
            onPick(open, heroId);
            close();
          }}
          onClear={() => {
            onPick(open, null);
            close();
          }}
          onClose={close}
        />
      )}
    </article>
  );
}
