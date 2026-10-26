import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Teste-guardião P0 da aba Builds GLOBAL (/dashboard) — builds-global-brief §2.
// Estático (sem rede): garante teto de requests, sem default de rota, sem
// fan-out e sem copy vetada. Falha = tempestade ou honestidade quebrada.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// A tela foi fatiada em `BuildsTab.tsx` (orquestração) + `builds/*` (hook,
// header, card e linha de build). O guardião lê o conjunto inteiro — o
// invariante é da aba, não de um arquivo.
const tabDir = path.join(root, "src/features/dashboard/builds");
const tabFiles = [
  "src/features/dashboard/BuildsTab.tsx",
  ...fs.readdirSync(tabDir)
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .map((f) => `src/features/dashboard/builds/${f}`),
];
const tab = tabFiles.map((rel) => fs.readFileSync(path.join(root, rel), "utf8")).join("\n");
const apiDir = path.join(root, "src/shared/api/queries");
// A camada de dados foi fatiada em domínios (ADR-040) e vive em `shared/api`
// desde a ADR-043: o invariante é "key definida 1x na camada de dados", não
// "num arquivo só". Lê barrel + módulos de query.
const api = ["src/shared/api/index.ts", ...fs.readdirSync(apiDir).filter((f) => f.endsWith(".ts")).map((f) => `src/shared/api/queries/${f}`)]
  .map((rel) => fs.readFileSync(path.join(root, rel), "utf8"))
  .join("\n");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
// Checks P0 valem sobre código (comentários citam os briefs por referência — honestidade, não copy).
const code = tab
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^\S\n])\/\/[^\n]*$/gm, "$1");

let bad = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) bad++;
};

// 1 · sem rota = 0 builds: sem default silencioso, sem "todas".
check("sem default silencioso de rota", !/sp\.get\("lane"\)\s*\?\?\s*"/.test(code));
check("sem fallback ?? para rota literal", !/\?\?\s*"(mid|gold|exp|roam|jungle)"/.test(code));
check("sem opcao 'todas' na global", !/["']todas["']/.test(code));

// 2 · teto N=3: no máximo 3 chamadas estáticas a useBuilds, sem fan-out.
const uses = (code.match(/useBuilds\(/g) ?? []).length;
check("R3-R5: 1..3 useBuilds estaticos", uses >= 1 && uses <= 3, `${uses} ocorrencia(s)`);
check("sem Promise.all/mapConc sobre builds", !/Promise\.all\s*\([^)]*builds|mapConc\s*\([^)]*builds/i.test(code));
check("sem loop com /builds", !/for\s*\([^)]*\)[^{]*\/builds/.test(code));

// 3 · keys idênticas às da ficha (navegação sem custo, QA-GBL-004).
const keyDefs = (api.match(/\["builds",\s*id,\s*rank,\s*lane\]/g) ?? []).length;
check("key [builds,id,rank,lane] definida 1x na camada de dados (shared/api)", keyDefs === 1, `${keyDefs} definicao(oes)`);
check("global nao cria key paralela", !/builds-global/.test(code + api));

// 4 · reuso (não duplicação): mesma função, mesmo aviso, mesma key via hook.
check("getBuildTags reutilizada da ficha", /shared\/domain\/buildLabel/.test(code) && (code.match(/getBuildTags/g) ?? []).length >= 2);
check("silencio no inconclusivo (sem rotulo falado)", !/Lift Inconclusivo|Popular, Sem Lift Demonstrado|Possível Vantagem Emergente/.test(code + fs.readFileSync(path.join(root, "src/features/builds/BuildsPanel.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")));
check("sem Aviso Central na global (removido por decisão do usuário)", !/SelectionWarning|Aviso Central de Domínio/.test(code));
check("R2 usa sort=win&order=desc&size=25", /sort=win&order=desc/.test(code) && /LIST_SIZE = 25/.test(code));

// 5 · lint de copy vetada (fora do aviso que nega, que vive em SelectionWarning.tsx).
const banned = /melhor build|top builds do meta|build ideal|build do jogo|maior lift da|win m[eé]dio|causa \+|aumenta.*win.*garant|(?<!sem )ordem de compra|em alta esta semana|score global do item|cross-lane|build.*global/i;
const denialFree = code.replace(/SelectionWarning/g, "");
check("copy vetada = 0 na global", !banned.test(denialFree));
// "em alta" (série temporal) saiu junto com o bloco de trincas.
check("sem copy de série temporal ('em alta')", !/em alta/i.test(code));

// 6 · aba enxuta (decisão do usuário): sem bloco Emergentes, sem bloco auditoria,
// sem linha de audit por card. O cabeçalho também perdeu chips de contexto,
// contador de cobertura e rodapé metodológico — a tela é só título + cards.
check("sem bloco Emergentes na global", !/Emergentes da/.test(code));
check("sem bloco auditoria na global", !/Auditoria em 1 linha/.test(code));
check("sem linha audit por card", !/Camada A · ajustado NULL/.test(code));
check("cabeçalho enxuto (sem chips/cobertura/rodapé)", !/CoverageMeter|com builds nesta rota|Contexto do recorte/.test(code));
check("estado isolado por card", ["loading", "error", "empty", "ready"].every((k) => new RegExp(`kind === "${k}"`).test(code)));

// 7 · decisão de localização do scoring registrada; a tela não usa itemsets
// (trincas removidas a pedido do usuário), mas o motor segue disponível para
// a página agregada e os testes.
check("web sem dep @radar/engine (scoring em shared/domain/itemsets.ts)", !pkg.dependencies["@radar/engine"]);
check("itemsets.ts preservado (página agregada/testes)", fs.existsSync(path.join(root, "src/shared/domain/itemsets.ts")));
check("global sem trincas/itemsets (decisão do usuário)", !/trinc|scoreRouteItemsets|itemset-score-v1|HeroItemsetContext/i.test(code));

// Orçamento (por construção, mesma key = cache hit ficha<->global).
console.log("ORCAMENTO sem rota: R1+R2 <= 2, builds = 0 | com rota: <= 5 fresh (<= 3 por troca de rota no mesmo rank)");
console.log(bad ? `GUARDIAN FAIL (${bad})` : "GUARDIAN OK");
process.exit(bad ? 1 : 0);
