import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { num, pct, useMatchups, useTrends, type Hero } from "../../shared/api";
import { classOf, dominantProfileOf, trendOfDated } from "@radar/engine";
import { withLanes } from "../../app/filters";
import { Avatar, ClassSeal, DomainStateBadge, TierBadge } from "../../shared/ui";

/**
 * Visibilidade na viewport (fetch lazy por card). UM IntersectionObserver de
 * módulo atende todos os cards — antes eram 2 observers por card (~100 por página).
 * Sem suporte a IntersectionObserver, assume visível (degrada p/ fetch imediato).
 */
let viewObserver: IntersectionObserver | null = null;
const viewWatchers = new WeakMap<Element, (visible: boolean) => void>();

function observeView(el: Element, cb: (visible: boolean) => void): () => void {
  if (typeof IntersectionObserver === "undefined") {
    cb(true);
    return () => {};
  }
  if (!viewObserver) {
    viewObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) viewWatchers.get(entry.target)?.(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
  }
  viewWatchers.set(el, cb);
  viewObserver.observe(el);
  return () => {
    viewWatchers.delete(el);
    viewObserver?.unobserve(el);
  };
}

function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observeView(el, setVisible);
  }, []);
  return [ref, visible] as const;
}

/**
 * Tendência por herói — 1 request por card VISÍVEL.
 * `useTrends` só é habilitado quando o card entra na viewport (id null = pausado).
 * Sem prefetch da grade: cards fora da viewport nunca disparam fetch.
 * A UI mostra só a direção (subindo/caindo/estável); números no tooltip.
 */
