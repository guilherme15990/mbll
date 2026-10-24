import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, ShieldCheck, Sparkles } from "lucide-react";
import { num, pct, useDistortion, useHeroes } from "../../shared/api";
import { PrimaryAction } from "../../shared/idd/cards/PrimaryAction";
import {
  Avatar, CtxBar, Loading,
  SectionTitle, StatusSeal, TierBadge, ErrBox
} from "../../shared/ui";
import { PressureScatter } from "../../shared/ui/patterns/charts";
import {
  averageStrengthOf, getDraftPatterns, medianBanOf, medianPickOf,
  topBansByBan, topGemsByStrengthLowPick,
} from "@radar/proprietary-engine";
import type { HeroPanelProps } from "../../shared/ui/patterns/heroPanel";

type DistortionView = {
  strength_class?: string;
  estimated_strength?: number;
  observed_win?: number;
  mu?: number;
  pick?: { observed?: number; residual?: number };
  ban?: { observed?: number; residual?: number };
  classification_status?: string;
};

/** Padrões operacionais do PRD Draft §7 — fonte única em `@radar/proprietary-engine`. */

/** CTX-DRF · painel reutilizado pela rota plana /draft e pela aba draft de /heroi. Mesmas keys ["distortion"…] + ["heroes"…]. */
export default function DraftPanel({ rank, window, hero, dossier, picker }: HeroPanelProps) {
  const [sp, setSp] = useSearchParams();
  const [activeScatter, setActiveScatter] = useState<"pick" | "ban">("pick");

  const pickHero = (id: string) => {
    sp.set("hero", id);
    setSp(sp);
  };

  const distortionQuery = useDistortion(hero || null, rank, window);
  const heroesQuery = useHeroes(rank, window);

  const dData = distortionQuery.data as unknown as DistortionView | undefined;
  const allHeroes = heroesQuery.data?.data ?? [];

  const avgStrength = useMemo(() => averageStrengthOf(allHeroes), [allHeroes]);

  const medianPick = useMemo(() => medianPickOf(allHeroes), [allHeroes]);

  const medianBan = useMemo(() => medianBanOf(allHeroes), [allHeroes]);

  // Top Ban Heroes (Overpressure candidates)
  const topBans = useMemo(() => topBansByBan(allHeroes, 5), [allHeroes]);

  // Top Gems (High wrAdj, Low pick)
  const topGems = useMemo(
    () => topGemsByStrengthLowPick(allHeroes, avgStrength, medianPick, 5),
    [allHeroes, avgStrength, medianPick],
  );

  const patterns = getDraftPatterns(dData);
  const activePattern = patterns.find((p) => p.ativo);

  return (
    <section className="space-y-5">
      <CtxBar
        id="DRF"
        name="Distorção de Draft e Pressão Competitiva"
        question="A pressão de pick e de ban acompanha a força competitiva real ou há defasagem e sobrepressão?"
        status="proposta (PRD §5)"
        formula="4 sinais separados (Performance, Pick, Ban, Discrepâncias); Pick e Ban com unidades distintas; Resíduo = Observado − Esperado; Pressão fora do M1; Sem acusar erro da comunidade"
        prdRef="PRD Draft Distortion"
      />

      {dossier}

      <SectionTitle
        kicker="Stream 2 · Inteligência de Draft & Descompasso Tático"
        title="Distorção de Draft: Força vs Demanda"
        subtitle="Analisa onde a popularidade e o receio de ban divergem da força latente ajustada, identificando oportunidades e armadilhas de meta."
      />

      {picker}

      <PrimaryAction
        contextId="DRF"
        capId="CAP-DRF-01"
        label="Marcar p/ acompanhar"
        to={`/tempo?hero=${hero}&rank=${rank}&window=${window}`}
        disabledReason={!hero ? "selecione um herói" : null}
      />

      {/* Hero Specific Analysis or Meta Overview */}
      {hero ? (
        distortionQuery.isLoading ? (
          <Loading rows={3} />
        ) : distortionQuery.isError || !dData ? (
          <ErrBox onRetry={() => distortionQuery.refetch()} />
        ) : (
          <div className="space-y-4">
            {/* 4 Autonomous Signals Cards Grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="stat-card border-line space-y-1">
                <span className="lbl">1. Performance (M1)</span>
                <p className="num text-2xl font-bold text-gold">
                  {num(dData.estimated_strength, 4)}
                </p>
                <p className="text-[11px] text-mist">
                  obs {num(dData.observed_win, 4)} · classe {dData.strength_class} · μ {num(dData.mu, 4)}
                </p>
              </div>

              <div className="stat-card border-line space-y-1">
                <span className="lbl">2. Pressão de Pick</span>
                <p className="num text-2xl font-bold text-foam">
                  {pct(dData.pick?.observed, 2)}
                </p>
                <p className="text-[11px] text-mist font-mono">
                  Resíduo: <b className="text-foam">{num(dData.pick?.residual, 4)}</b> · slot_share
                </p>
              </div>

              <div className="stat-card border-line space-y-1">
                <span className="lbl">3. Pressão de Ban</span>
                <p className="num text-2xl font-bold text-cyan-200">
                  {pct(dData.ban?.observed, 2)}
                </p>
                <p className="text-[11px] text-mist font-mono">
                  Resíduo: <b className="text-cyan-200">{num(dData.ban?.residual, 4)}</b> · fração de partidas
                </p>
              </div>

              <div className="stat-card border-line space-y-1">
                <span className="lbl">4. Diagnóstico de Discrepância</span>
                <p className="text-sm font-bold text-foam truncate">
                  {activePattern ? activePattern.caso : "Sinais Alinhados"}
                </p>
                <p className="text-[11px] text-mist line-clamp-2">
                  {activePattern ? activePattern.leitura : "Sem discrepância material nos limiares atuais."}
                </p>
              </div>
            </div>

            {/* Operational Patterns Checklist */}
            <div className="card p-4.5 border-line bg-panel2/40 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foam">
                  Padrões Operacionais do Domínio de Draft (PRD §7)
                </h4>
                <StatusSeal
                  ok={dData.classification_status === "provisional"}
                  good="Candidato Operacional Provisório"
                  bad="Inconclusivo"
                />
              </div>

              <div className="grid gap-2">
                {patterns.map((p) => (
                  <div
                    key={p.caso}
                    className={`p-2.5 rounded-xl border flex items-start gap-2.5 text-xs transition-colors ${
                      p.ativo
                        ? "bg-panel2/80 border-gold/40 shadow-sm"
                        : "bg-abyss/40 border-line text-mist/80"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${p.ativo ? "bg-gold shadow-glow" : "bg-mist/40"}`} />
                    <div className="flex-1">
                      <span className={`font-bold ${p.ativo ? "text-foam" : "text-mist"}`}>
                        {p.caso}:
                      </span>{" "}
                      <span className={p.ativo ? "text-foam/90" : "text-mist/80"}>
                        {p.leitura}
                      </span>
                      {p.ativo && (
                        <span className="block text-[10px] text-mist/70 font-mono">
                          evidência: {p.evidence_status === "unknown" ? "candidato experimental — q não validado (V2 §9)" : p.evidence_status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Guardrail Invariant */}
              <div className="flex items-center gap-2 text-[11px] text-mist/80 bg-abyss/60 p-2.5 rounded-xl border border-line">
                <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                <span>
                  <b>Invariante D-DIST-07:</b> Resíduo é estritamente uma discrepância estatística entre os dados e o modelo de referência, <b>nunca erro da comunidade</b>. O Radar respeita o conhecimento tácito dos jogadores.
                </span>
              </div>
            </div>
          </div>
        )
      ) : (
        /* Meta Snapshot Overview when no hero is selected */
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-4 border-line bg-panel2/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="lbl text-xs text-rose-300 font-bold flex items-center gap-1.5">
                <AlertTriangle size={14} /> Top 5 Mais Banidos no Elo
              </span>
              <span className="text-[10px] text-mist font-mono">Pressão Extrema</span>
            </div>
            <div className="space-y-2">
              {topBans.map((h) => (
                <div
                  key={h.id}
                  onClick={() => pickHero(String(h.id))}
                  className="flex items-center gap-3 p-2 rounded-xl bg-panel hover:bg-panel2 border border-line cursor-pointer transition-all"
                >
                  <Avatar src={h.head} name={h.name} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foam truncate hover:text-gold">{h.name}</p>
                    <p className="text-[11px] text-mist font-mono">
                      ban <b className="text-rose-300">{pct(h.ban)}</b> · θ̂ {num(h.wrAdj, 3)}
                    </p>
                  </div>
                  <TierBadge tier={h.tier} />
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4 border-line bg-panel2/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="lbl text-xs text-cyan-200 font-bold flex items-center gap-1.5">
                <Sparkles size={14} /> Top 5 Força Alta com Pick Baixo
              </span>
              <span className="text-[10px] text-mist font-mono">Candidatos a Joias</span>
            </div>
            <div className="space-y-2">
              {topGems.map((h) => (
                <div
                  key={h.id}
                  onClick={() => pickHero(String(h.id))}
                  className="flex items-center gap-3 p-2 rounded-xl bg-panel hover:bg-panel2 border border-line cursor-pointer transition-all"
                >
                  <Avatar src={h.head} name={h.name} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foam truncate hover:text-cyan-200">{h.name}</p>
                    <p className="text-[11px] text-mist font-mono">
                      θ̂ <b className="text-gold">{num(h.wrAdj, 3)}</b> · pick {pct(h.pick)}
                    </p>
                  </div>
                  <TierBadge tier={h.tier} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RF-DIST-02: Dual Pressure 2D Scatter Matrices (Pick & Ban separadas) */}
      <div className="card p-4.5 space-y-3 border-line bg-panel2/30">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-foam">
              Matriz 2D de Força vs Pressão de Draft (RF-DIST-02)
            </h4>
            <p className="text-[11px] text-mist">
              Exibição independente de Pick e de Ban (unidades distintas e não comparáveis linearmente).
            </p>
          </div>

          <div className="flex items-center gap-1 bg-abyss/80 p-1 rounded-xl border border-line text-xs">
            <button
              onClick={() => setActiveScatter("pick")}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                activeScatter === "pick"
                  ? "bg-gold text-abyss font-bold shadow-sm"
                  : "text-mist hover:text-foam"
              }`}
            >
              Força × Pressão de Pick
            </button>
            <button
              onClick={() => setActiveScatter("ban")}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                activeScatter === "ban"
                  ? "bg-cyan-400 text-abyss font-bold shadow-sm"
                  : "text-mist hover:text-foam"
              }`}
            >
              Força × Pressão de Ban
            </button>
          </div>
        </div>

        <div className="pt-2">
          <PressureScatter
            data={allHeroes}
            pressureKey={activeScatter}
            pressureLabel={activeScatter === "pick" ? "Pressão de Pick (slot_share)" : "Pressão de Ban (partidas)"}
            color={activeScatter === "pick" ? "#f59e0b" : "#38bdf8"}
            avgStrength={avgStrength}
            medianPressure={activeScatter === "pick" ? medianPick : medianBan}
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-[11px] text-mist font-mono">
            <span className="border border-line rounded-lg px-2.5 py-1 bg-panel/60">
              ⬆ Alto/Alto: <b>Ameaça Alinhada</b>
            </span>
            <span className="border border-cyan-400/40 rounded-lg px-2.5 py-1 bg-cyan-400/5 text-cyan-200">
              ⬆ Alto Força/Baixo Pressão: <b>Candidato a Joia</b>
            </span>
            <span className="border border-rose-400/40 rounded-lg px-2.5 py-1 bg-rose-400/5 text-rose-300">
              ⬆ Baixo Força/Alto Pressão: <b>Sobrepressão</b>
            </span>
            <span className="border border-line rounded-lg px-2.5 py-1 bg-panel/60">
              ⬇ Baixo/Baixo: <b>Sinal Baixo Alinhado</b>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
