import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LANES, num, pct, useBuilds, useHeroLanes, useHeroes,
  type Build, type Hero,
} from "../../lib/api";
import { BUILD_TAG_CLASS } from "../../lib/buildLabel";
import { getBuildTags, refWinsOf, scoreRouteItemsets, selectLaneTopHeroesDetailed } from "@radar/proprietary-engine";
import type { HeroItemsetContext } from "../../lib/itemsets";
import { NeedsLane } from "../../shared/idd/NeedsRankLane";
import {
  Avatar, Empty, ErrBox, IddZone, Loading, TierBadge,
} from "../../shared/ui";
import { signed } from "../../shared/format";

/**
 * Aba Builds do /dashboard (v1, composição por rota — sem herói).
 * Orçamento fechado (builds-global-brief §2): R1 mapa lanes (key da ficha,
 * cache 24h) + R2 lista `sort=win&order=desc&size=25` + R3–R5 ≤3 builds
 * (keys idênticas às da ficha, `["builds",id,rank,lane]`).
 * Sem rota escolhida = 0 requests de builds (GE-P0-01, guardião P0).
 * A aba nunca ordena builds entre heróis: ordem dos cards = θ̂ do herói (R2);
 * dentro do card, ordem das linhas = ordem da ficha. Tab local, nunca em key.
 */

const TOP_N = 3;
const LINES_PER_HERO = 2;
const LIST_EXTRA = "sort=win&order=desc";
const LIST_SIZE = 25;

type CardState =
  | { kind: "loading" }
  | { kind: "error"; onRetry: () => void }
  | { kind: "empty"; motive: string }
  | { kind: "ready"; hero: Hero; builds: Build[]; audit: string; unfiltered: boolean };

/** Cartão de herói com suas builds: win/pick + tags + referência por linha + ícones. */
function BuildLine({ b, rank, lane }: { b: Build; rank: string; lane: string }) {
  const tags = getBuildTags(b);
  const refs = b.references;
  return (
    <div className="rounded-xl bg-abyss/60 border border-line p-2.5 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-foam font-mono">win {pct(b.win)}</span>
        <span className="text-[11px] text-mist font-mono">pick {pct(b.pick, 2)}</span>
        {tags.map((t) => (
          <span
            key={t.key}
            title={t.title}
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full border inline-block ${BUILD_TAG_CLASS[t.tone]}`}
          >
            {t.label}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-mist font-mono leading-relaxed">
        vs Mais Usada {signed(b.lift_vs_most_used, 4)} (ref WR {pct(refs?.most_used_win)})
        {" · "}vs Média {signed(b.lift_vs_mean, 4)} (ref {pct(refs?.hero_mean_win)})
        {" · "}{rank} · {lane} · {b.reference_kind ?? "mais-usada"}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {(b.items ?? []).map((it, idx) => (
          it?.icon ? (
            <img
              key={idx}
              src={it.icon}
              alt={it.name ?? `Item #${it.id}`}
              title={it.name ?? `Item #${it.id}`}
              className="w-8 h-8 rounded-lg border border-line object-cover shadow-sm"
              loading="lazy"
            />
          ) : (
            <span
              key={idx}
              title={`Item #${it?.id}`}
              className="w-8 h-8 rounded-lg border border-line flex items-center justify-center text-[10px] font-mono text-mist bg-abyss"
            >
              #{it?.id}
            </span>
          )
        ))}
        {b.spell ? <span className="text-[10px] text-mist font-mono ml-1">{b.spell.name}</span> : null}
        {b.emblem ? <span className="text-[10px] text-mist font-mono">· {b.emblem.name}</span> : null}
      </div>
    </div>
  );
}

