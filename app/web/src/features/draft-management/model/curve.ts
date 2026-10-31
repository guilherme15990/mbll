/**
 * Draft Management — curva por faixa de duração (ADR-053 D3).
 *
 * Fonte: `Pair.curve` (`{label, mid, win}`) — a mesma curva que a tela de
 * confronto mostra por par, e da qual o motor deriva `Pair.profile`.
 *
 * A leitura é de SINERGIA INTERNA: percorre TODAS as duplas do time (2 a 2,
 * `i < j`) e devolve a MÉDIA das curvas por faixa — uma série por time. O
 * confronto contra o outro lado já é a matriz 5×5: a curva não o repete.
 *
 * Regras:
 * - dupla = par de heróis escolhidos do time (5 heróis → até 10 duplas);
 *   a fonte lista só os melhores parceiros de cada herói, então dupla não
 *   listada simplesmente não contribui — nunca é inventada;
 * - as duas perspectivas (`synergiesUp`, com `synergiesDown` como reserva, no
 *   livro de cada um dos dois) entram com peso igual; cada curva é lida no
 *   livro do próprio herói;
 * - cada dupla vale UM valor por faixa; a faixa é a média das duplas presentes;
 * - faixa sem dupla observada = null (buraco na linha), nunca 0;
 * - `n` = duplas com ponto na faixa; a ordem vem do `mid` (minutos);
 * - NÃO é win rate do time: é proxy do comportamento das duplas.
 */
import { finite, mean } from "./common.ts";
import type { CurvePoint, MatchupBooks, PairObs } from "./pairs.ts";

export type CurveBand = { mid: number; label: string; value: number | null; n: number };

export type TeamCurve = {
  bands: CurveBand[];
  /** Duplas distintas que contribuíram (com ao menos um ponto). */
  pairs: number;
  /** Pontos observados somados. */
  points: number;
};

type Bucket = { mid: number; label: string; values: number[] };

/** Curva da dupla no livro de um dos heróis (positiva antes da negativa). */
function duoCurve(owner: number, mate: number, books: MatchupBooks): PairObs | null {
  const book = books[owner];
  if (!book) return null;
  return (
    book.synergiesUp.find((pair) => pair.id === mate) ??
    book.synergiesDown.find((pair) => pair.id === mate) ??
    null
  );
}

/** Média da curva de UMA perspectiva por faixa (um valor por faixa). */
function curveBandMeans(curve: readonly CurvePoint[]): Map<number, { label: string; value: number }> {
  const byMid = new Map<number, Bucket>();
  for (const point of curve) {
    if (!finite(point.mid) || !finite(point.win)) continue;
    const bucket = byMid.get(point.mid) ?? { mid: point.mid, label: point.label, values: [] };
    bucket.values.push(point.win);
    byMid.set(point.mid, bucket);
  }
  const out = new Map<number, { label: string; value: number }>();
  for (const bucket of byMid.values()) {
    const value = mean(bucket.values);
    if (value != null) out.set(bucket.mid, { label: bucket.label, value });
  }
  return out;
}

/** Curva do lado: média das curvas das duplas do time, por faixa. */
export function teamCurve(ids: readonly number[], books: MatchupBooks): TeamCurve {
  const buckets = new Map<number, Bucket>();
  let pairs = 0;
  let points = 0;

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      if (a === b) continue;

      const perspectives: Map<number, { label: string; value: number }>[] = [];
      for (const [owner, mate] of [
        [a, b],
        [b, a],
      ] as const) {
        const pair = duoCurve(owner, mate, books);
        if (!pair?.curve?.length) continue;
        const means = curveBandMeans(pair.curve);
        if (!means.size) continue;
        points += pair.curve.filter((point) => finite(point.mid) && finite(point.win)).length;
        perspectives.push(means);
      }
      if (!perspectives.length) continue;
      pairs += 1;

      // Cada dupla vale UM valor por faixa: média das perspectivas presentes.
      const mids = new Set<number>(perspectives.flatMap((means) => [...means.keys()]));
      for (const mid of mids) {
        const label = perspectives.find((means) => means.has(mid))?.get(mid)?.label ?? `${mid}`;
        const value = mean(perspectives.map((means) => means.get(mid)?.value).filter(finite));
        if (value == null) continue;
        const bucket = buckets.get(mid) ?? { mid, label, values: [] };
        // 0 e 1 exatos são taxas degeneradas da fonte: entram, mas são raras.
        bucket.values.push(value);
        buckets.set(mid, bucket);
      }
    }
  }

  const bands = [...buckets.values()]
    .sort((x, y) => x.mid - y.mid)
    .map((bucket) => ({ mid: bucket.mid, label: bucket.label, value: mean(bucket.values), n: bucket.values.length }));

  return { bands, pairs, points };
}

export type CurveDelta = { mid: number; label: string; delta: number | null };

/** Δ (nós − inimigo) em pontos de taxa, alinhado por faixa. Só onde os dois têm dado. */
export function curveDelta(ours: TeamCurve, theirs: TeamCurve): CurveDelta[] {
  const byMid = new Map(theirs.bands.map((band) => [band.mid, band]));
  return ours.bands.map((band) => {
    const other = byMid.get(band.mid);
    return {
      mid: band.mid,
      label: band.label,
      delta: band.value != null && other?.value != null ? band.value - other.value : null,
    };
  });
}

/** Faixa em que o nosso lado está mais acima/abaixo (para o resumo em texto). */
export function curvePeak(delta: readonly CurveDelta[]): CurveDelta | null {
  let best: CurveDelta | null = null;
  for (const row of delta) {
    if (row.delta == null) continue;
    if (best?.delta == null || Math.abs(row.delta) > Math.abs(best.delta)) best = row;
  }
  return best;
}

/** Converte a taxa para exibição em % (0–100), sem reinterpretar a escala. */
export function curvePct(value: number | null): number | null {
  return value == null ? null : Math.round(value * 1000) / 10;
}

/** Pontos no formato que o gráfico consome (uma linha por lado). */
export function curveRows(
  ours: TeamCurve,
  theirs: TeamCurve,
): { mid: number; label: string; ours: number | null; theirs: number | null }[] {
  const byMid = new Map(theirs.bands.map((band) => [band.mid, band]));
  const mids = new Set<number>([...ours.bands.map((b) => b.mid), ...theirs.bands.map((b) => b.mid)]);
  return [...mids]
    .sort((a, b) => a - b)
    .map((mid) => {
      const a = ours.bands.find((band) => band.mid === mid);
      const b = byMid.get(mid);
      return {
        mid,
        label: a?.label ?? b?.label ?? `${mid}`,
        ours: a?.value != null ? Math.round(a.value * 1000) / 10 : null,
        theirs: b?.value != null ? Math.round(b.value * 1000) / 10 : null,
      };
    });
}
