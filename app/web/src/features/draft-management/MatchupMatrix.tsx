import { Swords, Info } from "lucide-react";
import { cx, num } from "../../shared/api";
import type { DraftHero, HeroPool, MatchupMatrix as Matrix, MatrixCell, MatrixCellState } from "./model";
import { LANE_LABEL } from "./labels";

/**
 * Matriz 5×5 de confronto direto (ADR-053 D7).
 *
 * Cada célula é UM par; direção vem da lista, |δ| é severidade. O resumo é
 * contagem de pares, nunca a soma dos efeitos.
 */
const CELL: Record<MatrixCellState, { glyph: string; cls: string; label: string }> = {
  advantage: {
    glyph: "+",
    cls: "text-emerald-300 bg-emerald-400/10 border-emerald-400/30",
    label: "nós counteramos",
  },
  disadvantage: {
    glyph: "−",
    cls: "text-rose-300 bg-rose-400/10 border-rose-400/30",
    label: "eles counteram",
  },
  contested: {
    glyph: "±",
    cls: "text-amber-300 bg-amber-400/10 border-amber-400/30",
    label: "os dois lados (contested)",
  },
  unknown: { glyph: "·", cls: "text-mist/40 bg-abyss/60 border-line/60", label: "sem par observado" },
};

const heroName = (pool: HeroPool, id: number | null, fallback = "—"): string =>
  id == null ? fallback : (pool[id]?.name ?? `Herói #${id}`);

function shortName(hero: DraftHero | undefined, id: number | null, fallback: string): string {
  if (id == null) return fallback;
  return hero?.name ?? `#${id}`;
}

function Cell({ cell, ours, theirs }: { cell: MatrixCell; ours: string; theirs: string }) {
  const tone = CELL[cell.state];
  return (
    <td
      className={cx("rounded-lg border min-w-[34px] h-9 w-full text-sm font-black align-middle", tone.cls)}
      title={`${ours} × ${theirs}: ${tone.label}${cell.delta == null ? "" : ` · |δ| ${num(cell.delta, 3)}`}`}
    >
      <span aria-hidden="true">{tone.glyph}</span>
      <span className="sr-only">
        {ours} contra {theirs}: {tone.label}
      </span>
    </td>
  );
}

export default function MatchupMatrix({ matrix, pool }: { matrix: Matrix; pool: HeroPool }) {
  const total = matrix.rows.length * matrix.cols.length;
  const observed = matrix.rows.reduce((sum, row) => sum + row.observed, 0);
  const advantages = matrix.rows.reduce((sum, row) => sum + row.advantages, 0);
  const disadvantages = matrix.rows.reduce((sum, row) => sum + row.disadvantages, 0);
  const contested = matrix.rows.reduce((sum, row) => sum + row.contested, 0);

  return (
    <section className="card p-3.5 space-y-2.5" aria-label="Matriz de confronto 5 por 5">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <p className="lbl flex items-center gap-1.5">
          <Swords size={12} className="text-gold" aria-hidden="true" /> Confronto 5×5
        </p>
        <div className="flex items-center gap-1.5 text-[9px] font-mono">
          <span className="px-1.5 py-0.5 rounded border border-emerald-400/30 text-emerald-300">+ {advantages}</span>
          <span className="px-1.5 py-0.5 rounded border border-rose-400/30 text-rose-300">− {disadvantages}</span>
          <span className="px-1.5 py-0.5 rounded border border-amber-400/30 text-amber-300">± {contested}</span>
          <span className="px-1.5 py-0.5 rounded border border-line text-mist">· {total - observed}</span>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-separate border-spacing-1 text-center">
          <colgroup>
            <col style={{ width: "82px" }} />
            {matrix.cols.map((col) => (
              <col key={col.index} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="text-left text-[9px] font-mono text-mist/70">nós \ eles</th>
              {matrix.cols.map((col, index) => (
                <th key={col.index} className="text-[9px] font-mono font-normal text-mist px-0.5">
                  <span className="block max-w-full truncate" title={heroName(pool, col.heroId, `Inimigo ${index + 1}`)}>
                    {shortName(pool[col.heroId ?? -1], col.heroId, `E${index + 1}`)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => {
              const oursName = heroName(pool, row.heroId, `Slot ${row.index + 1}`);
              return (
                <tr key={row.index}>
                  <th scope="row" className="text-left text-[9px] font-mono font-normal text-mist min-w-0">
                    <span className="block max-w-full truncate text-foam" title={`${oursName} · ${LANE_LABEL[row.lane]}`}>
                      {shortName(pool[row.heroId ?? -1], row.heroId, LANE_LABEL[row.lane])}
                    </span>
                    <span className="block text-[8px] text-mist/60">{LANE_LABEL[row.lane]}</span>
                  </th>
                  {row.cells.map((cell, index) => (
                    <Cell
                      key={index}
                      cell={cell}
                      ours={oursName}
                      theirs={heroName(pool, matrix.cols[index]?.heroId ?? null, `Inimigo ${index + 1}`)}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[9px] text-mist/70 flex items-start gap-1.5">
        <Info size={10} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          Cada célula é um par: <b className="text-emerald-300">+</b> nós counteramos, <b className="text-rose-300">−</b>{" "}
          eles counteram e <b className="text-amber-300">±</b> os dois lados (contestado). O resumo conta pares — a
          matriz não soma efeitos em “vantagem total”.
        </span>
      </p>
    </section>
  );
}
