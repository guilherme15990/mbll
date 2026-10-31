import { useMemo } from "react";
import { FlaskConical, Info } from "lucide-react";
import { useFilters } from "../../app/filters";
import { ago, pct, useHeroDraftScore } from "../../shared/api";
import { ErrBox, Loading } from "../../shared/ui";
import { NeedsRank } from "../../shared/ui/patterns/NeedsRankLane";
import DraftScoreTable from "./DraftScoreTable";

/**
 * `/draft-score` · página de TESTE do sistema (motor `hero-draft-score-v1`).
 *
 * Lista os heróis do recorte com UM número 0–100: o Draft Score =
 * min–max da WR no lote (o melhor WR lê 100, o pior lê 0). Só o desfecho medido
 * entra — `pick` e `ban` são exposição, nunca força; sem pesos nem constantes
 * declaradas. É a mesma ideia do score do app antigo, sem a mistura de percentis.
 *
 * A composição acontece no SERVIDOR (endpoint composto): 1 request por recorte,
 * sem fan-out no navegador.
 */
export default function DraftScorePage() {
  const { rank, window, set } = useFilters();
  const q = useHeroDraftScore(rank, window);
  const data = q.data;
  const rows = useMemo(
    () => [...(data?.rows ?? [])].sort((a, b) => (b.draft_score ?? -1) - (a.draft_score ?? -1)),
    [data],
  );
  const scale = data && data.meta.wr_min != null && data.meta.wr_max != null
    ? `100 = ${pct(data.meta.wr_max)} · 0 = ${pct(data.meta.wr_min)}`
    : "escala min–max do recorte";

  return (
    <div className="space-y-4">
      <header className="card p-4 md:p-5 space-y-3">
        <div className="min-w-0">
          <p className="lbl flex items-center gap-1.5">
            <FlaskConical size={12} className="text-gold" aria-hidden="true" /> Draft Score · teste
          </p>
          <h1 className="text-lg md:text-xl font-black text-foam tracking-tight mt-0.5">
            Draft Score dos heróis do recorte
          </h1>
          <p className="text-[11px] text-mist mt-0.5">
            Elo {rank.toUpperCase()} · janela {window}d · métrica{" "}
            <b className="text-foam">hero-draft-score-v1</b> · um número por herói (0–100).
          </p>
        </div>
        <div className="rounded-xl border border-line/60 bg-abyss/40 px-3 py-2 flex items-start gap-2">
          <Info size={13} className="text-gold shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[10px] text-mist leading-relaxed">
            O número é a posição da WR do herói dentro DESTE recorte: <b>100</b> = maior WR, <b>0</b> = menor WR,
            e o resto se distribui entre os dois. Não é probabilidade nem previsão — é a taxa de vitória medida,
            reescalada no lote. <b>pick</b> e <b>ban</b> são exposição, não entram na conta.
          </p>
        </div>
      </header>

      {rank === "all" ? (
        <NeedsRank
          title="O Draft Score exige elo explícito"
          hint="A WR vem do recorte; elo ALL não gera base."
          onPick={(next) => set("rank", next)}
        />
      ) : q.isError ? (
        <ErrBox onRetry={() => void q.refetch()} message="O lote não respondeu — sem WR não há número." />
      ) : q.isLoading ? (
        <Loading rows={6} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap px-1">
            <p className="text-[11px] text-mist">
              <b className="text-foam">{rows.length}</b> herói(s) no recorte
              {data ? ` · ${data.meta.with_data} com WR no recorte` : ""}
              {data?.stale ? ` · fonte em cache (${ago(data.ageMs ?? data.collectedAgoMs)})` : ""}
              {data?.truncated ? " · lote truncado na fonte" : ""}
            </p>
            <p className="text-[10px] font-mono text-mist/70">{scale}</p>
          </div>

          <DraftScoreTable rows={rows} />

          <p className="text-[10px] text-mist/70 px-1">
            Leitura exploratória da métrica. O número é RELATIVO ao elo+janela (não compare entre recortes) e
            reescala a WR para 0–100 dentro do lote — não mede dificuldade, composição ou execução. Herói sem WR no
            recorte aparece como “—”. Sem partidas observadas, nada aqui é causal.
          </p>
        </>
      )}
    </div>
  );
}
