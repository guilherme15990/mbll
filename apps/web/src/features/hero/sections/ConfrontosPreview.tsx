import { Link, useSearchParams } from "react-router-dom";
import { ShieldCheck, Swords, TriangleAlert } from "lucide-react";
import { cx, pct, RANKS, useMatchups, type Pair } from "../../../lib/api";
import { Avatar } from "../../../shared/ui";
import {
  hasFiniteDelta, selectTopCountersByDelta, selectTopSynergiesByDelta,
  sortPairsByDeltaAsc, sortPairsByDeltaDesc,
} from "@radar/proprietary-engine";
import {
  MATCHUP_TONE_BORDER, MATCHUP_TONE_SURFACE, MATCHUP_TONE_TEXT, fmtDelta,
  MatchupDeltaChip, MatchupPairRow, MatchupToneIcon, profileLabel, type MatchupTone,
} from "./matchupAtoms";

/**
 * Prévia de Confrontos da visão geral (capa da ficha).
 * Job: em 5s, mostrar o pior contra e o melhor com — e o recorte que qualifica
 * ambos. Não duplica a aba: só 2 focos + resíduos compactos + atalho.
 * Sem elo explícito (`rank=all`) nenhum matchup é buscado (mesma regra da aba).
 */
function FocalPair({
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
  tone: MatchupTone;
}) {
  return (
    <div className={cx("rounded-xl border p-2.5 space-y-1.5", MATCHUP_TONE_BORDER[tone], MATCHUP_TONE_SURFACE[tone])}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-mist flex items-center gap-1.5 min-w-0">
          <MatchupToneIcon tone={tone} size={12} />
          <span className="truncate">{label}</span>
        </p>
        <span className={cx("text-[9px] font-bold uppercase tracking-wide shrink-0", MATCHUP_TONE_TEXT[tone])}>
          {hint}
        </span>
      </div>
      {pair ? (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar src={pair.head} name={pair.name} size={34} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-foam truncate">{pair.name}</p>
            <p className="text-[10px] text-mist truncate">
              WR {pct(pair.win, 0)} · {profileLabel(pair.profile)}
            </p>
          </div>
          <MatchupDeltaChip delta={pair.delta} />
        </div>
      ) : (
        <p className="text-[11px] text-mist">{empty}</p>
      )}
    </div>
  );
}

function SideColumn({
  title,
  tone,
  count,
  children,
}: {
  title: string;
  tone: MatchupTone;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cx("rounded-xl border bg-abyss/25 overflow-hidden", MATCHUP_TONE_BORDER[tone])}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-line/60">
        <div className="flex items-center gap-1.5 min-w-0">
          <MatchupToneIcon tone={tone} size={13} />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-foam truncate">{title}</h3>
        </div>
        <span
          className="text-[10px] font-mono text-mist shrink-0"
          title="Pares catalogados neste sentido, neste elo e janela"
        >
          {count} {count === 1 ? "par" : "pares"}
        </span>
      </header>
      <div className="p-2.5 space-y-2">{children}</div>
    </section>
  );
}

function MiniPair({ pair, tone }: { pair: Pair; tone: MatchupTone }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-line/60 bg-panel2/25 py-0.5 pl-0.5 pr-2 max-w-full">
      <Avatar src={pair.head} name={pair.name} size={20} />
      <span className="text-[11px] font-semibold text-foam truncate max-w-[120px]">{pair.name}</span>
      <span className={cx("num text-[10px] font-bold shrink-0", MATCHUP_TONE_TEXT[tone])}>
        δ {fmtDelta(pair.delta)}
      </span>
    </span>
  );
}

