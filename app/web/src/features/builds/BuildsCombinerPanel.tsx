import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, FlaskConical, Info, Minus, Plus, Search, Sparkles, Swords, X } from "lucide-react";
import {
  LANES, cx, pct, useBuildsAggregate,
  type AggregateCombiner,
  type AggregateCombinerHero,
  type AggregateCombinerTalent,
} from "../../shared/api";
import {
  EMPTY_PICK, evidenceLabel, scoreCombination, validatePick, valueText,
  type CombinerContribution, type CombinerPick,
} from "../../shared/domain/combiner";
import { decodeLoadout } from "../../shared/domain/loadout";
import { CtxBar, Empty, ErrBox, FreshLine, Loading, SectionTitle } from "../../shared/ui";
import { signed } from "../../shared/format";

/**
 * Combinador (ADR-030) — guia própria em `/builds?view=combiner`.
 * Índice aditivo dos pesos por contraste do recorte (lane + rank).
 * Não é previsão, não é win rate da combinação e não é o "Poder da Build" oficial.
 */

const KIND_LABEL: Record<CombinerContribution["kind"], string> = {
  item: "Item",
  emblem: "Emblema",
  talent: "Talento",
  spell: "Feitiço",
};

const KIND_CLASS: Record<CombinerContribution["kind"], string> = {
  item: "text-sky-200 border-sky-400/30 bg-sky-400/10",
  emblem: "text-amber-200 border-amber-300/30 bg-amber-300/10",
  talent: "text-emerald-200 border-emerald-400/30 bg-emerald-400/10",
  spell: "text-purple-200 border-purple-400/30 bg-purple-400/10",
};

function ScoreCard({
  combiner, index, meanPp, withData, observed, estimated, total, hero,
}: {
  combiner: AggregateCombiner;
  index: number | null;
  meanPp: number | null;
  withData: number;
  observed: number;
  estimated: number;
  total: number;
  hero: AggregateCombinerHero | undefined;
}) {
  const coverage = total ? withData / total : 0;
  return (
    <div className="card p-4 bg-panel border-line space-y-3">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="grid place-items-center min-w-[132px]">
          <p className="lbl text-[10px]">Índice estimado</p>
          <p className="num text-4xl font-black text-gold leading-none">{index == null ? "—" : index.toFixed(1)}</p>
          <p className="text-[10px] text-mist mt-1">base {combiner.scale.base} · média do recorte</p>
        </div>
        <div className="grid gap-2 flex-1 min-w-[220px]">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-line bg-abyss/40 px-3 py-2">
              <p className="lbl text-[10px]">Média dos efeitos</p>
              <p className="num text-sm font-bold text-foam">{meanPp == null ? "—" : signed(meanPp, 2, " pp")}</p>
            </div>
            <div className="rounded-xl border border-line bg-abyss/40 px-3 py-2">
              <p className="lbl text-[10px]">Componentes no índice</p>
              <p className="num text-sm font-bold text-foam">{withData} de {total}</p>
              <p className="text-[10px] text-mist">{observed} observado{observed === 1 ? "" : "s"} · {estimated} estimado{estimated === 1 ? "" : "s"}</p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-abyss overflow-hidden" aria-hidden="true">
            <div className="h-full rounded-full bg-gold/70" style={{ width: `${coverage * 100}%` }} />
          </div>
          <div className="flex items-center gap-2 flex-wrap text-[11px] text-mist">
            <span className="px-2 py-0.5 rounded-full border border-line bg-abyss/50">
              {signed(combiner.scale.points_per_pp, 0)} pontos por ponto percentual
            </span>
            <span className="px-2 py-0.5 rounded-full border border-line bg-abyss/50">
              encolhimento n/(n+{combiner.scale.contrast?.shrink_k ?? combiner.scale.shrink_k})
            </span>
          </div>
        </div>
      </div>

      {hero && (
        <div className="rounded-xl border border-line bg-abyss/30 px-3 py-2 text-[11px] text-mist space-y-1">
          <p className="text-foam/90 font-semibold">Herói selecionado: {hero.name ?? `#${hero.id}`}</p>
          <p>
            Normal do herói: {hero.ref_win == null ? "—" : pct(hero.ref_win)} · força ajustada (wrAdj):{" "}
            {hero.wrAdj == null ? "—" : pct(hero.wrAdj)} · tier {hero.tier ?? "—"}.
          </p>
          <p className="text-mist/80">O herói fica fora do índice — ele é contexto, não mérito dos componentes.</p>
        </div>
      )}

      <p className="text-[11px] text-mist/90 flex items-start gap-1.5">
        <Info size={13} className="mt-0.5 shrink-0" />
        Índice relativo, não é probabilidade, não é previsão e não é o "Poder da Build" oficial.
        Cada componente é um peso por contraste (com × sem) no mesmo herói+lane+rank. Emblema é descritivo.
      </p>
    </div>
  );
}

