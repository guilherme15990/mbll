import { useSearchParams } from "react-router-dom";
import { Clock } from "lucide-react";
import { cx, pct, useMatchups, type Pair } from "../../../shared/api";
import { Empty, ErrBox, Loading } from "../../../shared/ui";
import { DurationChart } from "../../../shared/ui/patterns/charts";
import { NeedsRank } from "../../../shared/ui/patterns/NeedsRankLane";
import {
  hasFiniteDelta, sortPairsByDeltaAsc, sortPairsByDeltaDesc,
} from "@radar/proprietary-engine";
import {
  MATCHUP_TONE_BORDER, MATCHUP_TONE_TEXT, MatchupPairRow,
  MatchupToneIcon, profileLabel, type MatchupTone,
} from "./matchupAtoms";

type Tone = MatchupTone;

const PAIRS_PER_GROUP = 5;

function SectionHeader({
  rank,
  days,
  subtitle = "Quem evitar, quem combinar e onde o herói leva vantagem.",
}: {
  rank: string;
  days: string;
  subtitle?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="lbl">Confrontos · elo {rank.toUpperCase()} · janela {days}d</p>
      <h2 className="text-lg md:text-xl font-bold tracking-tight text-foam">Inimigos e aliados</h2>
      <p className="text-xs text-mist mt-0.5">{subtitle}</p>
    </div>
  );
}