function HeroTrend({ heroId, rank, days }: { heroId: number; rank: string; days: string }) {
  const [boxRef, visible] = useInView<HTMLSpanElement>();

  const q = useTrends(visible ? String(heroId) : null, rank, days, {
    staleTime: 15 * 60e3,
    retry: 0,
  });

  if (!visible || q.isLoading) {
    return <span ref={boxRef} role="img" className="text-[11px] text-mist" title="carregando série…" aria-label="tendência carregando">…</span>;
  }
  if (q.isError || !q.data) {
    return <span ref={boxRef} role="img" className="text-[11px] text-mist" aria-label="tendência sem dado">sem dado</span>;
  }

  // V2 §11.1: denominador em dias reais (lacunas não viram dias seguidos).
  const w = trendOfDated(q.data.data ?? []).win_rate;
  if (w.direction === "insufficient_data") {
    return (
      <span ref={boxRef} role="img" className="text-[11px] text-mist" title={`${w.n_points} ponto(s) · janela ${days}d · sem série suficiente`} aria-label="tendência sem dado">
        sem dado
      </span>
    );
  }

  const word = w.direction === "rising" ? "subindo" : w.direction === "falling" ? "caindo" : "estável";
  const tone = word === "subindo"
    ? "text-emerald-300 border-emerald-400/30"
    : word === "caindo"
    ? "text-rose-300 border-rose-400/30"
    : "text-slate-300 border-line";

  return (
    <span
      ref={boxRef}
      role="img"
      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-abyss/40 ${tone}`}
      title={`${w.n_points} pontos · ${w.window_days}d reais · ${word} (${w.delta_pp_window ?? "—"} pp)`}
      aria-label={`tendência ${word}, ${w.n_points} pontos em ${days} dias`}
    >
      {word}
    </span>
  );
}

/**
 * Perfil dominante do herói (snowball/scaling/uniforme) — agregado honesto dos
 * pares listados em confrontos, 1 request por card VISÍVEL (mesmo padrão lazy
 * da tendência). Perfil existe por PAR, nunca na lista: o selo mostra só o nome
 * ("Scaling"); a contagem de pares fica no tooltip/aria. Sem pares ou erro →
 * sem selo.
 */
function HeroProfileChip({ heroId, rank, days }: { heroId: number; rank: string; days: string }) {
  const [boxRef, visible] = useInView<HTMLSpanElement>();

  const q = useMatchups(visible ? String(heroId) : null, rank, days, {
    staleTime: 15 * 60e3,
    retry: 0,
  });
  if (!visible || q.isLoading) {
    return (
      <span ref={boxRef} role="img" className="text-[10px] font-mono text-mist/60" aria-label="perfil carregando">
        …
      </span>
    );
  }
  if (q.isError || !q.data) return <span ref={boxRef} />;
  const pairs = [
    ...(q.data.countersUp ?? []),
    ...(q.data.countersDown ?? []),
    ...(q.data.synergiesUp ?? []),
    ...(q.data.synergiesDown ?? []),
  ];
  const profs = pairs
    .map((p) => p.profile)
    .filter((p): p is "snowball" | "scaling" | "uniforme" => p === "snowball" || p === "scaling" || p === "uniforme");
  // Agregação do perfil dominante em `@radar/engine` (dominantProfileOf).
  const dom = dominantProfileOf(profs);
  if (!dom) return <span ref={boxRef} />;
  const { top, n } = dom;
  const total = dom.total;
  // Só o nome do perfil no selo; contagem de pares fica no tooltip/aria.
  const label = top.charAt(0).toUpperCase() + top.slice(1);
  return (
    <span
      ref={boxRef}
      role="img"
      className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-violet-400/50 text-violet-300 bg-violet-400/10"
      title={`perfil dominante entre os ${total} pares listados (fonte só expõe extremos); curva por par na ficha`}
      aria-label={`perfil dominante ${label}, ${n} de ${total} pares`}
    >
      {label}
    </span>
  );
}

/**
 * Card de herói da grade do /dashboard.
 * Reaproveita o objeto `Hero` já carregado pelo `useHeroes` da página
 * (nenhum fetch novo de lista aqui). Fetches do card, ambos lazy por
 * viewport: direção da tendência (`HeroTrend`) e perfil de duração
 * (`HeroProfileChip`).
 * `lanes` (opcional) vem do mapa `/heroes/lanes` já carregado pela
 * página — selo só p/ lane mapeada; herói sem lane não recebe selo.
 *
 * Hierarquia de leitura: índice (0–100) como métrica primária; tier e tipo
 * de herói ao lado do nome; win/pick/ban e tendência em blocos próprios.
 * θ̂ (wrAdj) e diagnósticos B/z/q ficam no tooltip do índice — precisão sem
 * poluir a leitura de panorama.
 */
export default function HeroCard({ hero, rank, window, lanes, filterLanes, indexN }: { hero: Hero; rank: string; window: string; lanes?: string[]; filterLanes?: string[]; indexN?: number }) {
  const detalhesTo = withLanes(`/hero/${hero.id}?rank=${rank}&window=${window}`, filterLanes ?? []);
  const idx = typeof hero.strength_index === "number" ? hero.strength_index : null;
  // Classe só quando discrimina: "Na media" é o padrão do lote, e Joia/Amostra
  // pequena já aparecem como flags próprios abaixo.
  const cls = classOf(hero);
  const showCls = cls === "Forte" || cls === "Fraco";

  return (
    <article className="card card-h h-full flex flex-col gap-3 p-3.5 bg-panel border-line" aria-label={`Herói ${hero.name}`}>
      {/* Identidade + índice em destaque: índice é posição no meta (0–100), não probabilidade. */}
      <div className="flex items-start gap-3">
        <Avatar src={hero.head} name={hero.name} size={44} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-foam truncate">{hero.name}</span>
            <TierBadge tier={hero.tier} />
            <HeroProfileChip heroId={hero.id} rank={rank} days={window} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {showCls ? <ClassSeal cls={cls} /> : null}
            {hero.isGem ? <DomainStateBadge status="gem" label="joia" /> : null}
            {hero.smallSample ? <DomainStateBadge status="inconclusive" label="amostra pequena" /> : null}
            {hero.degenerate ? <DomainStateBadge status="warning" label="taxa degenerada" /> : null}
          </div>
        </div>
        <div
          className="text-right shrink-0"
          title={`Índice de força ${idx ?? "—"} de 0–100: posição do θ̂ (${num(hero.wrAdj, 3)}) entre ${indexN ?? "?"} heróis do meta ${rank.toUpperCase()}, janela ${window}d (strength-index-v1, empates dividem posição). B ${num(hero.B, 2)} · z ${num(hero.z, 2)} · q ${num(hero.q, 4)}. Posição, nunca probabilidade.`}
        >
          {/* Número visível é só o valor; o rótulo entra pelo sr-only (div+aria-label
              sem role é ignorado por parte dos leitores de tela). */}
          <span className="sr-only">
            {idx !== null ? `Índice de força ${num(idx, 1)} de 100` : "Índice de força sem dado"}
          </span>
          <span aria-hidden="true" className="block num text-2xl font-bold text-gold leading-none">{idx !== null ? num(idx, 1) : "—"}</span>
          <span aria-hidden="true" className="block text-[10px] uppercase tracking-wider text-mist mt-0.5">índice</span>
          {idx !== null ? (
            <span aria-hidden="true" className="block h-1 w-16 ml-auto mt-1 rounded-full bg-abyss overflow-hidden">
              <span className="block h-full rounded-full bg-gold/70" style={{ width: `${Math.max(0, Math.min(100, idx))}%` }} />
            </span>
          ) : null}
        </div>
      </div>

      {/* Rotas do herói (múltiplas): sem lane = sem linha. */}
      {(lanes ?? []).length ? (
        <p className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-mist">rotas</span>
          {(lanes ?? []).map((l) => (
            <DomainStateBadge key={l} status="neutral" label={l} />
          ))}
        </p>
      ) : null}

      {/* Números-chave da faixa (unidade só no tooltip: win = partidas com vitória;
          pick = participação nos slots de herói — slot_share, denominador não
          validado; ban = fração de partidas com ban). */}
      <dl className="grid grid-cols-3 gap-1.5 text-center" aria-label="Win, pick e ban do herói">
        <div className="rounded-lg bg-abyss/60 border border-line px-1 py-1.5">
          <dt className="text-[10px] uppercase tracking-wider text-mist">win</dt>
          <dd className="text-sm font-bold text-foam" title="win rate observado na janela (sem ajuste de shrinkage)">
            {Number.isFinite(hero.win) ? pct(hero.win, 1) : "—"}
          </dd>
        </div>
        <div className="rounded-lg bg-abyss/60 border border-line px-1 py-1.5">
          <dt className="text-[10px] uppercase tracking-wider text-mist">pick</dt>
          <dd className="text-sm font-bold text-foam" title="pick = participação nos slots de herói da partida (slot_share; denominador de partidas não validado)">
            {Number.isFinite(hero.pick) ? pct(hero.pick, 1) : "—"}
          </dd>
        </div>
        <div className="rounded-lg bg-abyss/60 border border-line px-1 py-1.5">
          <dt className="text-[10px] uppercase tracking-wider text-mist">ban</dt>
          <dd className="text-sm font-bold text-foam" title="ban = fração de partidas da faixa em que o herói foi banido">
            {Number.isFinite(hero.ban) ? pct(hero.ban, 1) : "—"}
          </dd>
        </div>
      </dl>

      {/* Tendência (subindo / caindo / estável) — só a palavra; números no tooltip. */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-mist">tendência</span>
        <HeroTrend heroId={hero.id} rank={rank} days={window} />
      </div>

      <div className="mt-auto flex items-center justify-end gap-2 flex-wrap">
        <Link
          to={detalhesTo}
          className="btn-ghost !py-1 !px-2.5 text-[11px] inline-flex items-center gap-1"
          aria-label={`Abrir detalhes de ${hero.name}`}
        >
          Detalhes <ChevronRight size={13} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
