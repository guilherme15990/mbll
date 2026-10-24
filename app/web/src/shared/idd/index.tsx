import React, { createContext, useContext, useState } from "react";

/**
 * Interface Domain Design (IDD) Canonical Framework for Radar MLBB
 *
 * Baseado no modelo: Job → Job Map → Capability → Rule → State → Interaction → UI
 * Fonte canônica: interface-domain-design/INTERFACE-DOMAIN-DESIGN.md
 */

export interface JobStep {
  id: string;
  name: string;
  question: string;
  status: "ativo" | "suportado" | "parcial" | "fora_de_escopo";
  coveredInContexts: string[];
  description: string;
}

export const JOB_STEPS: JobStep[] = [
  {
    id: "definir",
    name: "1. Definir",
    question: "O analista consegue declarar o contexto amostral de decisão?",
    status: "fora_de_escopo",
    coveredInContexts: [],
    description: "Fora de escopo em v1 read-only porque não há estudo nomeado nem declaração de objetivo — selects globais são contexto implícito, não declaração.",
  },
  {
    id: "localizar",
    name: "2. Localizar",
    question: "Consegue encontrar o herói, confronto ou elo na base de dados?",
    status: "suportado",
    coveredInContexts: ["SHR", "M6", "RNK"],
    description: "Busca instantânea, ordenação por z-score/encolhimento e catálogo com casos de estudo clássicos dos PRDs.",
  },
  {
    id: "preparar",
    name: "3. Preparar",
    question: "Consegue configurar parâmetros de sensibilidade e contexto?",
    status: "suportado",
    coveredInContexts: ["CNF", "BDL", "RNK"],
    description: "Grade de premissas c=10^4-10^7, seleção obrigatória de Lane na build e pares de contraste de elos.",
  },
  {
    id: "confirmar",
    name: "4. Confirmar",
    question: "Consegue revisar se a evidência é sólida antes de assumir risco?",
    status: "suportado",
    coveredInContexts: ["CNF", "BPS", "EXP"],
    description: "Detecção da Zona Yve, selos de qualidade de evidência (robusto, dependente, inconclusivo) e checagem de n.",
  },
  {
    id: "executar",
    name: "5. Deliberar",
    question: "Consegue deliberar a decisão tática de draft, build ou priorização por leitura?",
    status: "fora_de_escopo",
    coveredInContexts: ["DRF", "BPS", "BDL"],
    description: "Parcial em v1 read-only porque deliberar é leitura instrumentada (fixar, levar, copiar) sem transição de domínio — sem Comando §11.",
  },
  {
    id: "acompanhar",
    name: "6. Acompanhar",
    question: "Consegue ver estabilidade temporal pós-patch e saúde do substrato?",
    status: "suportado",
    coveredInContexts: ["TMP", "EXP"],
    description: "Monitoramento diário de Δ log-odds em 30d, ciclo de vida do sinal e auditoria de fluxo Σ pick ≈ 1.",
  },
  {
    id: "corrigir",
    name: "7. Corrigir",
    question: "Consegue reparar falsas impressões geradas por ruído amostral?",
    status: "fora_de_escopo",
    coveredInContexts: [],
    description: "Fora de escopo em v1 read-only porque refetch é recuperação de UI, não correção §13 — sem desfazer/reabrir de domínio.",
  },
  {
    id: "concluir",
    name: "8. Concluir",
    question: "Consegue inspecionar o dossiê transversal e consolidar a evidência?",
    status: "suportado",
    coveredInContexts: ["SHR", "CNF", "RNK", "TMP", "M6", "DRF", "BPS", "BDL", "EXP"],
    description: "Barra transversal Dossiê 360° persistente na URL (?hero=ID) integrando todos os 9 Bounded Contexts.",
  },
];

