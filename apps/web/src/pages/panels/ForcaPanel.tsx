import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpDown, Search, Sparkles } from "lucide-react";
import { cx, num, pct, useHeroes, type Hero } from "../../lib/api";
import {
  Avatar, ClassSeal, CtxBar, Empty, ErrBox, FreshLine,
  IddZone, IddTraceBadge, Loading, SectionTitle, ThetaBar, TierBadge
} from "../../components/ui";
import { PrimaryAction } from "../../components/idd/PrimaryAction";
import { classOf, heroRankPosition, medianWrAdj, sortHeroesByMetric } from "@radar/proprietary-engine";

export interface HeroPanelProps {
  rank: string;
  window: string;
  hero: string;
  dossier?: ReactNode;
  picker?: ReactNode;
  /** Na ficha (/hero/:id): herói em destaque no topo, sem KPIs globais. Tabela segue abaixo como prova. */
  ficha?: boolean;
}

// DESVIO (c): `d` saiu do motor (era afim crescente de θ̂) — sorts usam wrAdj (ordem idêntica).
type SortKey = "wrAdj" | "win" | "pick" | "ban" | "q" | "B";

type HeroWithModel = Hero & { mu?: number; tau?: number };

/** CTX-SHR · painel reutilizado pela rota plana /forca e pela aba forca de /heroi. Mesma query key ["heroes",rank,window]. */
export default function ForcaPanel({ rank, window, hero, dossier, picker, ficha }: HeroPanelProps) {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState("");
  const [tier, setTier] = useState("todos");
  const [sort, setSort] = useState<SortKey>("wrAdj");

  const query = useHeroes(rank, window);

  const heroes = useMemo(() => {
    let rows = query.data?.data ?? [];
    if (q) rows = rows.filter((h) => h.name.toLowerCase().includes(q.toLowerCase()));
    if (tier !== "todos") rows = rows.filter((h) => h.tier === tier);

    // Ordenação por métrica em `@radar/proprietary-engine` (forca-sorting).
    return sortHeroesByMetric(rows, sort);
  }, [query.data, q, tier, sort]);

  const med = useMemo(() => medianWrAdj(query.data?.data ?? []), [query.data]);

  const selectHero = (id: number) => {
    sp.set("hero", String(id));
    setSp(sp);
  };

  if (query.isLoading) return <Loading rows={8} />;
  if (query.isError) return <ErrBox onRetry={() => query.refetch()} />;

  const meta = (query.data as unknown as { meta?: { mu: number; tau: number } } | undefined)?.meta;
  const mu = meta?.mu ?? 0.5;
  const tau = meta?.tau ?? 0.031;
  const totalCount = query.data?.total ?? 0;
  const sCount = (query.data?.data ?? []).filter((h) => h.tier === "S").length;

  return (
    <section className="space-y-5">
      <CtxBar
        id="SHR"
        name="Força e Shrinkage Bayesiano"
        question="Quão forte o herói é de verdade sob ruído amostral?"
        status="validado (M1)"
        formula="y_i | θ_i ~ N(θ_i, s_i²); s_i² = μ(1−μ)/(c · pick); θ̂_i = μ + B_i(y_i − μ); B_i = τ²/(τ² + s_i²); c=1e5 (grade 1e4–1e7)"
        prdRef="PRD Modelo Hierárquico com Shrinkage"
      />

      {dossier}

      {/* Header section with status & info */}
      <SectionTitle
        kicker="Stream I · Inferência e Força Latente (M1)"
        title="Panorama Geral de Força e Shrinkage"
        subtitle={`Elo ativo: ${rank.toUpperCase()} · Janela amostral: ${window} dias · Referência de regressão: μ̂=${num(mu, 4)}, τ̂=${num(tau, 4)}`}
        right={
          <FreshLine
            stale={query.data?.stale}
            ageMs={query.data?.collectedAgoMs}
            postPatch={query.data?.postPatch}
          />
        }
      />

      {picker}

      <PrimaryAction
        contextId="SHR"
        capId="CAP-SHR-01"
        label="Comparar neste contexto"
        to={`/confianca?hero=${hero}&rank=${rank}&window=${window}`}
        disabledReason={!hero ? "selecione um herói na tabela" : null}
      />

      {/* Destaque do herói (só na ficha): O herói primeiro, KPIs globais nunca */}
      {ficha && hero ? (() => {
        const rows = query.data?.data ?? [];
        const me = rows.find((h) => String(h.id) === String(hero));
        if (!me) return null;
        // Posição no meta em `@radar/proprietary-engine` (heroRankPosition).
        const pos = heroRankPosition(rows, hero);
        const escasso = (me.B ?? 1) < 0.25 || me.smallSample;
        return (
          <div className="card p-4 bg-panel border-gold/40 space-y-2.5" aria-label={`Destaque de força de ${me.name}`}>
            <div className="flex items-center gap-3 flex-wrap">
              <Avatar src={me.head} name={me.name} size={48} />
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-foam truncate">{me.name}</p>
                <p className="text-[11px] text-mist font-mono">
                  #{pos} de {rows.length} no meta · θ̂ {num(me.wrAdj, 3)} vs obs {num(me.win, 3)}
                </p>
              </div>
              <TierBadge tier={me.tier} />
            </div>
            <p className="text-[11px] font-mono text-mist" title="B = puxada à média; z = distância em erros-padrão; q = taxa de falsa descoberta">
              B {num(me.B, 2)} · z {num(me.z, 2)} · q {num(me.q, 4)}
              {escasso ? " · amostra escassa (encolhido à média)" : ""}
            </p>
          </div>
        );
      })() : null}

      {/* SaaS Metric KPI Stat Cards Row (só na rota plana; na ficha o herói já está acima) */}
      {!ficha ? (
      <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card bg-gradient-to-br from-panel via-panel2/50 to-panel border-line">
          <div className="flex items-center justify-between">
            <span className="lbl">Heróis Avaliados</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {totalCount} Heróis
            </span>
          </div>
          <p className="num text-2xl font-bold text-foam mt-1">{totalCount}</p>
          <p className="text-[11px] text-mist mt-1">
            Catálogo completo com convergência REML
          </p>
        </div>

        <div className="stat-card bg-gradient-to-br from-panel via-panel2/50 to-panel border-line">
          <div className="flex items-center justify-between">
            <span className="lbl">Média do Meta (μ̂)</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/30">
              Ponto Central
            </span>
          </div>
          <p className="num text-2xl font-bold text-gold mt-1">{pct(mu)}</p>
          <p className="text-[11px] text-mist mt-1">
            Âncora de encolhimento bayesiano
          </p>
        </div>

        <div className="stat-card bg-gradient-to-br from-panel via-panel2/50 to-panel border-line">
          <div className="flex items-center justify-between">
            <span className="lbl">Dispersão Real (τ̂)</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              Variância
            </span>
          </div>
          <p className="num text-2xl font-bold text-cyan-200 mt-1">{num(tau, 4)}</p>
          <p className="text-[11px] text-mist mt-1">
            Desvio-padrão entre heróis no elo
          </p>
        </div>

        <div className="stat-card bg-gradient-to-br from-panel via-panel2/50 to-panel border-line">
          <div className="flex items-center justify-between">
            <span className="lbl">Tier S Dominantes</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
              Elite
            </span>
          </div>
          <p className="num text-2xl font-bold text-foam mt-1">{sCount} heróis</p>
          <p className="text-[11px] text-mist mt-1">
            Percentil de força ajustada &ge; 92%
          </p>
        </div>
      </div>

      {/* DDD Methodological Explainer Card */}
      <div className="card p-4 bg-gradient-to-r from-panel via-panel2/60 to-panel border-line text-xs space-y-1.5 shadow-sm">
        <div className="flex items-center gap-2 text-gold font-bold">
          <Sparkles size={15} />
          <span>Diretriz do Modelo M1 (PRD §3.3 / RF-HIER-01):</span>
        </div>
        <p className="text-mist leading-relaxed">
          O Shrinkage <b>reduz a confiança em desvios extremos com pouca informação amostral</b> (baixo pick). Ele <b>não declara que o herói é mediano</b> e <b>não penaliza heróis pouco escolhidos por serem impopulares</b>. Quanto mais alto o fator <b>B</b> (próximo de 1.0), mais o win rate observado é preservado; quanto mais baixo, maior o encolhimento protetivo em direção à média global μ.
        </p>
      </div>

      {/* Filter and Search Controls */}
      <div className="card p-3.5 flex gap-3 flex-wrap items-center bg-panel border-line shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist" />
          <input
            className="inp w-full pl-9"
            aria-label="Filtrar por nome do herói"
            placeholder="Filtrar por nome do herói..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-mist">
          <span className="lbl mr-1">Tier:</span>
          {["todos", "S", "A", "B", "C", "D"].map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              className={cx(
                "px-2.5 py-1 rounded-lg font-bold text-xs transition-all",
                tier === t
                  ? "bg-gold text-abyss shadow-sm"
                  : "bg-abyss/60 text-mist hover:text-foam border border-line"
              )}
            >
              {t === "todos" ? "Todos" : t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-abyss/80 p-1 rounded-xl border border-line text-xs ml-auto">
          <span className="text-mist/70 px-2 flex items-center gap-1 text-[11px]">
            <ArrowUpDown size={12} /> Ordenar:
          </span>
          {[
            { key: "wrAdj", label: "Força θ̂" },
            { key: "win", label: "WR Bruto" },
            { key: "B", label: "Fator B" },
            { key: "q", label: "q-valor" },
            { key: "pick", label: "Pick" },
            { key: "ban", label: "Ban" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key as SortKey)}
              className={cx(
                "px-2 py-0.5 rounded-lg transition-colors font-medium text-[11px]",
                sort === s.key ? "bg-panel2 text-gold border border-gold/40 font-bold" : "text-mist hover:text-foam"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      </>
      ) : null}

      {/* Heroes Table/List (prova, abaixo da dobra na ficha) */}
      {!heroes.length ? (
        <Empty
          title="Nenhum herói encontrado"
          hint="Nenhum herói corresponde aos critérios de pesquisa e filtro ativos."
          action="Limpar filtros"
          to={`/forca?rank=${rank}&window=${window}`}
        />
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[11px] text-mist/80 px-2 font-mono">
            <span>RF-HIER-01: Win Rate Observado vs Estimado (θ̂) com Shrinkage B</span>
            <span>Premissa: c=100.000 (grade 1e4–1e7) · Exposição: slot_share (unvalidated)</span>
          </div>

          <div className="grid gap-2">
            {heroes.map((h) => {
              const isSelected = hero === String(h.id);
              const shrinkagePercent = ((1 - (h.B ?? 1)) * 100).toFixed(0);

              return (
                <article
                  key={h.id}
                  onClick={() => selectHero(h.id)}
                  className={cx(
                    "card card-h p-3.5 flex items-center gap-4 flex-wrap cursor-pointer transition-all",
                    isSelected ? "border-gold bg-gold/5 shadow-glow" : "bg-panel"
                  )}
                >
                  <IddZone zone="identity" capId="CAP-SHR-01" className="flex items-center gap-2.5 p-1">
                    <Avatar src={h.head} name={h.name} size={46} />
                    <div>
                      <span className="font-bold text-sm text-foam">{h.name}</span>
                      <IddTraceBadge capId="CAP-SHR-01" step="Localizar" />
                    </div>
                  </IddZone>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <IddZone zone="state" className="flex items-center gap-2 flex-wrap p-1">
                      <TierBadge tier={h.tier} />
                      <ClassSeal cls={classOf(h)} />
                      {isSelected && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gold/20 text-gold border border-gold/40">
                          Herói Ativo no Dossiê
                        </span>
                      )}
                      {h.B && h.B < 0.25 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          Amostra Escassa (Encolhido)
                        </span>
                      )}
                    </IddZone>

                    <IddZone zone="data" capId="CAP-SHR-02" className="flex items-center gap-4 text-xs text-mist flex-wrap p-1">
                      {/* Força Ajustada θ̂ vs Observado */}
                      <span className="flex items-center gap-1.5">
                        θ̂ <b className="num text-gold font-bold text-sm">{num(h.wrAdj, 3)}</b>
                        <span className="text-mist/70">
                          (obs {num(h.win, 3)} · B={num(h.B, 2)} · {shrinkagePercent}% encolhido)
                        </span>
                      </span>

                      {/* Barra de Posição em Relação à Mediana */}
                      <ThetaBar value={h.wrAdj} median={med} />

                      {/* Parâmetros do Modelo z e q (DESVIO (c): d saiu do motor; z no fio) */}
                      <span title="Distância da média em erros-padrão: z = (θ̂ - μ) / se">
                        z <b className="num text-foam font-bold">{num(h.z, 2)}</b>
                      </span>
                      <span title="FDR corrigido pelo Benjamini-Hochberg (BH-FDR)">
                        q <b className="num text-foam">{num(h.q, 4)}</b>
                      </span>

                      {/* Demanda de Draft */}
                      <span>
                        pick <b className="num text-foam">{pct(h.pick)}</b>
                      </span>
                      <span>
                        ban <b className="num text-cyan-200">{pct(h.ban)}</b>
                      </span>
                    </IddZone>
                  </div>

                  {/* Quick DDD Drilldown Links (Zona de Ações Secundárias / Drilldown) */}
                  <IddZone
                    zone="secondary"
                    className="flex items-center gap-1.5 flex-wrap ml-auto p-1"
                  >
                    <div
                      className="flex items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link
                        to={`/confianca?hero=${h.id}&rank=${rank}&window=${window}`}
                        className="btn-ghost !py-1 !px-2.5 text-xs text-cyan-200 hover:text-cyan-100"
                        title="Ver trio de incerteza e posterior"
                      >
                        Confiança →
                      </Link>
                      <Link
                        to={`/confrontos?hero=${h.id}&rank=${rank}&window=${window}`}
                        className="btn-ghost !py-1 !px-2.5 text-xs text-emerald-200 hover:text-emerald-100"
                        title="Ver counters e sinergias do M6"
                      >
                        Confrontos →
                      </Link>
                      <Link
                        to={`/draft?hero=${h.id}&rank=${rank}&window=${window}`}
                        className="btn-ghost !py-1 !px-2.5 text-xs text-amber-200 hover:text-amber-100"
                        title="Ver distorção no draft"
                      >
                        Draft →
                      </Link>
                    </div>
                  </IddZone>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
