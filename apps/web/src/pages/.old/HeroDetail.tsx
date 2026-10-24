import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Swords, Hammer, LineChart as LineIcon } from "lucide-react";
import { cx, num, pct, useBlind, useBuilds, useConfidence, useDistortion, useHero, useMatchups, useRankDiff, useTemporal, useTrends, LANES, type Pair } from "../../lib/api";
import { useFilters } from "../../App";
import { Avatar, ClassSeal, CtxSeal, Empty, ErrBox, Loading, SectionTitle, TierBadge } from "../../components/ui";
import { DurationChart, TrendChart } from "../../components/charts";

function PairRow({ p }: { p: Pair }) {
  const good = Number.isFinite(p.delta) && p.delta >= 0;
  const unknown = !Number.isFinite(p.delta);
  return (
    <Link to={`/hero/${p.id}?rank=mythic&window=7`} className="card card-h p-2.5 flex items-center gap-3">
      <Avatar src={p.head} name={p.name} size={40} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{p.name}</p>
        <p className="text-[11px] text-mist num">δ {unknown ? "desconhecido" : `${good ? "+" : ""}${num(p.delta, 3)}`} · win {pct(p.win, 0)} · {p.profile}</p>
        <p className="text-[10px] text-mist">{p.evidence_quality ?? "evidência descritiva"} · {p.coverage_status ?? "extremes-only"} · slot_share não validado</p>
      </div>
      <span className={cx("num text-sm font-bold", unknown ? "text-mist" : good ? "text-cyan-200" : "text-amber-200")}>{unknown ? "?" : good ? "▲" : "▼"}</span>
    </Link>
  );
}

function PairList({ title, note, pairs }: { title: string; note: string; pairs: Pair[] }) {
  if (!pairs.length) return null;
  return (
    <div className="grid gap-2">
      <p className="lbl">{title} <span className="normal-case font-normal">· {note}</span></p>
      <div className="grid gap-2 sm:grid-cols-2">
        {pairs.slice(0, 6).map((p) => <PairRow key={p.id} p={p} />)}
      </div>
    </div>
  );
}

