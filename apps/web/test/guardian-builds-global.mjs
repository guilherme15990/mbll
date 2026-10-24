import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Teste-guardião P0 da aba Builds GLOBAL (/dashboard) — builds-global-brief §2.
// Estático (sem rede): garante teto de requests, sem default de rota, sem
// fan-out e sem copy vetada. Falha = tempestade ou honestidade quebrada.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tab = fs.readFileSync(path.join(root, "src/components/dashboard/BuildsTab.tsx"), "utf8");
const api = fs.readFileSync(path.join(root, "src/lib/api.ts"), "utf8");
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
check("key [builds,id,rank,lane] definida 1x em lib/api", keyDefs === 1, `${keyDefs} definicao(oes)`);
check("global nao cria key paralela", !/builds-global/.test(code + api));

// 4 · reuso (não duplicação): mesma função, mesmo aviso, mesma key via hook.
check("getBuildTags reutilizada da ficha", /from "..\/..\/lib\/buildLabel"/.test(code) && (code.match(/getBuildTags/g) ?? []).length >= 2);
check("silencio no inconclusivo (sem rotulo falado)", !/Lift Inconclusivo|Popular, Sem Lift Demonstrado|Possível Vantagem Emergente/.test(code + fs.readFileSync(path.join(root, "src/pages/panels/BuildsPanel.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")));
check("sem Aviso Central na global (removido por decisão do usuário)", !/SelectionWarning|Aviso Central de Domínio/.test(code));
check("R2 usa sort=win&order=desc&size=25", /sort=win&order=desc/.test(code) && /LIST_SIZE = 25/.test(code));

// 5 · lint de copy vetada (fora do aviso que nega, que vive em SelectionWarning.tsx).
const banned = /melhor build|top builds do meta|build ideal|build do jogo|maior lift da|win m[eé]dio|causa \+|aumenta.*win.*garant|(?<!sem )ordem de compra|em alta esta semana|score global do item|cross-lane|build.*global/i;
const denialFree = code.replace(/SelectionWarning/g, "");
check("copy vetada = 0 na global", !banned.test(denialFree));
// "em alta" só com o qualificador de cobertura.
const altas = (code.match(/em alta/g) ?? []).length;
const quals = (code.match(/cobertura, n[ãa]o s[ée]rie temporal/g) ?? []).length;
check("em alta sempre qualificado (cobertura)", altas > 0 && quals >= altas, `${altas} uso(s), ${quals} qualificador(es)`);

// 6 · aba enxuta (decisão do usuário): sem bloco Emergentes, sem bloco auditoria,
// sem linha de audit por card — auditoria vive na ficha. Cobertura X/3 mantida.
check("sem bloco Emergentes na global", !/Emergentes da/.test(code));
check("sem bloco auditoria na global", !/Auditoria em 1 linha/.test(code));
check("sem linha audit por card", !/Camada A · ajustado NULL/.test(code));
check("contador X/3 com builds", /\/\{TOP_N\} com builds/.test(code) || /com builds nesta rota/.test(code));

// 7 · decisão de localização do scoring registrada e válida.
check("web sem dep @radar/engine (scoring em lib/itemsets.ts)", !pkg.dependencies["@radar/engine"]);
check("itemsets.ts existe", fs.existsSync(path.join(root, "src/lib/itemsets.ts")));
check("itemset-score-v1 citado na global", /itemset-score-v1/.test(tab));

// Orçamento (por construção, mesma key = cache hit ficha<->global).
console.log("ORCAMENTO sem rota: R1+R2 <= 2, builds = 0 | com rota: <= 5 fresh (<= 3 por troca de rota no mesmo rank)");
console.log(bad ? `GUARDIAN FAIL (${bad})` : "GUARDIAN OK");
process.exit(bad ? 1 : 0);
