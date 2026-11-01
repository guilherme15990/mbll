import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Guardião estático do Draft Management (ADR-052 + ADR-053).
//
// A tela NÃO cria modelo novo de previsão: ela lê sinais que a API já entrega
// (θ̂, pares de counter/sinergia, pick/ban, rotas, perfil e curva por par) e
// publica um índice relativo com suporte declarado. O invariante é:
// 1. rota própria + entrada no menu horizontal, preservando os filtros globais;
// 2. zero endpoint/query key novo — o fan-out usa a query oficial de matchups;
// 3. matemática em domínio puro (sem React, sem rede); só o motor é importado;
// 4. seleção vive na URL e `rank=all` não calcula proxy;
// 5. ausência de par é ausência, não zero; direção vem da lista, não do δ;
// 6. nenhuma copy promete probabilidade, previsão, recomendação ou "melhor pick".
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));

let bad = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) bad++;
};

const router = read("src/app/router.tsx");
const nav = read("src/app/TopNav.tsx");
const feature = "src/features/draft-management";
const screenPath = `${feature}/DraftManagement.tsx`;
const dataPath = `${feature}/useDraftData.ts`;
const modelDir = "src/features/draft-management/model";
const modelIndex = `${modelDir}/index.ts`;
const screen = exists(screenPath) ? read(screenPath) : "";
const data = exists(dataPath) ? read(dataPath) : "";
const domain =
  exists(modelDir)
    ? fs
        .readdirSync(path.join(root, modelDir))
        .filter((name) => /\.ts$/.test(name))
        .map((name) => read(`${modelDir}/${name}`))
        .join("\n")
    : "";
const featureFiles = exists(feature)
  ? fs
      .readdirSync(path.join(root, feature))
      .filter((name) => /\.(ts|tsx)$/.test(name))
      .map((name) => ({ name, body: read(`${feature}/${name}`) }))
  : [];

// 1. Rota e navegação.
check("tela existe", exists(screenPath), screenPath);
check(
  "chunk lazy da tela",
  /const DraftManagement = lazy\(\(\) => import\("\.\.\/features\/draft-management\/DraftManagement"\)\)/.test(router),
);
check("rota /draft", /<Route path="\/draft" element=\{<DraftManagement \/>\} \/>/.test(router));
check(
  "menu horizontal tem Draft management (DMP) preservando filtros",
  /getNavUrl\("\/draft"\)/.test(nav) && nav.includes("Draft management") && nav.includes("DMP"),
);