export default function HeroDetail() {
  const { id } = useParams();
  const { rank, window } = useFilters();
  const [tab, setTab] = useState<"geral" | "draft" | "builds">("geral");
  // INV-BDL-01: lane SEM default silencioso — escolha explícita, sem fetch antes (enabled só com lane válida)
  const [lane, setLane] = useState<string>(() => {
    try { const s = localStorage.getItem("radar:lane"); return (LANES as readonly string[]).includes(s ?? "") ? (s as string) : ""; } catch { return ""; }
  });
  const pickLane = (l: string) => { setLane(l); try { localStorage.setItem("radar:lane", l); } catch { /* privado */ } };
  const hero = useHero(id, rank, window);
  const trends = useTrends(id, rank);
  const match = useMatchups(id, rank, window);
  const builds = useBuilds(id, rank, lane);
  const conf = useConfidence(id, rank, window);
  const rdiff = useRankDiff(id, "mythic", "glory", window);
  const temp = useTemporal(id, rank, window);
  const dist = useDistortion(id, rank, window);
  const blind = useBlind(id, rank, window);

  if (hero.isLoading) return <Loading />;
  if (hero.isError || !hero.data) return <ErrBox onRetry={() => hero.refetch()} />;
  const h = hero.data!.data;
  const tabs = [
    { k: "geral", label: "Visão geral", icon: <LineIcon size={14} /> },
    { k: "draft", label: "Draft", icon: <Swords size={14} /> },
    { k: "builds", label: "Builds", icon: <Hammer size={14} /> },
  ] as const;

  return (
    <article className="grid gap-4">
      <p className="text-xs text-mist"><CtxSeal>Ficha</CtxSeal> · elo {rank} · janela {window}d</p>
      <div className="card p-4 sm:p-5 flex gap-4 flex-wrap items-center">
        <Avatar src={h.head} name={h.name} size={76} />
        <div className="grid gap-1.5 min-w-[220px] flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold">{h.name}</h2>
            <TierBadge tier={h.tier} />
          </div>
          <ClassSeal cls={h.class} conf={h.confidence} />
          <div className="flex gap-4 text-sm flex-wrap">
            <span>θ̂ <b className="num">{num(h.wrAdj, 3)}</b></span>
            <span>obs <b className="num">{num(h.win, 3)}</b></span>
            <span>B <b className="num">{num((h as any).B, 2)}</b></span>
            <span>d <b className="num">{num(h.d)}</b></span>
            <span>q <b className="num">{num(h.q, 4)}</b></span>
            <span>pick <b className="num">{pct(h.pick)}</b> (q {num(h.qPick, 2)})</span>
            <span>ban <b className="num">{pct(h.ban)}</b> (q {num(h.qBan, 2)})</span>
          </div>
        </div>
        <Link to={`/?rank=${rank}&window=${window}`} className="btn-ghost self-start">← Panorama</Link>
      </div>
      {/* INV-SHR/CNF: faixa de sensibilidade com superfície — banda c-grade-v2 sob o cabeçalho */}
      {(() => {
        const band = (h as any).sensitivity_band;
        const det = band?.details ?? [];
        const unc = String((h as any).uncertainty_status ?? "");
        const sens = unc.includes("inconclusive") || unc.includes("sensitivity");
        return (
          <div className={`card px-4 py-3 flex gap-3 flex-wrap items-center ${sens ? "border-amber-300/40" : ""}`}>
            <span className="lbl">Sensibilidade a c · {(h as any).c_grade ?? "c-grade-v2"} (c={(h as any).c_reference ?? 100000})</span>
            <span className="text-[11px] num text-mist">P(θ&gt;μ+0.02) ∈ [{band ? `${num(band.lo, 2)} – ${num(band.hi, 2)}` : "—"}]</span>
            <span className="text-[11px] text-mist">grade: {det.map((d: any) => `c=${d.c}→${num(d.prob, 2)}`).join(" · ") || "—"}</span>
            {sens
              ? <span className="text-[11px] px-2 py-0.5 rounded-full border text-amber-200 border-amber-300/30 bg-amber-300/10">Inconclusivo (sensível a c) — conclusão muda na grade, sem classe</span>
              : <span className="text-[11px] px-2 py-0.5 rounded-full border text-emerald-300 border-emerald-400/30 bg-emerald-400/10">estável em c</span>}
          </div>
        );
      })()}

      <div className="flex gap-1.5">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={cx("flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-colors", tab === t.k ? "bg-gold/15 text-gold border-gold/30" : "text-mist border-transparent hover:bg-panel2")}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "geral" && (
        <>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4 grid gap-2">
            <SectionTitle kicker="Série diária · 30d" title="Tendência de win e ban" />
            {trends.isLoading ? <Loading rows={3} /> : trends.isError || !trends.data?.data.length
              ? <p className="text-sm text-mist">Sem série diária para este herói/elo (camada B, Fase 2).</p>
              : <TrendChart data={trends.data.data} />}
            <p className="text-[11px] text-mist">Linha sólida: win · tracejada: ban. Inclinação de Theil-Sen completa na Fase 2.</p>
          </div>
          <div className="card p-4 grid gap-2">
            <SectionTitle kicker="Evidência · por que este score" title="Decomposição" />
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {[["win observado", num(h.win, 4)], ["θ̂ (média posterior)", num(h.wrAdj, 4)], ["B (peso do dado)", num((h as any).B, 3)], ["encolhimento 1−B", num((h as any).shrinkage, 3)], ["d=(θ̂−μ)/τ", num(h.d)], ["q (BH-FDR)", num(h.q, 4)], ["presença", num(h.presence, 3)], ["se=√V", num((h as any).se, 4)]].map(([k, v]) => (
                <div key={k} className="bg-abyss/60 border border-line rounded-xl px-3 py-2"><dt className="lbl">{k}</dt><dd className="num text-base">{v}</dd></div>
              ))}
            </dl>
            {h.degenerate && <p className="text-xs text-amber-300">Taxa degenerada (0/1) com pouco pick: tratada como ruído, nunca vira Forte/Joia.</p>}
            {h.smallSample && <p className="text-xs text-amber-300">Amostra pequena demais para MAD/BH: sem classe.</p>}
            <p className="text-[11px] text-mist">exposição: {(h.exposure as any)?.unit ?? "slot_share"} · {(h.exposure as any)?.status ?? "unvalidated"} — sem contagem de partidas · c={(h as any).c_reference ?? 1} · {(h as any).uncertainty_status ?? "provisional"}</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card p-4 grid gap-2">
            <SectionTitle kicker="Confiança · trio separado" title="Posterior / intervalo / prob" />
            {conf.isLoading ? <Loading rows={2} /> : conf.isError || !conf.data ? <p className="text-sm text-mist">Sem trio para este herói/janela.</p> : (
              <dl className="grid gap-2 text-sm">
                <div className="bg-abyss/60 border border-line rounded-xl px-3 py-2"><dt className="lbl">posterior_mean (c={(conf.data as any).c_reference})</dt><dd className="num text-base">{num((conf.data as any).posterior_mean, 4)}</dd></div>
                <div className="bg-abyss/60 border border-line rounded-xl px-3 py-2"><dt className="lbl">IC 95% provisório</dt><dd className="num text-base">{Array.isArray((conf.data as any).credible_interval_95) ? (conf.data as any).credible_interval_95.map((v: number) => num(v, 4)).join(" – ") : "—"}</dd></div>
                <div className="bg-abyss/60 border border-line rounded-xl px-3 py-2"><dt className="lbl">P(θ&gt;μ+0.02)</dt><dd className="num text-base">{num((conf.data as any).posterior_prob_above_threshold, 4)}</dd></div>
                <p className="text-[11px] text-mist">status: {(conf.data as any).uncertainty_status} · probabilidade ≠ chance de vitória · sensível a c vira inconclusivo</p>
              </dl>
            )}
          </div>
          <div className="card p-4 grid gap-2">
            <SectionTitle kicker="Rank · mythic × glory" title="Diferença ajustada" />
            {rdiff.isLoading ? <Loading rows={2} /> : rdiff.isError || !rdiff.data ? <p className="text-sm text-mist">Sem diferença (herói ausente em um rank).</p> : (
              <dl className="grid gap-2 text-sm">
                <div className="bg-abyss/60 border border-line rounded-xl px-3 py-2"><dt className="lbl">D mythic−glory</dt><dd className="num text-base">{num((rdiff.data as any).diff, 4)}</dd></div>
                <p className="text-[11px] text-mist">IC {(rdiff.data as any).interval_95?.map((v: number) => num(v, 4)).join(" – ")} · {(rdiff.data as any).classification_status} · sem causa atribuída</p>
              </dl>
            )}
          </div>
          <div className="card p-4 grid gap-2">
            <SectionTitle kicker="Temporal · 7d vs 30d" title="Mudança estimada" />
            {temp.isLoading ? <Loading rows={2} /> : temp.isError || !temp.data ? <p className="text-sm text-mist">Sem delta temporal.</p> : (
              <dl className="grid gap-2 text-sm">
                <div className="bg-abyss/60 border border-line rounded-xl px-3 py-2"><dt className="lbl">Δ vs base</dt><dd className="num text-base">{num((temp.data as any).delta, 4)}</dd></div>
                <p className="text-[11px] text-mist">{(temp.data as any).temporal_status} · {(temp.data as any).patch_association_status} (associação, não causal)</p>
              </dl>
            )}
          </div>
        </div>
        </>
      )}

      {tab === "draft" && (
        <div className="grid gap-4">
          {match.isLoading ? <Loading rows={4} /> : match.isError || !match.data ? <ErrBox onRetry={() => match.refetch()} />
            : (<>
              <p className="text-[11px] text-mist">{match.data.semanticsNote}</p>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="card p-4 grid gap-2">
                  <SectionTitle kicker="Distorção · pick vs ban separados" title="Força × pressão" />
                  {dist.isLoading ? <Loading rows={2} /> : dist.isError || !dist.data ? <p className="text-sm text-mist">Sem distorção.</p> : (
                    <p className="text-xs text-mist num">resíduo pick {num((dist.data as any).pick?.residual, 4)} · resíduo ban {num((dist.data as any).ban?.residual, 4)} · nunca somados · discrepância, não erro da comunidade</p>
                  )}
                </div>
                <div className="card p-4 grid gap-2">
                  <SectionTitle kicker="Blind · proxy" title="Segurança e robustez" />
                  {blind.isLoading ? <Loading rows={2} /> : blind.isError || !blind.data ? <p className="text-sm text-mist">Sem proxy (matriz incompleta).</p> : (
                    <p className="text-xs text-mist num">{(blind.data as any).robustness_status} · p10 {(blind.data as any).adverse_p10 != null ? num((blind.data as any).adverse_p10, 4) : "—"} · n={(blind.data as any).n_pairs} · proxy, não probabilidade</p>
                  )}
                </div>
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="grid gap-4">
                  <PairList title="⚔️ Confrontos a favor" note="δ positivo" pairs={match.data.countersUp} />
                  <PairList title="⚔️ Confrontos contra" note="δ negativo" pairs={match.data.countersDown} />
                </div>
                <div className="grid gap-4">
                  <PairList title="🤝 Sinergias a favor" note="δ positivo" pairs={match.data.synergiesUp} />
                  <PairList title="🤝 Sinergias contra" note="δ negativo" pairs={match.data.synergiesDown} />
                </div>
              </div>
              {!!match.data.countersUp[0]?.curve.length && (
                <div className="card p-4 grid gap-2">
                  <SectionTitle kicker="Perfil por duração · S7" title={`Top par: ${match.data.countersUp[0].name} (${match.data.countersUp[0].profile})`} />
                  <DurationChart curve={match.data.countersUp[0].curve} heroWin={match.data.countersUp[0].win} />
                  <p className="text-[11px] text-mist">snowball = rende cedo · scaling = rende tarde · faixas 0/1 descartadas (amostra mínima).</p>
                </div>
              )}
            </>)}
        </div>
      )}

      {tab === "builds" && (
        <div className="grid gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="lbl">Lane (obrigatória — sem default)</span>
            {LANES.map((l) => (
              <button key={l} onClick={() => pickLane(l)} aria-pressed={lane === l}
                className={cx("px-3 py-2 rounded-xl text-sm border transition-colors", lane === l ? "bg-gold/15 text-gold border-gold/30" : "text-mist border-line hover:bg-panel2")}>{l}</button>
            ))}
            <span className="text-[11px] text-mist">audit_pending · ajustado/causal NULL</span>
          </div>
          {!(LANES as readonly string[]).includes(lane) ? (
            <Empty title="Escolha a lane" hint="Sem lane não há fetch (API 422) e nenhum default silencioso — INV-BDL-01." to={`/hero/${id}?rank=${rank}&window=${window}`} action="Voltar" />
          ) : builds.isLoading ? <Loading rows={3} /> : builds.isError || !builds.data?.data.length
            ? <Empty title="Sem builds" hint="A fonte não tem builds para este herói/lane/elo." to={`/hero/${id}?rank=${rank}&window=${window}`} action="Voltar" />
            : builds.data.data.map((b, i) => (
              <div key={i} className="card p-4 flex gap-4 flex-wrap items-center">
                <div className="grid"><span className="lbl">win</span><b className="num text-lg text-gold">{pct(b.win)}</b><span className="text-xs text-mist num">pick {pct(b.pick, 2)}{b.lift_vs_most_used != null ? ` · L vs mais-usada ${num(b.lift_vs_most_used, 4)}` : " · lift nulo"}{b.lift_vs_mean != null ? ` · vs média ${num(b.lift_vs_mean, 4)}` : ""}</span></div>
                <div className="flex gap-1.5">{b.items.map((it, j) => it.icon ? <img key={j} src={it.icon} alt={it.name ?? `#${it.id}`} title={it.name ?? `#${it.id}`} className="w-10 h-10 rounded-lg border border-line object-cover" loading="lazy" /> : <span key={j} title={`item ${it.id}`} className="w-10 h-10 rounded-lg border border-line flex items-center justify-center text-[10px] num text-mist">#{it.id}</span>)}</div>
                <div className="flex gap-3 ml-auto">
                  {b.spell && <span className="flex items-center gap-1.5 text-xs">{b.spell.icon && <img src={b.spell.icon} className="w-7 h-7 rounded-md border border-line" alt="" />}{b.spell.name}</span>}
                  {b.emblem && <span className="flex items-center gap-1.5 text-xs">{b.emblem.icon && <img src={b.emblem.icon} className="w-7 h-7 rounded-md border border-line" alt="" />}{b.emblem.name}</span>}
                </div>
              </div>
            ))}
        </div>
      )}
    </article>
  );
}