export default function BuildsTab({ rank, window, active }: { rank: string; window: string; active: boolean }) {
  // Rota: estado local de UI, sem default, sem "todas" (GE-P0-01).
  const [lane, setLane] = useState<string | null>(null);
  const validLane = lane != null && (LANES as readonly string[]).includes(lane);
  const laneKey = validLane && lane != null ? lane : "";

  const pickLane = (l: string) => {
    setLane(l);
    try {
      localStorage.setItem("radar:lane", l);
    } catch {
      /* storage privado */
    }
  };

  // R1 · mapa heroId -> lanes[] (mesma key da ficha/dashboard, cache 24h).
  const lanesQuery = useHeroLanes(rank, active);
  // R2 · lista rankeada θ̂ desc (top-da-rota = interseção client-side, sem `lane=` no servidor).
  const listQuery = useHeroes(rank, window, LIST_EXTRA, 1, LIST_SIZE, active);

  const lanesMap = lanesQuery.data?.data as Record<number, string[]> | undefined;
  const lanesLoaded = lanesQuery.isSuccess && lanesMap != null;
  const lanesEmpty = lanesLoaded && Object.keys(lanesMap as Record<number, string[]>).length === 0;

  // Top-3 θ̂ da rota em `@radar/proprietary-engine` (ordem de R2 preservada).
  // selectLaneTopHeroesDetailed: sem mapa de rotas o top-3 vem SEM validação —
  // `validated:false` acende "rota não filtrada" no card (V2 §15, nunca recomendação confirmada).
  const laneSelection = useMemo(() => {
    if (!validLane || !lanesLoaded) return { rows: [] as Hero[], validated: false, reason: "lanes_not_loaded" };
    return selectLaneTopHeroesDetailed(listQuery.data?.data ?? [], lanesMap, laneKey, TOP_N);
  }, [listQuery.data, lanesLoaded, lanesEmpty, lanesMap, validLane, laneKey]);
  const laneHeroes: Hero[] = laneSelection.rows;

  // R3–R5 · um GET builds por herói do top-3, SÓ com aba ativa E rota escolhida.
  // Chamadas estáticas (sem loop/prefetch): teto N=3 enforced por construção.
  const qid0 = active && validLane && laneHeroes[0] != null ? String(laneHeroes[0].id) : null;
  const qid1 = active && validLane && laneHeroes[1] != null ? String(laneHeroes[1].id) : null;
  const qid2 = active && validLane && laneHeroes[2] != null ? String(laneHeroes[2].id) : null;
  const b0 = useBuilds(qid0, rank, laneKey);
  const b1 = useBuilds(qid1, rank, laneKey);
  const b2 = useBuilds(qid2, rank, laneKey);
  const buildQueries = [b0, b1, b2];

  const cards: CardState[] = laneHeroes.map((hero, i) => {
    const q = buildQueries[i];
    if (q.isLoading) return { kind: "loading" };
    // GE-P1-04: stale descartado — só renderiza o conjunto cuja (rank,lane,id) confere.
    // (id/rank/lane vêm no body em runtime; o tipo do hook declara só data+lane.)
    const body = q.data as unknown as
      | { id: number; rank: string; lane: string; data: Build[]; audit_status?: string }
      | undefined;
    const mismatch =
      body != null && (body.id !== hero.id || body.lane !== laneKey || body.rank !== rank);
    if (q.isError || mismatch) return { kind: "error", onRetry: () => q.refetch() };
    const builds = body?.data ?? [];
    if (!builds.length) {
      return {
        kind: "empty",
        motive: body == null ? "fonte indisponível nesta rota" : "sem builds catalogadas para este herói nesta rota",
      };
    }
    return {
      kind: "ready",
      hero,
      builds,
      audit: body?.audit_status ?? "audit_pending",
      unfiltered: !laneSelection.validated,
    };
  });

  const readyCards = cards.filter(
    (c): c is Extract<CardState, { kind: "ready" }> => c.kind === "ready",
  );
  const covered = readyCards.length;

  // Ícones por item id (para as fileiras de trincas): montado dos builds já
  // buscados (R3–R5), sem request extra; id sem ícone = selo #id honesto.
  const iconMap = useMemo(() => {
    const m = new Map<number, { icon: string | null; name: string | null }>();
    for (const c of readyCards) {
      for (const b of c.builds) {
        for (const it of b.items ?? []) {
          if (it && typeof it.id === "number" && !m.has(it.id)) {
            m.set(it.id, { icon: it.icon ?? null, name: it.name ?? null });
          }
        }
      }
    }
    return m;
  }, [readyCards]);

  // Trincas em alta na rota (cobertura, não série temporal) — client-side sobre R3–R5.
  const trincaView = useMemo(() => {
    if (!validLane) return { rows: [], names: new Map<number, string>() };
    const ctxs: HeroItemsetContext[] = readyCards.map((c) => {
      const refs = refWinsOf(c.builds);
      return {
        heroId: c.hero.id,
        heroName: c.hero.name,
        builds: c.builds,
        refMostWin: refs.most,
        refMeanWin: refs.mean,
        rank,
        lane: laneKey,
      };
    });
    if (!ctxs.length) return { rows: [], names: new Map<number, string>() };
    return {
      rows: scoreRouteItemsets(ctxs),
      names: new Map<number, string>(ctxs.map((c) => [c.heroId, c.heroName])),
    };
  }, [validLane, rank, laneKey, laneHeroes, b0.data, b1.data, b2.data]);
  const trincas = trincaView.rows;

  const fichaHref = (heroId: number) =>
    `/hero/${heroId}?rank=${rank}&window=${window}&lane=${laneKey}&tab=builds`;

  return (
    <div className="space-y-3" role="tabpanel" aria-label="Builds por rota">
      {/* 1 · Seletor de rota OBRIGATÓRIO: 5 lanes, sem default, sem "todas". Rank herdado do filtro global. */}
      <IddZone zone="state" capId="CAP-BDL-01" className="card p-3.5 bg-panel border-line space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foam">
            Rota · elo {rank.toUpperCase()}
          </h3>
          <span className="text-[10px] font-mono text-mist">sem rota, sem builds · 0 requests de builds até escolher</span>
        </div>
        {!validLane ? (
          <NeedsLane capId="CAP-BDL-01" onPick={pickLane} />
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Trocar de rota">
            {(LANES as readonly string[]).map((l) => {
              const on = laneKey === l;
              return (
                <button
                  key={l}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pickLane(l)}
                  className={on
                    ? "px-2.5 py-1 rounded-lg text-[11px] font-mono border border-gold/60 text-gold bg-gold/10"
                    : "px-2.5 py-1 rounded-lg text-[11px] font-mono border border-line text-mist bg-abyss/40 hover:border-gold/40 hover:text-foam transition-colors"}
                >
                  {l}
                </button>
              );
            })}
          </div>
        )}
        {lanesEmpty && validLane ? (
          <p className="text-[11px] text-amber-200" role="note">
            Rotas indisponíveis — top-3 sem filtro de rota (rota não filtrada). Números exibidos com a rota explícita {laneKey}.
          </p>
        ) : null}
      </IddZone>

      {!validLane ? (
        <Empty
          title="Escolha a rota"
          hint="A visão global de builds é um hub por rota: selecione exp, mid, roam, jungle ou gold acima. Nenhum build foi buscado — lifts só existem dentro de rank+rota (0 requests de builds até escolher)."
        />
      ) : (
        <>
          {/* 2 · Trincas em alta na rota (cobertura, não série temporal) */}
          <IddZone zone="data" capId="CAP-BDL-01" className="card p-4 bg-panel border-line space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foam">
                Trincas em alta na rota (cobertura, não série temporal)
              </h3>
              <span className="text-[10px] font-mono text-mist" title="Fórmula descritiva versionada">itemset-score-v1</span>
            </div>
            {buildQueries.some((q) => q.isLoading) && !readyCards.length ? (
              <Loading rows={3} />
            ) : !trincas.length ? (
              <p className="text-xs text-mist leading-relaxed" role="status">
                Nenhuma trinca com cobertura mínima nesta rota (corte: em ao menos 2/3 heróis ou 3 builds amostradas).
                Cobertura conta builds/heróis amostrados — nunca N de partidas.
              </p>
            ) : (
              <ol className="flex flex-wrap gap-2.5">
                {trincas.map((t) => {
                  const names = t.itemNames.map((n, i) => n ?? `#${t.itemIds[i]}`);
                  const title =
                    `Trinca ${names.join(" · ")} — em ${t.m} builds de ${t.k}/${TOP_N} heróis da ${laneKey} ` +
                    `(cobertura, não partidas) · refs por herói na ficha`;
                  const firstHero = t.perHero[0]?.heroId;
                  return (
                    <li key={t.itemIds.join("+")}>
                      <Link
                        to={firstHero != null ? fichaHref(firstHero) : "#"}
                        title={title}
                        aria-label={title}
                        className="flex items-center gap-1.5 rounded-xl bg-abyss/60 border border-line hover:border-gold/40 transition-colors p-2"
                      >
                        {t.itemIds.map((id) => {
                          const meta = iconMap.get(id);
                          return meta?.icon ? (
                            <img
                              key={id}
                              src={meta.icon}
                              alt={meta.name ?? `Item #${id}`}
                              title={meta.name ?? `Item #${id}`}
                              className="w-10 h-10 rounded-xl border border-line object-cover shadow-sm"
                              loading="lazy"
                            />
                          ) : (
                            <span
                              key={id}
                              className="w-10 h-10 rounded-xl border border-line flex items-center justify-center text-[10px] font-mono text-mist bg-abyss"
                            >
                              #{id}
                            </span>
                          );
                        })}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </IddZone>

          {/* 3 · Cobertura X/3 — top-3 θ̂ da rota com builds; falha da fonte à mostra */}
          <IddZone zone="data" capId="CAP-BDL-01" className="card p-4 bg-panel border-line space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foam">
                Top-3 θ̂ da {laneKey} com builds
              </h3>
              <span className="text-[11px] font-mono text-gold" role="status">
                {covered}/{TOP_N} com builds nesta rota{covered < TOP_N ? ` · ${TOP_N - covered} sem cobertura` : ""}
              </span>
            </div>
            {listQuery.isLoading ? (
              <Loading rows={3} />
            ) : listQuery.isError ? (
              <ErrBox onRetry={() => listQuery.refetch()} />
            ) : !laneHeroes.length ? (
              <Empty
                title="Nenhum dos top-3 tem builds nesta rota"
                hint="Sem heróis da rota no recorte ou fonte indisponível. Troque de rota ou abra as fichas."
              />
            ) : cards.every((c) => c.kind === "empty" || c.kind === "error") ? (
              <Empty
                title="Nenhum dos top-3 tem builds nesta rota"
                hint="Os três heróis retornaram fonte indisponível ou sem builds catalogadas. Troque de rota ou abra as fichas com a mesma rota."
              />
            ) : !readyCards.length ? (
              <p className="text-[11px] text-mist" role="status">Aguardando builds do top-3…</p>
            ) : (
              <ul className="grid gap-2.5 lg:grid-cols-3">
                {cards.map((c, i) => {
                  const hero = laneHeroes[i];
                  if (!hero) return null;
                  if (c.kind === "loading") {
                    return (
                      <li key={hero.id}>
                        <Loading rows={2} />
                      </li>
                    );
                  }
                  if (c.kind === "error") {
                    return (
                      <li key={hero.id}>
                        <ErrBox onRetry={c.onRetry} />
                      </li>
                    );
                  }
                  if (c.kind === "empty") {
                    return (
                      <li key={hero.id} className="card p-3.5 bg-panel2/40 border-line space-y-2">
                        <div className="flex items-center gap-2">
                          <Avatar src={hero.head} name={hero.name} size={32} />
                          <span className="text-xs font-bold text-foam">{hero.name}</span>
                          <TierBadge tier={hero.tier} />
                        </div>
                        <p className="text-[11px] text-mist">{c.motive}</p>
                        <Link to={fichaHref(hero.id)} className="btn-ghost text-[11px]">
                          Ver ficha →
                        </Link>
                      </li>
                    );
                  }
                  return (
                    <li key={hero.id} className="card p-3.5 bg-panel2/40 border-line space-y-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Avatar src={hero.head} name={hero.name} size={32} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-bold text-foam truncate">{hero.name}</span>
                          <span className="block text-[11px] text-mist font-mono">
                            θ̂ {num(hero.wrAdj, 3)}{c.unfiltered ? " · rota não filtrada" : ""}
                          </span>
                        </span>
                        <TierBadge tier={hero.tier} />
                      </div>
                      <div className="space-y-2">
                        {c.builds.slice(0, LINES_PER_HERO).map((b, bi) => (
                          <BuildLine key={bi} b={b} rank={rank} lane={laneKey} />
                        ))}
                      </div>
                      <Link
                        to={fichaHref(hero.id)}
                        className="btn-ghost text-[11px]"
                        aria-label={`Ver ficha de ${hero.name} nesta rota`}
                      >
                        Ver ficha de {hero.name} nesta rota →
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </IddZone>

        </>
      )}
    </div>
  );
}