export interface IddCapability {
  id: string;
  jobStory: string;
  step: string;
  contextId: string;
  name: string;
  object: string;
  command: string;
  classe: "Essencial" | "Obrigação Normativa" | "Facilitador" | "Hipótese";
  priorityScore?: number; // Frequência (1-3) x Dor (1-3) x Risco (1-3)
  origin: string;
  evidence: string;
  ruleSummary: string;
}

export const CAPABILITIES: IddCapability[] = [
  {
    id: "CAP-SHR-01",
    jobStory: "Como analista, preciso saber a força real do herói livre de ruído amostral para ranqueá-lo com segurança",
    step: "Localizar",
    contextId: "SHR",
    name: "Estimar Força Latente θ̂ via Shrinkage M1",
    object: "HeroProfile",
    command: "Calcular θ̂ = μ + B(y − μ)",
    classe: "Essencial",
    origin: "PRD Modelo Hierárquico com Shrinkage",
    evidence: "Amostras pequenas de pick distorcem WR observado em até +12% do valor real",
    ruleSummary: "s²_i = μ(1-μ)/(c · pick); B_i = τ²/(τ² + s²_i); nunca interpolar células vazias.",
  },
  {
    id: "CAP-SHR-02",
    jobStory: "Como comissão técnica, quero ver o fator B e a redução de dispersão para auditar a correção bayesiana",
    step: "Corrigir",
    contextId: "SHR",
    name: "Auditar Encolhimento e Z-Score",
    object: "ShrinkageEstimate",
    command: "Inspecionar fator B e tier",
    classe: "Facilitador",
    priorityScore: 18, // 3 (diário) * 2 (tempo) * 3 (risco de decisão errada)
    origin: "Entrevista de Balanceamento & ADR-015",
    evidence: "Comissão técnica rejeitava dados brutos por não saber quanto era ruído",
    ruleSummary: "B alto preserva observado; B baixo colapsa à média do elo.",
  },
  {
    id: "CAP-CNF-01",
    jobStory: "Como tomador de decisão, preciso do trio posterior para saber o intervalo de credibilidade 95%",
    step: "Confirmar",
    contextId: "CNF",
    name: "Computar Trio de Incerteza (IC 95% e Posterior)",
    object: "ConfidenceTrio",
    command: "Avaliar IC95 e P(θ > μ + Δ)",
    classe: "Essencial",
    origin: "PRD Confidence, Intervalo e Posterior",
    evidence: "Classificação em tier sem intervalo gerava falsas seguranças táticas",
    ruleSummary: "P(θ > μ + Δ) nunca deve ser chamada de chance de vitória em partida; Δ=0.02 é versionado.",
  },
  {
    id: "CAP-CNF-02",
    jobStory: "Como auditor, preciso identificar heróis cuja estimativa muda drasticamente com a premissa c",
    step: "Confirmar",
    contextId: "CNF",
    name: "Detectar e Isolar Zona Yve",
    object: "SensitivityBand",
    command: "Identificar Zona Yve (Sensibilidade)",
    classe: "Essencial",
    origin: "PRD Confidence § Zona Yve",
    evidence: "Caso canônico Yve: instabilidade extrema sob variação de c de 10^4 a 10^7",
    ruleSummary: "Herói com faixa larga entre extremos de c recebe selo 'inconclusivo por sensibilidade'.",
  },
  {
    id: "CAP-RNK-01",
    jobStory: "Como coach, quero comparar a eficácia de um herói entre Elo Baixo e Elo Alto para planejar transição",
    step: "Localizar",
    contextId: "RNK",
    name: "Contrastar Força Relativa entre Elos (D = s_a - s_b)",
    object: "RankContrast",
    command: "Calcular D relativo",
    classe: "Essencial",
    origin: "PRD Diferença de Força por Rank",
    evidence: "Heróis como Miya dominam elos de entrada mas colapsam no Mythic Glory",
    ruleSummary: "D = s_a - s_b onde s = θ - μ_rank; guardrail de não-causalidade ativo.",
  },
  {
    id: "CAP-TMP-01",
    jobStory: "Como analista de patches, preciso rastrear se a mudança no herói foi choque pontual ou tendência real",
    step: "Acompanhar",
    contextId: "TMP",
    name: "Rastrear Δ em Log-Odds e Ciclo de Vida Pós-Patch",
    object: "TemporalDelta",
    command: "Computar Δ_30d e persistência",
    classe: "Essencial",
    origin: "PRD Estabilidade Temporal e Patches",
    evidence: "Bans e nerfs recentes geram spikes passageiros que se dissipam em 72h",
    ruleSummary: "Classificação: Inicial (1-3d), Persistente (7d+ estável), Revertido (tendência invertida).",
  },
  {
    id: "CAP-M6-01",
    jobStory: "Como capitão de draft, quero ver os maiores counters e sinergias para orientar os picks",
    step: "Executar",
    contextId: "M6",
    name: "Mapear Efeito de Matchup δ e Curva de Duração",
    object: "MatchupPair",
    command: "Consultar counters e teammates",
    classe: "Essencial",
    origin: "PRD Matchup Effect e Confiança (M6)",
    evidence: "Drafts perdem jogos na fase de escolha por desconhecimento de anti-sinergias",
    ruleSummary: "Counters são antissimétricos (δ_AB = -δ_BA); Teammates são simétricos; n < 5 pares = inconclusivo.",
  },
  {
    id: "CAP-DRF-01",
    jobStory: "Como estrategista, quero separar pressão de Pick da pressão de Ban para achar joias subestimadas",
    step: "Executar",
    contextId: "DRF",
    name: "Diagnosticar Distorção com Matrizes 2D Separadas",
    object: "DraftPressure",
    command: "Mapear resíduo Pick vs Ban",
    classe: "Essencial",
    origin: "PRD Draft Distortion",
    evidence: "Heróis altamente banidos por hábito cultural (ex: Franco) possuem WR abaixo da média",
    ruleSummary: "Pick e Ban têm denominadores diferentes; nunca devem ser somados; matrizes 2D independentes.",
  },
  {
    id: "CAP-BPS-01",
    jobStory: "Como capitão no First Pick, preciso de heróis com pior caso robusto para blind pick seguro",
    step: "Executar",
    contextId: "BPS",
    name: "Calcular Segurança de Blind Pick via Cauda p10",
    object: "BlindSafety",
    command: "Avaliar proxy p10 e pior counter",
    classe: "Essencial",
    origin: "PRD Blind Pick Safety e Robustez",
    evidence: "Heróis com alta média podem ser completamente anulados por counters dominantes",
    ruleSummary: "Robustez é a cauda adversa (percentil 10 dos deltas); exige elo explícito; n < 5 pares = inconclusivo.",
  },
  {
    id: "CAP-BDL-01",
    jobStory: "Como jogador de rota, quero saber qual conjunto de itens performa melhor dentro da minha Lane",
    step: "Executar",
    contextId: "BDL",
    name: "Estimar Build Lift Associativo com Lane Obrigatória",
    object: "BuildItem",
    command: "Comparar lift vs Mais Usada e Média",
    classe: "Essencial",
    origin: "PRD Build Lift",
    evidence: "Itemização varia por rota; analisar build sem lane gera viés ecológico inútil",
    ruleSummary: "Lane é parâmetro obrigatório (HTTP 422 sem lane); lift é estritamente associativo, nunca causal.",
  },
  {
    id: "CAP-EXP-01",
    jobStory: "Como cientista de dados, preciso conferir se o substrato estatístico respeita as leis de conservação",
    step: "Acompanhar",
    contextId: "EXP",
    name: "Auditar Conservação de Denominador (Σ pick ≈ 1)",
    object: "SubstrateBatch",
    command: "Checar Σ pick e Σ ban",
    classe: "Essencial",
    origin: "PRD Estimated Exposure e Denominador",
    evidence: "A API oficial não fornece contagem absoluta de partidas; pick rate é slot_share em base Σ ≈ 1",
    ruleSummary: "Σ pick deve estar em 1.0 ± 0.005; Σ ban opera entre 7.6 e 8.9; violações disparam alerta vermelho.",
  },
  {
    id: "CAP-EXP-02",
    jobStory: "Como operador da plataforma, preciso ver o nível de integridade da infraestrutura e degradação da fonte",
    step: "Acompanhar",
    contextId: "EXP",
    name: "Verificar Nível de Degradação da Fonte (5 Níveis)",
    object: "SubstrateBatch",
    command: "Inspecionar integridade da API",
    classe: "Facilitador",
    origin: "PRD Estimated Exposure § Degradação",
    evidence: "A API comunitária Rone Arena pode sofrer instabilidades sazonais",
    ruleSummary: "Nível 1 (Normal) a Nível 5 (Congelado); endpoints descontinuados (ex: Ratings 10407) marcados offline.",
  },
];

