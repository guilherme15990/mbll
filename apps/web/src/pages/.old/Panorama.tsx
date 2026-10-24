import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, Search } from "lucide-react";
import { cx, num, pct, useHeroes } from "../../lib/api";
import { useFilters } from "../../App";
import { Avatar, ClassSeal, CtxSeal, Delta, Empty, ErrBox, FreshLine, Loading, SectionTitle, ThetaBar, TierBadge } from "../../components/ui";

type SortKey = "d" | "win" | "pick" | "ban" | "q";

export default function Panorama() {
  const { rank, window } = useFilters();
  const [q, setQ] = useState("");
  const [tier, setTier] = useState("todos");
  const [sort, setSort] = useState<SortKey>("d");
  const query = useHeroes(rank, window);
  const heroes = useMemo(() => {
    let rows = query.data?.data ?? [];
    if (q) rows = rows.filter((h) => h.name.toLowerCase().includes(q.toLowerCase()));
    if (tier !== "todos") rows = rows.filter((h) => h.tier === tier);
    const key = sort === "win" ? "wrAdj" : sort === "pick" ? "pick" : sort === "ban" ? "ban" : sort;
    return [...rows].sort((a: any, b: any) => sort === "q" ? a.q - b.q : b[key] - a[key]);
  }, [query.data, q, tier, sort]);
  const med = useMemo(() => {
    const ws = (query.data?.data ?? []).map((h) => h.wrAdj).sort((a, b) => a - b);
    return ws.length ? ws[Math.floor(ws.length / 2)] : 0.5;
  }, [query.data]);

  if (query.isLoading) return <Loading rows={10} />;
  if (query.isError) return <ErrBox onRetry={() => query.refetch()} />;
  if (!heroes.length)
    return <Empty title="Nada por aqui" hint="Nenhum herói passa os filtros neste elo e janela — ou ninguém passa o controle de falsas descobertas (q≤0,05)." to="/method" action="Ver o método" />;

  return (
    <section className="grid gap-4">
      <SectionTitle kicker="Panorama · ver o mercado" title={`${query.data!.total} heróis · ${rank} · ${window}d`}
        right={<FreshLine stale={query.data!.stale} ageMs={query.data!.collectedAgoMs} postPatch={query.data!.postPatch} />} />
      {query.data!.truncated && <p className="text-xs text-amber-300">Mostrando parcial da fonte (total {query.data!.totalFonte}).</p>}
      <div className="card p-3 flex gap-2 flex-wrap items-center">
        <label className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={15} className="text-mist shrink-0" />
          <input className="inp w-full" placeholder="Buscar herói…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="sel" value={tier} onChange={(e) => setTier(e.target.value)}>
          {["todos", "S", "A", "B", "C", "D"].map((t) => <option key={t} value={t}>tier {t}</option>)}
        </select>
        <label className="text-xs text-mist flex items-center gap-1.5"><ArrowUpDown size={13} />
          <select className="sel" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="d">ordenar: efeito d</option>
            <option value="q">ordenar: significância q</option>
            <option value="win">ordenar: θ̂ win</option>
            <option value="pick">ordenar: pick</option>
            <option value="ban">ordenar: ban</option>
          </select>
        </label>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-mist border-b border-line">
                <th className="px-4 py-2.5 font-medium">Herói</th>
                <th className="font-medium">Tier</th>
                <th className="font-medium" title="win rate ajustado (encolhido p/ mediana)">θ̂ win</th>
                <th className="font-medium" title="tamanho de efeito d">d</th>
                <th className="font-medium" title="q-valor BH">q</th>
                <th className="font-medium">pick</th>
                <th className="font-medium">ban</th>
                <th className="font-medium">classe</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {heroes.map((h) => (
                <tr key={h.id} className={cx("border-b border-line/60 last:border-0 hover:bg-panel2/60", h.isGem && "bg-cyan-300/[0.04]")}>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2.5">
                      <Avatar src={h.head} name={h.name} size={36} />
                      <span><span className="font-semibold">{h.name}</span> <span className="text-mist text-xs">#{h.id}</span>
                        {h.isGem && <span className="ml-1.5"><CtxSeal>💎 joia</CtxSeal></span>}
                        {h.degenerate && <span className="ml-1.5"><CtxSeal>ruído</CtxSeal></span>}</span>
                    </span>
                  </td>
                  <td><TierBadge tier={h.tier} /></td>
                  <td><span className="flex items-center gap-2"><span className="num">{num(h.wrAdj, 3)}</span><ThetaBar value={h.wrAdj} median={med} /><Delta z={h.z} /></span></td>
                  <td className="num">{num(h.d)}</td>
                  <td className="num text-mist">{num(h.q, 3)}</td>
                  <td className="num">{pct(h.pick)}</td>
                  <td className="num">{pct(h.ban)}</td>
                  <td><ClassSeal cls={h.class} conf={h.confidence} /></td>
                  <td className="pr-4 text-right"><Link to={`/hero/${h.id}?rank=${rank}&window=${window}`} className="btn-primary inline-block">Abrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
