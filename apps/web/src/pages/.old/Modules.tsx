import { Link } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import { useModules } from "../../lib/api";
import { useFilters } from "../../App";
import { ErrBox, Loading, SectionTitle } from "../../components/ui";

const STATUS_COLOR: Record<string, string> = {
  "validado": "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  "provisório": "text-amber-200 border-amber-300/30 bg-amber-300/10",
  "proposta": "text-sky-200 border-sky-300/30 bg-sky-300/10",
  "experimental": "text-violet-200 border-violet-300/30 bg-violet-300/10",
  "descritivo": "text-cyan-200 border-cyan-300/30 bg-cyan-300/10",
  "proxy": "text-orange-200 border-orange-300/30 bg-orange-300/10",
  "camada-A": "text-gold border-gold/30 bg-gold/10",
};

export default function Modules() {
  const { rank, window } = useFilters();
  const q = useModules();
  if (q.isLoading) return <Loading rows={9} />;
  if (q.isError || !q.data) return <ErrBox onRetry={() => q.refetch()} />;
  return (
    <section className="grid gap-4">
      <SectionTitle kicker="9 contextos · 1 por PRD" title={`Índice de contextos · ${rank} · ${window}d`}
        right={<span className="text-[11px] text-mist">c={q.data.c_reference} · {q.data.c_grade}</span>} />
      <p className="text-xs text-mist">Cada cartão é um bounded context do DDD: pergunta, agregado e linguagem ubíqua. Nada aqui é previsão — índices de pressão com incerteza declarada.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {q.data.data.map((m: any) => (
          <article key={m.id} className="card p-4 grid gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-8 h-8 rounded-xl bg-gold/15 border border-gold/40 flex items-center justify-center"><LayoutGrid size={16} className="text-gold" /></span>
              <h3 className="font-bold text-sm">CTX-{m.id} · {m.name}</h3>
              <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full border ${STATUS_COLOR[m.status] ?? "text-mist border-line"}`}>{m.status}</span>
            </div>
            <p className="text-xs"><b>{m.question}</b> <span className="text-mist">· {m.en} · agregado <code>{m.aggregate}</code></span></p>
            <code className="text-[11px] leading-relaxed text-foam/90 bg-abyss/70 border border-line rounded-xl px-3 py-2 whitespace-pre-wrap">{m.formula}</code>
            <div className="flex items-center gap-2 text-[11px] flex-wrap">
              <span className="text-mist">{m.doc}</span>
              <code className="text-mist num">{m.endpoint}</code>
              <Link className="btn-ghost ml-auto" to={m.id === "BDL" ? `/hero/1?rank=${rank}&window=${window}` : m.id === "M6" || m.id === "DRF" || m.id === "BPS" ? `/hero/1?rank=${rank}&window=${window}` : m.id === "RNK" || m.id === "TMP" || m.id === "CNF" ? `/hero/1?rank=${rank}&window=${window}` : `/?rank=${rank}&window=${window}`}>
                Ver no app →
              </Link>
            </div>
          </article>
        ))}
      </div>
      <p className="text-[11px] text-mist">Impossibilidades: {(q.data.impossibilities ?? []).join(" · ")}. Detalhes e cortes em <Link className="underline" to="/method">Método</Link>.</p>
    </section>
  );
}