function ContributionRow({ c }: { c: CombinerContribution }) {
  const positive = (c.points ?? 0) > 0;
  const negative = (c.points ?? 0) < 0;
  const evidenceCls =
    c.evidence === "observed"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : c.evidence === "estimated"
        ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
        : c.evidence === "descriptive"
          ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
          : "border-line bg-abyss/50 text-mist";
  return (
    <div className="flex items-center gap-2.5 py-1.5 border-t border-line/40 first:border-t-0" title={c.reason ?? undefined}>
      {c.icon ? (
        <img src={c.icon} alt="" className="w-7 h-7 rounded border border-line" loading="lazy" />
      ) : (
        <span className="w-7 h-7 rounded border border-line grid place-items-center text-[9px] num text-mist bg-abyss">—</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-foam truncate">{c.label}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cx("text-[9px] px-1.5 py-0.5 rounded-full border", KIND_CLASS[c.kind])}>{KIND_LABEL[c.kind]}</span>
          <span className={cx("text-[9px] px-1.5 py-0.5 rounded-full border", evidenceCls)}>{evidenceLabel(c.evidence)}</span>
          <span className="text-[10px] text-mist">
            {c.evidence === "descriptive"
              ? `aparece em ${pct(c.adoption, 0)} das builds · sem peso (constante dentro do herói)`
              : c.evidence === "none"
                ? `aparece em ${pct(c.adoption, 0)} das builds · sem contraste no recorte`
                : `aparece em ${pct(c.adoption, 0)} das builds · ${c.contexts} contexto${c.contexts === 1 ? "" : "s"} com contraste`}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0 w-[78px]">
        <p className="lbl text-[9px]">peso</p>
        <p className={cx("num text-[11px] font-bold", positive ? "text-emerald-300" : negative ? "text-rose-300" : "text-mist")}>
          {valueText(c.evidence, c.valuePp, c.valuePpEst)}
        </p>
      </div>
      <div className="text-right shrink-0 w-[56px]">
        <p className="lbl text-[9px]">pontos</p>
        <p className={cx("num text-[11px] font-bold", positive ? "text-emerald-300" : negative ? "text-rose-300" : "text-mist")}>
          {c.points == null ? "—" : signed(c.points, 2)}
        </p>
      </div>
    </div>
  );
}

export default function BuildsCombinerPanel({ rank, window }: { rank: string; window: string }) {
  const [sp, setSp] = useSearchParams();
  const laneParam = sp.get("lane");
  const lane = laneParam && (LANES as readonly string[]).includes(laneParam) ? laneParam : "";
  const top = Number(sp.get("top") ?? 10) === 20 ? 20 : 10;

  const q = useBuildsAggregate(rank, lane, window, top);
  const body = q.data;
  const combiner = body?.combiner;

  const [pick, setPick] = useState<CombinerPick>(EMPTY_PICK);
  const [heroId, setHeroId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  // Carga vinda de `/preparar` (ADR-044): `?l=` hidrata a composição.
  // Sem código, o recorte manda — componentes mudam com lane/top e começa limpo.
  const loadoutCode = sp.get("l");
  useEffect(() => {
    if (loadoutCode) {
      const decoded = decodeLoadout(loadoutCode);
      if (decoded.ok) {
        setPick(decoded.loadout.pick);
        setHeroId(String(decoded.loadout.heroId));
        return;
      }
    }
    setPick(EMPTY_PICK);
  }, [lane, top, loadoutCode]);

  const score = useMemo(() => scoreCombination(pick, combiner), [pick, combiner]);
  const pickCheck = useMemo(() => validatePick(pick, combiner), [pick, combiner]);

  const heroes = combiner?.heroes ?? [];
  const hero = heroes.find((h) => String(h.id) === heroId);

  const itemList = useMemo(() => {
    const rows = combiner?.items ?? [];
    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((i) => (i.name ?? `#${i.id}`).toLowerCase().includes(needle))
      : rows;
    return showAll || needle ? filtered.slice(0, 40) : filtered.slice(0, 12);
  }, [combiner, search, showAll]);

  const tiers = useMemo(() => {
    const map = new Map<number | null, AggregateCombinerTalent[]>();
    for (const t of combiner?.talents ?? []) {
      const arr = map.get(t.tier) ?? [];
      arr.push(t);
      map.set(t.tier, arr);
    }
    return [...map.entries()].sort((a, b) => (a[0] ?? 99) - (b[0] ?? 99));
  }, [combiner]);

  const setLane = (l: string) => {
    const next = new URLSearchParams(sp);
    next.set("lane", l);
    next.set("view", "combiner");
    setSp(next);
    try { localStorage.setItem("radar:lane", l); } catch { /* storage privado */ }
  };
  const setTop = (t: number) => {
    const next = new URLSearchParams(sp);
    next.set("top", String(t));
    setSp(next);
  };

  const addItem = (id: number) => {
    setPick((prev) => {
      if (prev.itemIds.includes(id) || prev.itemIds.length >= (combiner?.scale.slots.items ?? 6)) return prev;
      const meta = combiner?.items.find((i) => i.id === id);
      if (meta?.archetype === "movement") {
        const boots = prev.itemIds.filter((x) => combiner?.items.find((i) => i.id === x)?.archetype === "movement");
        if (boots.length >= 1) return prev;
      }
      return { ...prev, itemIds: [...prev.itemIds, id] };
    });
  };
  const removeItem = (id: number) => setPick((prev) => ({ ...prev, itemIds: prev.itemIds.filter((x) => x !== id) }));

  const pickTalent = (id: number, tier: number | null) => {
    setPick((prev) => {
      const others = prev.talentIds.filter((x) => {
        const t = combiner?.talents.find((row) => row.id === x);
        return (t?.tier ?? null) !== tier;
      });
      if (prev.talentIds.includes(id)) return { ...prev, talentIds: prev.talentIds.filter((x) => x !== id) };
      return { ...prev, talentIds: [...others, id] };
    });
  };

  const clearAll = () => { setPick(EMPTY_PICK); setSearch(""); };

  return (
    <section className="space-y-5">
      <CtxBar
        id="BDL"
        name="Builds — Combinador (poder estimado)"
        question="Como fica a configuração que eu monto?"
        status="peso por contraste, não oficial"
        formula="índice = 100 + 10 × média(contraste do componente no mesmo herói+lane+rank, encolhido por n/(n+3)). Herói fica fora do índice; emblema fica descritivo."
        prdRef="ADR-030"
      />

      <div className="card p-3.5 bg-panel border-line flex items-center gap-3 flex-wrap">
        <span className="lbl text-xs font-semibold text-foam">Lane:</span>
        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Escolha a lane do combinador">
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
          title="Escolha uma lane para montar"
          hint="O combinador usa os componentes observados no recorte (lane + rank + top). Sem lane não há componente nem índice."
        />
      )}

      {lane && q.isLoading && <Loading rows={5} />}

      {lane && q.isError && (
        <ErrBox
          onRetry={() => q.refetch()}
          message={`Não foi possível carregar os componentes da lane ${lane.toUpperCase()} agora. Tente de novo em instantes.`}
        />
      )}

      {lane && body && combiner && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <FreshLine stale={body.context.stale} ageMs={body.context.age_ms} />
            <span className="text-[11px] text-mist">
              {body.context.rank.toUpperCase()} · {body.context.lane.toUpperCase()} · top-{body.context.top}
            </span>
            <button onClick={clearAll} className="btn-ghost text-xs ml-auto inline-flex items-center gap-1.5">
              <X size={13} /> Limpar combinação
            </button>
          </div>

          <ScoreCard
            combiner={combiner}
            index={score.index}
            meanPp={score.meanPp}
            withData={score.withData}
            observed={score.observed}
            estimated={score.estimated}
            total={score.total}
            hero={hero}
          />

          {!pickCheck.ok && (
            <div className="rounded-xl border border-amber-300/40 bg-amber-400/5 p-3 text-[11px] text-amber-100 flex items-start gap-1.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{pickCheck.errors.join(" · ")}</span>
            </div>
          )}

          <SectionTitle
            kicker="1 · Herói"
            title="Contexto do herói"
            subtitle="O herói fica fora do índice. Ele aparece ao lado para você ler o índice contra o normal dele."
          />
          <div className="card p-3.5 bg-panel border-line">
            <label className="lbl text-[10px]" htmlFor="combiner-hero">Herói do recorte</label>
            <select
              id="combiner-hero"
              value={heroId}
              onChange={(e) => setHeroId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-abyss/60 text-xs text-foam px-2 py-2 min-h-[40px]"
            >
              <option value="">— nenhum (só o índice dos componentes) —</option>
              {heroes.map((h) => (
                <option key={String(h.id)} value={String(h.id)}>
                  {h.name ?? `#${h.id}`} · normal {h.ref_win == null ? "—" : pct(h.ref_win, 1)}
                </option>
              ))}
            </select>
          </div>

          <SectionTitle
            kicker="2 · Itens"
            title={`Itens da configuração (${pick.itemIds.length}/${combiner.scale.slots.items})`}
            subtitle="Só itens observados neste recorte. Uma bota no máximo. Clique para adicionar; clique no slot para remover."
          />
          <div className="card p-3.5 bg-panel border-line space-y-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {Array.from({ length: combiner.scale.slots.items }).map((_, idx) => {
                const id = pick.itemIds[idx];
                const meta = id == null ? undefined : combiner.items.find((i) => i.id === id);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => id != null && removeItem(id)}
                    title={meta ? `${meta.name ?? `#${meta.id}`} — clique para remover` : "Slot vazio"}
                    className={cx(
                      "w-12 h-12 rounded-xl border grid place-items-center transition-colors",
                      meta ? "border-line bg-abyss/60 hover:border-rose-300/50" : "border-dashed border-line/70 bg-abyss/20",
                    )}
                  >
                    {meta?.icon ? (
                      <img src={meta.icon} alt={meta.name ?? `#${meta.id}`} className="w-10 h-10 rounded-lg object-cover" />
                    ) : meta ? (
                      <span className="text-[9px] num text-mist">#{meta.id}</span>
                    ) : (
                      <Minus size={13} className="text-mist/50" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mist" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar item do recorte"
                  className="w-full rounded-xl border border-line bg-abyss/60 text-xs text-foam pl-7 pr-2 py-2 min-h-[40px]"
                />
              </div>
              <button onClick={() => setShowAll((v) => !v)} className="btn-ghost text-xs">
                {showAll ? "Mostrar menos" : "Ver todos"}
              </button>
            </div>

            <div className="grid gap-1.5 md:grid-cols-2">
              {itemList.map((item) => {
                const selected = pick.itemIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => (selected ? removeItem(item.id) : addItem(item.id))}
                    className={cx(
                      "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors",
                      selected ? "border-gold/60 bg-gold/10" : "border-line bg-abyss/40 hover:border-gold/40",
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
                        {item.archetype_label} · {pct(item.adoption, 0)} das builds ·{" "}
                        {valueText(item.value_pp_source, item.value_pp, item.value_pp_est)} de peso
                      </span>
                    </span>
                    {selected ? <Minus size={14} className="text-gold shrink-0" /> : <Plus size={14} className="text-mist shrink-0" />}
                  </button>
                );
              })}
              {itemList.length === 0 && (
                <p className="text-[11px] text-mist md:col-span-2">Nenhum item do recorte casa com a busca.</p>
              )}
            </div>
            {!showAll && !search && (combiner.items.length > 12) && (
              <p className="text-[10px] text-mist">Mostrando 12 de {combiner.items.length} itens observados. Use a busca ou "Ver todos".</p>
            )}
          </div>

          <SectionTitle
            kicker="3 · Emblema, talentos e feitiço"
            title="Runa e feitiço da configuração"
            subtitle="Um emblema, um talento por tier e um feitiço. Cada bloco mede uma coisa diferente — por isso as listas ficam separadas."
          />
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="card p-3.5 bg-panel border-line space-y-2">
              <h3 className="font-bold text-sm text-foam flex items-center gap-1.5"><Sparkles size={14} className="text-gold" /> Emblema</h3>
              <select
                aria-label="Emblema"
                value={pick.emblemId ?? ""}
                onChange={(e) => setPick((prev) => ({ ...prev, emblemId: e.target.value ? Number(e.target.value) : null }))}
                className="w-full rounded-xl border border-line bg-abyss/60 text-xs text-foam px-2 py-2 min-h-[40px]"
              >
                <option value="">— sem emblema —</option>
                {combiner.emblems.map((e) => (
                  <option key={e.emblem_id} value={e.emblem_id}>
                    {e.name ?? `#${e.emblem_id}`} · {pct(e.adoption, 0)} das builds
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-mist">
                {combiner.emblems[0]?.value_reason ?? "A escolha do emblema é constante dentro do herói — descritivo, sem peso estimado."}
              </p>
            </div>

            <div className="card p-3.5 bg-panel border-line space-y-2">
              <h3 className="font-bold text-sm text-foam flex items-center gap-1.5"><Swords size={14} className="text-gold" /> Feitiço</h3>
              <select
                aria-label="Feitiço"
                value={pick.spellName ?? ""}
                onChange={(e) => setPick((prev) => ({ ...prev, spellName: e.target.value || null }))}
                className="w-full rounded-xl border border-line bg-abyss/60 text-xs text-foam px-2 py-2 min-h-[40px]"
              >
                <option value="">— sem feitiço —</option>
                {combiner.spells.map((s) => (
                  <option key={s.name ?? "spell"} value={s.name ?? ""}>
                    {s.name ?? "—"} · {pct(s.adoption, 0)} das builds
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="card p-3.5 bg-panel border-line space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm text-foam flex items-center gap-1.5"><FlaskConical size={14} className="text-gold" /> Talentos</h3>
              <span className="text-[10px] text-mist ml-auto">1 por tier · {pick.talentIds.length} de {combiner.scale.slots.talents}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {tiers.map(([tier, rows]) => (
                <div key={tier ?? "sem_tier"} className="rounded-xl border border-line bg-abyss/30 p-2.5 space-y-1.5">
                  <p className="lbl text-[10px]">{tier == null ? "Sem tier" : `Tier ${tier}`}</p>
                  {rows?.map((t) => {
                    const selected = pick.talentIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => pickTalent(t.id, t.tier)}
                        title={t.desc ?? undefined}
                        className={cx(
                          "w-full text-left rounded-lg border px-2 py-1.5 transition-colors",
                          selected ? "border-gold/60 bg-gold/10" : "border-line bg-panel/40 hover:border-gold/40",
                        )}
                      >
                        <span className="block text-[11px] text-foam truncate">{t.label}</span>
                        <span className="block text-[10px] text-mist">
                          {pct(t.adoption, 0)} das builds · {valueText(t.value_pp_source, t.value_pp, t.value_pp_est)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <SectionTitle
            kicker="4 · Contribuições"
            title="De onde vem o índice"
            subtitle="Cada linha é um componente da sua configuração. Os pontos somam o índice − 100. Sem peso, o componente não soma — e a linha diz se é estimado, descritivo ou sem contraste."
          />
          <div className="card p-3.5 bg-panel border-line space-y-1">
            {score.contributions.length === 0 ? (
              <p className="text-[11px] text-mist">Monte uma configuração para ver as contribuições.</p>
            ) : (
              [...score.contributions]
                .sort((a, b) => (b.points ?? -Infinity) - (a.points ?? -Infinity))
                .map((c) => <ContributionRow key={c.key} c={c} />)
            )}
          </div>

          <div className="card p-3.5 bg-panel2/40 border-line space-y-2">
            <p className="text-[11px] text-mist flex items-start gap-1.5">
              <Info size={13} className="mt-0.5 shrink-0" />
              Mostra o que aparece nos dados; não garante que um componente é o motivo da vitória, não prevê o
              resultado de uma partida e não é o número interno do jogo.
            </p>
            <details className="text-[11px] text-mist">
              <summary className="cursor-pointer text-foam/90">Como isso foi calculado</summary>
              <div className="mt-2 space-y-1.5">
                <p>{combiner.scale.index_rule}</p>
                <p>
                  <b className="text-foam/90">Peso do componente:</b> contraste no mesmo herói+lane+rank —
                  vitória das builds que usam o componente menos vitória das que não usam. A mediana entre
                  contextos evita que um herói puxe o valor, e o encolhimento
                  n/(n+{combiner.scale.contrast?.shrink_k ?? 3}) reduz o que tem pouco contraste.
                </p>
                <p>
                  <b className="text-foam/90">Selos:</b> <span className="text-emerald-200">observado</span> =
                  contextos e trocas pareadas acima do mínimo; <span className="text-amber-200">estimado</span> =
                  existe contraste mas abaixo do mínimo (valor com <span className="num">~</span>);
                  <span className="text-sky-200"> descritivo</span> = emblema, constante dentro do herói;
                  <span className="text-mist"> sem contraste</span> = nunca variou no recorte. Sem dado não vira zero.
                </p>
                <p>
                  <b className="text-foam/90">Herói:</b> fora do índice. Força do herói (wrAdj), tier e normal do
                  herói ficam ao lado, como contexto.
                </p>
                <p>
                  <b className="text-foam/90">Limites:</b> o recorte cobre top-{body.context.top} da lane
                  {" "}{body.context.lane.toUpperCase()} e só os itens/emblemas/talentos que aparecem nos dados.
                  Combinação completa de 6 itens é parcialmente extrapolada.
                </p>
                <p>Nada aqui é causal nem probabilidade. Sem N de partidas.</p>
              </div>
            </details>
          </div>
        </>
      )}
    </section>
  );
}
