// Metadados do sistema: catálogo dos 6 módulos ativos e saúde/cache/histórico.
// CNF/RNK/TMP saíram junto com as abas da ficha e as rotas planas (ADR-048).
import { cacheStats } from "../infra/cacheStore.js";
import { historyStats } from "../infra/snapshotHistory.js";
import { C_REFERENCE, LANES } from "@radar/engine";
import { versions } from "../application/versions.js";
import { startedAtIso, layerHealthState } from "../application/health.js";

// GET /modules — catálogo dos módulos ativos (fórmula, status, endpoint) p/ UI reimaginada
export async function modulesRoute() {
  return { status: 200, body: { data: [
    { id: "EXP", name: "Exposição", en: "Exposure", question: "Quanto observamos de cada herói?", aggregate: "HeroRate + SigmaSums", status: "validado", formula: "pick = slot_share; Σ≈1 (±0.005); ban Σ 7.6–8.9; sem N·p (Beta-Binomial descartada)", endpoint: "/v1/heroes (pickSumCheck)", doc: "PRD Exposure" },
    { id: "SHR", name: "Força e Shrinkage", en: "Strength + Shrinkage (M1)", question: "Quão forte o herói é de verdade?", aggregate: "HeroStrength (θ̂,B,V)", status: "validado", formula: "s²=μ(1−μ)/(c·pick); θ~N(μ,τ²); V=(1/s²+1/τ²)⁻¹; m=V(y/s²+μ/τ²); B=τ²/(τ²+s²); μ≈0.499 τ≈0.031; c único declarado (sem grade)", endpoint: "/v1/heroes (θ̂,B,se,V)", doc: "PRD Shrinkage §3" },
    { id: "M6", name: "Confrontos e Sinergias", en: "Matchup Effect (M6)", question: "Quais pares ajudam ou atrapalham?", aggregate: "PairEffect (δ, evidence)", status: "descritivo", formula: "δ bruto, counter antissimétrico / teammate simétrico; 125 pares 0 violações; evidence consistente/contexto/limitado/inconclusivo; sem soma", endpoint: "/v1/heroes/:id/matchups", doc: "PRD M6 §7–8" },
    { id: "DRF", name: "Distorção de Draft", en: "Draft Distortion", question: "Pressão de pick/ban acompanha a força?", aggregate: "DistortionResidual (pick, ban)", status: "proposta", formula: "pick e ban separados (nunca somados); resíduo=obs−esperado; pressão fora do M1", endpoint: "/v1/heroes/:id/distortion", doc: "PRD Distortion" },
    { id: "BPS", name: "Blind Pick", en: "Blind Pick Safety", question: "Dá para escolher sem ver o inimigo?", aggregate: "BlindProxy (p10, pior counter)", status: "proxy", formula: "distribuição δ elegíveis; p10 adverso + pior counter; n<5 inconclusivo; nunca probabilidade", endpoint: "/v1/heroes/:id/blind", doc: "PRD Blind" },
    { id: "BDL", name: "Builds e Lift", en: "Build Lift", question: "Qual build rende mais — e contra qual referência?", aggregate: "BuildLift (L vs refs)", status: "camada-A", formula: "L=WR−WR_ref (mais-usada/média); ajustado/causal NULL; lane obrigatória; audit_pending", endpoint: "/v1/heroes/:id/builds?lane=", doc: "PRD Build §4/§8" },
  ], c_reference: C_REFERENCE, impossibilities: ["ratings 10407 offline", "sem N por partida", "sem draft completo"] } };
}

// GET /meta/status
export async function statusRoute() {
  const vers = await versions();
  return { status: 200, body: { startedAt: startedAtIso(), health: layerHealthState(), cache: cacheStats(), history: historyStats(), versions: vers?.slice?.(0, 3) ?? vers, impossibilities: ["academy/ratings offline (10407)", "builds e win-rate/timeline exigem ?lane (422 sem lane)", "sem dados por partida/draft completo — sem causal, sem IC de pseudo-contagem", "pick_rate é slot_share unvalidated, sem contagem absoluta", "janelas sobrepostas não são replicação independente"], lanes: LANES } };
}
