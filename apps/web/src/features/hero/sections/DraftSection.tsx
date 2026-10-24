import { Link, useSearchParams } from "react-router-dom";
import { Ban, Crosshair, Gauge, ListChecks, ShieldCheck } from "lucide-react";
import {
  num, pct, useBlind, useDistortion, type Hero, type LotMeta,
} from "../../../lib/api";
import {
  classifyBlindPick, classifyFirstPick, getDraftPatterns,
} from "@radar/proprietary-engine";
import { NeedsRank } from "../../../shared/idd/NeedsRankLane";
import { PickVerdictCard, PickVerdictPill } from "../../../shared/PickVerdict";
import {
  Empty, ErrBox, Loading, SectionTitle,
} from "../../../shared/ui";

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

type DistortionView = {
  strength_class?: string;
  estimated_strength?: number;
  observed_win?: number;
  mu?: number;
  pick?: { observed?: number; residual?: number };
  ban?: { observed?: number; residual?: number };
  classification_status?: string;
};

type Tone = "emerald" | "amber" | "rose" | "slate";

const TONE_TEXT: Record<Tone, string> = {
  emerald: "text-emerald-300",
  amber: "text-amber-300",
  rose: "text-rose-300",
  slate: "text-mist",
};

/** Célula de estado do header: rótulo + veredito + uma linha de contexto. */
function SummaryCell({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: Tone }) {
  return (
    <div className="rounded-xl border border-line bg-abyss/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-mist">{label}</p>
      <p className={`text-sm font-bold ${TONE_TEXT[tone]}`}>{value}</p>
      <p className="text-[10px] text-mist/70 truncate" title={hint}>{hint}</p>
    </div>
  );
}

/**
 * Aba Draft (fundida) da ficha isolada — IDD: um Contexto de Interface,
 * três leituras de uma decisão:
 * - Blind Pick (BPS): escolher sem ver nenhum inimigo.
 * - First Pick (BPS): travar primeiro e ver o inimigo responder.
 * - Pressão de draft (DRF): pick/ban acompanham a força? Padrões operacionais §7.
 *
 * Dados: 2 buscas com as MESMAS keys das rotas planas (/blind e /draft).
 * Nenhum endpoint novo. Layout limpo: identidade → estado → decisão → pressão → risco.
 */
