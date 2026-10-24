import { useSearchParams } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { RANKS, num, useRankDiff, useViews } from "../../lib/api";
import { PrimaryAction } from "../../shared/idd/PrimaryAction";
import {
  Avatar, CtxBar, Empty, ErrBox, Loading,
  SectionTitle, StatusSeal
} from "../../shared/ui";
import type { HeroPanelProps } from "../../shared/heroPanel";
import { getRankProfileLabel } from "@radar/proprietary-engine";

const PRESET_COMPARISONS = [
  { a: "epic", b: "legend", label: "Epic × Legend (Transição inicial)" },
  { a: "legend", b: "mythic", label: "Legend × Mythic (Entrada competitiva)" },
  { a: "mythic", b: "honor", label: "Mythic × Honor (Consistência intermediária)" },
  { a: "honor", b: "glory", label: "Honor × Glory (Nível de elite)" },
  { a: "epic", b: "glory", label: "Epic × Glory (Contraste total de extremos)" },
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

type EloTopHero = { id: number; head: string | null; name: string; wrAdj: number };
type EloRow = { rank: string; error?: string; top: EloTopHero[] };

/** Rótulos de produto oficiais PRD Rank §9 — fonte única em `@radar/proprietary-engine`. */

/** CTX-RNK · painel reutilizado pela rota plana /ranks e pela aba ranks de /heroi. Par a×b via URL (?a=&b=). Mesma key ["rankdiff",id,a,b,window]. */
export default function RanksPanel({ rank, window, hero, dossier, picker, ficha }: HeroPanelProps) {
  const [sp, setSp] = useSearchParams();

  // Par de comparação vive na URL (deep-link ?a=&b= restaurável); defaults mythic/glory.
  const rankA = sp.get("a") ?? "mythic";
  const rankB = sp.get("b") ?? "glory";

  const setPair = (na: string, nb: string) => {
    sp.set("a", na);
    sp.set("b", nb);
    setSp(sp, { replace: true });
  };

  const pickHero = (id: string) => {
    sp.set("hero", id);
    setSp(sp);
  };

  const diffQuery = useRankDiff(hero || null, rankA, rankB, window);
  const eloOverview = useViews("elo", rank, window);

  const diffData = diffQuery.data as unknown as RankDiff | undefined;

  return (
    <section className="space-y-4">
      <CtxBar
        id="RNK"
        name="Heterogeneidade e Diferença de Força por Rank"
        question="O herói é forte em todos os ranks ou seu rendimento relativo depende do nível competitivo?"
        status="proposta (PRD §5)"
        formula="s_ir = θ_ir − μ_r; D_i(r_a, r_b) = s_i,r_a − s_i,r_b; P(D > Δr); sem subtração de win rates brutos; sem atribuição causal"
        prdRef="PRD Diferença de Força por Rank"
      />

      {dossier}

      <SectionTitle
        kicker="Stream I · Heterogeneidade Relativa entre Elos (D-RANK-01)"
        title="Diferença de Força Relativa por Rank"
        subtitle="Mede a vantagem competitiva do herói relativa à referência de cada elo, expurgando o efeito de base do ambiente."
      />

      {picker}

      <PrimaryAction
        contextId="RNK"
        capId="CAP-RNK-01"
        label="Fixar par a×b"
        to={`/tempo?hero=${hero}&rank=${rank}&window=${window}`}
        disabledReason={!hero ? "selecione um herói" : rankA === rankB ? "escolha dois elos distintos" : null}
      />

      {/* Rank Comparator Controls */}
      <div className="card p-4 space-y-3 bg-panel border-line">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs text-mist flex items-center gap-2">
              Rank Base A:
              <select
                className="sel !py-1 text-xs"
                aria-label="Rank base A"
                value={rankA}
                onChange={(e) => setPair(e.target.value, rankB)}
              >
                {RANKS.filter((r) => r !== "all").map((r) => (
                  <option key={r} value={r}>{r.toUpperCase()}</option>
                ))}
              </select>
            </label>

            <span className="text-mist font-bold">×</span>

            <label className="text-xs text-mist flex items-center gap-2">
              Rank Comparado B:
              <select
                className="sel !py-1 text-xs"
                aria-label="Rank comparado B"
                value={rankB}
                onChange={(e) => setPair(rankA, e.target.value)}
              >
                {RANKS.filter((r) => r !== "all").map((r) => (
                  <option key={r} value={r}>{r.toUpperCase()}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-mist/80 mr-1 hidden sm:inline">Comparações Priorizadas PRD §8:</span>
            {PRESET_COMPARISONS.map((p) => (
              <button
                key={`${p.a}-${p.b}`}
                onClick={() => setPair(p.a, p.b)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                  rankA === p.a && rankB === p.b
                    ? "bg-gold text-abyss font-bold shadow-sm"
                    : "bg-abyss/60 text-mist hover:text-foam border border-line"
                }`}
                title={p.label}
              >
                {p.a.toUpperCase()} × {p.b.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hero ? (
        <Empty
          title="Selecione um herói para analisar a heterogeneidade entre ranks"
          hint="A métrica D isola a força relativa nos dois elos selecionados com intervalo credível e probabilidade posterior de relevância prática."
          to={`/forca?rank=${rank}&window=${window}`}
          action="Voltar ao panorama"
        />
      ) : diffQuery.isLoading ? (
        <Loading rows={3} />
      ) : diffQuery.isError || !diffData ? (
        <ErrBox onRetry={() => diffQuery.refetch()} />
      ) : (
        <div className="space-y-4">
          {(() => {
            const profile = getRankProfileLabel(diffData, rankA, rankB);
            return (
              <>
                {/* Result Card */}
                <div className="card p-4.5 border-line bg-gradient-to-r from-panel via-panel2/60 to-panel space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${profile.color}`}>
                        {profile.label}
                      </span>
                      <span className="text-xs font-mono text-mist">
                        ({rankA.toUpperCase()} vs {rankB.toUpperCase()})
                      </span>
                    </div>
                    <StatusSeal
                      ok={diffData.classification_status === "classified" || diffData.classification_status === "provisional_model_based"}
                      good="Sinal model-based (proxy)"
                      bad={String(diffData.classification_status ?? "provisional")}
                    />
                  </div>
                  <p className="text-xs text-foam leading-relaxed">{profile.motive}</p>
                </div>

                {/* Metrics Breakdown */}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="card p-4 bg-panel border-line space-y-2">
                    <span className="lbl">Força Absoluta Estimada θ̂ por Elo</span>
                    <div className="flex items-center gap-4 text-sm font-mono pt-1">
                      <div className="p-2.5 rounded-xl bg-abyss/60 border border-line flex-1">
                        <span className="text-xs text-mist block">{rankA.toUpperCase()}:</span>
                        <b className="text-foam text-lg">{num(diffData.thetaA, 4)}</b>
                      </div>
                      <div className="p-2.5 rounded-xl bg-abyss/60 border border-line flex-1">
                        <span className="text-xs text-mist block">{rankB.toUpperCase()}:</span>
                        <b className="text-gold text-lg">{num(diffData.thetaB, 4)}</b>
                      </div>
                    </div>
                    <p className="text-[11px] text-mist leading-relaxed">
                      Força bruta de cada elo. Um win rate bruto pode cair 2 pp e a vantagem sobre a média cair apenas 1 pp.
                    </p>
                  </div>

                  <div className="card p-4 bg-panel border-line space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="lbl">Diferença Relativa D = s_a − s_b</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-abyss text-mist border border-line">
                        Δr = {diffData.delta_r ?? 0.02}
                      </span>
                    </div>
                    <p className="num text-2xl font-bold text-gold">
                      {num(diffData.diff, 4)}
                    </p>
                    <div className="text-xs text-mist space-y-1">
                      <p>
                        IC 95%:{" "}
                        <span className="text-foam font-mono">
                          {diffData.interval_95?.map((v: number) => num(v, 4)).join(" – ") ?? "—"}
                        </span>
                      </p>
                      <p>
                        P(|D| &gt; Δr):{" "}
                        <span className="text-cyan-200 font-mono font-bold">
                          {num(diffData.prob_above, 4)}
                        </span>
                        {" "}· Premissa c={diffData.c_reference ?? 100000}
                      </p>
                    </div>
                  </div>
                </div>

                {/* PRD Non-Causal Guardrail Alert */}
                <div className="card p-3.5 bg-panel2/40 border-line text-xs flex items-start gap-3">
                  <ShieldAlert size={18} className="text-amber-400 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold text-foam">
                      Invariante de Produto RF-RANK-05 (Sem Atribuição Causal):
                    </p>
                    <p className="text-mist leading-relaxed">
                      A diferença de força relativa <b>não identifica causas internas do jogador</b> (como nível de mecânica, microdecisão ou coordenação de equipe). O Radar descreve a disparidade estatística entre ambientes sem especular sobre habilidade sem dados individuais por partida.
                    </p>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Ranks Ecosystem Top 5 */}
      <section className="space-y-3 pt-3">
        <SectionTitle
          kicker="Ecossistema por Elo · Top Heróis por Rank"
          title="Distribuição de Força no Meta"
          subtitle="Os heróis líderes em força latente estimada (θ̂) em cada degrau da escada competitiva."
        />

        {eloOverview.isLoading ? (
          <Loading rows={3} />
        ) : eloOverview.isError ? (
          <ErrBox onRetry={() => eloOverview.refetch()} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {((eloOverview.data?.data as unknown as EloRow[] | undefined) ?? []).map((r: EloRow) => (
              <div key={r.rank} className="card p-3.5 border-line bg-panel2/40 space-y-2">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="font-bold text-xs uppercase tracking-wider text-foam">
                    {r.rank}
                  </span>
                  <span className="text-[10px] text-mist font-mono">Top 5</span>
                </div>

                {r.error ? (
                  <p className="text-xs text-mist">Fonte temporariamente indisponível para este elo.</p>
                ) : (
                  <div className="space-y-1.5">
                    {r.top.slice(0, 5).map((h: EloTopHero, i: number) => (
                      <div
                        key={h.id}
                        onClick={() => pickHero(String(h.id))}
                        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-panel cursor-pointer transition-colors"
                      >
                        <span className="num text-mist text-xs w-4">{i + 1}</span>
                        <Avatar src={h.head} name={h.name} size={26} />
                        <span className="truncate flex-1 text-xs text-foam font-medium hover:text-gold">
                          {h.name}
                        </span>
                        <span className="num text-xs text-gold font-bold">
                          {num(h.wrAdj, 3)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