// 2. Reuso dos contratos oficiais, sem backend novo.
check("hook de dados separado da tela", exists(dataPath));
check("tela usa o hook de dados", /useDraftData\s*\(/.test(screen));
check(
  "hook usa o lote COMPLETO oficial /heroes (sem tamanho de lote fixo)",
  /useAllHeroes\s*\(/.test(data) && !/useHeroes\s*\(/.test(data) && !/\bsize\b/.test(data),
);
check("hook usa o catálogo oficial", /useCatalog\s*\(/.test(data));
check("hook usa o mapa oficial de rotas", /useHeroLanes\s*\(/.test(data));
check("fan-out usa a query oficial de matchups", /matchupsQuery\s*\(/.test(data));
check("fan-out é useQueries (1 request por herói escolhido)", /useQueries\s*\(/.test(data));
check(
  "fan-out = escolhidos + candidatos da lane, com teto declarado",
  /\(enabled \? bookIds : \[\]\)\.map/.test(data) &&
    /CANDIDATE_BOOK_LIMIT = 8/.test(data) &&
    /BOOK_LIMIT = 18/.test(data) &&
    /laneCandidates\s*\(/.test(data),
);
check("nenhum endpoint literal na feature", !featureFiles.some((f) => /\/v1\//.test(f.body)));
check("nenhum fetch cru na feature", !featureFiles.some((f) => /\bfetch\s*\(/.test(f.body)));
check("nenhuma query key própria na feature", !featureFiles.some((f) => /queryKey/.test(f.body)));

// 3. Matemática em domínio puro (feature-local, como builds/aggregate/model).
check("modelo existe com barrel", exists(modelIndex));
check(
  "tela importa o modelo, não espalha matemática",
  /from "\.\/model"/.test(screen) || /from "\.\/model\//.test(screen),
);
check("domínio sem React", !/from\s+["']react["']/.test(domain) && !/\buse(State|Effect|Memo|Queries)\b/.test(domain));
check("domínio sem rede", !/\bfetch\s*\(/.test(domain) && !/getJSON/.test(domain));
check(
  "domínio só importa irmãos e o motor (sem app/api/shared de runtime)",
  [...domain.matchAll(/from\s+["']([^"']+)["']/g)]
    .map((match) => match[1])
    .every((source) => source.startsWith("./") || source === "@radar/engine"),
);
check("domínio sem endpoint literal", !/\/v1\//.test(domain));
check(
  "domínio exporta as funções puras da tela",
  [
    "parseDraft",
    "encodeDraft",
    "draftSequence",
    "sequenceState",
    "teamStrength",
    "pairSynergy",
    "pairMatchup",
    "buildTeamPower",
    "draftVerdict",
    "pickSuggestions",
    "banTargets",
    "readFirstPick",
    "analyzeDraft",
    "indexShare",
    "heroArchetype",
    "teamMix",
    "mixRelation",
    "teamCurve",
    "curveDelta",
    "matchupMatrix",
    "cellOf",
    "lanePercentile",
    "laneCandidates",
    "balanceOf",
    "nextPickIndex",
    "nextBanIndex",
  ].every((fn) => new RegExp(`export function ${fn}\\b`).test(domain)),
);
check("escala do índice é constante declarada", /POWER_SCALE_K/.test(domain));
check("pesos dos componentes são declarados", /COMPONENT_WEIGHTS/.test(domain));
check("ordem MLBB é uma constante de regra", /1-2-2-2-2-1/.test(domain));
check("tela não recalcula matemática", !/Math\.tanh/.test(screen) && /analyzeDraft\s*\(/.test(screen));
check(
  "escala do índice não é recalculada fora do modelo",
  !featureFiles.some((f) => /Math\.tanh/.test(f.body)),
);

// 4. Seleção na URL e recorte explícito.
check("lê o draft da URL", /parseDraft\s*\(/.test(screen) && /sp\.get/.test(screen));
check("grava d/b/first na URL", /params\.set\("d"/.test(screen) && /params\.set\("b"/.test(screen) && /params\.set\("first"/.test(screen));
check("grava com replace (sem poluir o histórico)", /setSp\(params,\s*\{\s*replace:\s*true\s*\}\)/.test(screen));
check("rank=all pede elo em vez de calcular", /rank === "all"/.test(screen) && /NeedsRank/.test(screen));
check("respeita o filtro global de janela", /useFilters\s*\(/.test(screen) && /useDraftData\(rank,\s*window/.test(screen));

// 5. Honestidade estrutural.
check("ausência de par vira null, não zero", /return \{ value: null, observed: 0/.test(domain) || /value: null/.test(domain));
check("confronto é média por par, nunca soma", /mean\(observations\)/.test(domain) && !/sum \+ .*\.delta/.test(domain));
check("direção vem de countersUp/countersDown", /countersUp/.test(domain) && /countersDown/.test(domain) && /synergiesUp/.test(domain) && /synergiesDown/.test(domain));
check("hazard é proxy declarado", /hazard/i.test(domain) && /Não é probabilidade|não é probabilidade/i.test(domain));
check("ban e pick repetidos são rejeitados", /isUsed\(state, heroId\)\) return state/.test(domain));
check("par contestado não escolhe lado", /contested \+= 1/.test(domain));

// 5b. Leituras da v2 (ADR-053).
check(
  "perfil dominante vem do motor, nunca de tabela fixa",
  /import \{ dominantProfileOf \} from "@radar\/engine"/.test(domain) &&
    /dominantProfileOf\(profiles\)/.test(domain),
);
check("arquétipo sem par é null, nunca uniforme", /if \(!dom \|\| !isArchetype\(dom\.top\)\) return null/.test(domain));
check(
  "percentual só existe com os dois índices",
  /export function indexShare/.test(domain) && /if \(ours == null \|\| theirs == null\) return null/.test(domain),
);
check(
  "curva agrega as duplas do time e não preenche buraco",
  /j = i \+ 1/.test(domain) && /value: mean\(bucket\.values\)/.test(domain) && /value: null/.test(domain),
);
check(
  "matriz conta pares e não soma efeitos",
  /advantages: cells\.filter/.test(domain) && !/sum \+ cell\.delta/.test(domain),
);
check("pick/ban do card usam a ordem do draft", /nextPickIndex/.test(domain) && /nextBanIndex/.test(domain));
check("recomendador tem dois fatores declarados", /BALANCE_WEIGHT = 0\.25/.test(domain) && /lanePercentile/.test(domain));
check(
  "tela em faixas: draft, recomendações, força, matriz, arquétipos, curva",
  ["RecommendationPanel", "StrengthBar", "MatchupMatrix", "ArchetypePanel", "PowerCurve"].every((name) =>
    exists(`${feature}/${name}.tsx`),
  ),
);
check(
  "card maior com Pick e Ban em todos os candidatos",
  /Mais indicado agora/.test(read(`${feature}/RecommendationPanel.tsx`)) &&
    /aria-label=\{`Pickar \$\{name\}`\}/.test(read(`${feature}/RecommendationPanel.tsx`)) &&
    /aria-label=\{`Banir \$\{name\}`\}/.test(read(`${feature}/RecommendationPanel.tsx`)),
);
check(
  "lane alvo vive na URL e alimenta o fan-out",
  /params\.set\("lane"/.test(screen) &&
    /sp\.get\("lane"\)/.test(screen) &&
    /useDraftData\(rank,\s*window,\s*pickedIds,\s*laneTarget\)/.test(screen),
);
check(
  "divisão do índice é rotulada como divisão",
  /divisão do índice/.test(read(`${feature}/StrengthBar.tsx`)),
);
check(
  "curva é proxy das duplas, não do time",
  /média das curvas das duplas/i.test(read(`${feature}/PowerCurve.tsx`)) &&
    /não win rate do time/i.test(read(`${feature}/PowerCurve.tsx`)),
);
check(
  "matriz não promete vantagem total",
  /não soma efeitos/i.test(read(`${feature}/MatchupMatrix.tsx`)),
);

// 6. Copy: nada de promessa; a ressalva precisa existir por escrito.
const forbidden = [
  /melhor pick/i,
  /pick ideal/i,
  /build recomendada/i,
  /previsão de vitória/i,
  /probabilidade de vitória/i,
  /chance de vitória/i,
  /win ?rate de composição/i,
  /\bgarante\b/i,
];
const hits = featureFiles.flatMap((f) =>
  forbidden.filter((re) => re.test(f.body)).map((re) => `${f.name}: ${re.source}`),
);
check("sem copy de promessa", hits.length === 0, hits.join(", "));
check("ressalva explícita do índice", /não é probabilidade/i.test(screen) && /não é previsão/i.test(screen));
check("sugestão não é recomendação", /não (são|é) recomendação/i.test(featureFiles.map((f) => f.body).join("\n")));
check("proxy é rotulado como proxy", /proxy/i.test(featureFiles.map((f) => f.body).join("\n")));
check(
  "50 = neutro declarado na tela",
  /50 = neutro/.test(featureFiles.map((f) => f.body).join("\n")),
);
check(
  "causalidade só aparece negada",
  featureFiles
    .flatMap((f) => f.body.split("\n"))
    .filter((line) => /\bcausa(l)?\b/i.test(line))
    .every((line) => /não|nunca|nem|nada|sem/i.test(line)),
);

// 7. Nada de import cruzado entre features.
check("não importa outra feature", !featureFiles.some((f) => /from\s+["'][^"']*features\//.test(f.body)));

// 8. Página de TESTE do Draft Score do herói (`/draft-score`) — separada do índice
//    `/draft`. O número (0–100 = min–max da WR no recorte: melhor=100, pior=0) é
//    composto no SERVIDOR (`/v1/heroes/draft-score`, motor `hero-draft-score-v1`):
//    a web consome 1 request por recorte, sem fan-out no navegador.
const scorePagePath = `${feature}/DraftScorePage.tsx`;
const scorePage = exists(scorePagePath) ? read(scorePagePath) : "";
const scoreTablePath = `${feature}/DraftScoreTable.tsx`;
const scoreHookPath = "src/shared/api/queries/draftScore.ts";
const scoreHook = exists(scoreHookPath) ? read(scoreHookPath) : "";
check("página de teste existe", exists(scorePagePath), scorePagePath);
check(
  "chunk lazy da página de teste",
  /const DraftScore = lazy\(\(\) => import\("\.\.\/features\/draft-management\/DraftScorePage"\)\)/.test(router),
);
check("rota /draft-score separada de /draft", /<Route path="\/draft-score" element=\{<DraftScore \/>\} \/>/.test(router));
check("tabela do Draft Score existe", exists(scoreTablePath), scoreTablePath);
check(
  "página de teste consome o número pronto (hook de shared/api)",
  /useHeroDraftScore\s*\(/.test(scorePage) && scoreHook.length > 0,
);
check(
  "hook do Draft Score bate no endpoint composto do servidor",
  /heroes\/draft-score/.test(scoreHook) && /useQuery\s*/.test(scoreHook),
);
check(
  "DTO do fio vem de @radar/contracts (sem cópia local)",
  /from\s+["']@radar\/contracts["']/.test(scoreHook) && !/type\s+HeroDraftScoreResponse\s*=/.test(scoreHook),
);
check(
  "página de teste não faz fan-out",
  !/matchupsQuery\s*\(/.test(scorePage) && !/matchupsQuery\s*\(/.test(scoreHook),
);
check("página de teste declara a ressalva", /não é[\s\S]{0,40}probabilidade/i.test(scorePage) && /previsão/i.test(scorePage));
check("página de teste sem endpoint literal", !/\/v1\//.test(scorePage));

console.log(bad ? `GUARDIAN DRAFT MANAGEMENT FAIL (${bad})` : "GUARDIAN DRAFT MANAGEMENT OK");
process.exit(bad ? 1 : 0);
