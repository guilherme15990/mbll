import { useState } from "react";
import {
  Compass, Eye, Layers, ShieldAlert, Sparkles, X, Filter,
  CheckCircle2, AlertCircle, Clock, ExternalLink, ArrowRight,
  BookOpen, HelpCircle, ShieldCheck, Crosshair, Wrench, Check
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  CAPABILITIES, JOB_STEPS, OBJECT_EVENT_MATRIX, IDD_ZONES,
  IddCapability, useIdd
} from ".";

export function IddModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { inspectorEnabled, toggleInspector } = useIdd();
  const [tab, setTab] = useState<"jobmap" | "capabilities" | "matrix" | "zones" | "traceability">("jobmap");
  const [capFilter, setCapFilter] = useState<string>("todos");
  const [searchCap, setSearchCap] = useState("");

  if (!isOpen) return null;

  const filteredCaps = CAPABILITIES.filter((c) => {
    if (capFilter !== "todos" && c.classe !== capFilter) return false;
    if (searchCap) {
      const q = searchCap.toLowerCase();
      return (
        c.id.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.object.toLowerCase().includes(q) ||
        c.contextId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-abyss/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-6xl max-h-[92vh] bg-panel border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-panel2/70">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-700/10 text-gold border border-gold/40 shadow-glow">
              <Compass size={22} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-foam tracking-tight">
                  Interface Domain Designer <span className="gradient-text font-black">(IDD)</span>
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/40 font-bold">
                  Canônico
                </span>
              </div>
              <p className="text-xs text-mist">
                Job Map → Capacidades → Regras → Estados de Domínio vs UI → Gramática das Zonas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Inspector Switch */}
            <button
              onClick={toggleInspector}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                inspectorEnabled
                  ? "bg-emerald-500/15 border-emerald-400 text-emerald-300 shadow-sm"
                  : "bg-abyss/80 border-line hover:border-mist/60 text-mist hover:text-foam"
              }`}
              title="Ativa sobreposição visual das 6 Zonas IDD e etiquetas de capacidade na interface"
            >
              <Eye size={14} className={inspectorEnabled ? "text-emerald-400 animate-pulse" : ""} />
              <span>Inspetor de Zonas {inspectorEnabled ? "Ligado" : "Desligado"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-mist hover:text-foam hover:bg-panel border border-transparent hover:border-line transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-line px-6 bg-abyss/40 text-xs overflow-x-auto">
          <button
            onClick={() => setTab("jobmap")}
            className={`py-3 px-4 font-semibold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
              tab === "jobmap"
                ? "border-gold text-gold"
                : "border-transparent text-mist hover:text-foam"
            }`}
          >
            <Compass size={14} /> 1. Job Map (JTBD)
          </button>
          <button
            onClick={() => setTab("capabilities")}
            className={`py-3 px-4 font-semibold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
              tab === "capabilities"
                ? "border-gold text-gold"
                : "border-transparent text-mist hover:text-foam"
            }`}
          >
            <Layers size={14} /> 2. Mapa de Capacidades ({CAPABILITIES.length})
          </button>
          <button
            onClick={() => setTab("matrix")}
            className={`py-3 px-4 font-semibold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
              tab === "matrix"
                ? "border-gold text-gold"
                : "border-transparent text-mist hover:text-foam"
            }`}
          >
            <Crosshair size={14} /> 3. Matriz Objeto × Evento
          </button>
          <button
            onClick={() => setTab("zones")}
            className={`py-3 px-4 font-semibold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
              tab === "zones"
                ? "border-gold text-gold"
                : "border-transparent text-mist hover:text-foam"
            }`}
          >
            <Wrench size={14} /> 4. Gramática das 6 Zonas
          </button>
          <button
            onClick={() => setTab("traceability")}
            className={`py-3 px-4 font-semibold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${
              tab === "traceability"
                ? "border-gold text-gold"
                : "border-transparent text-mist hover:text-foam"
            }`}
          >
            <ShieldCheck size={14} /> 5. Rastreabilidade UI
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-mist flex-1">
          {/* TAB 1: JOB MAP */}
          {tab === "jobmap" && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-gold/10 border border-gold/30 text-foam text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-gold" />
                  <span className="font-bold text-gold text-sm">Núcleo do Método IDD:</span>
                </div>
                <p className="font-mono text-amber-200">
                  Job → Job Map → Capability → Rule → State → Interaction → UI
                </p>
                <p className="text-mist leading-relaxed">
                  Nenhuma interface é projetada antes de existir um modelo de capacidades, regras, estados e evidências que justifique o que a interface precisa permitir. Abaixo estão as 8 etapas canônicas de cobertura do trabalho:
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {JOB_STEPS.map((step) => (
                  <div
                    key={step.id}
                    className="card p-4 bg-panel2/40 border-line hover:border-gold/40 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foam text-sm">{step.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                          {step.status}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-amber-300 italic">
                        "{step.question}"
                      </p>
                      <p className="text-xs text-mist leading-relaxed">
                        {step.description}
                      </p>
                    </div>

                    <div className="pt-3 mt-3 border-t border-line/60 flex items-center justify-between text-[11px]">
                      <span className="text-mist/70">Contextos cobertos:</span>
                      <div className="flex items-center gap-1">
                        {step.coveredInContexts.map((ctx) => (
                          <span
                            key={ctx}
                            className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-abyss border border-line text-gold"
                          >
                            CTX-{ctx}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: CAPABILITIES MAP */}
          {tab === "capabilities" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foam">Filtrar Classe:</span>
                  {["todos", "Essencial", "Obrigação Normativa", "Facilitador"].map((cls) => (
                    <button
                      key={cls}
                      onClick={() => setCapFilter(cls)}
                      className={`text-xs px-2.5 py-1 rounded-xl border transition-all ${
                        capFilter === cls
                          ? "bg-gold/15 text-gold border-gold/40 font-semibold"
                          : "bg-abyss/60 text-mist border-line hover:text-foam"
                      }`}
                    >
                      {cls}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="Buscar capacidade, objeto ou regra..."
                  value={searchCap}
                  onChange={(e) => setSearchCap(e.target.value)}
                  className="inp text-xs py-1 px-3 w-64"
                />
              </div>

              <div className="card overflow-hidden border-line">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-panel2/80 text-mist font-semibold border-b border-line">
                        <th className="p-3">ID / Contexto</th>
                        <th className="p-3">Capacidade & Comando</th>
                        <th className="p-3">Objeto Central</th>
                        <th className="p-3">Classe & Prioridade</th>
                        <th className="p-3">Origem & Evidência</th>
                        <th className="p-3">Regra / Invariante</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {filteredCaps.map((c) => (
                        <tr key={c.id} className="hover:bg-panel2/40 transition-colors">
                          <td className="p-3 align-top whitespace-nowrap">
                            <div className="font-mono font-bold text-gold">{c.id}</div>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-abyss border border-line text-mist">
                              CTX-{c.contextId} · {c.step}
                            </span>
                          </td>
                          <td className="p-3 align-top">
                            <div className="font-semibold text-foam">{c.name}</div>
                            <div className="text-[11px] text-amber-300 font-mono mt-0.5">
                              {c.command}
                            </div>
                            <div className="text-[11px] text-mist/80 mt-1 italic">
                              {c.jobStory}
                            </div>
                          </td>
                          <td className="p-3 align-top whitespace-nowrap">
                            <span className="font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded text-[11px]">
                              {c.object}
                            </span>
                          </td>
                          <td className="p-3 align-top whitespace-nowrap">
                            <div className="flex flex-col gap-1 items-start">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  c.classe === "Essencial"
                                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                    : c.classe === "Obrigação Normativa"
                                    ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                                    : "bg-sky-500/10 text-sky-300 border-sky-500/30"
                                }`}
                              >
                                {c.classe}
                              </span>
                              {c.priorityScore && (
                                <span className="text-[10px] font-mono text-mist">
                                  Score: <b className="text-foam">{c.priorityScore}</b> (F×D×C)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 align-top">
                            <div className="font-medium text-foam text-[11px]">{c.origin}</div>
                            <div className="text-[11px] text-mist/80 leading-relaxed mt-0.5">
                              {c.evidence}
                            </div>
                          </td>
                          <td className="p-3 align-top font-mono text-[11px] text-amber-200/90 leading-relaxed">
                            {c.ruleSummary}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OBJECT x EVENT MATRIX */}
          {tab === "matrix" && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-panel2/60 border border-line text-xs flex items-center justify-between gap-3">
                <span className="text-foam">
                  <b>Princípio IDD §14:</b> Nada fica sem decisão. Toda célula é marcada como <code>necessário</code>, <code>não se aplica</code> ou <code>adiado</code>.
                </span>
                <span className="text-mist font-mono text-[11px]">
                  10 Objetos Centrais Auditados
                </span>
              </div>

              <div className="card overflow-hidden border-line">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-panel2/80 text-mist font-semibold border-b border-line text-center">
                        <th className="p-3 text-left">Objeto Central</th>
                        <th className="p-2">Criar</th>
                        <th className="p-2">Listar</th>
                        <th className="p-2">Ver</th>
                        <th className="p-2">Buscar</th>
                        <th className="p-2">Filtrar</th>
                        <th className="p-2">Histórico</th>
                        <th className="p-2">Auditoria</th>
                        <th className="p-2">Compartilhar</th>
                        <th className="p-2">Exportar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {OBJECT_EVENT_MATRIX.map((row) => (
                        <tr key={row.object} className="hover:bg-panel2/40 transition-colors text-center">
                          <td className="p-3 text-left font-mono font-semibold text-foam">
                            {row.object}
                          </td>
                          {[
                            row.criar,
                            row.listar,
                            row.ver,
                            row.buscar,
                            row.filtrar,
                            row.historico,
                            row.auditoria,
                            row.compartilhar,
                            row.exportar,
                          ].map((decision, idx) => (
                            <td key={idx} className="p-2">
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                                  decision === "necessário"
                                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 font-bold"
                                    : decision === "adiado"
                                    ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                    : "bg-abyss text-mist/60 border-line"
                                }`}
                              >
                                {decision === "necessário" ? "Sim" : decision === "adiado" ? "Adiado" : "N/A"}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ZONES GRAMMAR */}
          {tab === "zones" && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-panel2/50 border border-line text-xs space-y-2">
                <h4 className="font-bold text-foam text-sm">
                  Regra das Zonas do IDD (Seção 20):
                </h4>
                <p className="text-mist leading-relaxed">
                  "Onde um elemento vive é determinado por sua <b>função semântica</b>, pela <b>tarefa</b> e pelo <b>estado</b>; não por mero gosto estético isolado."
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.values(IDD_ZONES).map((z) => (
                  <div
                    key={z.code}
                    className={`card p-4 border ${z.colorBorder} ${z.colorBg} flex flex-col justify-between`}
                  >
                    <div className="space-y-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${z.colorBadge}`}>
                        {z.label}
                      </span>
                      <h4 className="font-bold text-foam text-sm">{z.name}</h4>
                      <p className="text-xs text-mist leading-relaxed">{z.role}</p>
                    </div>

                    <div className="pt-3 mt-3 border-t border-line/60 text-[11px] text-mist/80">
                      <b>Exemplo no Radar:</b>
                      <p className="text-foam mt-0.5">
                        {z.code === "identity" && "Avatar, Nome do Herói, Elo e Janela Temporal"}
                        {z.code === "state" && "Selo de Evidência, Zona Yve, Tier S/A/B/C/D, Amostra Pequena"}
                        {z.code === "data" && "θ̂, IC 95%, Fator B, Pick Rate (slot_share), Ban Rate"}
                        {z.code === "primary" && "Abrir Dossiê 360°, Selecionar no Draft, Comparar Elos"}
                        {z.code === "secondary" && "Filtros de Tier/Lane, Alternar Premissa c, Ver Fórmulas"}
                        {z.code === "risk" && "Aviso de Não-Causalidade, Alerta de Viés de Seleção, Σ≠1"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: TRACEABILITY */}
          {tab === "traceability" && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-gold/10 border border-gold/30 text-xs text-foam">
                <b>Rastreabilidade Canônica IDD (§28):</b> Toda decisão de interface aponta para:
                <code> Job Step → Capability → Object → Command → Rule → Domain State → UI State → UI Organism</code>.
              </div>

              <div className="card p-4 border-line space-y-4">
                <div className="grid md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-panel2/50 border border-line space-y-1">
                    <span className="lbl text-gold">Dossiê Transversal 360°</span>
                    <p className="font-semibold text-foam">Organismo: HeroDossier</p>
                    <p className="text-mist">Responde a: <code>CAP-SHR-01..CAP-BDL-01</code></p>
                    <p className="text-mist/80 text-[11px]">Garante persistência via URL (?hero=ID) em todos os 9 contextos.</p>
                  </div>

                  <div className="p-3 rounded-xl bg-panel2/50 border border-line space-y-1">
                    <span className="lbl text-cyan-300">Trio de Incerteza</span>
                    <p className="font-semibold text-foam">Organismo: TrioConfidenceCard</p>
                    <p className="text-mist">Responde a: <code>CAP-CNF-01</code></p>
                    <p className="text-mist/80 text-[11px]">Separa rigorosamente posterior, IC95% e P(θ&gt;μ+Δ).</p>
                  </div>

                  <div className="p-3 rounded-xl bg-panel2/50 border border-line space-y-1">
                    <span className="lbl text-purple-300">Detecção de Sensibilidade</span>
                    <p className="font-semibold text-foam">Organismo: YveZoneAlert</p>
                    <p className="text-mist">Responde a: <code>CAP-CNF-02</code></p>
                    <p className="text-mist/80 text-[11px]">Identifica Zona Yve sob variação de c em grade 10^4 a 10^7.</p>
                  </div>

                  <div className="p-3 rounded-xl bg-panel2/50 border border-line space-y-1">
                    <span className="lbl text-indigo-300">Contraste de Elos</span>
                    <p className="font-semibold text-foam">Organismo: RankDiffSelector</p>
                    <p className="text-mist">Responde a: <code>CAP-RNK-01</code></p>
                    <p className="text-mist/80 text-[11px]">Computa D=s_a-s_b com guardrail explícito de não-causalidade.</p>
                  </div>

                  <div className="p-3 rounded-xl bg-panel2/50 border border-line space-y-1">
                    <span className="lbl text-amber-300">Matrizes 2D Pick vs Ban</span>
                    <p className="font-semibold text-foam">Organismo: PressureScatter</p>
                    <p className="text-mist">Responde a: <code>CAP-DRF-01</code></p>
                    <p className="text-mist/80 text-[11px]">Nunca soma pick e ban; mantém denominadores separados.</p>
                  </div>

                  <div className="p-3 rounded-xl bg-panel2/50 border border-line space-y-1">
                    <span className="lbl text-emerald-300">Monitor de Conservação</span>
                    <p className="font-semibold text-foam">Organismo: ExposureSubstrateMonitor</p>
                    <p className="text-mist">Responde a: <code>CAP-EXP-01</code></p>
                    <p className="text-mist/80 text-[11px]">Audita conservação Σ pick ≈ 1.0 e integridade da API.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-line bg-panel2/80 text-xs">
          <span className="text-mist">
            Interface Domain Design (IDD) · Em conformidade com os 9 PRDs e Bounded Contexts v3
          </span>
          <button
            onClick={onClose}
            className="btn-primary text-xs"
          >
            Fechar Designer
          </button>
        </div>
      </div>
    </div>
  );
}
