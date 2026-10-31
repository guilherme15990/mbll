import { Link } from "react-router-dom";
import { ArrowUpRight, Minus, Plus } from "lucide-react";
import { cx, pct } from "../../../shared/api";
import type { AggregateCombinerItem, AggregateItemShape, AggregateTopBuild } from "../../../shared/api";
import {
  TOTAL_ITEM_SLOTS, evidenceLabel, freeItemSlots, valueText,
  type CombinerContribution, type CombinerScore,
} from "../../../shared/domain/combiner";
import { signed } from "../../../shared/format";

/**
 * Uma build observada do recorte, com o índice estimado e os itens extras.
 *
 * Recebe tudo por props: quem decide o que abrir/adicionar é o painel. Assim a
 * linha continua sendo uma leitura pura do recorte — e testável sem estado.
 */

function ItemSlot({ item, size = 34, added = false }: { item: AggregateItemShape; size?: number; added?: boolean }) {
  const ring = added ? " ring-1 ring-gold/70" : "";
  return item.icon ? (
    <img
      src={item.icon}
      alt={item.name ?? `Item #${item.id}`}
      title={added ? `${item.name ?? `Item #${item.id}`} (adicionado)` : item.name ?? `Item #${item.id}`}
      className={`rounded-lg border border-line object-cover bg-panel2${ring}`}
      style={{ width: size, height: size }}
      loading="lazy"
    />
  ) : (
    <span
      title={added ? `Item #${item.id} (adicionado)` : item.name ?? `Item #${item.id}`}
      className={`rounded-lg border border-line grid place-items-center text-[9px] num text-mist bg-abyss${ring}`}
      style={{ width: size, height: size }}
    >
      #{item.id}
    </span>
  );
}

function IndexBadge({ score }: { score: CombinerScore }) {
  return (
    <div className="text-right shrink-0 w-[116px]">
      <p className="lbl text-[10px]">Índice estimado</p>
      <p className="num text-2xl font-black text-gold leading-none">{score.index == null ? "—" : score.index.toFixed(1)}</p>
      <p className="text-[10px] text-mist mt-0.5">
        {score.observed} obs · {score.estimated} est de {score.total}
      </p>
      <div className="mt-1 h-1 rounded-full bg-abyss overflow-hidden" aria-hidden="true">
        <div className="h-full rounded-full bg-gold/70" style={{ width: `${score.coverage * 100}%` }} />
      </div>
    </div>
  );
}

function EvidenceTag({ c }: { c: CombinerContribution }) {
  const cls =
    c.evidence === "observed"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : c.evidence === "estimated"
        ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
        : c.evidence === "descriptive"
          ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
          : "border-line bg-abyss/50 text-mist";
  return (
    <span title={c.reason ?? undefined} className={`text-[9px] px-1.5 py-0.5 rounded-full border ${cls}`}>
      {evidenceLabel(c.evidence)}
    </span>
  );
}

export function CombinerBuildRow({
  hero, build, extras, score, itemById,
  onOpen, onAdd, onRemove,
}: {
  hero: { id: number | null; name: string | null; head: string | null; tier: string | null; wrAdj: number | null };
  build: AggregateTopBuild;
  extras: number[];
  score: CombinerScore;
  itemById: Map<number, AggregateCombinerItem>;
  onOpen: (rowKey: string) => void;
  onAdd: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const observedItems = build.items ?? [];
  const free = freeItemSlots(build, extras);
  const observedDelta = build.delta_wr_pp_vs_most_used;

  return (
    <div className="card p-3.5 bg-panel border-line space-y-2.5">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {hero.head ? (
            <img src={hero.head} alt="" className="w-9 h-9 rounded-lg border border-line object-cover" loading="lazy" />
          ) : (
            <span className="w-9 h-9 rounded-lg border border-line grid place-items-center text-[10px] num text-mist bg-abyss">
              {hero.name?.slice(0, 1) ?? "#"}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foam truncate">{hero.name ?? `#${hero.id}`}</p>
            <p className="text-[10px] text-mist">
              tier {hero.tier ?? "—"} · vitória ajustada {hero.wrAdj == null ? "—" : pct(hero.wrAdj, 1)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap ml-auto">
          {build.spell && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-purple-400/30 bg-purple-400/10 text-purple-200">
              {build.spell.icon ? <img src={build.spell.icon} alt="" className="w-4 h-4 rounded border border-line" /> : null}
              {build.spell.name}
            </span>
          )}
          {build.emblem && (
            <span
              title="Emblema é constante dentro do herói — descritivo, sem peso estimado"
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-amber-300/30 bg-amber-300/10 text-amber-200"
            >
              {build.emblem.icon ? <img src={build.emblem.icon} alt="" className="w-4 h-4 rounded border border-line" /> : null}
              {build.emblem.name ?? `#${build.emblem.id}`}
            </span>
          )}
          {(build.talents ?? []).map((t) => (
            <span
              key={t.id}
              title={t.desc ?? undefined}
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
            >
              {t.icon ? <img src={t.icon} alt="" className="w-4 h-4 rounded border border-line" /> : null}
              {t.name ?? `#${t.id}`}{t.tier != null ? ` · T${t.tier}` : ""}
            </span>
          ))}
          <Link to={`/builds?${new URLSearchParams({ view: "hero", ...(hero.id != null ? { hero: String(hero.id) } : {}) }).toString()}`} className="text-[10px] text-mist hover:text-gold inline-flex items-center gap-0.5">
            ficha <ArrowUpRight size={11} />
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {observedItems.map((it, idx) => <ItemSlot key={`${it.id}-${idx}`} item={it} />)}
          {extras.map((id) => (
            <ItemSlot
              key={`x-${id}`}
              added
              item={{ id, name: itemById.get(id)?.name ?? null, icon: itemById.get(id)?.icon ?? null }}
            />
          ))}
          {Array.from({ length: free }).map((_, idx) => (
            <button
              key={`free-${idx}`}
              type="button"
              onClick={() => onOpen(build.variant_key)}
              aria-label="Adicionar item"
              className="w-[34px] h-[34px] rounded-lg border border-dashed border-line/80 bg-abyss/20 grid place-items-center text-mist/60 hover:border-gold/50 hover:text-gold"
            >
              <Plus size={13} />
            </button>
          ))}
        </div>
        <span className="text-[10px] text-mist">
          {observedItems.length + extras.length}/{TOTAL_ITEM_SLOTS} itens
          {free > 0 ? ` · faltam ${free}` : " · build completa"}
        </span>

        <IndexBadge score={score} />
      </div>

      {extras.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-mist">
          <span>adicionados:</span>
          {extras.map((id) => {
            const name = itemById.get(id)?.name ?? `#${id}`;
            return (
              <button
                key={`rm-${id}`}
                onClick={() => onRemove(id)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-line bg-abyss/60 hover:border-rose-300/50"
                title={`Remover ${name}`}
                aria-label={`Remover ${name}`}
              >
                {name} <Minus size={10} />
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap text-[11px] text-mist">
        <span className="px-2 py-0.5 rounded-full border border-line bg-abyss/50">
          Observado: vitória mediana {build.win == null ? "—" : pct(build.win, 1)} · aparece em {build.pick == null ? "—" : pct(build.pick, 1)} das builds
        </span>
        <span className={cx(
          "px-2 py-0.5 rounded-full border",
          observedDelta == null || Math.abs(observedDelta) < 2
            ? "border-line bg-abyss/50 text-mist"
            : observedDelta > 0
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              : "border-rose-300/30 bg-rose-300/10 text-rose-200",
        )}>
          {observedDelta == null || Math.abs(observedDelta) < 2
            ? "vs build mais usada: sem diferença relevante"
            : `vs build mais usada: ${signed(observedDelta, 1, " pp")}`}
        </span>
        <span className="text-mist/80">referência: {build.references?.most_used_win == null ? "—" : pct(build.references.most_used_win, 1)} (mais usada)</span>
      </div>

      {score.contributions.length > 0 && (
        <details className="text-[11px] text-mist">
          <summary className="cursor-pointer text-foam/90">De onde vem o índice ({score.contributions.length} componentes)</summary>
          <div className="mt-1.5 space-y-1">
            {score.contributions
              .slice()
              .filter((c) => c.kind !== "item" || build.item_ids.includes(Number(c.id)) || extras.includes(Number(c.id)))
              .sort((a, b) => (b.points ?? -Infinity) - (a.points ?? -Infinity))
              .map((c) => (
                <div key={c.key} className="flex items-center gap-2" title={c.reason ?? undefined}>
                  <span className="text-foam/90 w-[42px] shrink-0 text-[10px]">{c.kind === "item" ? "Item" : c.kind === "emblem" ? "Emblema" : c.kind === "talent" ? "Talento" : "Feitiço"}</span>
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  <EvidenceTag c={c} />
                  <span className="num shrink-0 w-[72px] text-right">{valueText(c.evidence, c.valuePp, c.valuePpEst)}</span>
                  <span className={cx("num shrink-0 w-[52px] text-right", (c.points ?? 0) > 0 ? "text-emerald-300" : (c.points ?? 0) < 0 ? "text-rose-300" : "text-mist")}>
                    {c.points == null ? "—" : signed(c.points, 2)}
                  </span>
                </div>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}
