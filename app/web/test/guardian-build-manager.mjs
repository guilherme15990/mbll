import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Guardião estático do Build Management (ADR-047).
//
// A tela é uma superfície de DECISÃO, não um motor novo. O invariante é:
// 1. entra no menu horizontal e tem rota própria (com herói por param ou query);
// 2. reusa os hooks oficiais — sem endpoint, query key ou fetch novos;
// 3. núcleo/build/sugestão vêm de funções puras testáveis;
// 4. seleção vive na URL e é limpa quando o recorte muda;
// 5. composição com item adicionado é `custom` e não herda win rate;
// 6. nenhuma copy promete previsão, probabilidade, causalidade ou "melhor build".
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
const screenPath = "src/features/build-manager/BuildManager.tsx";
const domainPath = "src/shared/domain/buildManager.ts";
const screen = exists(screenPath) ? read(screenPath) : "";
const domain = exists(domainPath) ? read(domainPath) : "";

// 1. Rota e navegação.
check("tela existe", exists(screenPath), screenPath);
check("chunk lazy da tela", /const BuildManager = lazy\(\(\) => import\("\.\.\/features\/build-manager\/BuildManager"\)\)/.test(router));
check("rota /build", /<Route path="\/build" element=\{<BuildManager \/>\} \/>/.test(router));
check("rota /build/:id", /<Route path="\/build\/:id" element=\{<BuildManager \/>\} \/>/.test(router));
check(
  "menu horizontal tem Gerenciar build preservando ?hero=",
  /getNavUrl\("\/build"\)/.test(nav) && nav.includes("Gerenciar build") && nav.includes("BMS"),
);

// 2. Reuso dos contratos oficiais, sem backend novo.
check("importa useBuilds", /useBuilds\b/.test(screen));
check("importa useBuildsAggregate", /useBuildsAggregate\b/.test(screen));
check("importa useHero", /useHero\b/.test(screen));
check("importa useHeroLanes", /useHeroLanes\b/.test(screen));
check("nenhum endpoint novo na tela", !/\/v1\//.test(screen) && !/getJSON\s*[(<]/.test(screen));
check("nenhum fetch novo na tela", !/\bfetch\s*\(/.test(screen));
check("nenhuma query key paralela", !/queryKey/.test(screen) && !/\buseQuery\s*\(/.test(screen));
check("um único fan-out do agregado", (screen.match(/useBuildsAggregate\s*\(/g) ?? []).length === 1);
check(
  "agregado só é habilitado com lane",
  /useBuildsAggregate\(rank, hero && lane \? lane : ""/.test(screen),
);

// 3. Lógica pura separada da UI.
check("importa as funções puras", /coreItems/.test(screen) && /completionSuggestions/.test(screen) && /applyCandidate/.test(screen) && /pickFromObservedBuild/.test(screen));
check("domínio não importa React", !/from\s+["']react/.test(domain) && !/\buse(State|Effect|Memo)\b/.test(domain));
check("domínio não faz rede", !/\bfetch\s*\(/.test(domain) && !/getJSON/.test(domain));
check("domínio só tem import type", !/^\s*import\s+(?!type\b)[^;]*from/m.test(domain));
check(
  "domínio exporta as funções puras da tela",
  ["coreItems", "pickFromObservedBuild", "completionSuggestions", "applyCandidate", "removeSlot", "observedRuneCombos", "maxIndexPick"].every((fn) =>
    new RegExp(`export function ${fn}\\b`).test(domain),
  ),
);

// 4. Seleção endereçável (URL como store) e limpeza por recorte.
check("lê ?build=", /sp\.get\("build"\)/.test(screen));
check("grava ?build=", /next\.set\("build"/.test(screen));
check("limpa ?build= ao trocar recorte", (screen.match(/next\.delete\("build"\)/g) ?? []).length >= 2);
check("herói vem de /build/:id ou ?hero=", /params\.id \?\? sp\.get\("hero"\)/.test(screen));
check("troca de herói/lane limpa composição editada", (screen.match(/next\.delete\("l"\)/g) ?? []).length >= 2);

// 5. Honestidade estrutural da composição.
check("proveniência custom quando diverge da base", /provenance:\s*same\s*\?\s*"observed"\s*:\s*"custom"/.test(screen));
check(
  "observedItems conta só a origem",
  /observedItems:\s*same\s*\?/.test(screen) &&
    /nextPick\.itemIds\.filter\(\(id\) => selected\.pick\.itemIds\.includes\(id\)\)/.test(screen),
);
check("usa o índice do Combinador", /scoreCombination\s*\(/.test(screen));
check("usa o teto de slots do Combinador", /TOTAL_ITEM_SLOTS/.test(screen));
check("uma bota no máximo", /archetype === "movement"/.test(domain));
check("teto de 6 itens no domínio", /maxItems = 6/.test(domain));
check("assinatura estável do loadout", /signatureOfPick\s*\(/.test(screen));
check("link para a preparação", /loadoutHref\s*\(/.test(screen));

// 6. Copy: nada de promessa; a ressalva precisa existir por escrito.
const forbidden = [
  /melhor build/i,
  /build recomendada/i,
  /build ideal/i,
  /previsão de vitória/i,
  /probabilidade de vitória/i,
  /chance de vitória/i,
  /\bgarante\b/i,
];
const hits = forbidden.filter((re) => re.test(screen)).map((re) => re.source);
check("sem copy de promessa", hits.length === 0, hits.join(", "));
const causalLines = screen.split("\n").filter((line) => /\bcausa(l)?\b/i.test(line));
check(
  "causalidade só aparece negada",
  causalLines.every((line) => /não|nunca|nem|nada|sem/i.test(line)),
  causalLines.join(" | "),
);
check(
  "ressalva explícita do índice",
  /não é winrate/i.test(screen) && /não é previsão/i.test(screen) && /não é probabilidade/i.test(screen),
);
check("sugestão não é recomendação", /Não são recomendação/i.test(screen));
check("vazio de contraste explicado", /Sem contraste não vira sugestão/i.test(screen));

// 7. Nada de import cruzado entre features (o f4b cobre, mas a tela é nova).
check("não importa outra feature", !/from\s+["'][^"']*features\//.test(screen));

console.log(bad ? `GUARDIAN BUILD MANAGER FAIL (${bad})` : "GUARDIAN BUILD MANAGER OK");
process.exit(bad ? 1 : 0);