export default function DraftSection({
  heroId,
  rank,
  window,
  hero,
  meta,
}: {
  heroId: string;
  rank: string;
  window: string;
  hero: Hero | undefined;
  meta?: LotMeta | undefined;
}) {
  const [sp, setSp] = useSearchParams();
  const days = sp.get("days") ?? window;
  const blindQ = useBlind(heroId || null, rank, days);
  const distQ = useDistortion(heroId || null, rank, window);

  if (!heroId) return <Empty title="Sem herói" hint="Volte à visão geral e escolha um herói." />;

  if (rank === "all") {
    return (
      <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Draft do herói">
        <header className="rounded-2xl border border-line bg-panel p-4 md:p-5 space-y-1.5">
          <p className="lbl">Draft · elo ALL</p>
          <p className="text-xs text-mist">Proxy exige elo explícito — blind, first pick e pressão ficam sem número.</p>
        </header>
        <NeedsRank
          capId="CAP-BPS-01"
          onPick={(r) => {
            sp.set("rank", r);
            setSp(sp);
          }}
        />
      </section>
    );
  }

  if (blindQ.isLoading || distQ.isLoading) {
    return (
      <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Draft do herói">
        <Loading rows={4} />
      </section>
    );
  }

  const blind = blindQ.data as unknown as BlindView | undefined;
  const dist = distQ.data as unknown as DistortionView | undefined;
  const blindVerdict = classifyBlindPick({ blind });
  const firstVerdict = classifyFirstPick({ hero, blind, baseline: meta?.mu });
  const patterns = getDraftPatterns(dist);
  const activePattern = dist ? patterns.find((p) => p.ativo) : undefined;
  const worstName = blind?.worst_counter?.name ?? "Nenhum par extremo";
  const worstDelta = blind?.worst_counter?.delta ?? blind?.worst_observed;

  const pressureLabel = distQ.isError || !dist ? "Sem dado" : activePattern ? activePattern.caso : "Alinhada";
  const pressureTone: Tone = distQ.isError || !dist ? "slate" : activePattern ? "amber" : "emerald";
  const pressureHint = activePattern ? "padrão operacional ativo" : "pick e ban vs força";

  return (
    <section className="space-y-5 animate-fadeIn motion-reduce:animate-none" aria-label="Draft do herói">
      {/* IDENTIDADE + ESTADO — uma decisão, três leituras */}
      <header className="rounded-2xl border border-line bg-panel p-4 md:p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="lbl">Draft · elo {rank.toUpperCase()} · janela {window}d</p>
            <p className="text-xs text-mist mt-0.5">Blind pick, first pick e pressão na mesma decisão.</p>
          </div>
          <span className="text-[10px] font-mono text-mist/60" title="Contextos traduzidos nesta tela">BPS + DRF</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <SummaryCell label="Blind pick" value={blindVerdict.label} hint="sem ver o inimigo" tone={blindVerdict.tone} />
          <SummaryCell label="First pick" value={firstVerdict.label} hint="trava primeiro" tone={firstVerdict.tone} />
          <SummaryCell label="Pressão" value={pressureLabel} hint={pressureHint} tone={pressureTone} />
        </div>
      </header>

      <div id="prova-draft" className="space-y-5 scroll-mt-4">
        {/* ESTADO — decisão de pick (BPS) */}
        <section className="space-y-3">
            <SectionTitle
              kicker="Decisão de pick"
              title="Blind pick x first pick"
              subtitle="Duas exposições, dois vereditos independentes."
            />
            {blindQ.isError ? (
              <ErrBox onRetry={() => blindQ.refetch()} message="O proxy de counters não respondeu — os dois vereditos ficam sem dado." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <PickVerdictCard
                  title="Blind Pick"
                  subtitle="Sem ver nenhum inimigo (modo clássico)."
                  verdict={blindVerdict}
                  metrics={[
                    { label: "Força θ̂", value: hero ? num(hero.wrAdj, 3) : "—", hint: "θ̂ do lote" },
                    { label: "Cauda p10", value: blind?.adverse_p10 != null ? num(blind.adverse_p10, 4) : "—", hint: "adversa · proxy" },
                    { label: "Pior δ", value: worstDelta != null ? num(worstDelta, 4) : "—", hint: worstName },
                  ]}
                />
                <PickVerdictCard
                  title="First Pick"
                  subtitle="Travar primeiro e ver o inimigo responder."
                  verdict={firstVerdict}
                  metrics={[
                    { label: "Força θ̂", value: hero ? num(hero.wrAdj, 3) : "—", hint: `ref ${meta?.mu != null ? num(meta.mu, 4) : "0,5"}` },
                    { label: "Pior δ", value: worstDelta != null ? num(worstDelta, 4) : "—", hint: "counter replicado?" },
                    { label: "Pick · ban", value: hero ? `${pct(hero.pick)} · ${pct(hero.ban)}` : "—", hint: "pressão observada" },
                  ]}
                />
              </div>
            )}
        </section>

        {/* DADOS — pressão de draft (DRF) */}
        <section className="space-y-3">
            <SectionTitle
              kicker="Pressão de draft"
              title="Pick e ban acompanham a força?"
              subtitle="Quatro sinais separados; resíduo = observado − esperado."
            />
            {distQ.isError || !dist ? (
              <ErrBox onRetry={() => distQ.refetch()} message="A distorção de draft não respondeu — pressão de pick/ban indisponível neste recorte." />
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <div className="stat-card border-line space-y-1">
                    <span className="lbl flex items-center gap-1.5"><Gauge size={12} className="text-gold" aria-hidden="true" /> Força θ̂</span>
                    <p className="num text-xl font-bold text-gold">{num(dist.estimated_strength, 4)}</p>
                    <p className="text-[10px] text-mist">μ {num(dist.mu, 4)}</p>
                  </div>
                  <div className="stat-card border-line space-y-1">
                    <span className="lbl flex items-center gap-1.5"><Crosshair size={12} className="text-foam" aria-hidden="true" /> Pick</span>
                    <p className="num text-xl font-bold text-foam">{pct(dist.pick?.observed, 1)}</p>
                    <p className="text-[10px] text-mist font-mono">resíduo <b className="text-foam">{num(dist.pick?.residual, 4)}</b></p>
                  </div>
                  <div className="stat-card border-line space-y-1">
                    <span className="lbl flex items-center gap-1.5"><Ban size={12} className="text-cyan-200" aria-hidden="true" /> Ban</span>
                    <p className="num text-xl font-bold text-cyan-200">{pct(dist.ban?.observed, 1)}</p>
                    <p className="text-[10px] text-mist font-mono">resíduo <b className="text-cyan-200">{num(dist.ban?.residual, 4)}</b></p>
                  </div>
                  <div className="stat-card border-line space-y-1">
                    <span className="lbl flex items-center gap-1.5"><ListChecks size={12} className="text-amber-300" aria-hidden="true" /> Diagnóstico</span>
                    <p className="text-sm font-bold text-foam font-sans">{activePattern ? activePattern.caso : "Sinais alinhados"}</p>
                    <p className="text-[10px] text-mist leading-snug">{activePattern ? activePattern.leitura : "Pressão acompanha a força."}</p>
                  </div>
                </div>

                {/* Padrões operacionais — MANTIDOS (PRD §7) */}
                <div className="card p-4 border-line bg-panel space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foam flex items-center gap-1.5">
                      <ListChecks size={14} className="text-gold" aria-hidden="true" />
                      Padrões operacionais
                    </h3>
                    <span className="text-[10px] text-mist/60 font-mono">PRD §7</span>
                  </div>
                  <ul className="divide-y divide-line/60">
                    {patterns.map((p) => (
                      <li key={p.caso} className={`py-2 flex items-start gap-2 text-xs ${p.ativo ? "text-foam" : "text-mist/70"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${p.ativo ? "bg-gold" : "bg-mist/40"}`} aria-hidden="true" />
                        <div className="min-w-0">
                          <span className="font-bold">{p.caso}</span>
                          <span className="text-mist"> — {p.leitura}</span>
                          {p.ativo && (
                            <span className="block text-[10px] text-mist/60 font-mono mt-0.5">
                              evidência: {p.evidence_status === "unknown" ? "candidato experimental — q não validado" : p.evidence_status}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
        </section>

        {/* RISCO — uma linha, sem card extra */}
        <p className="text-[10px] text-mist/70 flex items-start gap-1.5">
          <ShieldCheck size={12} className="text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Proxy de cauda, não probabilidade. Resíduo é discrepância ao modelo, nunca erro da comunidade.
            Pick e ban nunca são somados. First pick não tem ordem de draft na fonte.
          </span>
        </p>
      </div>

      <Link
        to={`/draft?hero=${heroId}&rank=${rank}&window=${window}`}
        className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gold text-abyss text-sm font-bold hover:bg-gold-light transition-colors min-h-[44px]"
      >
        Abrir draft na rota plana →
      </Link>
      <nav aria-label="Rotas planas relacionadas" className="flex items-center gap-4 flex-wrap text-[11px] text-mist/80">
        <Link to={`/blind?hero=${heroId}&rank=${rank}&window=${window}`} className="underline hover:text-gold min-h-[44px] inline-flex items-center">
          abrir blind pick na rota plana →
        </Link>
        <Link to={`/hero/${heroId}?tab=confrontos&rank=${rank}&window=${window}`} className="underline hover:text-gold min-h-[44px] inline-flex items-center">
          ver counters →
        </Link>
      </nav>
    </section>
  );
}
