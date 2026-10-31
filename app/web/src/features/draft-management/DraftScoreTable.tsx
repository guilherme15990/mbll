import type { HeroDraftScoreRow } from "../../shared/api";
import { cx, num } from "../../shared/api";
import { Avatar } from "../../shared/ui";

/**
 * Tabela do Draft Score (página de TESTE). Ordenação vem do chamador.
 *
 * A superfície mostra UM número por herói: o Draft Score 0–100 (min–max da WR no
 * recorte — maior WR = 100, menor = 0). Nada de pick/ban, incerteza ou colunas
 * derivadas — só o número.
 */
const scoreTone = (score: number | null): string =>
  score == null
    ? "text-mist"
    : score >= 66
      ? "text-emerald-300"
      : score >= 34
        ? "text-foam"
        : "text-rose-300";

export default function DraftScoreTable({ rows }: { rows: readonly HeroDraftScoreRow[] }) {
  if (!rows.length) {
    return (
      <p className="card p-4 text-[11px] text-mist">
        Nenhum herói no recorte — sem lote não há Draft Score a exibir.
      </p>
    );
  }
  return (
    <div className="card p-0 overflow-x-auto">
      <table className="w-full text-[11px] border-collapse">
        <caption className="sr-only">Draft Score por herói: um número 0–100 (min–max da WR no recorte)</caption>
        <thead>
          <tr className="text-left text-[9px] uppercase tracking-wider text-mist/70 border-b border-line/60">
            <th className="px-2 py-2 w-8">#</th>
            <th className="px-2 py-2">Herói</th>
            <th className="px-2 py-2 text-right" title="Min–max da WR no recorte (0–100): maior WR = 100, menor = 0">
              Draft Score
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-b border-line/30">
              <td className="px-2 py-2 font-mono text-mist">{i + 1}</td>
              <td className="px-2 py-2">
                <div className="flex items-center gap-2">
                  <Avatar src={r.head} name={r.name ?? `Herói #${r.id}`} size={22} />
                  <p className="font-semibold text-foam truncate">{r.name ?? `Herói #${r.id}`}</p>
                </div>
              </td>
              <td className={cx("px-2 py-2 text-right font-mono font-bold text-base", scoreTone(r.draft_score))}>
                {r.draft_score == null ? "—" : num(r.draft_score, 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
