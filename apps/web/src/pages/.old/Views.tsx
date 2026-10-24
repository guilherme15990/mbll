import { Link } from "react-router-dom";
import { num, useHeroes, useViews } from "../../lib/api";
import { useFilters } from "../../App";
import { Avatar, Empty, ErrBox, Loading, SectionTitle } from "../../components/ui";
import { Quadrant } from "../../components/charts";

export default function Views() {
  const { rank, window } = useFilters();
  const sem = useViews("semana", rank, window);
  const tier = useViews("tier", rank, window);
  const all = useHeroes(rank, window);
  const avg = all.data ? all.data.data.reduce((a, h) => a + h.wrAdj, 0) / Math.max(1, all.data.data.length) : 0.5;

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <SectionTitle kicker="Visão padrão · força da semana" title="Top 10 fortes e fracos" />
        {sem.isLoading ? <Loading rows={4} /> : sem.isError ? <ErrBox onRetry={() => sem.refetch()} /> : (
          <div className="grid gap-4 md:grid-cols-2">
            {([["Mais fortes", sem.data.data.strongest], ["Mais fracos", sem.data.data.weakest]] as const).map(([t, arr]) => (
              <div key={t} className="card p-4 grid gap-1">
                <p className="lbl">{t} · θ̂ (win ajustado)</p>
                {arr.map((h: any, i: number) => (
                  <Link key={h.id} to={`/hero/${h.id}?rank=${rank}&window=${window}`} className="flex items-center gap-2.5 py-1.5 border-b border-line/50 last:border-0 hover:bg-panel2/50 rounded-lg px-1">
                    <span className="num text-mist text-xs w-5">{i + 1}</span>
                    <Avatar src={h.head} name={h.name} size={30} />
                    <span className="text-sm font-medium flex-1 truncate">{h.name}</span>
                    <span className="num text-sm">θ̂ {num(h.wrAdj, 3)}</span>
                    <span className="num text-xs text-mist">d {num(h.d)}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-3">
        <SectionTitle kicker="Dispersão · presença × força" title="Mapa do meta" />
        <div className="card p-4">
          {all.isLoading ? <Loading rows={3} /> : all.isError ? <ErrBox onRetry={() => all.refetch()} /> : (
            <>
              <Quadrant data={all.data!.data} avg={avg} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-[11px]">
                <span className="border border-line rounded-lg px-2 py-1">⬆ direita/alto: <b>meta dominante</b></span>
                <span className="border border-cyan-300/40 rounded-lg px-2 py-1">⬆ esquerda/alto: <b className="text-cyan-200">joia escondida</b></span>
                <span className="border border-line rounded-lg px-2 py-1">⬇ direita/baixo: <b>armadilha</b></span>
                <span className="border border-line rounded-lg px-2 py-1">⬇ esquerda/baixo: <b>abandonado</b></span>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="grid gap-3">
        <SectionTitle kicker="Visão padrão · por tier" title="S/A/B/C/D por percentil de θ̂" />
        {tier.isLoading ? <Loading rows={3} /> : tier.isError ? <ErrBox onRetry={() => tier.refetch()} /> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Object.entries(tier.data.data).map(([t, arr]: any) => (
              <div key={t} className="card p-3">
                <p className="font-bold text-lg">{t} <span className="text-xs text-mist font-normal">({arr.length})</span></p>
                <ul className="mt-1 grid gap-1">
                  {arr.slice(0, 6).map((h: any) => (
                    <li key={h.id}><Link to={`/hero/${h.id}?rank=${rank}&window=${window}`} className="flex items-center gap-1.5 text-sm hover:text-gold"><Avatar src={h.head} name={h.name} size={22} /><span className="truncate">{h.name}</span></Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