export interface ObjectEventRow {
  object: string;
  criar: "não se aplica" | "necessário" | "adiado";
  listar: "não se aplica" | "necessário" | "adiado";
  ver: "não se aplica" | "necessário" | "adiado";
  buscar: "não se aplica" | "necessário" | "adiado";
  filtrar: "não se aplica" | "necessário" | "adiado";
  historico: "não se aplica" | "necessário" | "adiado";
  auditoria: "não se aplica" | "necessário" | "adiado";
  compartilhar: "não se aplica" | "necessário" | "adiado";
  exportar: "não se aplica" | "necessário" | "adiado";
}

export const OBJECT_EVENT_MATRIX: ObjectEventRow[] = [
  { object: "HeroProfile", criar: "não se aplica", listar: "necessário", ver: "necessário", buscar: "necessário", filtrar: "necessário", historico: "necessário", auditoria: "necessário", compartilhar: "necessário", exportar: "necessário" },
  { object: "ShrinkageEstimate (M1)", criar: "não se aplica", listar: "necessário", ver: "necessário", buscar: "não se aplica", filtrar: "necessário", historico: "adiado", auditoria: "necessário", compartilhar: "necessário", exportar: "necessário" },
  { object: "ConfidenceTrio", criar: "não se aplica", listar: "necessário", ver: "necessário", buscar: "não se aplica", filtrar: "necessário", historico: "adiado", auditoria: "necessário", compartilhar: "necessário", exportar: "necessário" },
  { object: "RankContrast", criar: "não se aplica", listar: "necessário", ver: "necessário", buscar: "não se aplica", filtrar: "necessário", historico: "adiado", auditoria: "necessário", compartilhar: "necessário", exportar: "necessário" },
  { object: "TemporalDelta", criar: "não se aplica", listar: "necessário", ver: "necessário", buscar: "não se aplica", filtrar: "necessário", historico: "necessário", auditoria: "necessário", compartilhar: "necessário", exportar: "necessário" },
  { object: "MatchupPair", criar: "não se aplica", listar: "necessário", ver: "necessário", buscar: "necessário", filtrar: "necessário", historico: "adiado", auditoria: "necessário", compartilhar: "necessário", exportar: "necessário" },
  { object: "DraftPressure", criar: "não se aplica", listar: "necessário", ver: "necessário", buscar: "não se aplica", filtrar: "necessário", historico: "adiado", auditoria: "necessário", compartilhar: "necessário", exportar: "necessário" },
  { object: "BlindSafety", criar: "não se aplica", listar: "necessário", ver: "necessário", buscar: "não se aplica", filtrar: "necessário", historico: "adiado", auditoria: "necessário", compartilhar: "necessário", exportar: "necessário" },
  { object: "BuildItem", criar: "não se aplica", listar: "necessário", ver: "necessário", buscar: "não se aplica", filtrar: "necessário", historico: "adiado", auditoria: "necessário", compartilhar: "necessário", exportar: "necessário" },
  { object: "SubstrateBatch", criar: "não se aplica", listar: "necessário", ver: "necessário", buscar: "não se aplica", filtrar: "não se aplica", historico: "necessário", auditoria: "necessário", compartilhar: "necessário", exportar: "necessário" },
];

