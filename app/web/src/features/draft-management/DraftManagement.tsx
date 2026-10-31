import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Compass, Info, RotateCcw, ShieldCheck } from "lucide-react";
import { useFilters } from "../../app/filters";
import { cx } from "../../shared/api";
import { ErrBox, Loading } from "../../shared/ui";
import { NeedsRank } from "../../shared/ui/patterns/NeedsRankLane";
import {
  DRAFT_LANES,
  analyzeDraft,
  encodeDraft,
  nextBanIndex,
  nextPickIndex,
  nextPickStep,
  parseDraft,
  resetDraft,
  setBan,
  setFirst,
  setLane,
  setPick,
  type DraftLane,
  type DraftSide,
  type DraftState,
} from "./model";
import { LANE_LABEL } from "./labels";
import ArchetypePanel from "./ArchetypePanel";
import MatchupMatrix from "./MatchupMatrix";
import PowerCurve from "./PowerCurve";
import PowerPanel from "./PowerPanel";
import RecommendationPanel from "./RecommendationPanel";
import StrengthBar from "./StrengthBar";
import TeamBoard from "./TeamBoard";
import { useDraftData } from "./useDraftData";

/**
 * `/draft` · Draft Management (ADR-052 + ADR-053).
 *
 * Layout em faixas: draft à esquerda, recomendações à direita; abaixo, força em
 * %, matriz 5×5 e mix de arquétipos; depois a curva de duração e o detalhe do
 * índice. Nenhum endpoint novo; seleção (draft e lane) vive na URL.
 */
