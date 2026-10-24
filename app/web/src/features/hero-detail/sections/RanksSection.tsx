import { Link, useSearchParams } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { RANKS, num, useRankDiff } from "../../../shared/api";
import { getRankProfileLabel } from "@radar/proprietary-engine";
import {
  Empty, ErrBox, Loading, SectionTitle, StatusSeal,
} from "../../../shared/ui";

const PRESETS = [
  { a: "epic", b: "legend", label: "Epic × Legend" },
  { a: "legend", b: "mythic", label: "Legend × Mythic" },
  { a: "mythic", b: "honor", label: "Mythic × Honor" },
  { a: "honor", b: "glory", label: "Honor × Glory" },
  { a: "epic", b: "glory", label: "Epic × Glory" },
];

type RankDiff = {
  diff: number | null;
  delta_r?: number;
  prob_above?: number;
  thetaA?: number;
  thetaB?: number;
  interval_95?: number[];
  c_reference?: number;
  classification_status?: string;
};

/** Rótulos de produto oficiais PRD Rank §9 — fonte única em `@radar/proprietary-engine`. */

/**
 * Aba Ranks da ficha isolada — 1 busca de detalhe (par a×b) + herói compartilhado.
 * Selo de perfil + D + IC95 + P(|D|>Δr). Sem Top-5 por elo (contexto global).
 */
export default function RanksSection({
  heroId,
  window,
}: {
  heroId: string;
  window: string;
}) {
  const [sp, setSp] = useSearchParams();
  const rankA = sp.get("a") ?? "mythic";
  const rankB = sp.get("b") ?? "glory";
  const setPair = (na: string, nb: string) => {
    sp.set("a", na);
    sp.set("b", nb);
    setSp(sp, { replace: true });
  };

  const q = useRankDiff(heroId || null, rankA, rankB, window);
  const samePair = rankA === rankB;

  return (
    <section className="space-y-4" aria-label="Diferença entre ranks">
      <div className="card p-4 space-y-3 bg-panel border-line">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs text-mist flex items-center gap-2">
            Rank A:
            <select className="sel !py-1 text-xs" aria-label="Rank base A" value={rankA} onChange={(e) => setPair(e.target.value, rankB)}>
              {RANKS.filter((r) => r !== "all").map((r) => (
                <option key={r} value={r}>{r.toUpperCase()}</option>
              ))}
            </select>
          </label>
          <span className="text-mist font-bold">×</span>
          <label className="text-xs text-mist flex items-center gap-2">
            Rank B:
            <select className="sel !py-1 text-xs" aria-label="Rank comparado B" value={rankB} onChange={(e) => setPair(rankA, e.target.value)}>
              {RANKS.filter((r) => r !== "all").map((r) => (
                <option key={r} value={r}>{r.toUpperCase()}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={`${p.a}-${p.b}`}
              onClick={() => setPair(p.a, p.b)}
              title={p.label}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                rankA === p.a && rankB === p.b
                  ? "bg-gold text-abyss font-bold shadow-sm"
                  : "bg-abyss/60 text-mist hover:text-foam border border-line"
              }`}
            >
              {p.a.toUpperCase()} × {p.b.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {!heroId ? (
        <Empty title="Sem herói" hint="Volte à visão geral e escolha um herói." />
      ) : samePair ? (
        <div className="card p-4 border-line bg-panel2/40 text-xs text-foam" role="status">
          Escolha dois elos distintos para contrastar (par atual: {rankA.toUpperCase()} × {rankB.toUpperCase()}).
        </div>
      ) : q.isLoading ? (
        <Loading rows={3} />
      ) : q.isError ? (
        <ErrBox />
      ) : (
        (() => {
          const d = q.data as unknown as RankDiff | undefined;
          if (!d) return <ErrBox />;
          const profile = getRankProfileLabel(d, rankA, rankB);
          return (
            <div className="space-y-4">
              <div className="card p-4 border-line bg-panel space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${profile.color}`}>
                    {profile.label}
                  </span>
                  <StatusSeal
                    ok={d.classification_status === "classified" || d.classification_status === "provisional_model_based"}
                    good="Sinal model-based (proxy)"
                    bad={String(d.classification_status ?? "provisional")}
                  />
                </div>
                <p className="text-xs text-foam">{profile.motive}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="card p-4 bg-panel border-line space-y-2">
                  <span className="lbl">θ̂ por elo</span>
                  <div className="flex items-center gap-4 text-sm font-mono">
                    <div className="p-2.5 rounded-xl bg-abyss/60 border border-line flex-1">
                      <span className="text-xs text-mist block">{rankA.toUpperCase()}:</span>
                      <b className="text-foam text-lg">{num(d.thetaA, 4)}</b>
                    </div>
                    <div className="p-2.5 rounded-xl bg-abyss/60 border border-line flex-1">
                      <span className="text-xs text-mist block">{rankB.toUpperCase()}:</span>
                      <b className="text-gold text-lg">{num(d.thetaB, 4)}</b>
                    </div>
                  </div>
                </div>
                <div className="card p-4 bg-panel border-line space-y-2">
                  <span className="lbl">D = s_a − s_b (Δr = {d.delta_r ?? 0.02})</span>
                  <p className="num text-2xl font-bold text-gold">{num(d.diff, 4)}</p>
                  <p className="text-xs text-mist">
                    IC 95%: <span className="text-foam font-mono">{d.interval_95?.map((v: number) => num(v, 4)).join(" – ") ?? "—"}</span>
                  </p>
                  <p className="text-xs text-mist">
                    P(|D| &gt; Δr): <span className="text-cyan-200 font-mono font-bold">{num(d.prob_above, 4)}</span>
                  </p>
                </div>
              </div>
              <div className="card p-3.5 bg-panel2/40 border-line text-xs flex items-start gap-3">
                <ShieldAlert size={18} className="text-amber-400 mt-0.5 shrink-0" />
                <p className="text-mist leading-relaxed">
                  Sem atribuição causal: a diferença relativa não identifica mecânica ou coordenação como causa.
                </p>
              </div>
            </div>
          );
        })()
      )}

      <SectionTitle kicker="Prova" title="Contraste com referência" subtitle="D expurga o efeito-base do ambiente." />
      <Link
        to={`/ranks?hero=${heroId}&window=${window}&a=${rankA}&b=${rankB}`}
        className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gold text-abyss text-sm font-bold hover:bg-gold-light transition-colors min-h-[44px]"
      >
        Fixar par a×b →
      </Link>
    </section>
  );
}
