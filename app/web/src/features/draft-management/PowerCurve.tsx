import { Clock, Info } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { pp } from "../../shared/format";
import { curvePeak, curveRows, type CurveDelta, type TeamCurve } from "./model";

/**
 * Curva de duração (ADR-053 D3).
 *
 * Cada dupla do time resolve a própria curva (a mesma leitura da tela de
 * confronto); a faixa mostra a média dessas curvas. NÃO é win rate do time:
 * é proxy do comportamento das duplas, com faixa vazia em branco.
 */
export default function PowerCurve({
  curve,
}: {
  curve: { ours: TeamCurve; theirs: TeamCurve; delta: CurveDelta[] };
}) {
  const rows = curveRows(curve.ours, curve.theirs);
  const values = rows.flatMap((row) => [row.ours, row.theirs]).filter((value): value is number => value != null);
  const peak = curvePeak(curve.delta);

  if (values.length === 0) {
    return (
      <section className="card p-3.5 space-y-2" aria-label="Curva de evolução por duração">
        <p className="lbl flex items-center gap-1.5">
          <Clock size={12} className="text-gold" aria-hidden="true" /> Evolução por duração
        </p>
        <p className="text-[11px] text-mist">
          Sem curva de sinergia nas duplas deste time. Faixa sem dupla fica em branco — não vira zero.
        </p>
      </section>
    );
  }

  const lo = Math.max(0, Math.floor(Math.min(...values, 50) - 2));
  const hi = Math.min(100, Math.ceil(Math.max(...values, 50) + 2));

  return (
    <section className="card p-3.5 space-y-2" aria-label="Curva de evolução por duração">
      <header className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="lbl flex items-center gap-1.5">
            <Clock size={12} className="text-gold" aria-hidden="true" /> Evolução por duração
          </p>
          <p className="text-[10px] text-mist mt-0.5">
            Média das curvas das duplas do time, por faixa de duração —{" "}
            <b className="text-foam/80">proxy</b>, não win rate do time.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-mist shrink-0">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-400" aria-hidden="true" />
            {curve.ours.pairs > 0 ? `nós (${curve.ours.pairs} duplas)` : "nós: sem dupla listada"}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-400" aria-hidden="true" />
            {curve.theirs.pairs > 0 ? `eles (${curve.theirs.pairs} duplas)` : "eles: sem dupla listada"}
          </span>
        </div>
      </header>

      {(curve.ours.pairs === 0 || curve.theirs.pairs === 0) && (
        <p className="text-[9px] text-amber-300/90">
          A fonte lista só os melhores parceiros de cada herói: time sem dupla listada fica sem linha, e nenhuma dupla é
          inventada.
        </p>
      )}

      <div className="h-[220px] -ml-2" role="img" aria-label="Curva da média das curvas das duplas por faixa de duração">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="#1e2a4a" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#33456b" fontSize={10} tickLine={false} />
            <YAxis domain={[lo, hi]} stroke="#33456b" fontSize={10} tickLine={false} width={36} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: "#0d1528", border: "1px solid #1e2a4a", borderRadius: 10, fontSize: 12 }}
              labelStyle={{ color: "#94a3b8" }}
              formatter={(value: any, key: any) => [value == null ? "sem par" : `${Number(value).toFixed(1)}%`, key === "ours" ? "nós" : "eles"]}
            />
            <ReferenceLine y={50} stroke="#475569" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="ours" stroke="#38bdf8" strokeWidth={2} dot={{ r: 2.5 }} connectNulls={false} />
            <Line type="monotone" dataKey="theirs" stroke="#fb7185" strokeWidth={2} dot={{ r: 2.5 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[9px] uppercase tracking-wider text-mist/70 font-bold">Δ nós − eles</span>
        {curve.delta.map((row) => (
          <span
            key={row.mid}
            className={
              row.delta == null
                ? "text-[9px] font-mono px-1.5 py-0.5 rounded border border-line text-mist/60"
                : `text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                    row.delta >= 0
                      ? "border-emerald-400/30 text-emerald-300 bg-emerald-400/5"
                      : "border-rose-400/30 text-rose-300 bg-rose-400/5"
                  }`
            }
            title={`faixa ${row.label}: diferença das médias das curvas das duplas`}
          >
            {row.label} {row.delta == null ? "sem dupla" : pp(row.delta * 100, 1)}
          </span>
        ))}
      </div>

      <p className="text-[9px] text-mist/70 flex items-start gap-1.5">
        <Info size={10} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          Cada faixa é a média das curvas das duplas do time (2 a 2) — uma dupla = um valor na faixa, não um ponto.
          Faixa sem dupla fica em branco. A curva descreve as duplas, não o time.
          {peak?.delta != null ? ` Maior separação em ${peak.label} (${pp(peak.delta * 100, 1)}).` : ""}
        </span>
      </p>
    </section>
  );
}
