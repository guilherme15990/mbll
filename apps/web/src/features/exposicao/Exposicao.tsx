import { Link } from "react-router-dom";
import { CheckCircle2, HeartPulse, Info, Server, ShieldAlert, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { ago, useHeroes, useMeta, useViews } from "../../lib/api";
import { useFilters } from "../../app/filters";
import {
  Avatar, CtxBar, ErrBox, IddZone, Loading,
  SectionTitle, StatusSeal, TierBadge
} from "../../shared/ui";
import { PrimaryAction } from "../../shared/idd/PrimaryAction";
import { SigmaBanCard } from "../../shared/idd/SigmaBanCard";

/** CTX-EXP · Exposição e Validação do Denominador — Quanto observamos de cada herói? */
export default function Exposicao() {
  const { rank, window } = useFilters();
  const heroesQuery = useHeroes(rank, window);
  const tiersQuery = useViews("tier", rank, window);
  const metaQuery = useMeta();

  const pickCheck: any = (heroesQuery.data as any)?.pickSumCheck;
  const meta = metaQuery.data;

  return (
    <section className="space-y-4">
      <CtxBar
        id="EXP"
        name="Governança de Exposição e Integridade do Denominador"
        question="Qual é o substrato amostral real? O denominador de pick_rate é estável e conservado?"
        status="validado (slot_share)"
        formula="Σ pick_rate ≈ 1.0 (slot_share conservado); Σ ban_rate ≈ 7.6–8.9 (fração de partidas); Denominador de partidas desconhecido; Beta-Binomial descartada"
        prdRef="PRD Estimated Exposure e Validação do Denominador de Pick Rate"
      />

      <SectionTitle
        kicker="Stream 3 · Governança do Substrato Amostral (PRD §1)"
        title="Vigilância de Exposição & Denominador"
        subtitle="Auditoria contínua de integridade matemática: conservação de slot_share, saúde da API e rejeição de pseudo-contagens."
      />

      <PrimaryAction
        contextId="EXP"
        capId="CAP-EXP-01"
        label="Exportar relatório do lote"
        to={`/exposicao?rank=${rank}&window=${window}`}
        disabledReason={heroesQuery.isError || !pickCheck ? "sem snapshot neste rank/janela" : null}
      />

      <SigmaBanCard
        sigmaBanSum={null}
        sigmaPickSum={typeof pickCheck?.sum === "number" ? pickCheck.sum : null}
        sigmaAlert={Boolean(pickCheck) && !pickCheck.ok}
        pickFonte="appearance==pick"
        capId="CAP-EXP-01"
      />

      {/* Core Integrity Gauges */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Σ pick_rate Conservation Card */}
        <div className="card p-4.5 bg-gradient-to-br from-panel to-panel2/60 border-line space-y-3">
          <div className="flex items-center justify-between">
            <span className="lbl text-xs font-semibold text-foam">
              1. Conservação Σ pick_rate (RF-EXP-04)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-abyss text-mist border border-line">
              Limiar: 1.0 ± 0.005
            </span>
          </div>

          {heroesQuery.isLoading ? (
            <Loading rows={1} />
          ) : heroesQuery.isError || !pickCheck ? (
            <p className="text-xs text-mist">Sem dados de verificação neste snapshot.</p>
          ) : (
            <div className="flex items-center gap-3">
              <span className="num text-3xl font-bold text-gold">
                {Number(pickCheck.sum).toFixed(6)}
              </span>
              <StatusSeal
                ok={pickCheck.ok}
                good="Conservação Estável (Σ ≈ 1.0)"
                bad="Alerta: Desvio fora de 1 ± 0.005"
              />
            </div>
          )}

          <p className="text-xs text-mist leading-relaxed">
            Como a soma sobre os 132 heróis resulta em ~1,000 em todos os snapshots testados (e não ~5,0), o pick_rate representa a <b>participação normalizada nos slots de heróis da partida (slot_share)</b>, refutando a leitura de fração direta de partidas.
          </p>
        </div>

        {/* API Health & Infrastructure */}
        <div className="card p-4.5 bg-gradient-to-br from-panel to-panel2/60 border-line space-y-3">
          <div className="flex items-center justify-between">
            <span className="lbl text-xs font-semibold text-foam">
              2. Saúde da Infraestrutura e Cache
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Operacional
            </span>
          </div>

          {metaQuery.isLoading ? (
            <Loading rows={1} />
          ) : metaQuery.isError || !meta ? (
            <ErrBox message="Serviço de telemetria da API inacessível." />
          ) : (
            <div className="space-y-1.5 text-xs text-mist font-mono">
              <div className="flex justify-between">
                <span>Fonte Conectada:</span>
                <b className="text-foam">arena.rone.dev (Rone Arena)</b>
              </div>
              <div className="flex justify-between">
                <span>Erros Registrados:</span>
                <b className="text-foam">{meta.health?.errors ?? 0} falhas</b>
              </div>
              <div className="flex justify-between">
                <span>Camada de Cache:</span>
                <b className="text-foam">
                  {meta.cache?.sqlite ? `SQLite (${meta.cache.rows} chaves persistidas)` : "Memória volátil"}
                </b>
              </div>
              <div className="flex justify-between">
                <span>Versão do Jogo:</span>
                <b className="text-gold">
                  {(meta.versions ?? [])[0]?.data?.game_version ?? "Não identificada"}
                </b>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5-Level Validation Protocol (PRD §3) */}
      <div className="card p-4.5 border-line bg-panel2/40 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-gold" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-foam">
            Protocolo de Validação do Denominador em 5 Níveis (PRD §3)
          </h4>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5 text-xs">
          <div className="p-3 rounded-xl bg-panel border border-line space-y-1">
            <div className="flex items-center justify-between">
              <b className="text-foam">1. Semântico</b>
              <span className="text-[10px] text-amber-300 font-mono">Parcial</span>
            </div>
            <p className="text-[11px] text-mist">
              A documentação oficial menciona apenas "appearance rate", sem declarar o denominador da razão.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-panel border border-emerald-500/30 bg-emerald-500/5 space-y-1">
            <div className="flex items-center justify-between">
              <b className="text-emerald-300">2. Conservação</b>
              <span className="text-[10px] text-emerald-400 font-mono">Executado</span>
            </div>
            <p className="text-[11px] text-mist">
              Σ pick ≈ 1.0 comprovado em todos os 5 snapshots com desvio residual &lt; 0.001. Hipótese A refutada.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-panel border border-rose-500/30 bg-rose-500/5 space-y-1">
            <div className="flex items-center justify-between">
              <b className="text-rose-300">3. Inteireza</b>
              <span className="text-[10px] text-rose-400 font-mono">Refutado</span>
            </div>
            <p className="text-[11px] text-mist">
              Busca por N que gere contagens inteiras de vitórias falhou (resíduo aleatório uniforme). Rejeitada reconstrução.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-panel border border-line space-y-1">
            <div className="flex items-center justify-between">
              <b className="text-foam">4. Cross-Endpoint</b>
              <span className="text-[10px] text-mist font-mono">Parcial</span>
            </div>
            <p className="text-[11px] text-mist">
              Confrontado entre /heroes/rank e /academy para pares. Coerência demonstrada para matchups.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-panel border border-line space-y-1">
            <div className="flex items-center justify-between">
              <b className="text-foam">5. Cross-Time</b>
              <span className="text-[10px] text-mist font-mono">Pendente</span>
            </div>
            <p className="text-[11px] text-mist">
              Coerência estocástica entre agregações móveis de 1, 3, 7, 15 e 30 dias com série diária.
            </p>
          </div>
        </div>

        {/* PRD Acceptance Criteria Alert */}
        <div className="p-3 rounded-xl bg-abyss/80 border border-line text-[11px] text-mist flex items-start gap-2.5">
          <ShieldAlert size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-foam">
              Critério de Aceite RF-EXP-02 (Proibição de Pseudo-Contagens):
            </span>
            <p>
              O sistema <b>nunca exibe contagens absolutas de partidas estimadas</b> (como "~24 mil jogos") enquanto não houver telemetria oficial de denominador comprovada. O status de exposição permanece estritamente <code>exposure.status = unvalidated</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Meta Tier Distribution Overview */}
      <section className="space-y-3 pt-2">
        <SectionTitle
          kicker="Distribuição Populacional por Percentil de θ̂"
          title="Divisão dos Tiers Competitivos no Elo"
          subtitle="Agrupamento determinístico dos heróis em Tiers S, A, B, C e D pelo percentil da força latente ajustada."
        />

        {tiersQuery.isLoading ? (
          <Loading rows={3} />
        ) : tiersQuery.isError ? (
          <ErrBox onRetry={() => tiersQuery.refetch()} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Object.entries(tiersQuery.data?.data ?? {}).map(([tierKey, heroList]: any) => (
              <div key={tierKey} className="card p-3.5 border-line bg-panel2/40 space-y-2">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="font-bold text-base flex items-center gap-1.5">
                    <TierBadge tier={tierKey} />
                    <span className="text-foam">Tier {tierKey}</span>
                  </span>
                  <span className="text-xs text-mist font-mono font-bold">
                    {heroList.length} heróis
                  </span>
                </div>

                <ul className="space-y-1.5 pt-1">
                  {heroList.slice(0, 6).map((h: any) => (
                    <li key={h.id}>
                      <Link
                        to={`/forca?hero=${h.id}&rank=${rank}&window=${window}`}
                        className="flex items-center gap-2 p-1 rounded-lg hover:bg-panel transition-colors text-xs"
                      >
                        <Avatar src={h.head} name={h.name} size={24} />
                        <span className="truncate flex-1 text-foam hover:text-gold font-medium">
                          {h.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
