import { useSearchParams } from "react-router-dom";
import { Clock, Info, Swords, Users } from "lucide-react";
import { cx, num, pct, useMatchups, type Pair } from "../../shared/api";
import { PrimaryAction } from "../../shared/ui/patterns/PrimaryAction";
import {
  Avatar, CtxBar, ErrBox, EvidenceQualityBadge,
  Loading, SectionTitle
} from "../../shared/ui";
import { DurationChart } from "../../shared/ui/patterns/charts";
import type { HeroPanelProps } from "../../shared/ui/patterns/heroPanel";

const STUDY_CASES = [
  { id: "101", name: "Granger", desc: "Heterogeneidade M6 por rank com ruído em pares pequenos (MAE 0.0068 vs magnitude 0.0089)" },
  { id: "1", name: "Miya", desc: "Precisão aparente inflada pelo proxy de exposição (c=1e7 colapsa IC)" },
  { id: "10", name: "Franco", desc: "Robusto à premissa de ruído (P=0.00 em toda a grade c)" },
  { id: "11", name: "Fanny", desc: "Força extrema consistente imune à escolha da premissa c" },
  { id: "104", name: "Yve", desc: "Caso clássico da Zona Yve (inconclusivo por sensibilidade)" },
];

function PairCard({ p, isCounter }: { p: Pair; isCounter: boolean }) {
  void isCounter;
  const hasValue = p.delta != null && Number.isFinite(p.delta);
  const isPositive = hasValue && (p.delta as number) >= 0;

  return (
    <div className="card card-h p-3 flex items-center gap-3 bg-panel border-line transition-all" title={p.pair_key ? `par canónico ${p.pair_key}` : "par sem chave canónica"}>
      <Avatar src={p.head} name={p.name} size={42} />

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-foam truncate">{p.name}</span>
          <span
            className={cx(
              "num text-xs font-bold px-2 py-0.5 rounded-full border",
              !hasValue
                ? "text-mist border-line bg-abyss"
                : isPositive
                ? "text-emerald-300 border-emerald-400/30 bg-emerald-400/10"
                : "text-rose-300 border-rose-400/30 bg-rose-400/10"
            )}
            title="δ em pontos percentuais absolutos (hipótese) — não é probabilidade, não somar entre inimigos"
          >
            {hasValue ? `${isPositive ? "+" : ""}${num(p.delta, 3)}` : "desconhecido"}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-mist flex-wrap">
          <span className="font-mono">WR {pct(p.win, 0)}</span>
          <span>·</span>
          <span className="text-foam capitalize">{p.profile}</span>
          <span>·</span>
          <EvidenceQualityBadge
            quality={p.evidence_quality}
            reasons={p.evidence_reasons}
          />
          {p.pair_key ? (
            <span className="font-mono text-[10px] text-mist/70" title={`par canónico ${p.pair_key}`}>{p.pair_key}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PairGroup({
  title,
  subtitle,
  pairs,
  isCounter,
  isNegativeHighlight,
}: {
  title: string;
  subtitle: string;
  pairs: Pair[];
  isCounter: boolean;
  isNegativeHighlight?: boolean;
}) {
  void isCounter;
  if (!pairs.length) return null;

  return (
    <div className={`space-y-2.5 p-4 rounded-2xl border ${
      isNegativeHighlight
        ? "bg-rose-500/5 border-rose-500/30"
        : "bg-panel2/30 border-line"
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-foam flex items-center gap-1.5">
            {title}
            {isNegativeHighlight && (
              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                Atenção Tática
              </span>
            )}
          </h4>
          <p className="text-[11px] text-mist">{subtitle}</p>
        </div>
        <span className="text-xs font-mono text-mist font-bold">n={pairs.length}</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {pairs.slice(0, 6).map((p) => (
          <PairCard
            key={`${p.relationship_type}-${p.id}`}
            p={p}
            isCounter={isCounter}
          />
        ))}
      </div>
    </div>
  );
}

/** CTX-M6 · painel reutilizado pela rota plana /confrontos e pela aba confrontos de /heroi. Janela de pares via URL (?days=, default = window). Mesma key ["matchups",id,rank,days]. */
export default function ConfrontosPanel({ rank, window, hero, dossier, picker }: HeroPanelProps) {
  const [sp, setSp] = useSearchParams();

  const pickHero = (id: string) => {
    sp.set("hero", id);
    setSp(sp);
  };

  const days = sp.get("days") ?? window;
  const matchupsQuery = useMatchups(hero || null, rank, days);
  const m = matchupsQuery.data;

  return (
    <section className="space-y-5">
      <CtxBar
        id="M6"
        name="Associações de Matchup e Confiança (M6)"
        question="Quais adversários e aliados apresentam associações empíricas com o rendimento do herói?"
        status="descritivo v1 (sem shrinkage inferencial)"
        formula="δ_raw = lift sobre a própria base global (pp absoluto, hipótese forte); Counter antissimétrico; Teammate simétrico; Par ausente = NULL; Sem soma linear de inimigos"
        prdRef="PRD Matchup Effect e Confiança (M6)"
      />

      {dossier}

      <SectionTitle
        kicker="Stream 2 · Inteligência de Draft & Interações (M6)"
        title="Counters & Sinergias Contextuais"
        subtitle="Efeito bruto de associação direcional com carimbo obrigatório de rank, janela e qualidade da evidência."
      />

      {picker}

      <PrimaryAction
        label="Levar par p/ o draft"
        to={`/draft?hero=${hero}&rank=${rank}&window=${window}`}
        disabledReason={!hero ? "selecione um par" : null}
      />

      {!hero ? (
        <div className="space-y-4">
          <div className="card p-6 border-line bg-panel2/30 space-y-3 text-center">
            <span className="p-3 rounded-2xl bg-panel inline-flex text-gold border border-gold/30">
              <Swords size={24} />
            </span>
            <h3 className="font-bold text-base text-foam">
              Selecione um Herói para Inspecionar Confrontos & Sinergias
            </h3>
            <p className="text-xs text-mist max-w-lg mx-auto leading-relaxed">
              O catálogo M6 processa pares canônicos antissimétricos (counters) e simétricos (sinergias) de acordo com o elo selecionado. Clique em um dos casos de estudo abaixo para explorar imediatamente:
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 text-left">
              {STUDY_CASES.map((sc) => (
                <div
                  key={sc.id}
                  onClick={() => pickHero(sc.id)}
                  className="card card-h p-3 cursor-pointer bg-panel border-line hover:border-gold/40 transition-all space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foam hover:text-gold">{sc.name}</span>
                    <span className="text-[10px] font-mono text-mist">ID #{sc.id}</span>
                  </div>
                  <p className="text-[11px] text-mist line-clamp-2 leading-relaxed">
                    {sc.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : matchupsQuery.isLoading ? (
        <Loading rows={4} />
      ) : matchupsQuery.isError || !m ? (
        <ErrBox onRetry={() => matchupsQuery.refetch()} />
      ) : (
        <div className="space-y-5">
          {/* DDD Invariant Banner for M6 */}
          <div className="card p-4 bg-gradient-to-r from-panel via-panel2/50 to-panel border-line text-xs space-y-1.5 shadow-sm">
            <div className="flex items-center gap-2 text-gold font-bold">
              <Info size={15} />
              <span>Regras Estruturais do M6 (PRD §1 / D-MTCH-11):</span>
            </div>
            <p className="text-mist leading-relaxed">
              δ <b>não é probabilidade de vitória</b> e <b>não deve ser somado</b> linearmente entre 5 inimigos em um score aditivo de draft. Cada par canônico representa uma evidência singular. Teammates possuem <b>cauda negativa dominante</b> (média −0,0076), tornando o alerta de <b>anti-sinergia ("evite este par")</b> uma prioridade tática.
            </p>
          </div>

          {/* Abertura: sinergias + curva de duração; counters em seguida (ficha §2) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-line pb-2">
              <Users size={16} className="text-emerald-300" />
              <h3 className="text-sm font-bold text-foam">
                Com quem comba (sinergias · relação simétrica)
              </h3>
            </div>
            <p className="text-[11px] text-mist">δ positivo simétrico — par rende junto, não é causal.</p>

            <PairGroup
              title="🤝 Aliados Favoráveis (Sinergia Positiva)"
              subtitle="δ positivo: dupla com rendimento conjunto favorável"
              pairs={m.synergiesUp}
              isCounter={false}
            />

            <PairGroup
              title="⚠️ Anti-Sinergias Dominantes (Evite este Par)"
              subtitle="δ negativo: cauda negativa dominante identificada pelo PRD §6.2"
              pairs={m.synergiesDown}
              isCounter={false}
              isNegativeHighlight={true}
            />
          </div>

          {/* Curva de duração (quando no jogo) — logo abaixo das sinergias */}
          {(() => {
            const curveHero = m.synergiesUp[0] ?? m.countersUp[0];
            return !!curveHero?.curve?.length ? (
            <div className="card p-4 space-y-3 border-line bg-panel2/40">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-cyan-300" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foam">
                    Quando no jogo — duração (referência: {curveHero.name})
                  </h4>
                </div>
                <span className="text-[11px] text-mist font-mono">
                  Perfil: <b className="text-foam uppercase">{curveHero.profile}</b>
                </span>
              </div>

              <DurationChart
                curve={curveHero.curve}
                heroWin={curveHero.win ?? 0.5}
              />
              <p className="text-[11px] text-mist text-center">
                Associação por faixa de duração — não causal. Snowball = maior rendimento no início · Scaling = maior rendimento no late game · Faixas extremas sem amostragem descartadas.
              </p>
            </div>
            ) : null;
          })()}

          {/* Em seguida: counters (relação antissimétrica) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-line pb-2">
              <Swords size={16} className="text-gold" />
              <h3 className="text-sm font-bold text-foam">
                Quem countera / quem eu countero (relação antissimétrica)
              </h3>
            </div>

            <PairGroup
              title="⚔️ Desvantagem contra Inimigo (Herói é counterado)"
              subtitle="δ negativo: adversários com associação histórica desfavorável"
              pairs={m.countersDown}
              isCounter={true}
              isNegativeHighlight={true}
            />

            <PairGroup
              title="⚔️ Vantagem a Favor (Herói supera o alvo)"
              subtitle="δ positivo: o herói eleva sua taxa contra este adversário"
              pairs={m.countersUp}
              isCounter={true}
            />
          </div>
        </div>
      )}
    </section>
  );
}
