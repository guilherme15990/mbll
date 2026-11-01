import { Ban as BanIcon, Check, Sparkles, Crosshair } from "lucide-react";
import { cx } from "../../shared/api";
import { Avatar } from "../../shared/ui";
import {
  ARCHETYPE_LABEL,
  DRAFT_LANES,
  type Candidate,
  type DraftAnalysis,
  type DraftLane,
  type HeroPool,
} from "./model";
import { LANE_LABEL } from "./labels";

/**
 * Recomendações na lane alvo (ADR-053 D5/D6 + ADR-055).
 *
 * O motor ordena por CINCO fatores: counter contra o inimigo, antisinergia com
 * o nosso time, exposição aos counters inimigos, meta (percentil do θ̂) e
 * balanceamento de arquétipo. O score NÃO é exibido — a UI mostra só os sinais
 * observados por extenso. Leitura, não recomendação.
 */
type SignalTone = "good" | "bad" | "flat";
type Signal = { key: string; label: string; tone: SignalTone };

function signalsOf(candidate: Candidate): Signal[] {
  const signals: Signal[] = [];
  if (candidate.counter.value != null) {
    signals.push({ key: "counter", label: `countera ${candidate.counter.ids.length}`, tone: "good" });
  }
  if (candidate.antisynergy.value != null) {
    signals.push({ key: "antisynergy", label: `antisinergia ${candidate.antisynergy.ids.length}`, tone: "bad" });
  }
  if (candidate.exposure.value != null) {
    signals.push({ key: "exposure", label: `exposto ${candidate.exposure.ids.length}`, tone: "bad" });
  }
  if (candidate.meta != null) {
    signals.push({
      key: "meta",
      label: `meta ${Math.round(candidate.meta * 100)}`,
      tone: candidate.meta >= 0.5 ? "good" : "flat",
    });
  }
  if (candidate.balance != null) {
    signals.push({
      key: "balance",
      label: candidate.balance > 0 ? "balanceia" : candidate.balance < 0 ? "repete" : "neutro",
      tone: candidate.balance > 0 ? "good" : candidate.balance < 0 ? "bad" : "flat",
    });
  }
  return signals;
}

const TONE_CLASS: Record<SignalTone, string> = {
  good: "border-emerald-400/30 text-emerald-300",
  bad: "border-rose-400/30 text-rose-300",
  flat: "border-line text-mist",
};

function SignalRow({ candidate, compact }: { candidate: Candidate; compact: boolean }) {
  const signals = signalsOf(candidate);
  if (!signals.length) {
    return <p className="text-[9px] font-mono text-mist/60 truncate">sem par observado neste recorte</p>;
  }
  return (
    <ul className="flex items-center gap-1 flex-wrap" aria-label="Sinais observados">
      {signals.map((signal) => (
        <li
          key={signal.key}
          className={cx(
            "rounded-full border bg-abyss/50 font-mono text-mist/80 whitespace-nowrap",
            compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
            TONE_CLASS[signal.tone],
          )}
          title={candidate.reasons.join(" · ")}
        >
          {signal.label}
        </li>
      ))}
    </ul>
  );
}

function Actions({
  candidate,
  name,
  canPick,
  canBan,
  compact,
  onPick,
  onBan,
}: {
  candidate: Candidate;
  name: string;
  canPick: boolean;
  canBan: boolean;
  compact: boolean;
  onPick: (heroId: number) => void;
  onBan: (heroId: number) => void;
}) {
  const size = compact ? 11 : 13;
  return (
    <div className={compact ? "flex items-center gap-1 shrink-0" : "grid grid-cols-2 gap-2"}>
      <button
        type="button"
        onClick={() => onPick(candidate.heroId)}
        disabled={!canPick}
        aria-label={`Pickar ${name}`}
        className={cx(compact ? "btn-ghost !px-1.5 !py-1 text-[10px]" : "btn-primary", "disabled:opacity-40")}
      >
        <Check size={size} aria-hidden="true" /> Pick
      </button>
      <button
        type="button"
        onClick={() => onBan(candidate.heroId)}
        disabled={!canBan}
        aria-label={`Banir ${name}`}
        className={cx(compact ? "btn-ghost !px-1.5 !py-1 text-[10px]" : "btn-ghost", "!text-rose-300 disabled:opacity-40")}
      >
        <BanIcon size={size} aria-hidden="true" /> Ban
      </button>
    </div>
  );
}

