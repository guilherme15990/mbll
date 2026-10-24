import { BookOpen, Check, Layers, Scale, ShieldAlert, Sparkles, X } from "lucide-react";
import { useState } from "react";

interface DddModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DddModal({ isOpen, onClose }: DddModalProps) {
  const [tab, setTab] = useState<"contexts" | "glossary" | "invariants">("contexts");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-abyss/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-panel border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-panel2/60">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-gold/15 text-gold border border-gold/30">
              <Layers size={20} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-foam flex items-center gap-2">
                Arquitetura DDD & Diretrizes dos PRDs
                <span className="text-xs px-2 py-0.5 rounded-full bg-gold/20 text-gold border border-gold/40">v1.0 Final</span>
              </h2>
              <p className="text-xs text-mist">
                Domínio Orientado pelo Radar de Balanceamento · 9 Bounded Contexts · Linguagem Ubíqua
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-mist hover:text-foam hover:bg-panel border border-transparent hover:border-line transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-line px-6 bg-abyss/40 text-xs">
          <button
            onClick={() => setTab("contexts")}
            className={`py-3 px-4 font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              tab === "contexts"
                ? "border-gold text-gold"
                : "border-transparent text-mist hover:text-foam"
            }`}
          >
            <Layers size={14} /> 9 Bounded Contexts
          </button>
          <button
            onClick={() => setTab("glossary")}
            className={`py-3 px-4 font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              tab === "glossary"
                ? "border-gold text-gold"
                : "border-transparent text-mist hover:text-foam"
            }`}
          >
            <BookOpen size={14} /> Linguagem Ubíqua (Glossário)
          </button>
          <button
            onClick={() => setTab("invariants")}
            className={`py-3 px-4 font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              tab === "invariants"
                ? "border-gold text-gold"
                : "border-transparent text-mist hover:text-foam"
            }`}
          >
            <ShieldAlert size={14} /> Invariantes & Leis do Radar
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-mist flex-1">
          {tab === "contexts" && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-gold/10 border border-gold/30 text-foam text-xs space-y-1">
                <p className="font-semibold text-gold flex items-center gap-1.5">
                  <Sparkles size={14} /> Filosofia de Produto dos PRDs:
                </p>
                <p>
                  O Radar de Balanceamento MLBB é um <b>índice de pressão e evidência inferencial</b>, e <b>nunca uma previsão de vitória em partida</b>.
                  As 9 seções do sistema correspondem a 9 Bounded Contexts independentes, preservando a semântica de incerteza estatística em vez de produzir scores compostos arbitrários.
                </p>
              </div>

              <div className="grid gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foam">
                  Stream 1: Inferência & Força Latente (Core Engine)
                </h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="card p-3 border-line bg-panel2/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gold text-xs">CTX-SHR · Força e Shrinkage</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">M1 Validado</span>
                    </div>
                    <p className="text-xs text-foam font-semibold">Modelo Normal Hierárquico com Shrinkage Bayesiano</p>
                    <p className="text-[11px] leading-relaxed">
                      Estima a força real latente (θ̂) encolhendo desvios com pouca exposição em direção à referência global μ. O parâmetro de escala c é premissa analisada em grade (1e4 a 1e7), nunca estimado diretamente.
                    </p>
                  </div>

                  <div className="card p-3 border-line bg-panel2/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300 text-xs">CTX-CNF · Confiança e Incerteza</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">Provisório</span>
                    </div>
                    <p className="text-xs text-foam font-semibold">O Trio de Incerteza & Detecção da Zona Yve</p>
                    <p className="text-[11px] leading-relaxed">
                      Mantém separados três conceitos: Posterior Mean, Intervalo Credível 95% e Probabilidade Posterior P(θ &gt; μ+Δ). Heróis sensíveis à escolha de c são marcados como <code>inconclusive_sensitivity</code> (Zona Yve).
                    </p>
                  </div>

                  <div className="card p-3 border-line bg-panel2/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-300 text-xs">CTX-RNK · Força por Rank</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">Proposta</span>
                    </div>
                    <p className="text-xs text-foam font-semibold">Heterogeneidade Relativa: D = s_a − s_b</p>
                    <p className="text-[11px] leading-relaxed">
                      Mede a diferença de força relativa à referência própria de cada rank (s_r = θ_r − μ_r). Sem imputar causalidade em mecânica ou habilidade sem covariáveis de jogadores.
                    </p>
                  </div>

                  <div className="card p-3 border-line bg-panel2/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sky-300 text-xs">CTX-TMP · Tempo e Patches</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">Experimental</span>
                    </div>
                    <p className="text-xs text-foam font-semibold">Δ em Log-Odds & Regra Sinal → Alerta → Causal</p>
                    <p className="text-[11px] leading-relaxed">
                      Mede a diferença temporal entre janelas em log-odds (nunca em pontos percentuais sem referência). Ciclo de vida: Sinal Inicial → Sinal Persistente → Sinal Revertido. Causalidade de patch exige desenho contrafactual.
                    </p>
                  </div>
                </div>

                <h3 className="text-xs font-bold uppercase tracking-wider text-foam pt-3">
                  Stream 2: Inteligência de Draft & Interações (Draft Synergy)
                </h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="card p-3 border-line bg-panel2/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-300 text-xs">CTX-M6 · Confrontos e Sinergias</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Descritivo v1</span>
                    </div>
                    <p className="text-xs text-foam font-semibold">Counters Antissimétricos vs Sinergias Simétricas</p>
                    <p className="text-[11px] leading-relaxed">
                      Um único δ por par canônico. Sem p-valor, IC ou soma aditiva de 5 inimigos no v1. Teammates exibem cauda negativa dominante (alerta prioritário de anti-sinergia: "evite este par").
                    </p>
                  </div>

                  <div className="card p-3 border-line bg-panel2/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300 text-xs">CTX-DRF · Distorção de Draft</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">Proposta</span>
                    </div>
                    <p className="text-xs text-foam font-semibold">Performance vs Pressões Independentes de Pick e Ban</p>
                    <p className="text-[11px] leading-relaxed">
                      Pick e Ban têm unidades distintas e nunca são somados. Resíduos de pressão esperada identificam Overbanned, Hidden Gem, Stale Draft Pressure e Popular Underperformer sem acusar a comunidade de "erro".
                    </p>
                  </div>

                  <div className="card p-3 border-line bg-panel2/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-300 text-xs">CTX-BPS · Blind Pick Safety</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">Proxy</span>
                    </div>
                    <p className="text-xs text-foam font-semibold">Resiliência de Cauda Adversa (p10) e Exposição</p>
                    <p className="text-[11px] leading-relaxed">
                      Não é o herói de maior win rate, mas o de vulnerabilidade de cauda limitada contra a distribuição de adversários do elo. Pior counter pontual é diagnóstico; segurança não equivale a solo queue.
                    </p>
                  </div>

                  <div className="card p-3 border-line bg-panel2/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-orange-300 text-xs">CTX-BDL · Builds e Item Lift</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/30">Camada A</span>
                    </div>
                    <p className="text-xs text-foam font-semibold">Lift Bruto vs Referência & Causalidade Reversa</p>
                    <p className="text-[11px] leading-relaxed">
                      L = WR_build − WR_ref (Mais Usada ou Média). Lane é obrigatória. Alerta de viés de seleção: partidas ganhas completam builds ofensivas de 6 itens; jogos perdidos terminam com itens parciais/defensivos.
                    </p>
                  </div>
                </div>

                <h3 className="text-xs font-bold uppercase tracking-wider text-foam pt-3">
                  Stream 3: Governança do Substrato de Dados (Data Governance)
                </h3>
                <div className="card p-3 border-line bg-panel2/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-400 text-xs">CTX-EXP · Exposição e Denominador</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Validado (slot_share)</span>
                  </div>
                  <p className="text-xs text-foam font-semibold">Vigilância de Conservação: Σ pick ≈ 1.0 vs Σ ban ≈ 7.6–8.9</p>
                  <p className="text-[11px] leading-relaxed">
                    Audita que o pick rate é uma cota de vagas (slot_share) e refuta a leitura ingênua de "partidas em que apareceu". Rejeita reconstrução de contagens inteiras ou Beta-Binomial sem dados reais de partidas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === "glossary" && (
            <div className="space-y-4">
              <p className="text-xs text-mist">
                Termos formais utilizados em todo o sistema, rigorosamente alinhados aos PRDs e à literatura de modelagem estatística:
              </p>
              <div className="grid gap-3">
                <div className="p-3 rounded-xl bg-panel2/60 border border-line">
                  <span className="font-mono text-xs font-bold text-gold">θ̂ (Força Latente Ajustada / wrAdj)</span>
                  <p className="text-xs text-foam mt-1">
                    Estimativa pontual da verdadeira força do herói após shrinkage empírico. Corrige a dispersão causada por heróis com baixa participação.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-panel2/60 border border-line">
                  <span className="font-mono text-xs font-bold text-cyan-300">c (Parâmetro de Escala de Ruído / c_reference)</span>
                  <p className="text-xs text-foam mt-1">
                    Premissa de modelagem que controla a escala da variância observacional s² = μ(1−μ)/(c·pick). Não é identificável por máxima verossimilhança (possui platô), sendo avaliado em grade (1e4, 1e5, 1e6, 1e7).
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-panel2/60 border border-line">
                  <span className="font-mono text-xs font-bold text-amber-300">Zona Yve (Inconclusivo por Sensibilidade)</span>
                  <p className="text-xs text-foam mt-1">
                    Heróis cujo resultado posterior muda de categoria interpretativa dependendo exclusivamente da premissa c adotada (ex: Yve com pick 0,00049 e P oscilando de 0,23 a 0,48). São rotulados como inconclusivos sem classificação categórica forçada.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-panel2/60 border border-line">
                  <span className="font-mono text-xs font-bold text-emerald-300">δ (Efeito de Matchup / delta_raw)</span>
                  <p className="text-xs text-foam mt-1">
                    Lift de associação de um herói contra outro (counter) ou ao lado de outro (teammate). Expressa em pontos percentuais sobre a base própria do herói. Não é probabilidade de vitória de partida.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-panel2/60 border border-line">
                  <span className="font-mono text-xs font-bold text-purple-300">slot_share</span>
                  <p className="text-xs text-foam mt-1">
                    Unidade operacional do pick_rate. Como Σ pick em 132 heróis resulta em ~1,0 (e não 5,0), cada unidade representa a fração dos 10 slots disponíveis na partida que foi preenchida pelo herói.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-panel2/60 border border-line">
                  <span className="font-mono text-xs font-bold text-sky-300">D = s_a − s_b (Diferença Relativa entre Ranks)</span>
                  <p className="text-xs text-foam mt-1">
                    Comparação da vantagem relativa de um herói em relação à média do rank A contra sua vantagem relativa em relação à média do rank B. Isola variações gerais do ambiente de rank.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-panel2/60 border border-line">
                  <span className="font-mono text-xs font-bold text-rose-300">Causalidade Reversa de Builds</span>
                  <p className="text-xs text-foam mt-1">
                    Fenômeno em que o estado favorável da partida leva à compra de itens caros e agressivos de finalização, inflando artificialmente o win rate aparente de certas builds, enquanto escolhas defensivas e reativas ocorrem em partidas desfavoráveis.
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === "invariants" && (
            <div className="space-y-4">
              <p className="text-xs text-mist">
                Regras intransigentes extraídas dos critérios de aceite de todos os 9 PRDs:
              </p>
              <div className="space-y-2.5">
                {[
                  "Nenhum score composto que some Pick Rate e Ban Rate (possuem denominadores e unidades distintas).",
                  "Probabilidade posterior (P(θ > μ + Δ)) NUNCA deve ser chamada de 'chance de vitória do jogador'.",
                  "O M6 não exibe p-valor, IC frequentista nem posterior numérico para pares de heróis no v1.",
                  "Pares de matchup ausentes devem ser exibidos como NULL/desconhecidos, NUNCA como efeito zero ou neutro.",
                  "Efeitos de matchups de múltiplos inimigos NÃO podem ser somados linearmente em um score de draft.",
                  "Nenhuma estimativa de 'número absoluto de partidas' pode ser inventada ou exibida.",
                  "A diferença de força entre ranks NÃO deve imputar causas de habilidade, mecânica ou coordenação sem dados de jogadores.",
                  "Toda publicação de força e intervalo do M1 deve carimbar c_reference, status de incerteza e status da exposição.",
                  "Toda análise de builds exige a seleção explícita da Lane (sem fallback silencioso).",
                  "Rótulos de Distorção de Draft tratam o resíduo como discrepância estatística, NUNCA como erro da comunidade.",
                ].map((inv, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-panel2/40 border border-line/70">
                    <span className="text-emerald-400 mt-0.5 shrink-0">
                      <Check size={16} />
                    </span>
                    <span className="text-xs text-foam leading-relaxed">{inv}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-line bg-panel2/60 text-xs text-mist">
          <span>Origem: Documentos de Consolidação Técnica dos PRDs · 08–09/10/2026</span>
          <button onClick={onClose} className="btn-primary !py-1 !px-3 text-xs">
            Compreendido
          </button>
        </div>
      </div>
    </div>
  );
}
