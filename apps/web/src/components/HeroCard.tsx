import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { num, pct, useMatchups, useTrends, type Hero, type TrendPoint } from "../lib/api";
import { TREND_N, classOf, dominantProfileOf, trendOfDated } from "@radar/proprietary-engine";
import { Avatar, ClassSeal, DomainStateBadge, TierBadge, TrustSeal, type TrustLevel } from "./ui";

// Derivação em `@radar/proprietary-engine` (trendOfDated — Theil–Sen com datas reais,
// V2 §11); geometria SVG sparkPath é presentacional e fica aqui.

function sparkPath(wins: number[], w: number, h: number, pad: number): string {
  if (!wins.length) return "";
  const min = Math.min(...wins);
  const max = Math.max(...wins);
  const span = max - min < 1e-9 ? 1 : max - min;
  return wins
    .map((v, i) => {
      const x = wins.length === 1 ? w / 2 : pad + (i / (wins.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * Faísca de tendência por herói — 1 request por card VISÍVEL.
 * IntersectionObserver liga/desliga o `useTrends` (enabled = visível).
 * Sem prefetch da grade: cards fora da viewport nunca disparam fetch.
 */
function HeroTrend({ heroId, rank, days }: { heroId: number; rank: string; days: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setVisible(entry ? entry.isIntersecting : false);
      },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const q = useTrends(visible ? String(heroId) : null, rank, days);
  const title = `${TREND_N} pontos · janela ${days}d`;

  if (!visible || q.isLoading) {
    return (
      <div ref={boxRef} className="flex items-center gap-1.5" title={visible ? "carregando série…" : title} aria-label="tendência carregando">
        <svg width="72" height="22" viewBox="0 0 72 22" aria-hidden="true" className="text-mist/40">
          <line x1="2" y1="11" x2="70" y2="11" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        </svg>
        <span className="text-[11px] text-mist font-mono" aria-hidden="true">
          …
        </span>
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div ref={boxRef} className="flex items-center gap-1.5" title={`${title} · sem série neste recorte`} aria-label="tendência sem dado">
        <svg width="72" height="22" viewBox="0 0 72 22" aria-hidden="true" className="text-mist/40">
          <line x1="2" y1="11" x2="70" y2="11" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        </svg>
        <span className="text-[11px] text-mist font-mono">—</span>
        <span className="text-[11px] text-mist">sem dado</span>
      </div>
    );
  }

  const points: TrendPoint[] = q.data.data ?? [];
  // V2 §11.1: denominador em dias reais (lacunas não viram dias seguidos), 3 séries
  // separadas — a faísca usa só win_rate; pick/ban têm radar próprio na ficha.
  const radar = trendOfDated(points);
  const w = radar.win_rate;
  if (w.direction === "insufficient_data") {
    return (
      <div ref={boxRef} className="flex items-center gap-1.5" title={`${w.n_points} ponto(s) · janela ${days}d · sem série suficiente`} aria-label="tendência sem dado">
        <svg width="72" height="22" viewBox="0 0 72 22" aria-hidden="true" className="text-mist/40">
          <line x1="2" y1="11" x2="70" y2="11" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        </svg>
        <span className="text-[11px] text-mist font-mono">—</span>
        <span className="text-[11px] text-mist">sem dado</span>
      </div>
    );
  }

  const wins = points.filter((p) => Number.isFinite(p.win)).slice(-TREND_N).map((p) => p.win);
  const d = sparkPath(wins, 72, 22, 3);
  const dir = w.direction === "rising" ? "subindo" : w.direction === "falling" ? "caindo" : "estável";
  const color = dir === "subindo" ? "text-emerald-300" : dir === "caindo" ? "text-rose-300" : "text-slate-300";
  const Icon = dir === "subindo" ? TrendingUp : dir === "caindo" ? TrendingDown : Minus;
  const word = dir;
  const markerId = `trend-arr-${heroId}`;

  return (
    <div ref={boxRef} className={`flex items-center gap-1.5 ${color}`} title={`${w.n_points} pontos · ${w.window_days}d reais · ${word} (${w.delta_pp_window ?? "—"} pp)`} aria-label={`tendência ${word}, ${w.n_points} pontos em ${days} dias`}>
      <svg width="72" height="22" viewBox="0 0 72 22" aria-hidden="true" className="shrink-0">
        <defs>
          <marker id={markerId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L6,3 L0,6 z" fill="currentColor" />
          </marker>
        </defs>
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#${markerId})`} />
      </svg>
      <Icon size={13} aria-hidden="true" className="shrink-0" />
      <span className="text-[11px] font-medium">{word}</span>
    </div>
  );
}

/**
 * Perfil dominante do herói (snowball/scaling/uniforme) — agregado honesto dos
 * pares listados em confrontos, 1 request por card VISÍVEL (mesmo padrão lazy
 * da faísca). Perfil existe por PAR, nunca na lista: o selo diz "N/M pares" e
 * aponta a ficha. Sem pares ou erro → sem selo (o link "perfil na ficha" segue abaixo).
 */
function HeroProfileChip({ heroId, rank, days }: { heroId: number; rank: string; days: string }) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setVisible(entry ? entry.isIntersecting : false);
      },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const q = useMatchups(visible ? String(heroId) : null, rank, days);
  if (!visible || q.isLoading) {
    return (
      <span ref={boxRef} className="text-[10px] font-mono text-mist/60" aria-label="perfil carregando">
        tipo: …
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
  // Agregação do perfil dominante em `@radar/proprietary-engine` (dominantProfileOf).
  const dom = dominantProfileOf(profs);
  if (!dom) return <span ref={boxRef} />;
  const { top, n } = dom;
  const total = dom.total;
  return (
    <span
      ref={boxRef}
      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-violet-400/50 text-violet-300 bg-violet-400/10"
      title={`perfil dominante entre os ${total} pares listados (fonte só expõe extremos); curva por par na ficha`}
      aria-label={`perfil dominante ${top}, ${n} de ${total} pares`}
    >
      tipo: {top} {n}/{total}
    </span>
  );
}

export type HeroTrust = { level: TrustLevel; motive: string };

/**
 * Card de herói da grade do /dashboard.
 * Reaproveita o objeto `Hero` já carregado pelo `useHeroes` da página
 * (nenhum fetch novo de lista aqui). O único fetch deste card é a
 * faísca de tendência, lazy por viewport (ver `HeroTrend`).
 * `lanes` (opcional) vem do mapa `/heroes/lanes` já carregado pela
 * página — selo só p/ lane mapeada; herói sem lane não recebe selo.
 */
export default function HeroCard({ hero, rank, window, trust, lanes, indexN }: { hero: Hero; rank: string; window: string; trust: HeroTrust; lanes?: string[]; indexN?: number }) {
  const detalhesTo = `/hero/${hero.id}?rank=${rank}&window=${window}`;
  // Perfil de duração (snowball/scaling/uniforme) existe por PAR em confrontos,
  // nunca na lista — link p/ a aba certa da ficha em vez de selo fabricado.
  const perfilTo = `/hero/${hero.id}?rank=${rank}&window=${window}&tab=confrontos`;

  return (
    <article className="card card-h p-3.5 bg-panel border-line space-y-2.5" aria-label={`Herói ${hero.name}`}>
      <div className="flex items-center gap-2.5">
        <Avatar src={hero.head} name={hero.name} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-foam truncate">{hero.name}</span>
          <span className="block text-[11px] text-mist font-mono" title="Força estimada (shrinkage) na grade c">
            θ̂ {num(hero.wrAdj, 3)}
          </span>
        </span>
        {/* Índice 0–100 ADR-024: percentil do θ̂ no meta (posição, não probabilidade) */}
        <span
          className="text-right shrink-0"
          title={`Índice de força ${hero.strength_index ?? "—"} de 0–100: posição normalizada do θ̂ entre ${indexN ?? "?"} heróis do meta ${rank.toUpperCase()}, janela ${window}d (strength-index-v1, empates dividem posição). Posição, nunca probabilidade.`}
          aria-label={typeof hero.strength_index === "number" ? `Índice de força ${hero.strength_index} de 100` : "Índice de força sem dado"}
        >
          <span className="block num text-xl font-bold text-gold leading-none">
            {typeof hero.strength_index === "number" ? num(hero.strength_index, 1) : "—"}
          </span>
          <span className="block text-[9px] uppercase tracking-wider text-mist mt-0.5">índice</span>
        </span>
        <TierBadge tier={hero.tier} />
        <HeroProfileChip heroId={hero.id} rank={rank} days={window} />
      </div>

      {/* Rotas do herói (múltiplas): linha própria abaixo do nome; sem lane = sem linha. */}
      {(lanes ?? []).length ? (
        <p className="flex items-center gap-1.5 flex-wrap" aria-label={`Rotas: ${(lanes ?? []).join(", ")}`}>
          <span className="text-[10px] text-mist">rotas:</span>
          {(lanes ?? []).map((l) => (
            <DomainStateBadge key={l} status="neutral" label={l} />
          ))}
        </p>
      ) : null}

      {/* Selos do que a lista já traz: classe + estados (sem request por herói). */}
      <div className="flex items-center gap-1.5 flex-wrap" aria-label="Selos do herói">
        <ClassSeal cls={classOf(hero)} />
        {hero.isGem ? <DomainStateBadge status="gem" label="joia" /> : null}
        {hero.smallSample ? <DomainStateBadge status="inconclusive" label="amostra pequena" /> : null}
        {hero.degenerate ? <DomainStateBadge status="warning" label="taxa degenerada" /> : null}
      </div>

      {/* Valores calculados pelo sistema (shrinkage M1), como na tela de Força. */}
      <p
        className="text-[10px] font-mono text-mist"
        title="B = quanto a estimativa foi puxada à média (0 = dado puro, 1 = só média); z = distância da média em erros-padrão; q = taxa de falsa descoberta (BH)"
        aria-label={`Fator B ${num(hero.B, 2)}, z ${num(hero.z, 2)}, q ${num(hero.q, 4)}`}
      >
        B {num(hero.B, 2)} · z {num(hero.z, 2)} · q {num(hero.q, 4)}
      </p>

      <dl className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-lg bg-abyss/60 border border-line px-1 py-1">
          <dt className="text-[9px] uppercase tracking-wider text-mist">win obs.</dt>
          <dd className="text-[11px] font-mono text-foam">{Number.isFinite(hero.win) ? pct(hero.win, 1) : "—"}</dd>
        </div>
        <div className="rounded-lg bg-abyss/60 border border-line px-1 py-1">
          <dt className="text-[9px] uppercase tracking-wider text-mist">pick</dt>
          <dd className="text-[11px] font-mono text-foam">{Number.isFinite(hero.pick) ? pct(hero.pick, 1) : "—"}</dd>
        </div>
        <div className="rounded-lg bg-abyss/60 border border-line px-1 py-1">
          <dt className="text-[9px] uppercase tracking-wider text-mist">ban</dt>
          <dd className="text-[11px] font-mono text-foam">{Number.isFinite(hero.ban) ? pct(hero.ban, 1) : "—"}</dd>
        </div>
      </dl>
      <p className="text-[10px] font-mono text-mist" title="Unidade de exposição da fonte">
        slot_share·unvalidated
      </p>

      <HeroTrend heroId={hero.id} rank={rank} days={window} />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <TrustSeal level={trust.level} motive={trust.motive} />
        <span className="inline-flex items-center gap-1.5">
          <Link
            to={perfilTo}
            className="text-[11px] text-mist hover:text-gold transition-colors"
            title="Curva de duração por par (snowball/scaling/uniforme) só na ficha"
            aria-label={`Ver perfil de duração de ${hero.name} na ficha`}
          >
            perfil na ficha →
          </Link>
          <Link
            to={detalhesTo}
            className="btn-ghost !py-1 !px-2.5 text-[11px] inline-flex items-center gap-1"
            aria-label={`Abrir detalhes de ${hero.name}`}
          >
            Detalhes <ChevronRight size={13} aria-hidden="true" />
          </Link>
        </span>
      </div>
    </article>
  );
}