export default function RecommendationPanel({
  analysis,
  pool,
  lane,
  canPick,
  canBan,
  onLane,
  onPick,
  onBan,
}: {
  analysis: DraftAnalysis;
  pool: HeroPool;
  lane: DraftLane;
  canPick: boolean;
  canBan: boolean;
  onLane: (lane: DraftLane) => void;
  onPick: (heroId: number) => void;
  onBan: (heroId: number) => void;
}) {
  const { suggestions, next, mix } = analysis;
  const top = suggestions[0] ?? null;
  const rest = suggestions.slice(1);
  const topName = top ? (pool[top.heroId]?.name ?? top.name ?? `Herói #${top.heroId}`) : "";

  return (
    <section className="card p-3.5 space-y-3" aria-label="Recomendações de heróis">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="lbl flex items-center gap-1.5">
            <Sparkles size={12} className="text-gold" aria-hidden="true" /> Recomendações
          </p>
          <span className="text-[9px] font-mono text-mist/60">{suggestions.length} candidatos</span>
        </div>
        <div
          role="group"
          aria-label="Lane alvo das recomendações"
          className="grid grid-cols-5 gap-1 rounded-xl border border-line bg-abyss/60 p-1"
        >
          {DRAFT_LANES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={option === lane}
              onClick={() => onLane(option)}
              className={cx(
                "min-h-[30px] rounded-lg text-[10px] font-bold transition-colors",
                option === lane ? "bg-gold text-abyss shadow-sm" : "text-mist hover:text-foam",
              )}
            >
              {LANE_LABEL[option]}
            </button>
          ))}
        </div>
        {mix.relation.target && (
          <p className="text-[10px] text-mist flex items-center gap-1">
            <Crosshair size={11} className="text-gold shrink-0" aria-hidden="true" />
            contrapeso ao dominante inimigo: <b className="text-foam">{ARCHETYPE_LABEL[mix.relation.target]}</b>
          </p>
        )}
      </header>

      {!next ? (
        <p className="text-[11px] text-mist py-2">Draft completo: não há próximo pick para ordenar.</p>
      ) : suggestions.length === 0 ? (
        <p className="text-[11px] text-mist py-2">
          Sem candidatos com sinal observado nesta lane. Preencha mais picks ou revise o recorte.
        </p>
      ) : (
        <>
          {top && (
            <article className="rounded-2xl border border-gold/40 bg-gold/[0.06] p-3 space-y-2" aria-label="Primeiro candidato">
              <div className="flex items-center gap-3">
                <Avatar src={pool[top.heroId]?.head ?? top.head} name={topName} size={52} />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] uppercase tracking-wider font-bold text-gold">Mais indicado agora</p>
                  <p className="text-base font-black text-foam truncate">{topName}</p>
                  <p className="text-[10px] text-mist font-mono truncate">{pool[top.heroId]?.tier ?? "sem tier no recorte"}</p>
                </div>
              </div>
              <SignalRow candidate={top} compact={false} />
              <Actions
                candidate={top}
                name={topName}
                canPick={canPick}
                canBan={canBan}
                compact={false}
                onPick={onPick}
                onBan={onBan}
              />
            </article>
          )}

          {rest.length > 0 && (
            <ul className="space-y-1">
              {rest.map((candidate) => {
                const name = pool[candidate.heroId]?.name ?? candidate.name ?? `Herói #${candidate.heroId}`;
                return (
                  <li
                    key={candidate.heroId}
                    className="flex items-center gap-2 rounded-xl border border-line/60 bg-abyss/40 px-2 py-1.5"
                  >
                    <Avatar src={pool[candidate.heroId]?.head ?? candidate.head} name={name} size={28} />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-[11px] font-semibold text-foam truncate">{name}</p>
                      <SignalRow candidate={candidate} compact={true} />
                    </div>
                    <Actions
                      candidate={candidate}
                      name={name}
                      canPick={canPick}
                      canBan={canBan}
                      compact={true}
                      onPick={onPick}
                      onBan={onBan}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
