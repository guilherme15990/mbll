// meta/assess-series — BC-TEMPO / DDD-V4-05 (corpo idêntico ao ex-engine).
// SnapshotHistory detém ordenação, lacuna, duplicata e "série curta".
// T5 consome a série (INV4-015): persistente|revertido exige ≥2 snapshots VERIFICADOS
// não-sobrepostos com span ≥14d; <14d ou 1 snapshot ⇒ serie_curta; só janelas
// sobrepostas ⇒ inconclusivo (sem replicação independente). Violados entram no histórico
// (auditoria) mas NUNCA contam como replicação. Duplicata (mesmo hash) conta 1.
// Não-sobreposição: intervalos [t-w,t] disjuntos ⇔ gap ≥ janela do posterior.
// Puro, sem I/O, zero dependências.
/**
 * @param snaps [{coletado_em, janela, payload_hash, status}]
 */
export function assessSeries(snaps = []) {
  const base = { n_snapshots: 0, n_distintos: 0, span_dias: 0, nao_sobrepostos: false, lacunas: 0, status: "serie_curta", motivo: "sem snapshots verificados" };
  const ver = (snaps ?? [])
    .filter((s) => s && s.status !== "violado")
    .map((s) => ({ ts: Number(s.coletado_em ?? s.ts), janela: Number(s.janela ?? 7) || 7, hash: String(s.payload_hash ?? s.hash ?? "") }))
    .filter((s) => Number.isFinite(s.ts) && s.ts > 0)
    .sort((a, b) => a.ts - b.ts);
  const distintos = ver.filter((s, i) => i === 0 || s.hash === "" || s.hash !== ver[i - 1].hash);
  const n = distintos.length;
  if (!n) return base;
  const span = (distintos[n - 1].ts - distintos[0].ts) / 86400e3;
  const head = { n_snapshots: ver.length, n_distintos: n, span_dias: +span.toFixed(2) };
  if (n < 2) return { ...head, nao_sobrepostos: false, lacunas: 0, status: "serie_curta", motivo: "1 snapshot verificado — sem replicação (INV4-015)" };
  if (span < 14) return { ...head, nao_sobrepostos: false, lacunas: 0, status: "serie_curta", motivo: `span ${head.span_dias}d < 14d (INV4-015)` };
  let nao = false, lac = 0;
  for (let j = 1; j < n; j++) {
    const gap = distintos[j].ts - distintos[j - 1].ts;
    if (gap >= distintos[j].janela * 86400e3) nao = true;
    if (gap > 2 * Math.max(distintos[j].janela, distintos[j - 1].janela) * 86400e3) lac++;
  }
  if (!nao) return { ...head, nao_sobrepostos: false, lacunas: lac, status: "inconclusivo", motivo: "só janelas sobrepostas — sem replicação independente" };
  return { ...head, nao_sobrepostos: true, lacunas: lac, status: "avaliavel", motivo: "≥2 verificados não-sobrepostos, span ≥14d" };
}
