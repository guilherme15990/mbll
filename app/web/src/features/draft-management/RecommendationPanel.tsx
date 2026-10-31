import { Ban as BanIcon, Check, Sparkles, Crosshair } from "lucide-react";
import { cx, pct } from "../../shared/api";
import { num } from "../../shared/format";
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
 * Recomendações na rota do slot (ADR-053 D5/D6).
 *
 * Dois fatores declarados: percentil do θ̂ na lane (peso 1) e tipo que
 * contrabalança o arquétipo dominante inimigo (peso 0,25). O score NÃO é
 * exibido — a UI mostra os fatores por extenso. Leitura, não recomendação.
 */
function metaText(candidate: Candidate): string {
  if (candidate.percentile == null) return "meta da lane: sem θ̂ no recorte";
  const percentile = Math.round(candidate.percentile * 100);
  const above = candidate.above == null ? "" : ` · ${candidate.above} acima`;
  return `meta da lane: ${percentile}º percentil${above}`;
}

function typeText(candidate: Candidate): string {
  if (!candidate.archetype) return "tipo: sem par com perfil";
  const base = `${ARCHETYPE_LABEL[candidate.archetype.top]} (${candidate.archetype.n}/${candidate.archetype.total})`;
  if (candidate.balance === 1 && candidate.target) return `tipo: ${base} — contrabalança ${ARCHETYPE_LABEL[candidate.target]}`;
  if (candidate.balance === -1) return `tipo: ${base} — repete a janela inimiga`;
  if (candidate.balance === 0) return `tipo: ${base} — sem inclinação`;
  return `tipo: ${base} — sem alvo de contrapeso`;
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
  const waiting = next?.side === "them";
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
        <p className="text-[11px] text-mist">
          Lane <b className="text-foam">{LANE_LABEL[lane]}</b> · leitura ordenada por dois fatores, não é recomendação.
        </p>
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

      {waiting && (
        <p className="text-[10px] text-amber-300/90 rounded-lg border border-amber-400/25 bg-amber-400/5 px-2 py-1.5">
          O inimigo picka agora — a lista vale para quando a vez voltar.
        </p>
      )}

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
                  <p className="text-[10px] text-mist font-mono truncate">
                    {top.laneFit === true ? `rota ${LANE_LABEL[top.lane]}` : top.laneFit === false ? "fora da rota" : "rota sem dado"}
                    {pool[top.heroId]?.tier ? ` · ${pool[top.heroId]?.tier}` : ""}
                  </p>
                </div>
              </div>
              <ul className="space-y-1 text-[10px]">
                <li className="text-foam/90">
                  <span className="text-mist">1.</span> {metaText(top)}
                </li>
                <li className="text-foam/90">
                  <span className="text-mist">2.</span> {typeText(top)}
                </li>
                <li className="text-mist/70 font-mono">
                  sobrevivência proxy até o pick: {top.availability == null ? "sem dado" : `${pct(top.availability, 0)} vivo`}
                </li>
              </ul>
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
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-foam truncate">{name}</p>
                      <p className="text-[9px] text-mist/80 truncate" title={`${metaText(candidate)} · ${typeText(candidate)}`}>
                        {candidate.percentile == null ? "sem θ̂ na lane" : `${Math.round(candidate.percentile * 100)}º pct`}
                        {" · "}
                        {candidate.archetype ? ARCHETYPE_LABEL[candidate.archetype.top] : "sem par"}
                        {candidate.balance === 1 ? " (contrapeso)" : ""}
                        {candidate.availability != null ? ` · ${num(candidate.availability * 100, 0)}% vivo` : ""}
                      </p>
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

      <p className="text-[9px] text-mist/60 leading-relaxed pt-1 border-t border-line/60">
        Fatores: percentil do θ̂ na lane (peso 1) e tipo que contrabalança o dominante inimigo (peso 0,25 declarado).
        A ordem é leitura — não é probabilidade. “vivo” é proxy de hazard.
      </p>
    </section>
  );
}
