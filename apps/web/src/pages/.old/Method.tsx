import { ago, useHeroes, useMeta } from "../../lib/api";
import { ErrBox, Loading, SectionTitle } from "../../components/ui";

const CUTS = [
  ["α (significância)", "0,05", "q≤0,05 + θ̂ fora da mediana = forte/fraco"],
  ["presença da joia", "quantil 0,25", "pick e ban abaixo do q25 do elo"],
  ["joia desbalanceada", "d ≥ 2", "joia com efeito grande"],
  ["consistência entre elos", "I² ≤ 50%", "alerta exige 2 elos adjacentes (Fase 2)"],
  ["histerese", "2 coletas", "condição persiste 2 ciclos (Fase 2)"],
  ["janela pós-patch", "3 dias", "comparações que cruzam patch = janela mista"],
];

export default function Method({ health = false }: { health?: boolean }) {
  const q = useMeta();
  const sigma = useHeroes("mythic", "7");
  return (
    <div className="grid gap-6">
      {!health && (
        <section className="grid gap-3">
          <SectionTitle kicker="Fonte e método · confiar no resultado" title="Como o índice é calculado" />
          <div className="card p-4 grid gap-3">
            <ol className="grid gap-2 text-sm list-none">
              <li><b className="text-gold">M1 força real (hierárquico).</b> <span className="text-mist">y|θ~N(θ,s²), s²=μ(1−μ)/(c·pick); θ~N(μ,τ²); posterior V=(1/s²+1/τ²)⁻¹, m=V(y/s²+μ/τ²), B=τ²/(τ²+s²); μ̂=mediana, τ̂=1.48·MAD; grade c 1e4–1e7 (ref 1e5). Ver <a className="underline" href="/modules">Módulos</a>.</span></li>
              <li><b className="text-gold">M2 falsos positivos.</b> <span className="text-mist">Benjamini-Hochberg sobre ~133 heróis por elo: sem isso haveria dezenas de falsos alarmes por coleta.</span></li>
              <li><b className="text-gold">M3 presença.</b> <span className="text-mist">Quantis empíricos de pick/ban dentro do elo — sem pesos manuais.</span></li>
              <li><b className="text-gold">M4 momentum.</b> <span className="text-mist">Δ(1d−15d) e Δ(3d−30d)/(7d−30d) com mesmo sinal (S4).</span></li>
              <li><b className="text-gold">S7 duração.</b> <span className="text-mist">Curva nas 9 faixas, faixas 0/1 descartadas; snowball / scaling / uniforme.</span></li>
            </ol>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {CUTS.map(([k, v, d]) => (
                <div key={k} className="bg-abyss/60 border border-line rounded-xl px-3 py-2">
                  <p className="lbl">{k}</p>
                  <p className="num text-base text-gold">{v}</p>
                  <p className="text-[11px] text-mist">{d}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-mist">Limites declarados: intervalos dependem de pick≈amostra; lane/duração sem intervalo não entram em classificações; M8 (projeção) mede associação, não causalidade; dados comunitários, uso informativo.</p>
          </div>
        </section>
      )}
      <section className="grid gap-3">
        <SectionTitle kicker="Fonte e frescor" title="Saúde da fonte" />
        <div className="card p-4">
          {q.isLoading ? <Loading rows={3} /> : q.isError ? <ErrBox onRetry={() => q.refetch()} /> : (
            <ul className="grid gap-1.5 text-sm">
              <li>API <b className="num">arena.rone.dev</b> · erros acumulados: <b className="num">{q.data.health.errors}</b> · último ok: {q.data.health.lastOk ?? "—"}</li>
              <li>Cache SQLite: <b>{q.data.cache.sqlite ? `ativo (${q.data.cache.rows} chaves)` : "memória (SQLITE_CACHE=off)"}</b> · TTL A=2h/B=6h/C=24h + SWR</li>
              <li>Versões do jogo: {(q.data.versions ?? []).slice(0, 3).map((v: any) => v?.data?.game_version ?? "?").join(" · ") || "—"}</li>
              <li className="text-mist">no ar desde {q.data.startedAt} · página gerada {ago(0)}</li>
              <li>
                {(sigma.data as any)?.pickSumCheck
                  ? <span>Σ pick (mythic 7d): <b className="num">{(sigma.data as any).pickSumCheck.sum}</b> {(sigma.data as any).pickSumCheck.ok ? "· Σ≈1 ok" : "· ALERTA fora de 1±0.005"} · <span className="text-mist">slot_share · não validado (EXP)</span></span>
                  : <span className="text-mist">Σ pick: carregando…</span>}
              </li>
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
