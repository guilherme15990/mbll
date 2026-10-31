import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Info, Sparkles, Swords } from "lucide-react";
import { LANES, cx, useBuildsAggregate } from "../../shared/api";
import type { AggregateCombinerItem, AggregateTopBuild } from "../../shared/api";
import { TOTAL_ITEM_SLOTS, pickFromBuild, scoreCombination } from "../../shared/domain/combiner";
import type { CombinerScore } from "../../shared/domain/combiner";
import { CtxBar, Empty, ErrBox, FreshLine, Loading, SectionTitle } from "../../shared/ui";
import { CombinerBuildRow } from "./power/CombinerBuildRow";
import { ItemPicker } from "./power/ItemPicker";

/**
 * Builds + poder (ADR-030) — guia própria em `/builds?view=power`.
 *
 * Lista as builds observadas do recorte (itens + emblema + talentos + feitiço),
 * deixa completar até 6 itens e mostra o índice estimado de cada build.
 * O índice é a média dos pesos por contraste — não é previsão, não é
 * win rate da combinação e não é o "Poder da Build" oficial.
 *
 * A linha (`power/CombinerBuildRow`) e o seletor de item (`power/ItemPicker`) moraram
 * neste arquivo até o E3; aqui fica só o recorte, os filtros e o estado.
 */
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
              <CombinerBuildRow
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
            <ItemPicker
              rowKey={openRow.key}
              hero={openRow.hero}
              build={openRow.build}
              extras={openRow.extras}
              itemById={itemById}
              itemOptions={itemOptions}
              search={search}
              onSearch={setSearch}
              onClose={() => { setOpenKey(null); setSearch(""); }}
              onAdd={(id) => addExtra(openRow.key, openRow.build, openRow.extras, id)}
              onRemove={(id) => removeExtra(openRow.key, id)}
            />
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