function RankPrompt({ onPick }: { onPick: (rank: string) => void }) {
  const ranks = (RANKS as readonly string[]).filter((r) => r !== "all");
  return (
    <div
      data-testid="preview-needs-rank"
      data-capid="CAP-M6-01"
      className="rounded-xl border border-line bg-abyss/30 p-3 space-y-2"
    >
      <p className="text-[11px] text-mist">
        Confrontos exigem elo explícito — escolha um para liberar counters e sinergias.
      </p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {ranks.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onPick(r)}
            className="px-3 py-2 rounded-xl text-[11px] font-bold uppercase bg-abyss/60 text-mist hover:text-foam border border-line hover:border-gold/40 transition-colors min-h-[44px]"
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ConfrontosPreview({
  heroId,
  heroName,
  rank,
  window,
  to,
  onPickRank,
}: {
  heroId: string;
  heroName: string;
  rank: string;
  window: string;
  /** URL da aba Confrontos já com rank/janela/lane preservados. */
  to: string;
  onPickRank: (rank: string) => void;
}) {
  const [sp] = useSearchParams();
  const days = sp.get("days") ?? window;
  const needsRank = rank === "all";
  // rank=all não gera número: 0 requests de matchup (paridade com a aba).
  const q = useMatchups(needsRank ? null : heroId || null, rank, days);
  const m = q.data;

  // Cortes por δ só com valor finito: par sem sinal não vira "pior/melhor".
  const topCounters = selectTopCountersByDelta(m?.countersDown ?? [], 3);
  const topSynergies = selectTopSynergiesByDelta(m?.synergiesUp ?? [], 3);
  const anti = sortPairsByDeltaAsc((m?.synergiesDown ?? []).filter(hasFiniteDelta))[0];
  const advantage = sortPairsByDeltaDesc((m?.countersUp ?? []).filter(hasFiniteDelta))[0];

  const threatCount = (m?.countersDown?.length ?? 0) + (m?.synergiesDown?.length ?? 0);
  const favorCount = (m?.countersUp?.length ?? 0) + (m?.synergiesUp?.length ?? 0);
  const totalPairs = threatCount + favorCount;
  const hasPairs = totalPairs > 0;
  const rankLabel = needsRank ? "sem elo" : `elo ${rank.toUpperCase()}`;

  return (
    <section
      data-testid="hero-confrontos-preview"
      aria-label={`Prévia de confrontos de ${heroName}`}
      aria-busy={q.isLoading}
      className="rounded-2xl border border-line bg-panel p-3.5 md:p-4 space-y-3 animate-fadeIn motion-reduce:animate-none"
    >
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-rose-400/25 bg-rose-400/10 text-rose-300 shrink-0">
            <Swords size={15} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="lbl">
              Confrontos · {rankLabel} · janela {days}d
              {!q.isLoading && !q.isError && totalPairs > 0 ? ` · ${totalPairs} pares` : ""}
            </p>
            <h2 className="text-sm md:text-base font-bold tracking-tight text-foam">
              Pior contra · melhor com
            </h2>
          </div>
        </div>
        <Link
          to={to}
          aria-label={`Abrir a aba Confrontos de ${heroName}`}
          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl border border-line bg-abyss/40 text-[11px] font-bold text-mist hover:text-foam hover:border-gold/40 transition-colors focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:outline-none"
        >
          Abrir aba <span aria-hidden="true">→</span>
        </Link>
      </header>

      {needsRank ? (
        <RankPrompt onPick={onPickRank} />
      ) : q.isLoading ? (
        <>
          <div aria-hidden="true" className="grid gap-2.5 lg:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-xl border border-line/60 bg-abyss/20 p-2.5 space-y-2">
                <div className="h-3 w-24 rounded bg-panel2/60" />
                <div className="h-12 rounded-lg bg-panel2/50" />
                <div className="h-4 w-40 rounded bg-panel2/40" />
              </div>
            ))}
          </div>
          <p className="sr-only" role="status">Carregando confrontos…</p>
        </>
      ) : q.isError || !m ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-300/30 bg-amber-400/5 p-3 flex items-start gap-2.5 flex-wrap"
        >
          <TriangleAlert size={16} className="text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-foam">Confrontos indisponíveis neste recorte</p>
            <p className="text-[11px] text-mist">A fonte não respondeu — nenhum par foi avaliado.</p>
          </div>
          <button
            type="button"
            onClick={() => q.refetch()}
            className="btn-ghost min-h-[44px] text-[11px]"
          >
            Tentar de novo
          </button>
        </div>
      ) : !hasPairs ? (
        <div className="rounded-xl border border-dashed border-line bg-abyss/20 p-4">
          <p className="text-xs font-bold text-foam">Nenhum par catalogado neste recorte</p>
          <p className="text-[11px] text-mist">
            A fonte expõe só extremos; ausência de par ≠ efeito zero. Tente outro elo ou janela.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-2.5 lg:grid-cols-2">
            <SideColumn title="Contra você" tone="threat" count={threatCount}>
              <FocalPair
                label="Pior counter"
                hint="evite"
                tone="threat"
                pair={topCounters[0]}
                empty="Sem counter com δ neste recorte"
              />
              {topCounters.length > 1 ? (
                <div className="space-y-1.5">
                  <p className="text-[9px] uppercase tracking-wider text-mist">Também contra</p>
                  <ul className="flex items-center gap-1.5 flex-wrap">
                    {topCounters.slice(1).map((p) => (
                      <li key={p.pair_key ?? `${p.relationship_type}-${p.id}`}>
                        <MiniPair pair={p} tone="threat" />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {anti ? (
                <p className="text-[11px] text-amber-300 flex items-start gap-1.5">
                  <TriangleAlert size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    Não combine com <b className="text-foam">{anti.name}</b>{" "}
                    <span className="num text-[10px]">(δ {fmtDelta(anti.delta)})</span>.
                  </span>
                </p>
              ) : null}
            </SideColumn>

            <SideColumn title="A favor" tone="synergy" count={favorCount}>
              <FocalPair
                label="Melhor sinergia"
                hint="combine"
                tone="synergy"
                pair={topSynergies[0]}
                empty="Sem sinergia com δ neste recorte"
              />
              {topSynergies.length > 1 ? (
                <div className="space-y-1.5">
                  <p className="text-[9px] uppercase tracking-wider text-mist">Também a favor</p>
                  <ul className="flex items-center gap-1.5 flex-wrap">
                    {topSynergies.slice(1).map((p) => (
                      <li key={p.pair_key ?? `${p.relationship_type}-${p.id}`}>
                        <MiniPair pair={p} tone="synergy" />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {advantage ? (
                <p className="text-[11px] text-teal-300 flex items-start gap-1.5">
                  <ShieldCheck size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    Vantagem contra <b className="text-foam">{advantage.name}</b>{" "}
                    <span className="num text-[10px]">(δ {fmtDelta(advantage.delta)})</span>.
                  </span>
                </p>
              ) : null}
            </SideColumn>
          </div>

          <p className="text-[11px] text-mist/80 leading-relaxed">
            δ = associação do par, não probabilidade; não somar entre inimigos. Par ausente = desconhecido, nunca 0.
          </p>
        </>
      )}
    </section>
  );
}
