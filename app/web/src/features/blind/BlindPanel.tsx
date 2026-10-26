import { useSearchParams } from "react-router-dom";
import { FlaskConical, Shield, ShieldAlert } from "lucide-react";
import { num, pct, useBlind, useHero, useHeroes } from "../../shared/api";
import {
  Avatar, CtxBar, Empty, ErrBox, Loading,
  SectionTitle, StatusSeal, TierBadge
} from "../../shared/ui";
import { PrimaryAction } from "../../shared/ui/patterns/PrimaryAction";
import { classOf, getSafetyClassification, selectLevelPopularityCandidates } from "@radar/proprietary-engine";
import { NeedsRank } from "../../shared/ui/patterns/NeedsRankLane";
import type { HeroPanelProps } from "../../shared/ui/patterns/heroPanel";

type BlindView = {
  classification_status?: string;
  robustness_status?: string;
  n_pairs?: number;
  worst_observed?: number;
  adverse_p10?: number | null;
  spread?: number;
  pair_coverage?: string;
  worst_counter?: { name?: string; delta?: number | null } | null;
};

/** Rótulos oficiais PRD Blind §10 — fonte única em `@radar/proprietary-engine`. */

/** CTX-BPS · painel reutilizado pela rota plana /blind e pela aba blind de /heroi. Janela via URL (?days=, default = window). Mesma key ["blind",id,rank,days]. Guarda rank!=="all" herdada. */
export default function BlindPanel({ rank, window, hero, dossier, picker }: HeroPanelProps) {
  const [sp, setSp] = useSearchParams();

  const pickHero = (id: string) => {
    sp.set("hero", id);
    setSp(sp);
  };

  const days = sp.get("days") ?? window;
  const blindQuery = useBlind(hero || null, rank, days);
  const heroQuery = useHero(hero || null, rank, window);
  const heroesQuery = useHeroes(rank, window);

  const bData = blindQuery.data as unknown as BlindView | undefined;
  const hData = heroQuery.data?.data;
  const safety = getSafetyClassification(bData ?? null);

  // Candidatos por nível+popularidade em `@radar/proprietary-engine` (selectLevelPopularityCandidates).
  const consistentCandidates = selectLevelPopularityCandidates(heroesQuery.data?.data ?? [], 6);

  return (
    <section className="space-y-5">
      <CtxBar
        id="BPS"
        name="Blind Pick Safety e Counter Robustness"
        question="Quão defensável é escolher este herói às cegas antes de conhecer a composição inimiga?"
        status="proxy (sem drafts completos)"
        formula="3 eixos separados (Força M1, Robustez de Cauda p10, Exposição); Pior counter é diagnóstico; Sem escala arbitrária 0–100; Não é probabilidade nem solo queue"
        prdRef="PRD Blind Pick Safety e Counter Robustness"
      />

      {dossier}

      <SectionTitle
        kicker="Stream 2 · Decisão de Draft às Cegas (PRD §8)"
        title="Blind Pick Safety & Robustez a Counters"
        subtitle="Mapeamento de risco pré-draft sem conhecimento da composição adversária, combinando cauda negativa e exposição."
      />

      {picker}

      <PrimaryAction
        label="Declarar candidato + checklist"
        to={`/blind?hero=${hero}&rank=${rank}&window=${window}`}
        disabledReason={!hero ? "selecione um herói" : rank === "all" ? "selecione o rank" : null}
      />

      {rank === "all" && hero ? (
        <div>
          <NeedsRank
            onPick={(r) => {
              sp.set("rank", r);
              setSp(sp);
            }}
          />
        </div>
      ) : !hero ? (
        <div className="space-y-4">
          <div className="card p-6 border-line bg-panel2/30 space-y-3 text-center">
            <span className="p-3 rounded-2xl bg-panel inline-flex text-rose-300 border border-rose-400/30">
              <FlaskConical size={24} />
            </span>
            <h3 className="font-bold text-base text-foam">
              Avaliação de Escolha no Escuro (Blind Pick)
            </h3>
            <p className="text-xs text-mist max-w-lg mx-auto leading-relaxed">
              O modelo avalia a cauda adversa de matchups e a exposição a counters. Selecione um herói acima ou analise os candidatos com alta força e consistência no elo {rank.toUpperCase()}:
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 text-left">
              {consistentCandidates.map((c) => (
                <div
                  key={c.id}
                  onClick={() => pickHero(String(c.id))}
                  className="card card-h p-3 cursor-pointer bg-panel border-line hover:border-gold/40 transition-all flex items-center gap-3"
                >
                  <Avatar src={c.head} name={c.name} size={38} />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-xs text-foam truncate hover:text-gold block">{c.name}</span>
                    <span className="text-[11px] text-mist font-mono">
                      θ̂ <b className="text-gold">{num(c.wrAdj, 3)}</b> · pick {pct(c.pick)}
                    </span>
                  </div>
                  <TierBadge tier={c.tier} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : blindQuery.isLoading || heroQuery.isLoading ? (
        <Loading rows={3} />
      ) : blindQuery.isError || !bData ? (
        <ErrBox onRetry={() => { blindQuery.refetch(); heroQuery.refetch(); }} />
      ) : (
        <div className="space-y-4">
          {/* Main Classification Card */}
          <div className="card p-4.5 border-line bg-gradient-to-r from-panel via-panel2/60 to-panel space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${safety?.color}`}>
                  {safety?.label}
                </span>
                <span className="text-xs text-mist font-mono">
                  Contextualizado para {rank.toUpperCase()}
                </span>
              </div>
              <StatusSeal
                ok={bData.classification_status === "provisional"}
                good="Proxy Provisório"
                bad={String(bData.classification_status ?? "inconclusive")}
              />
            </div>
            <p className="text-xs text-foam leading-relaxed">{safety?.motive}</p>
          </div>

          {/* 3 Autonomous Axes Grid (PRD §8) */}
          <div className="grid gap-3 md:grid-cols-3">
            {/* Eixo 1: Força Latente (M1) */}
            <div className="card p-4 bg-panel border-line space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="lbl">Eixo 1 · Força Geral (M1)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-abyss text-mist border border-line">
                  Baseline
                </span>
              </div>
              <p className="num text-xl font-bold text-gold">
                {hData ? `${num(hData.wrAdj, 3)} (${classOf(hData)})` : "—"}
              </p>
              <p className="text-[11px] text-mist leading-relaxed">
                q={hData ? num(hData.q, 4) : "—"}. <b>Aviso:</b> um blind pick seguro <b>não é o herói com maior win rate</b>, mas aquele com vulnerabilidade limitada.
              </p>
            </div>

            {/* Eixo 2: Counter Robustness (Cauda Adversa) */}
            <div className="card p-4 bg-panel border-line space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="lbl">Eixo 2 · Counter Robustness</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  Cauda Adversa
                </span>
              </div>
              <p className="text-xl font-bold text-foam capitalize">
                {bData.robustness_status ?? "Em avaliação"}
              </p>
              <p className="text-[11px] text-mist leading-relaxed font-mono">
                p10 adverso: <b className="text-cyan-200">{bData.adverse_p10 != null ? num(bData.adverse_p10, 4) : "—"}</b> · dispersão {num(bData.spread, 4)} · n={bData.n_pairs}
              </p>
            </div>

            {/* Eixo 3: Exposição & Pior Counter */}
            <div className="card p-4 bg-panel border-line space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="lbl">Eixo 3 · Exposição ao Pior Par</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  Diagnóstico
                </span>
              </div>
              <p className="text-xl font-bold text-foam truncate">
                {bData.worst_counter?.name ?? "Nenhum par extremo"}
              </p>
              <p className="text-[11px] text-mist leading-relaxed font-mono">
                pior δ: <b className="text-rose-300">{bData.worst_counter ? num(bData.worst_counter.delta, 4) : "—"}</b> · cobertura: {bData.pair_coverage ?? "extremes-only"}
              </p>
            </div>
          </div>

          {/* DDD Guardrails & Solo Queue Disclaimer */}
          <div className="card p-4 border-line bg-panel2/40 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foam">
              Ressalvas de Domínio e Guardrails do Produto (PRD §11)
            </h4>

            <div className="grid md:grid-cols-2 gap-3 text-xs text-mist">
              <div className="p-3 rounded-xl bg-panel2/40 border border-line space-y-1">
                <p className="font-semibold text-foam flex items-center gap-1.5">
                  <Shield size={14} className="text-gold" />
                  Blind Pick NÃO É Segurança de Solo Queue:
                </p>
                <p className="leading-relaxed">
                  Blind Pick Safety trata exclusivamente da <b>incerteza sobre o time inimigo</b>. A segurança para solo queue depende criticamente dos <b>aliados</b> (sinergias de equipe, dependência de coordenação) e a API não fornece tamanho de grupo de fila (solo vs duo/trio).
                </p>
              </div>

              <div className="p-3 rounded-xl bg-panel2/40 border border-line space-y-1">
                <p className="font-semibold text-foam flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-amber-400" />
                  Sem Probabilidade de Vitória sem Calibração:
                </p>
                <p className="leading-relaxed">
                  Sem telemetria completa de fases e ordem de draft, toda medida de blind pick é um <b>proxy de risco de cauda</b>. A interface nunca a rotula como percentual de garantia nem declara ausência absoluta de counters.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