export interface IddZoneConfig {
  name: string;
  code: "identity" | "state" | "data" | "primary" | "secondary" | "risk";
  label: string;
  role: string;
  colorBorder: string;
  colorBg: string;
  colorBadge: string;
}

export const IDD_ZONES: Record<string, IddZoneConfig> = {
  identity: {
    name: "Identidade",
    code: "identity",
    label: "Zona de Identidade",
    role: "Identifica o objeto central persistente (Herói, Elo, Versão)",
    colorBorder: "border-sky-500/50",
    colorBg: "bg-sky-500/5",
    colorBadge: "text-sky-300 border-sky-400/40 bg-sky-400/10",
  },
  state: {
    name: "Estado",
    code: "state",
    label: "Zona de Estado",
    role: "Torna legível o estado semântico de domínio (Tier, Incerteza, Sólido, Yve)",
    colorBorder: "border-purple-500/50",
    colorBg: "bg-purple-500/5",
    colorBadge: "text-purple-300 border-purple-400/40 bg-purple-400/10",
  },
  data: {
    name: "Dados",
    code: "data",
    label: "Zona de Dados",
    role: "Expõe atributos quantitativos na ordem natural da tarefa",
    colorBorder: "border-amber-500/50",
    colorBg: "bg-amber-500/5",
    colorBadge: "text-amber-300 border-amber-400/40 bg-amber-400/10",
  },
  primary: {
    name: "Ação Primária",
    code: "primary",
    label: "Zona de Ação Primária",
    role: "CTA de maior valor epistemológico ou tático da etapa",
    colorBorder: "border-emerald-500/50",
    colorBg: "bg-emerald-500/5",
    colorBadge: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10",
  },
  secondary: {
    name: "Ações Secundárias",
    code: "secondary",
    label: "Zona de Ações Secundárias",
    role: "Filtros, visualização de fórmula, alternância de premissas",
    colorBorder: "border-slate-500/50",
    colorBg: "bg-slate-500/5",
    colorBadge: "text-slate-300 border-slate-400/40 bg-slate-400/10",
  },
  risk: {
    name: "Risco & Guardrails",
    code: "risk",
    label: "Zona de Risco",
    role: "Avisos epistemológicos, limites amostrais, não-causalidade",
    colorBorder: "border-rose-500/50",
    colorBg: "bg-rose-500/5",
    colorBadge: "text-rose-300 border-rose-400/40 bg-rose-400/10",
  },
};

interface IddContextType {
  inspectorEnabled: boolean;
  toggleInspector: () => void;
  openModal: boolean;
  setOpenModal: (v: boolean) => void;
  activeStep: string | null;
  setActiveStep: (v: string | null) => void;
}

const IddContext = createContext<IddContextType>({
  inspectorEnabled: false,
  toggleInspector: () => {},
  openModal: false,
  setOpenModal: () => {},
  activeStep: null,
  setActiveStep: () => {},
});

export function IddProvider({ children }: { children: React.ReactNode }) {
  const [inspectorEnabled, setInspectorEnabled] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [activeStep, setActiveStep] = useState<string | null>(null);

  const toggleInspector = () => setInspectorEnabled((v) => !v);

  return (
    <IddContext.Provider
      value={{
        inspectorEnabled,
        toggleInspector,
        openModal,
        setOpenModal,
        activeStep,
        setActiveStep,
      }}
    >
      {children}
    </IddContext.Provider>
  );
}

export function useIdd() {
  return useContext(IddContext);
}
