import { Link } from "react-router-dom";
import { num, useTemporal, useTrends } from "../../../lib/api";
import {
  DomainStateBadge, Empty, ErrBox, Loading, SectionTitle,
} from "../../../components/ui";
import { Spark, TrendChart } from "../../../components/charts";
import { isShortSeries, resolveTemporalSignal, trendDirectionOf } from "@radar/proprietary-engine";

type TemporalView = {
  delta?: number;
  delta_logit?: number;
  interval_95?: number[];
  temporal_status?: string;
  patch_association_status?: string;
};

/** Estados do sinal (PRD Temporal §6) — fonte única em `@radar/proprietary-engine`. */

/**
 * Aba Tempo da ficha isolada — temporal + série do próprio herói.
 * Banner: estado do sinal + Δ em logit. Prova: sparkline + badge de direção + tabela.
 * Série curta (<2 pontos ou span <14d) = inconclusivo, sem selo Persistente.
 * Sem ledger de versões (contexto global, fora da ficha).
 */
export default function TempoSection({
  heroId,
  rank,
  window,
  heroName,
}: {
  heroId: string;
  rank: string;
  window: string;
  heroName: string;
}) {
  const temporalQuery = useTemporal(heroId || null, rank, window);
  const trendSeries = useTrends(heroId || null, rank);

  if (!heroId) return <Empty title="Sem herói" hint="Volte à visão geral e escolha um herói." />;
  if (temporalQuery.isLoading) {
    return (
      <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Sinal temporal">
        <Loading rows={3} />
      </section>
    );
  }
  if (temporalQuery.isError) {
    return (
      <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Sinal temporal">
        <div className="card p-4 border-line bg-panel space-y-1">
          <p className="lbl">Tempo · elo {rank.toUpperCase()} · janela {window}d</p>
          <p className="text-sm font-bold text-foam">Tempo indisponível neste recorte</p>
          <p className="text-xs text-mist">A fonte não respondeu — o sinal temporal não foi avaliado.</p>
        </div>
        <ErrBox onRetry={() => temporalQuery.refetch()} />
      </section>
    );
  }

  const t = temporalQuery.data as unknown as TemporalView | undefined;
  if (!t) {
    return (
      <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Sinal temporal">
        <div className="card p-4 border-line bg-panel space-y-1">
          <p className="lbl">Tempo · elo {rank.toUpperCase()} · janela {window}d</p>
          <p className="text-sm font-bold text-foam">Inconclusivo — sem série neste recorte</p>
          <p className="text-xs text-mist">Passou o patch e o sinal continua? Sem pontos suficientes para dizer.</p>
        </div>
        <ErrBox onRetry={() => temporalQuery.refetch()} />
      </section>
    );
  }

  const pts = trendSeries.data?.data ?? [];
  // Série curta + estado do sinal em `@radar/proprietary-engine` (tempo-signal).
  const shortSeries = isShortSeries(pts);
  const signal = resolveTemporalSignal(t.temporal_status, pts);
  const { word: dirWord, delta } = trendDirectionOf(t);
  const wins = pts.map((p) => p.win).filter((v) => Number.isFinite(v));

  return (
    <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Sinal temporal">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="lbl">Tempo · elo {rank.toUpperCase()} · janela {window}d</p>
          <h2 className="text-lg font-extrabold tracking-tight text-foam">
            Sinal {signal.label} — Δ {delta != null && Number.isFinite(delta) ? `${delta >= 0 ? "+" : ""}${num(delta, 4)}` : "—"} em logit
          </h2>
          <p className="text-xs text-mist">
            Associação com patch: {t.patch_association_status ?? "temporal_association"} — nunca causa.
          </p>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${signal.color}`}>{signal.label}</span>
      </div>
      {shortSeries && (
        <p className="text-[11px] text-amber-300" role="status">
          Série curta: sem confirmação — sem selo Persistente.
        </p>
      )}

      <div id="prova-tempo" className="space-y-4 scroll-mt-4">
        <SectionTitle kicker="Prova" title="Sparkline + direção + série" subtitle="Log-odds nunca lidos como pontos percentuais" />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="card p-4 bg-panel border-line space-y-2">
            <span className="lbl">Δ de força (escala logit)</span>
            <p className="num text-2xl font-bold text-gold">{num(delta, 4)}</p>
            <p className="text-[11px] text-mist">
              IC 95%: <span className="text-foam font-mono">{t.interval_95?.map((v: number) => num(v, 4)).join(" – ") ?? "—"}</span>
            </p>
            <p className="text-[11px] text-mist">Log-odds nunca lidos como pontos percentuais.</p>
          </div>
          <div className="card p-4 bg-panel border-line space-y-2">
            <span className="lbl">Estado do sinal</span>
            <p><span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${signal.color}`}>{signal.label}</span></p>
            <p className="text-[11px] text-mist">{signal.desc}</p>
            <p className="text-[11px] text-mist">
              associação com patch — <b>nunca causa declarada</b>.
            </p>
          </div>
        </div>

        <div className="card p-4 space-y-3 border-line bg-panel2/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foam">Série diária · 30 dias (win + ban)</h4>
            <span className="flex items-center gap-2">
              <span role="img" aria-label={`sparkline de win em 30 dias — direção ${dirWord}`}>
                <Spark data={wins} />
              </span>
              <DomainStateBadge status="temporal" label={shortSeries ? "série curta" : `${pts.length} pontos · ${dirWord}`} />
            </span>
          </div>
          {trendSeries.isLoading ? (
            <Loading rows={2} />
          ) : trendSeries.isError || !pts.length ? (
            <p className="p-6 text-center text-xs text-mist" role="status">Sem histórico diário neste elo (aviso, não erro).</p>
          ) : (
            <>
              <TrendChart data={pts} />
              <details className="rounded-xl border border-line bg-abyss/40 p-2.5">
                <summary className="text-[11px] font-bold text-foam cursor-pointer min-h-[44px] flex items-center">
                  Tabela equivalente (data · win · pick · ban)
                </summary>
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-left text-mist uppercase tracking-wider text-[10px]">
                        <th className="px-2 py-1">Data</th>
                        <th className="px-2 py-1">Win</th>
                        <th className="px-2 py-1">Pick</th>
                        <th className="px-2 py-1">Ban</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pts.map((p) => (
                        <tr key={p.date} className="border-t border-line/60">
                          <td className="px-2 py-1 font-mono text-mist">{p.date}</td>
                          <td className="px-2 py-1 font-mono text-foam">{num(p.win, 4)}</td>
                          <td className="px-2 py-1 font-mono text-mist">{num(p.pick, 4)}</td>
                          <td className="px-2 py-1 font-mono text-mist">{num(p.ban, 4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </div>
      </div>

      <Link
        to={`/tempo?hero=${heroId}&rank=${rank}&window=${window}`}
        className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gold text-abyss text-sm font-bold hover:bg-gold-light transition-colors min-h-[44px]"
      >
        Abrir tempo na rota plana →
      </Link>
    </section>
  );
}
