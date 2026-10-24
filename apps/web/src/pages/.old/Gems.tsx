import { Link } from "react-router-dom";
import { num } from "../../lib/api";
import { useFilters } from "../../App";
import { useGems } from "../../lib/api";
import { Avatar, ClassSeal, Empty, ErrBox, GhostNote, Loading, SectionTitle } from "../../components/ui";

export default function Gems() {
  const { rank, window } = useFilters();
  const q = useGems(rank, window);
  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrBox onRetry={() => q.refetch()} />;
  const rows = q.data!.data;
  if (!rows.length)
    return <Empty title="Nenhuma joia" hint="Joia = q≤0,05 + θ̂ acima da mediana + pick e ban abaixo do quantil 0,25. Neste elo/janela, o mercado já precificou tudo — ou o ruído venceu." to="/method" action="Ver o método" />;
  return (
    <section className="grid gap-3">
      <SectionTitle kicker="Descoberta · achar antes de virar meta" title={`Joias escondidas (${rows.length})`} />
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((g) => (
          <div key={g.id} className="card card-h p-4 flex gap-3">
            <Avatar src={g.head} name={g.name} size={56} />
            <div className="grid gap-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Link to={`/hero/${g.id}?rank=${rank}&window=${window}`} className="font-bold hover:text-gold">{g.name}</Link>
                <ClassSeal cls="Joia" conf={g.confidence} />
              </div>
              <p className="text-sm">θ̂ <b className="num">{num(g.wrAdj, 3)}</b> · d <b className="num">{num(g.d)}</b> · q <b className="num">{num(g.q, 3)}</b></p>
              <GhostNote>{g.reason}</GhostNote>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
