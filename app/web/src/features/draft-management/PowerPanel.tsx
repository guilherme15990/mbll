import { AlertTriangle, Crosshair, HelpCircle, Layers } from "lucide-react";
import { cx, num, pct } from "../../shared/api";
import { signed } from "../../shared/format";
import {
  scaleIndex,
  type DraftAnalysis,
  type HeroPool,
  type PowerComponent,
  type TeamPower,
} from "./model";

function barPct(value: number | null): number {
  if (value == null) return 50;
  return scaleIndex(value) ?? 50;
}

function ComponentRow({ component, ours, theirs }: { component: PowerComponent; ours: TeamPower; theirs: TeamPower }) {
  const mine = ours.components.find((row) => row.key === component.key);
  const other = theirs.components.find((row) => row.key === component.key);
  const mineValue = mine?.value ?? null;
  const otherValue = other?.value ?? null;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-foam font-semibold">{component.label}</span>
        <span className="text-[10px] text-mist font-mono">
          {mineValue == null ? "sem dado" : signed(mineValue, 3)} · {otherValue == null ? "sem dado" : signed(otherValue, 3)}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-abyss border border-line/60 overflow-hidden">
        <span className="absolute left-1/2 top-0 bottom-0 w-px bg-line" aria-hidden="true" />
        <span
          className={cx("absolute top-0 bottom-0", mineValue != null && mineValue >= 0 ? "bg-emerald-400" : "bg-rose-400")}
          style={
            mineValue == null
              ? { display: "none" }
              : {
                  left: `${Math.min(50, barPct(mineValue))}%`,
                  width: `${Math.abs(barPct(mineValue) - 50)}%`,
                }
          }
          aria-hidden="true"
        />
      </div>
      <p className="text-[9px] text-mist/60 font-mono">
        suporte {mine?.observed ?? 0}/{mine?.total ?? 0} · {component.note}
      </p>
    </div>
  );
}

function Structure({ power, pool }: { power: TeamPower; pool: HeroPool }) {
  const offLane = power.laneFit
    .filter((row) => row.heroId != null && row.fit === false)
    .map((row) => pool[row.heroId as number]?.name ?? `Herói #${row.heroId}`);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-foam font-semibold flex items-center gap-1">
          <Layers size={11} className="text-gold" aria-hidden="true" /> Rotas
        </span>
        <span className="text-[10px] font-mono text-mist">
          {power.laneFitRate == null ? "sem dado" : `${Math.round(power.laneFitRate * 100)}% no encaixe`}
        </span>
      </div>
      <p className="text-[10px] text-mist font-mono">
        {power.emptyLanes.length ? `sem slot: ${power.emptyLanes.join(", ")}` : "5 rotas cobertas"}
        {power.flex != null ? ` · flex médio ${power.flex.toFixed(1)} rotas` : ""}
      </p>
      {offLane.length > 0 && (
        <p className="text-[10px] text-amber-300/90 flex items-start gap-1">
          <AlertTriangle size={10} className="mt-0.5 shrink-0" aria-hidden="true" />
          fora da rota: {offLane.join(", ")}
        </p>
      )}
      <p className="text-[10px] text-mist/60 font-mono">
        contestação pick {pct(power.contest.pick)} · ban {pct(power.contest.ban)}
      </p>
    </div>
  );
}

/**
 * Detalhe do índice (ADR-052). Os cards de índice e a divisão em % ficaram no
 * `StrengthBar` (ADR-053 D2) — aqui ficam componentes, estrutura e turnos.
 */
export default function PowerPanel({ analysis, pool }: { analysis: DraftAnalysis; pool: HeroPool }) {
  const { ourPower, theirPower, firstPick, next } = analysis;
  const firstLabel = firstPick.side === "us" ? "meu time" : "inimigo";
  const lastLabel = firstPick.side === "us" ? "inimigo" : "meu time";

  return (
    <section className="card p-3.5 space-y-3" aria-label="Detalhe do índice de poder">
      <header>
        <p className="lbl">Detalhe do índice</p>
        <p className="text-[10px] text-mist mt-0.5">
          Relativo ao recorte — 50 = neutro, não é probabilidade, não é previsão.
        </p>
      </header>

      <div className="space-y-2">
        {ourPower.components.map((component) => (
          <ComponentRow key={component.key} component={component} ours={ourPower} theirs={theirPower} />
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 pt-2 border-t border-line/60">
        <Structure power={ourPower} pool={pool} />
        <Structure power={theirPower} pool={pool} />
      </div>

      <div className="pt-2 border-t border-line/60 space-y-1">
        <p className="text-[11px] text-foam font-semibold flex items-center gap-1">
          <Crosshair size={11} className="text-gold" aria-hidden="true" /> Primeiro pick
        </p>
        <p className="text-[10px] text-mist">
          1º pick: <b className="text-foam">{firstLabel}</b> · último pick: <b className="text-foam">{lastLabel}</b>{" "}
          <span className="font-mono text-mist/60">
            (turnos {firstPick.firstLast ?? "—"} e {firstPick.secondLast ?? "—"})
          </span>
        </p>
        {firstPick.exposure ? (
          <p className="text-[10px] text-mist">
            exposição do 1º lock: <b className="text-foam">{firstPick.exposure.available}</b> counter(s) disponível(is)
            {firstPick.exposure.worst != null
              ? ` · pior |δ| ${num(firstPick.exposure.worst, 3)} (${firstPick.exposure.worstName})`
              : ""}
          </p>
        ) : (
          <p className="text-[10px] text-mist/70">exposição do 1º lock: sem herói no slot 1.</p>
        )}
        {firstPick.leverage ? (
          <p className="text-[10px] text-mist">
            respostas do último pick: <b className="text-foam">{firstPick.leverage.available}</b> no pool atual
            {firstPick.leverage.worst != null
              ? ` · pior |δ| ${num(firstPick.leverage.worst, 3)} (${firstPick.leverage.worstName})`
              : ""}
          </p>
        ) : (
          <p className="text-[10px] text-mist/70">respostas do último pick: sem pick do 1º lado ainda.</p>
        )}
        <p className="text-[9px] text-mist/60 flex items-start gap-1">
          <HelpCircle size={10} className="mt-0.5 shrink-0" aria-hidden="true" />
          Opções no pool atual, não chance de o outro lado escolher.
        </p>
      </div>

      {next && (
        <p className="text-[10px] text-mist/80 pt-1 border-t border-line/60">
          Próximo turno:{" "}
          <b className={next.side === "us" ? "text-sky-300" : "text-rose-300"}>
            pick do {next.side === "us" ? "meu time" : "inimigo"}
          </b>{" "}
          <span className="font-mono text-mist/60">#{next.step}</span>
        </p>
      )}
    </section>
  );
}