export default function DraftManagement() {
  const { rank, window, set } = useFilters();
  const [sp, setSp] = useSearchParams();

  const draft = useMemo<DraftState>(() => parseDraft((key) => sp.get(key)), [sp]);
  const pickedIds = useMemo(
    () =>
      [...draft.us, ...draft.them]
        .map((slot) => slot.heroId)
        .filter((id): id is number => id != null),
    [draft],
  );

  // Lane alvo: `?lane=` → lane do próximo slot nosso → `exp`.
  const laneParam = sp.get("lane");
  const laneTarget: DraftLane = (DRAFT_LANES as readonly string[]).includes(laneParam ?? "")
    ? (laneParam as DraftLane)
    : (nextPickStep(draft, "us")?.lane ?? DRAFT_LANES[0]);

  const data = useDraftData(rank, window, pickedIds, laneTarget);

  const analysis = useMemo(
    () => analyzeDraft(draft, { pool: data.pool, books: data.books, baseline: data.baseline, lane: laneTarget }),
    [draft, data.pool, data.books, data.baseline, laneTarget],
  );

  const apply = (next: DraftState) => {
    const encoded = encodeDraft(next);
    const params = new URLSearchParams(sp);
    params.set("d", encoded.d);
    params.set("b", encoded.b);
    params.set("first", encoded.first);
    setSp(params, { replace: true });
  };

  const onPick = (side: DraftSide) => (index: number, heroId: number | null) => {
    apply(setPick(draft, side, index, heroId));
  };

  const onLane = (side: DraftSide) => (index: number, lane: DraftLane) => {
    apply(setLane(draft, side, index, lane));
  };

  const onBan = (side: DraftSide) => (index: number, heroId: number | null) => {
    apply(setBan(draft, side, index, heroId));
  };

  const onLaneTarget = (lane: DraftLane) => {
    const params = new URLSearchParams(sp);
    params.set("lane", lane);
    setSp(params, { replace: true });
  };

  const pickSlot = nextPickIndex(draft, laneTarget);
  const banSlot = nextBanIndex(draft);

  const pickFromCard = (heroId: number) => {
    if (pickSlot == null) return;
    apply(setPick(draft, "us", pickSlot, heroId));
  };

  const banFromCard = (heroId: number) => {
    if (banSlot == null) return;
    apply(setBan(draft, "us", banSlot, heroId));
  };

  const nextFor = (side: DraftSide) => (analysis.next?.side === side ? analysis.next.index : null);
  const firstSide = draft.first;
  const empty = analysis.ourPower.filled + analysis.theirPower.filled === 0;

  return (
    <div className="space-y-4">
      <header className="card p-4 md:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="lbl flex items-center gap-1.5">
              <Compass size={12} className="text-gold" aria-hidden="true" /> Draft management
            </p>
            <h1 className="text-lg md:text-xl font-black text-foam tracking-tight mt-0.5">
              Monte o draft e leia o que os sinais sustentam
            </h1>
            <p className="text-[11px] text-mist mt-0.5">
              Elo {rank.toUpperCase()} · janela {window}d · força θ̂, sinergia observada e confronto por par ·{" "}
              {data.bookCount} livros de pares no fan-out (≤18).
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <div
              role="group"
              aria-label="Quem picka primeiro"
              className="inline-flex items-center gap-1 rounded-2xl border border-line bg-abyss/60 p-1"
            >
              <span className="text-[9px] uppercase font-bold tracking-wider text-mist/70 px-1.5">1º pick</span>
              <button
                type="button"
                aria-pressed={firstSide === "us"}
                onClick={() => apply(setFirst(draft, "us"))}
                className={cx(
                  "px-2.5 py-1.5 rounded-xl text-[11px] font-bold min-h-[34px] transition-all",
                  firstSide === "us" ? "bg-gold text-abyss shadow-sm" : "text-mist hover:text-foam",
                )}
              >
                Meu time
              </button>
              <button
                type="button"
                aria-pressed={firstSide === "them"}
                onClick={() => apply(setFirst(draft, "them"))}
                className={cx(
                  "px-2.5 py-1.5 rounded-xl text-[11px] font-bold min-h-[34px] transition-all",
                  firstSide === "them" ? "bg-gold text-abyss shadow-sm" : "text-mist hover:text-foam",
                )}
              >
                Inimigo
              </button>
            </div>
            <button
              type="button"
              onClick={() => apply(resetDraft(draft))}
              className="btn-ghost min-h-[34px]"
              aria-label="Limpar picks e bans deste draft"
            >
              <RotateCcw size={12} /> Limpar
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-line/60 bg-abyss/40 px-3 py-2 flex items-start gap-2">
          <Info size={13} className="text-gold shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[10px] text-mist leading-relaxed">
            Quem picka primeiro entrega o primeiro lock e recebe a resposta do outro lado; quem picka por último tem
            dois picks seguidos no meio e a última escolha. Ordem MLBB: bans alternados e picks <b>1-2-2-2-2-1</b>.
            O índice é relativo (50 = neutro), não é probabilidade, não é previsão.
          </p>
        </div>

        {(data.stale || data.truncated || data.bookErrors > 0) && (
          <div className="text-[10px] text-amber-300/90 flex items-start gap-1.5">
            <Info size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {data.stale ? "Lote em cache (stale). " : ""}
              {data.truncated ? "Lista de heróis truncada pela fonte. " : ""}
              {data.bookErrors > 0
                ? `${data.bookErrors} herói(s) sem matriz de pares — componentes ficam sem dado, não viram zero.`
                : ""}
            </span>
          </div>
        )}
      </header>

      {rank === "all" ? (
        <NeedsRank
          title="Draft exige elo explícito"
          hint="O índice usa θ̂ e pares do recorte. Elo ALL não gera proxy (INV-DMP-008)."
          onPick={(nextRank) => set("rank", nextRank)}
        />
      ) : data.error ? (
        <ErrBox onRetry={data.refetch} message="O lote de heróis não respondeu — não há como calcular o índice neste recorte." />
      ) : data.loading ? (
        <Loading rows={5} />
      ) : (
        <>
          {empty && (
            <div className="card p-3 border-gold/30 bg-gold/5 flex items-start gap-2">
              <Info size={14} className="text-gold shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-[11px] text-mist">
                Comece pelo seletor de 1º pick e preencha os slots na ordem do draft. O índice aparece assim que houver
                força, sinergia ou confronto observado — sem par, o componente fica em branco. A lane das recomendações
                segue o próximo slot nosso; troque nas chips ao lado.
              </p>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
            <div className="space-y-4 min-w-0">
              <TeamBoard
                side="us"
                slots={draft.us}
                power={analysis.ourPower}
                bans={draft.usBans}
                pool={data.pool}
                used={analysis.used}
                nextIndex={nextFor("us")}
                isFirst={firstSide === "us"}
                onPick={onPick("us")}
                onLane={onLane("us")}
                onBan={onBan("us")}
              />
              <TeamBoard
                side="them"
                slots={draft.them}
                power={analysis.theirPower}
                bans={draft.themBans}
                pool={data.pool}
                used={analysis.used}
                nextIndex={nextFor("them")}
                isFirst={firstSide === "them"}
                onPick={onPick("them")}
                onLane={onLane("them")}
                onBan={onBan("them")}
              />

              <StrengthBar analysis={analysis} />
            </div>

            <div className="min-w-0 xl:sticky xl:top-4">
              <RecommendationPanel
                analysis={analysis}
                pool={data.pool}
                lane={laneTarget}
                canPick={pickSlot != null}
                canBan={banSlot != null}
                onLane={onLaneTarget}
                onPick={pickFromCard}
                onBan={banFromCard}
              />
              {analysis.next && (
                <p className="text-[10px] text-mist/70 mt-2 px-1">
                  Lane alvo <b className="text-foam">{LANE_LABEL[analysis.lane]}</b> · próximo turno{" "}
                  <b className={analysis.next.side === "us" ? "text-sky-300" : "text-rose-300"}>
                    {analysis.next.side === "us" ? "nosso" : "inimigo"}
                  </b>
                  .
                </p>
              )}
            </div>
          </div>

          <MatchupMatrix matrix={analysis.matrix} pool={data.pool} />

          <PowerCurve curve={analysis.curve} />

          <ArchetypePanel mix={analysis.mix} teams={analysis.teams} books={data.books} pool={data.pool} />

          <PowerPanel analysis={analysis} pool={data.pool} />

          <p className="text-[10px] text-mist/70 flex items-start gap-1.5">
            <ShieldCheck size={12} className="text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Índice relativo de poder: não é probabilidade, não é previsão. Componente sem par observado fica em
              branco e sai do índice. Direção do par vem da lista, não do sinal do δ. Counters não são somados entre os
              cinco inimigos — o componente é média por par. A divisão em % é o índice somado e a curva é a média das
              duplas de cada time: proxies, não probabilidade. Sugestões não são recomendação.
            </span>
          </p>
        </>
      )}
    </div>
  );
}
