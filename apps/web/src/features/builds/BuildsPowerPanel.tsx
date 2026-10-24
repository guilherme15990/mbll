import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, Boxes, Info, Minus, Plus, Search, Sparkles, Swords, X } from "lucide-react";
import {
  LANES, cx, pct, useBuildsAggregate,
  type AggregateCombinerItem,
  type AggregateItemShape,
  type AggregateTopBuild,
} from "../../lib/api";
import {
  TOTAL_ITEM_SLOTS, evidenceLabel, freeItemSlots, pickFromBuild, scoreCombination, valueText,
  type CombinerContribution,
  type CombinerScore,
} from "../../lib/combiner";
import { CtxBar, Empty, ErrBox, FreshLine, Loading, SectionTitle } from "../../shared/ui";
import { signed } from "../../shared/format";

/**
 * Builds + poder (ADR-030) — guia própria em `/builds?view=power`.
 *
 * Lista as builds observadas do recorte (itens + emblema + talentos + feitiço),
 * deixa completar até 6 itens e mostra o índice estimado de cada build.
 * O índice é a média dos pesos por contraste — não é previsão, não é
 * win rate da combinação e não é o "Poder da Build" oficial.
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

function BuildRow({
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

export default function BuildsPowerPanel({ rank, window }: { rank: string; window: string }) {
  const [sp, setSp] = useSearchParams();
  const laneParam = sp.get("lane");
  const lane = laneParam && (LANES as readonly string[]).includes(laneParam) ? laneParam : "";
  const top = Number(sp.get("top") ?? 10) === 20 ? 20 : 10;

  const q = useBuildsAggregate(rank, lane, window, top);
  const body = q.data;
  const combiner = body?.combiner;

  /** Metadados dos itens observados no recorte (nome, ícone, adoção, efeito). */
  const itemById = useMemo(
    () => new Map<number, AggregateCombinerItem>((combiner?.items ?? []).map((i) => [i.id, i])),
    [combiner],
  );

  const [extras, setExtras] = useState<Record<string, number[]>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [heroFilter, setHeroFilter] = useState("");
  const [sort, setSort] = useState<"power" | "observed" | "hero">("power");
  const [onlyFull, setOnlyFull] = useState(false);

  useEffect(() => { setExtras({}); setOpenKey(null); setSearch(""); }, [lane, top, rank, window]);

  const setLane = (l: string) => {
    const next = new URLSearchParams(sp);
    next.set("lane", l);
    next.set("view", "power");
    setSp(next);
    try { localStorage.setItem("radar:lane", l); } catch { /* storage privado */ }
  };
  const setTop = (t: number) => {
    const next = new URLSearchParams(sp);
    next.set("top", String(t));
    setSp(next);
  };

  const rows = useMemo(() => {
    const out: {
      key: string;
      hero: { id: number | null; name: string | null; head: string | null; tier: string | null; wrAdj: number | null };
      build: AggregateTopBuild;
      extras: number[];
      score: CombinerScore;
    }[] = [];
    for (const cell of body?.top_builds ?? []) {
      for (const build of cell.builds ?? []) {
        const key = `${cell.hero.id ?? "?"}|${build.variant_key}`;
        const ex = extras[key] ?? [];
        out.push({
          key,
          hero: cell.hero,
          build,
          extras: ex,
          score: scoreCombination(pickFromBuild(build, ex), combiner),
        });
      }
    }
    return out;
  }, [body, combiner, extras]);

  const visible = useMemo(() => {
    let list = rows;
    if (heroFilter) list = list.filter((r) => String(r.hero.id) === heroFilter);
    if (onlyFull) list = list.filter((r) => (r.build.item_ids.length + r.extras.length) >= TOTAL_ITEM_SLOTS);
    const arr = [...list];
    if (sort === "power") {
      arr.sort((a, b) => (b.score.index ?? -Infinity) - (a.score.index ?? -Infinity));
    } else if (sort === "observed") {
      arr.sort((a, b) => (b.build.delta_wr_pp_vs_most_used ?? -Infinity) - (a.build.delta_wr_pp_vs_most_used ?? -Infinity));
    } else {
      arr.sort((a, b) => (a.hero.name ?? "").localeCompare(b.hero.name ?? "") || (b.build.delta_wr_pp_vs_most_used ?? -Infinity) - (a.build.delta_wr_pp_vs_most_used ?? -Infinity));
    }
    return arr;
  }, [rows, heroFilter, onlyFull, sort]);

  const itemOptions = useMemo(() => {
    const rows = combiner?.items ?? [];
    const needle = search.trim().toLowerCase();
    return (needle ? rows.filter((i) => (i.name ?? `#${i.id}`).toLowerCase().includes(needle)) : rows).slice(0, 40);
  }, [combiner, search]);

  const addExtra = (rowKey: string, build: AggregateTopBuild, current: number[], id: number) => {
    if (build.item_ids.includes(id) || current.includes(id)) return;
    const all = [...build.item_ids, ...current];
    if (all.length >= TOTAL_ITEM_SLOTS) return;
    if (itemById.get(id)?.archetype === "movement" && all.some((x) => itemById.get(x)?.archetype === "movement")) return;
    setExtras((prev) => ({ ...prev, [rowKey]: [...(prev[rowKey] ?? []), id] }));
  };
  const removeExtra = (rowKey: string, id: number) =>
    setExtras((prev) => ({ ...prev, [rowKey]: (prev[rowKey] ?? []).filter((x) => x !== id) }));

  const openRow = rows.find((r) => r.key === openKey);

  return (
    <section className="space-y-5">
      <CtxBar
        id="BDL"
        name="Builds — Builds + poder"
        question="Quais builds observadas existem e como fica o poder delas completas em 6 itens?"
        status="peso por contraste, não oficial"
        formula="índice = 100 + 10 × média(contraste do componente no mesmo herói+lane+rank, encolhido por n/(n+3)). Observado e estimado entram com selo; emblema fica descritivo."
        prdRef="ADR-030"
      />

      <div className="card p-3.5 bg-panel border-line flex items-center gap-3 flex-wrap">
        <span className="lbl text-xs font-semibold text-foam">Lane:</span>
        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Escolha a lane">
          {LANES.map((l) => (
            <button
              key={l}
              onClick={() => setLane(l)}
              aria-pressed={lane === l}
              className={cx(
                "px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all min-h-[40px]",
                lane === l ? "bg-gold text-abyss shadow-sm" : "bg-abyss/60 text-mist hover:text-foam border border-line",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <span className="lbl text-xs font-semibold text-foam ml-auto">Profundidade:</span>
        <div className="flex items-center gap-1.5">
          {[10, 20].map((t) => (
            <button
              key={t}
              onClick={() => setTop(t)}
              aria-pressed={top === t}
              className={cx(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all min-h-[40px]",
                top === t ? "bg-gold text-abyss" : "bg-abyss/60 text-mist hover:text-foam border border-line",
              )}
            >
              top-{t}
            </button>
          ))}
        </div>
      </div>

      {!lane && (
        <Empty
          title="Escolha uma lane para listar as builds"
          hint="A lista usa as builds observadas do recorte (lane + rank + top). Sem lane não há build nem índice."
        />
      )}

      {lane && q.isLoading && <Loading rows={6} />}

      {lane && q.isError && (
        <ErrBox
          onRetry={() => q.refetch()}
          message={`Não foi possível carregar as builds da lane ${lane.toUpperCase()} agora. Tente de novo em instantes.`}
        />
      )}

      {lane && body && !combiner && (
        <Empty
          title="Este recorte veio sem os valores por componente"
          hint="O índice precisa do bloco de componentes do recorte. Recarregue a página; se persistir, o recorte ainda não foi agregado com essa versão."
        />
      )}

      {lane && body && combiner && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <FreshLine stale={body.context.stale} ageMs={body.context.age_ms} />
            <span className="text-[11px] text-mist">
              {body.context.rank.toUpperCase()} · {body.context.lane.toUpperCase()} · top-{body.context.top} · {rows.length} builds observadas
            </span>
          </div>

          <SectionTitle
            kicker="1 · Filtros"
            title="Escolha o que listar"
            subtitle="A lista mostra as builds observadas com os itens, o emblema, os talentos e o feitiço. Complete os slots vazios até 6 itens e veja o índice."
          />
          <div className="card p-3.5 bg-panel border-line flex items-center gap-3 flex-wrap">
            <label className="lbl text-[10px]" htmlFor="power-hero">Herói</label>
            <select
              id="power-hero"
              value={heroFilter}
              onChange={(e) => setHeroFilter(e.target.value)}
              className="rounded-xl border border-line bg-abyss/60 text-xs text-foam px-2 py-2 min-h-[40px] min-w-[180px]"
            >
              <option value="">todos os heróis do recorte</option>
              {(body.top_builds ?? []).map((cell) => (
                <option key={String(cell.hero.id)} value={String(cell.hero.id)}>
                  {cell.hero.name ?? `#${cell.hero.id}`}
                </option>
              ))}
            </select>

            <span className="lbl text-[10px] ml-auto">Ordenar por</span>
            <div className="flex items-center gap-1.5">
              {([["power", "Índice"], ["observed", "Observado"], ["hero", "Herói"]] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setSort(value)}
                  aria-pressed={sort === value}
                  className={cx(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all min-h-[40px]",
                    sort === value ? "bg-gold text-abyss" : "bg-abyss/60 text-mist hover:text-foam border border-line",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="inline-flex items-center gap-2 text-[11px] text-mist">
              <input type="checkbox" checked={onlyFull} onChange={(e) => setOnlyFull(e.target.checked)} className="accent-gold" />
              só 6 itens
            </label>
          </div>

          <SectionTitle
            kicker="2 · Builds"
            title="Builds do recorte com poder estimado"
            subtitle="Índice = média dos pesos por contraste dos componentes. O desempenho observado aparece separado — não é somado ao índice."
          />

          <div className="grid gap-2.5">
            {visible.map((row) => (
              <BuildRow
                key={row.key}
                hero={row.hero}
                build={row.build}
                extras={row.extras}
                score={row.score}
                itemById={itemById}
                onOpen={() => { setOpenKey(openKey === row.key ? null : row.key); setSearch(""); }}
                onAdd={(id) => addExtra(row.key, row.build, row.extras, id)}
                onRemove={(id) => removeExtra(row.key, id)}
              />
            ))}
            {visible.length === 0 && (
              <Empty
                title="Nenhuma build com esses filtros"
                hint="Tire um filtro ou escolha outro herói. Só mostramos builds que existem nos dados do recorte."
              />
            )}
          </div>

          {openRow && (
            <div className="fixed inset-x-0 bottom-0 z-40 p-2 sm:p-3">
              <div className="mx-auto max-w-3xl card p-3.5 bg-panel2/95 border-gold/40 shadow-2xl space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Boxes size={15} className="text-gold" />
                  <span className="font-bold text-sm text-foam">
                    Escolher item para {openRow.hero.name ?? `#${openRow.hero.id}`}
                  </span>
                  <span className="text-[11px] text-mist ml-auto">
                    {freeItemSlots(openRow.build, openRow.extras)} slot(s) livre(s)
                  </span>
                </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mist" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar item do recorte"
                    className="w-full rounded-xl border border-line bg-abyss/60 text-xs text-foam pl-7 pr-2 py-2 min-h-[40px]"
                  />
                </div>
                <button onClick={() => { setOpenKey(null); setSearch(""); }} className="btn-ghost text-xs inline-flex items-center gap-1">
                  <X size={13} /> fechar
                </button>
              </div>
              <p className="text-[10px] text-mist">Só itens observados neste recorte. Uma bota no máximo.</p>
              <div className="grid gap-1.5 md:grid-cols-2 max-h-[320px] overflow-auto">
                {itemOptions.map((item) => {
                  const already = openRow.build.item_ids.includes(item.id) || openRow.extras.includes(item.id);
                  const all = [...openRow.build.item_ids, ...openRow.extras];
                  const bootsBlocked = item.archetype === "movement" && all.some((x) => itemById.get(x)?.archetype === "movement");
                  const full = all.length >= TOTAL_ITEM_SLOTS;
                  const disabled = already || bootsBlocked || full;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={disabled && !openRow.extras.includes(item.id)}
                      onClick={() => (openRow.extras.includes(item.id) ? removeExtra(openRow.key, item.id) : addExtra(openRow.key, openRow.build, openRow.extras, item.id))}
                      className={cx(
                        "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors",
                        disabled && !openRow.extras.includes(item.id)
                          ? "border-line bg-abyss/20 opacity-50 cursor-not-allowed"
                          : openRow.extras.includes(item.id)
                            ? "border-gold/60 bg-gold/10"
                            : "border-line bg-abyss/40 hover:border-gold/40",
                      )}
                    >
                      {item.icon ? (
                        <img src={item.icon} alt="" className="w-7 h-7 rounded border border-line" loading="lazy" />
                      ) : (
                        <span className="w-7 h-7 rounded border border-line grid place-items-center text-[9px] num text-mist bg-abyss">#{item.id}</span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-foam truncate">{item.name ?? `#${item.id}`}</span>
                        <span className="block text-[10px] text-mist">
                          {item.archetype_label} · {pct(item.adoption, 0)} das builds · {valueText(item.value_pp_source, item.value_pp, item.value_pp_est)}
                        </span>
                      </span>
                      {openRow.extras.includes(item.id)
                        ? <Minus size={13} className="text-gold shrink-0" />
                        : already ? <span className="text-[9px] text-mist shrink-0">já na build</span>
                          : bootsBlocked ? <span className="text-[9px] text-mist shrink-0">já tem bota</span>
                            : full ? <span className="text-[9px] text-mist shrink-0">6/6</span>
                              : <Plus size={13} className="text-mist shrink-0" />}
                    </button>
                  );
                })}
                {itemOptions.length === 0 && <p className="text-[11px] text-mist md:col-span-2">Nenhum item do recorte casa com a busca.</p>}
                </div>
              </div>
            </div>
          )}

          <div className="card p-3.5 bg-panel2/40 border-line space-y-2">
            <p className="text-[11px] text-mist flex items-start gap-1.5">
              <Info size={13} className="mt-0.5 shrink-0" />
              O índice é relativo, não é previsão, não é probabilidade e não é o "Poder da Build" oficial. Os itens que
              você acrescenta entram como peso por contraste do recorte, não como sinergia medida com a build.
            </p>
            <details className="text-[11px] text-mist">
              <summary className="cursor-pointer text-foam/90">Como isso foi calculado</summary>
              <div className="mt-2 space-y-1.5">
                <p>{combiner.scale.index_rule}</p>
                <p>
                  <b className="text-foam/90">Peso do componente:</b> contraste no mesmo herói+lane+rank —
                  vitória das builds que usam o componente menos vitória das que não usam. A mediana entre contextos
                  evita que um herói puxe o valor, e o encolhimento n/(n+{combiner.scale.contrast?.shrink_k ?? 3})
                  reduz o que tem pouco contraste.
                </p>
                <p>
                  <b className="text-foam/90">Selos:</b> <span className="text-emerald-200">observado</span> = contextos
                  e trocas pareadas acima do mínimo; <span className="text-amber-200">estimado</span> = existe contraste
                  mas abaixo do mínimo (valor com <span className="num">~</span>);
                  <span className="text-sky-200"> descritivo</span> = emblema, constante dentro do herói;
                  <span className="text-mist"> sem contraste</span> = o componente nunca variou no recorte.
                  Nenhum deles é zero: sem dado não vira número.
                </p>
                <p>
                  <b className="text-foam/90">Troca pareada:</b> quando as duas builds só diferem no slot do componente
                  (mesmo resto de itens, emblema, outros talentos e feitiço), o contraste é a evidência mais limpa.
                  Numa troca de item, o que se mede é a diferença entre o que entrou e o que saiu — por isso os dois
                  lados recebem valores opostos.
                </p>
                <p>
                  <b className="text-foam/90">Build completa:</b> o recorte traz 3 itens por build. Os {TOTAL_ITEM_SLOTS - 3} slots
                  restantes são preenchidos por você e marcados como adicionados.
                </p>
                <p>
                  <b className="text-foam/90">Observado ≠ índice:</b> "ganha/pick/vs build mais usada" é o dado da fonte;
                  o índice é a média dos pesos por contraste. Os dois ficam lado a lado, nunca somados.
                </p>
                <p>Nada aqui é causal. Sem N de partidas.</p>
              </div>
            </details>
            <p className="text-[10px] text-mist/80 flex items-center gap-1.5">
              <Sparkles size={12} className="text-gold" /> Emblema, talentos e feitiço vêm da própria build observada.
              O emblema é descritivo (não varia dentro do herói) e não soma no índice.
              <Swords size={12} className="text-gold ml-2" /> Só itens do recorte entram como item extra.
            </p>
            <p className="text-[10px] text-amber-200/80 flex items-center gap-1.5">
              <AlertTriangle size={12} /> Itens fora do recorte não aparecem: o índice só usa o que foi observado.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