function PairGroup({
  title,
  hint,
  pairs,
  tone,
}: {
  title: string;
  hint: string;
  pairs: Pair[];
  tone: Tone;
}) {
  if (!pairs.length) return null;
  const visible = pairs.slice(0, PAIRS_PER_GROUP);

  return (
    <section
      aria-label={title}
      className={cx("rounded-2xl border bg-panel overflow-hidden", MATCHUP_TONE_BORDER[tone])}
    >
      <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line/70">
        <div className="flex items-center gap-2 min-w-0">
          <MatchupToneIcon tone={tone} />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foam truncate">{title}</h3>
            <p className="text-[11px] text-mist truncate">{hint}</p>
          </div>
        </div>
        <span className="text-[11px] font-mono text-mist shrink-0">n={visible.length}</span>
      </header>
      <div className="p-3 space-y-2">
        {visible.map((p) => (
          <div
            key={p.pair_key ?? `${p.relationship_type}-${p.id}`}
            className="rounded-xl border border-line/70 bg-panel2/25 p-2.5"
          >
            <MatchupPairRow pair={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

function HighlightCard({
  label,
  hint,
  pair,
  empty,
  tone,
}: {
  label: string;
  hint: string;
  pair: Pair | undefined;
  empty: string;
  tone: Tone;
}) {
  return (
    <div className={cx("rounded-xl border bg-abyss/40 px-3 py-2.5 space-y-2", MATCHUP_TONE_BORDER[tone])}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-mist flex items-center gap-1.5 min-w-0">
          <MatchupToneIcon tone={tone} />
          <span className="truncate">{label}</span>
        </p>
        <span className={cx("text-[9px] font-bold uppercase tracking-wide shrink-0", MATCHUP_TONE_TEXT[tone])}>
          {hint}
        </span>
      </div>
      {pair ? (
        <MatchupPairRow pair={pair} showPick={false} />
      ) : (
        <p className="text-[11px] text-mist">{empty}</p>
      )}
    </div>
  );
}

/**
 * Aba Confrontos da ficha isolada — 1 busca de detalhe (pares) + herói compartilhado.
 * Leitura operacional: destaques no topo, grupos por relação e duração de referência.
 * Par ausente = "—", nunca 0. Grupos vazios não ocupam espaço; o vazio global orienta.
 */
export default function ConfrontosSection({
  heroId,
  rank,
  window,
}: {
  heroId: string;
  rank: string;
  window: string;
}) {
  const [sp, setSp] = useSearchParams();
  const days = sp.get("days") ?? window;
  const q = useMatchups(rank === "all" ? null : heroId || null, rank, days);

  if (!heroId) return <Empty title="Sem herói" hint="Volte à visão geral e escolha um herói." />;

  if (rank === "all") {
    return (
      <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Confrontos do herói">
        <header className="rounded-2xl border border-line bg-panel p-4 md:p-5">
          <SectionHeader
            rank={rank}
            days={days}
            subtitle="Confrontos exigem elo explícito — counters e sinergias ficam sem número."
          />
        </header>
        <NeedsRank
          hint="Escolha um elo para liberar counters e sinergias."
          onPick={(r) => {
            sp.set("rank", r);
            setSp(sp);
          }}
        />
      </section>
    );
  }

  if (q.isLoading) {
    return (
      <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Confrontos do herói">
        <header className="rounded-2xl border border-line bg-panel p-4 md:p-5">
          <SectionHeader rank={rank} days={days} />
        </header>
        <Loading rows={4} />
      </section>
    );
  }

  if (q.isError || !q.data) {
    return (
      <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Confrontos do herói">
        <header className="rounded-2xl border border-line bg-panel p-4 md:p-5">
          <SectionHeader rank={rank} days={days} />
        </header>
        <ErrBox
          onRetry={() => q.refetch()}
          message="A fonte de counters e sinergias não respondeu. Nenhum par foi avaliado neste recorte."
        />
      </section>
    );
  }

  const m = q.data;
  // Ordenação/seleção por δ em `@radar/proprietary-engine` (matchup-ordering).
  // Destaques só com δ finito: par sem sinal não vira "pior/melhor".
  const worst = sortPairsByDeltaAsc(m.countersDown ?? []).find(hasFiniteDelta);
  const bestSyn = sortPairsByDeltaDesc(m.synergiesUp ?? []).find(hasFiniteDelta);
  const anti = sortPairsByDeltaAsc(m.synergiesDown ?? []).find(hasFiniteDelta);
  const refCurve = [
    ...(m.synergiesUp ?? []),
    ...(m.countersUp ?? []),
    ...(m.synergiesDown ?? []),
    ...(m.countersDown ?? []),
  ].find((p) => p.curve?.length);
  const threatCount = (m.countersDown?.length ?? 0) + (m.synergiesDown?.length ?? 0);
  const favorCount = (m.countersUp?.length ?? 0) + (m.synergiesUp?.length ?? 0);
  const totalPairs = threatCount + favorCount;
  const hasAnyPair = totalPairs > 0;
  const groups: { title: string; hint: string; pairs: Pair[]; tone: Tone }[] = [
    { title: "Piores counters", hint: "Inimigos que punem o herói", pairs: sortPairsByDeltaAsc(m.countersDown ?? []), tone: "threat" as Tone },
    { title: "Anti-sinergias", hint: "Aliados com associação negativa", pairs: sortPairsByDeltaAsc(m.synergiesDown ?? []), tone: "warning" as Tone },
    { title: "Melhores sinergias", hint: "Aliados que elevam o rendimento", pairs: sortPairsByDeltaDesc(m.synergiesUp ?? []), tone: "synergy" as Tone },
    { title: "Melhores vantagens", hint: "Inimigos que o herói pune", pairs: sortPairsByDeltaDesc(m.countersUp ?? []), tone: "advantage" as Tone },
  ].filter((g) => g.pairs.length > 0);

  return (
    <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Confrontos do herói">
      <header className="rounded-2xl border border-line bg-panel p-4 md:p-5 space-y-3">
        <SectionHeader rank={rank} days={days} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <HighlightCard
            label="Pior counter"
            hint="evite"
            tone="threat"
            pair={worst}
            empty="Sem counter com δ"
          />
          <HighlightCard
            label="Melhor sinergia"
            hint="combine"
            tone="synergy"
            pair={bestSyn}
            empty="Sem sinergia com δ"
          />
          <HighlightCard
            label="Anti-sinergia"
            hint="separe"
            tone="warning"
            pair={anti}
            empty="Sem anti-sinergia com δ"
          />
        </div>
      </header>

      {hasAnyPair ? (
        <div className={`grid gap-3 items-start ${groups.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {groups.map((g) => (
            <PairGroup key={g.title} title={g.title} hint={g.hint} pairs={g.pairs} tone={g.tone} />
          ))}
        </div>
      ) : (
        <Empty
          title="Nenhum par catalogado neste recorte"
          hint="Sem confrontos com volume suficiente para herói + elo + janela. Experimente outro elo ou janela."
        />
      )}

      {refCurve?.curve?.length ? (
        <section className="rounded-2xl border border-line bg-panel overflow-hidden" aria-label="Duração no par de referência">
          <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line/70 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <Clock size={14} className="text-cyan-300 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-foam">Duração no par de referência</h3>
                <p className="text-[11px] text-mist truncate">
                  {refCurve.name} · perfil {profileLabel(refCurve.profile)}
                </p>
              </div>
            </div>
            <span className="text-[11px] text-mist font-mono shrink-0">
              {refCurve.curve.length} faixas
            </span>
          </header>
          <div className="p-4 space-y-3">
            <DurationChart curve={refCurve.curve} heroWin={refCurve.win ?? 0.5} />
            <p className="text-[11px] text-mist text-center">
              Associação por faixa de duração — não causal.
            </p>
          </div>
        </section>
      ) : null}

      {refCurve?.curve?.length ? (
        <section className="rounded-2xl border border-line bg-panel overflow-hidden" aria-label="Tabela por faixa de duração">
          <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line/70">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foam">Tabela por faixa</h3>
              <p className="text-[11px] text-mist truncate">
                {refCurve.name} · perfil {profileLabel(refCurve.profile)}
              </p>
            </div>
            <span className="text-[11px] text-mist font-mono shrink-0">{refCurve.curve.length} faixas</span>
          </header>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-mist uppercase tracking-wider text-[10px]">
                  <th className="px-2 py-1">Faixa</th>
                  <th className="px-2 py-1">Win</th>
                </tr>
              </thead>
              <tbody>
                {refCurve.curve.map((c) => (
                  <tr key={c.label} className="border-t border-line/60">
                    <td className="px-2 py-1 text-foam">{c.label}</td>
                    <td className="px-2 py-1 font-mono text-foam">{pct(c.win, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  );
}
