// Gate de fronteiras do monorepo (F5).
//
// Verifica o que o compilador não vê: direção de dependência entre zonas e o
// contrato do workspace do motor. Roda na raiz: `npm run check:boundaries`.
//
// Regras
//  1. Engine — todo nome importado de `@radar/engine` tem declaração
//     em `packages/engine/src/index.d.ts` (o d.ts sombreia o JS), e
//     toda declaração de VALOR (função/classe/const) existe no runtime.
//  2. Engine — ninguém importa o interior do pacote (`/src/`, `/test/`);
//     o motor entra pela raiz `@radar/engine` (ADR-059 substitui ADR-025).
//  3. Apps — nenhum import relativo que escape da própria app (o motor entra
//     pelo nome do workspace).
//  4. Packages — não importam `app/` (dependência é sempre app → package).
//  5. Web — `features/a` não importa `features/b`; `app|shared|lib` não importam
//     `features`; só `App.tsx` carrega features; `src/pages` e `src/components`
//     não existem; `lib → shared` só via `shared/format`.
//  6. Contrato — `@radar/contracts` é a única casa dos DTOs do fio: só tipos, sem
//     import, e nenhum app/pacote redeclara um nome que ele exporta.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toPosix = (p) => p.split(path.sep).join("/");
const rel = (abs) => toPosix(path.relative(ROOT, abs));

let bad = 0;
const check = (name, problems, okDetail = "") => {
  const ok = problems.length === 0;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? (okDetail ? ` — ${okDetail}` : "") : ""}`);
  if (!ok) {
    bad++;
    for (const p of problems.slice(0, 8)) console.log(`     · ${p}`);
    if (problems.length > 8) console.log(`     · … +${problems.length - 8}`);
  }
};

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "dist") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(m?js|tsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

const API = path.join(ROOT, "app/api");
const WEB = path.join(ROOT, "app/web");
const PACKAGES = path.join(ROOT, "packages");

const files = [
  ...walk(path.join(API, "src")),
  ...walk(path.join(API, "test")),
  ...walk(path.join(WEB, "src")),
  ...walk(PACKAGES),
];

// ── parser de imports (estático + dinâmico) ──────────────────────────────────
const STATIC = /\b(?:import|export)\s+([^;]*?)\s+from\s*["']([^"']+)["']/g;

/** @returns {{ spec: string, clause: string }[]} */
function importsOf(text) {
  const out = [];
  for (const m of text.matchAll(STATIC)) out.push({ clause: m[1], spec: m[2] });
  for (const m of text.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    // `const { a, b } = await import("...")`: recupera os nomes do destructuring.
    const before = text.slice(Math.max(0, m.index - 400), m.index);
    const destructure = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:await\s*)?$/.exec(before);
    out.push({ clause: destructure ? destructure[1] : "", spec: m[1] });
  }
  return out;
}

function namesOf(clause) {
  const names = [];
  const block = /\{([^}]*)\}/.exec(clause);
  const defaultImport = /^\s*([A-Za-z0-9_$]+)\s*(?:,|$)/.exec(clause);
  if (defaultImport && !clause.trim().startsWith("{")) names.push(defaultImport[1]);
  if (block) {
    for (const part of block[1].split(",")) {
      const cleaned = part.trim().replace(/^type\s+/, "");
      if (!cleaned) continue;
      const name = cleaned.split(/\s+as\s+/)[0].trim();
      if (!name || name === "*") continue;
      names.push(name);
    }
  }
  return names;
}

const RESOLVE_EXT = ["", ".js", ".mjs", ".ts", ".tsx", "/index.js", "/index.ts", "/index.tsx"];
function resolveRel(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const ext of RESOLVE_EXT) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const isInside = (child, parent) => {
  const r = path.relative(parent, child);
  return r !== "" && !r.startsWith("..") && !path.isAbsolute(r);
};

// ── 1. contrato do motor ────────────────────────────────────────────────────
const dts = fs.readFileSync(path.join(PACKAGES, "engine/src/index.d.ts"), "utf8");
const declared = new Set();
for (const m of dts.matchAll(/export\s+declare\s+(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) declared.add(m[1]);
for (const m of dts.matchAll(/export\s+(?:type|interface)\s+([A-Za-z0-9_$]+)/g)) declared.add(m[1]);

const undeclared = [];
let engineImports = 0;
for (const file of files) {
  for (const { clause, spec } of importsOf(fs.readFileSync(file, "utf8"))) {
    if (spec !== "@radar/engine") continue;
    engineImports++;
    for (const name of namesOf(clause)) {
      if (!declared.has(name)) undeclared.push(`${rel(file)} importa "${name}" (sem declaração no index.d.ts)`);
    }
  }
}
check("engine: todo import tem contrato no index.d.ts", undeclared, `${declared.size} nomes declarados, ${engineImports} imports`);

// 1b. declaração → runtime: o .d.ts sombreia o JS, então uma declaração sem
// export real é uma mentira que só aparece em runtime (`undefined`).
const valueDecls = new Set();
for (const m of dts.matchAll(/export\s+declare\s+(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) valueDecls.add(m[1]);
const runtime = await import(pathToFileURL(path.join(PACKAGES, "engine/src/index.js")).href);
const phantom = [...valueDecls].filter((n) => !(n in runtime)).sort();
check("engine: toda declaração de valor existe no runtime", phantom, `${valueDecls.size} valores declarados`);

// ── 2. interior do pacote ───────────────────────────────────────────────────
const deep = [];
for (const file of files) {
  for (const { spec } of importsOf(fs.readFileSync(file, "utf8"))) {
    if (/^@radar\/engine\//.test(spec)) deep.push(`${rel(file)} → ${spec} (importe a raiz do pacote)`);
  }
}
check("engine: sem import do interior do pacote", deep);

// ── 3/4. apps não escapam; packages não dependem de app ─────────────────────
const escapes = [];
const appPackages = [];
for (const file of files) {
  const inApi = isInside(file, API);
  const inWeb = isInside(file, WEB);
  const inPackages = isInside(file, PACKAGES);
  const zone = inApi ? "app/api" : inWeb ? "app/web" : inPackages ? "packages" : null;
  if (!zone) continue;
  for (const { spec } of importsOf(fs.readFileSync(file, "utf8"))) {
    if (!spec.startsWith(".")) continue;
    const target = resolveRel(file, spec);
    if (!target) continue; // path inexistente: o build/teste acusa
    if ((inApi && !isInside(target, API)) || (inWeb && !isInside(target, WEB))) {
      escapes.push(`${rel(file)} → ${spec} (sai de ${zone}; use o nome do workspace)`);
    }
    if (inPackages && isInside(target, path.join(ROOT, "app"))) {
      appPackages.push(`${rel(file)} → ${spec} (package dependendo de app)`);
    }
  }
}
check("app: nenhum import relativo escapa da app", escapes);
check("packages: não importam app", appPackages);

// ── 5. fronteiras da web ────────────────────────────────────────────────────
const WEB_SRC = path.join(WEB, "src");
const webFiles = files.filter((f) => isInside(f, WEB_SRC));
const webRel = (f) => toPosix(path.relative(WEB_SRC, f));

const webImports = webFiles.map((file) => {
  const list = [];
  for (const { spec } of importsOf(fs.readFileSync(file, "utf8"))) {
    if (!spec.startsWith(".")) continue;
    const target = resolveRel(file, spec);
    if (target) list.push({ spec, target, targetRel: webRel(target) });
  }
  return { file, rel: webRel(file), imports: list };
});

const crossFeature = [];
const zoneToFeature = [];
for (const { rel: from, imports } of webImports) {
  const fromFeature = /^features\/([^/]+)\//.exec(from);
  for (const { targetRel } of imports) {
    const toFeature = /^features\/([^/]+)\//.exec(targetRel);
    if (fromFeature && toFeature && toFeature[1] !== fromFeature[1]) {
      crossFeature.push(`${from} → ${targetRel}`);
    }
    const fromZone = /^(app|shared)\//.exec(from);
    // `app/router.tsx` é o único arquivo de shell que carrega features (ADR-043).
    if (fromZone && toFeature && from !== "app/router.tsx") zoneToFeature.push(`${from} → ${targetRel}`);
  }
}
check("web: features não importam outras features", crossFeature);
check("web: app|shared não importam features (exceto app/router.tsx)", zoneToFeature);

// ADR-043 / regra 12 da ADR-041: `shared/domain` é lógica pura — só o motor,
// `shared/format` e os irmãos do próprio `shared/domain`. Tipos podem vir de
// `shared/api` (`import type`): são apagados no build e não criam dependência de
// runtime nem ciclo real. O domínio pode ter vários arquivos (ADR-041 §7, teto
// de 300 linhas): um irmão de pasta é o MESMO módulo lógico e cada arquivo da
// pasta é checado aqui, então a pureza vale por transitividade.
const DOMAIN_PKGS = new Set(["@radar/engine"]);
const domainImpure = [];
for (const file of webFiles) {
  const from = webRel(file);
  if (!/^shared\/domain\//.test(from)) continue;
  for (const { spec, clause } of importsOf(fs.readFileSync(file, "utf8"))) {
    if (/^\s*type\b/.test(clause)) continue;
    if (!spec.startsWith(".")) {
      if (!DOMAIN_PKGS.has(spec)) domainImpure.push(`${from} → ${spec}`);
      continue;
    }
    const target = resolveRel(file, spec);
    const targetRel = target ? webRel(target) : spec;
    const allowed =
      /^shared\/format(\.ts)?$/.test(targetRel) || targetRel.startsWith("shared/domain/");
    if (!allowed) domainImpure.push(`${from} → ${targetRel}`);
  }
}
check("web: shared/domain puro (motor + shared/format)", domainImpure);

// ADR-043 / regra 11 da ADR-041: `ui/primitives` é átomo — sem dado, sem
// contexto, sem composição. Só `shared/format` (número/data) e
// `shared/domain/present` (`cx`), ambos puros. Precisou de hook → é pattern.
const PRIM_PKGS = new Set(["react", "react-router-dom", "lucide-react"]);
const primViolations = [];
const primShape = [];
for (const file of webFiles) {
  const from = webRel(file);
  if (!from.startsWith("shared/ui/primitives/")) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const { spec, clause } of importsOf(text)) {
    if (/^\s*type\b/.test(clause)) continue;
    if (!spec.startsWith(".")) {
      if (!PRIM_PKGS.has(spec)) primViolations.push(`${from} → ${spec}`);
      continue;
    }
    const target = resolveRel(file, spec);
    const targetRel = target ? webRel(target) : spec;
    const allowed =
      /^shared\/format(\.ts)?$/.test(targetRel) ||
      /^shared\/domain\/present(\.ts)?$/.test(targetRel) ||
      targetRel.startsWith("shared/ui/primitives/");
    if (!allowed) primViolations.push(`${from} → ${targetRel}`);
  }
  // Regra 14: 1 componente exportado por arquivo, com o nome do arquivo.
  const fns = [...text.matchAll(/export function ([A-Za-z0-9_]+)/g)].map((m) => m[1]);
  const expected = path.basename(file).replace(/\.tsx?$/, "");
  if (fns.length !== 1 || fns[0] !== expected) {
    primShape.push(`${from}: exporta ${fns.join(", ") || "nada"} (esperado ${expected})`);
  }
}
check("web: ui/primitives sem dado/contexto (format + cx)", primViolations);
check("web: 1 componente por arquivo em ui/primitives", primShape);

// `lib/` foi dissolvido em `shared/{api,domain}` (ADR-043). Recriar a pasta
// reabre a ambiguidade nº 1 da ADR-041 — é o que esta linha impede.
check(
  "web: sem src/lib (shared/api + shared/domain)",
  fs.existsSync(path.join(WEB_SRC, "lib")) ? ["src/lib existe"] : [],
);

const featureImporters = webImports
  .filter(({ rel: from }) => !/^features\//.test(from))
  .filter(({ imports }) => imports.some(({ targetRel }) => targetRel.startsWith("features/")))
  .map(({ rel: from }) => from);
// Só o shell carrega features: o App e o mapa de rotas (ADR-043).
const FEATURE_LOADERS = new Set(["App.tsx", "app/router.tsx"]);
const wrongLoaders = featureImporters.filter((f) => !FEATURE_LOADERS.has(f));
check("web: só App.tsx e app/router carregam features", wrongLoaders, featureImporters.join(", "));

const legacy = ["pages", "components"].filter((d) => fs.existsSync(path.join(WEB_SRC, d)));
check("web: sem src/pages e src/components", legacy.map((d) => `src/${d} existe`));

// ── 6. camada providers (ADR-045) ───────────────────────────────────────────
// `providers/` é a base da pilha do backend: providers → application → routes →
// http. Se um provider importar uma camada de cima, o cliente externo passa a
// depender de regra de negócio e deixa de ser substituível. O compilador não vê
// direção de dependência; este gate vê.
const API_SRC = path.join(API, "src");
const PROVIDERS_DIR = path.join(API_SRC, "providers");
const apiRel = (f) => toPosix(path.relative(API_SRC, f));
const providersUp = [];
const arenaImports = [];
for (const file of files) {
  if (!isInside(file, API_SRC)) continue; // só o backend é regido por esta seção
  const from = apiRel(file);
  for (const { spec } of importsOf(fs.readFileSync(file, "utf8"))) {
    if (!spec.startsWith(".")) continue;
    const target = resolveRel(file, spec);
    if (!target) continue;
    const targetRel = apiRel(target);
    // O cliente externo tem UMA casa (`providers/arena`). `infra/arena` era a
    // duplicata que a ADR-045 eliminou — recriar o arquivo reabre o segundo cliente.
    if (/^infra\/arena(\.js)?$/.test(targetRel)) {
      arenaImports.push(`${from} → ${targetRel}`);
    }
    if (!isInside(file, PROVIDERS_DIR)) continue;
    if (/^(application|routes|http)\//.test(targetRel)) {
      providersUp.push(`${from} → ${targetRel}`);
    }
  }
}
check("providers: não importa application/routes/http", providersUp);
check("api: cliente externo só em providers/arena", arenaImports);
check(
  "api: infra/arena.js removido (ADR-045)",
  fs.existsSync(path.join(API_SRC, "infra", "arena.js")) ? ["app/api/src/infra/arena.js existe"] : [],
);

// ── 6. contrato único (@radar/contracts) ────────────────────────────────────
// O agregado de builds já teve três descrições: o `index.d.ts` do motor com
// `Record<string, any>`, a montagem em JS na API e 29 tipos escritos à mão na
// web. Divergir era possível sem o `tsc` reclamar. Agora `@radar/contracts` é a
// fonte: o motor declara `buildAggregate(): AggregateBody`, a API anota a borda
// e a web reexporta. Este gate impede a terceira cópia de voltar.
const CONTRACTS = path.join(PACKAGES, "contracts");
const CONTRACTS_ENTRY = path.join(CONTRACTS, "src/index.ts");
const contractText = fs.existsSync(CONTRACTS_ENTRY) ? fs.readFileSync(CONTRACTS_ENTRY, "utf8") : "";
const contractNames = new Set();
for (const m of contractText.matchAll(/export\s+(?:type|interface)\s+([A-Za-z0-9_$]+)/g)) contractNames.add(m[1]);

check(
  "contracts: pacote existe com tipos",
  contractText && contractNames.size > 0 ? [] : ["packages/contracts/src/index.ts ausente ou sem exports de tipo"],
  `${contractNames.size} tipos`,
);

// Só tipo: nada de import (nem de app, nem do motor) e nenhum valor exportado.
// Um contrato com runtime vira mais uma camada para manter em sincronia.
const contractRuntime = [];
for (const { spec } of importsOf(contractText)) contractRuntime.push(`import de "${spec}" (contrato é só tipo)`);
for (const m of contractText.matchAll(/^(?:export\s+)?(?:const|let|var|function|class|enum)\s+([A-Za-z0-9_$]+)/gm)) {
  contractRuntime.push(`valor ${m[1]} (contrato é só tipo)`);
}
check("contracts: só tipos, sem import nem runtime", contractRuntime);

// Ninguém redeclara um nome do contrato. `export type { X } from "@radar/contracts"`
// continua válido: o reexport não casa com este padrão.
const contractDuplicates = [];
for (const file of files) {
  if (isInside(file, CONTRACTS)) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(/(?:export\s+)?(?:type|interface)\s+([A-Za-z0-9_$]+)\s*(?:=|extends\b|\{)/g)) {
    if (contractNames.has(m[1])) contractDuplicates.push(`${rel(file)} redeclara ${m[1]}`);
  }
}
check("contracts: nenhum DTO do fio redeclarado fora do pacote", contractDuplicates);

// O consumidor da web importa daqui (não de uma cópia local).
const webBuildsQueries = path.join(WEB_SRC, "shared/api/queries/builds.ts");
const webBuildsText = fs.existsSync(webBuildsQueries) ? fs.readFileSync(webBuildsQueries, "utf8") : "";
check(
  "contracts: web importa o agregado de @radar/contracts",
  /from\s+["']@radar\/contracts["']/.test(webBuildsText)
    ? []
    : ["shared/api/queries/builds.ts não importa @radar/contracts"],
);

// Workspace declarado nos três consumidores: sem isso o import funciona por
// acaso (hoisting) e quebra num `npm ci` limpo.
const contractDeps = [];
for (const pkgPath of ["app/web/package.json", "app/api/package.json", "packages/engine/package.json"]) {
  const abs = path.join(ROOT, pkgPath);
  if (!fs.existsSync(abs)) continue;
  const pkg = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (!pkg.dependencies?.["@radar/contracts"]) contractDeps.push(`${pkgPath} sem dependência @radar/contracts`);
}
check("contracts: declarado em web, api e motor", contractDeps);

// ── 7. tamanho de arquivo (ADR-041, critério de aceite nº 1) ─────────────────
// "Nenhum arquivo acima de 300 linhas fora de packages/engine".
// A regra existia só no papel e por isso regrediu para 11 arquivos. A allowlist
// é a dívida medida em 2026-10-27, com o tamanho de então: o arquivo pode
// encolher, não crescer. Arquivo novo acima do limite falha.
//
// `packages/contracts` fica fora de propósito: é declaração de tipo do fio
// (crescer = mais endpoints), sem lógica que alguém precise abrir para mudar
// comportamento — que é o que o critério da ADR-041 quer proteger.
const LOC_LIMIT = 300;
const LOC_BASELINE = new Map([
  ["app/web/src/features/build-manager/SlotPicker.tsx", 430],
  ["app/web/src/shared/domain/loadout.ts", 476],
  ["app/api/src/application/buildsAggregate.js", 394],
  ["app/web/src/features/hero-detail/sections/BuildsSection.tsx", 349],
  ["app/web/src/features/builds/BuildsPowerPanel.tsx", 338],
  ["app/web/src/features/dashboard/Dashboard.tsx", 333],
  ["app/web/src/features/hero-detail/sections/ConfrontosPreview.tsx", 312],
  ["app/web/src/features/hero-detail/sections/ConfrontosSection.tsx", 302],
]);

const locOversize = [];
const locGrew = [];
const locPaid = [];
const locFiles = [
  ...walk(path.join(API, "src")),
  ...walk(path.join(WEB, "src")),
];
for (const file of locFiles) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  if (lines <= LOC_LIMIT) continue;
  const from = rel(file);
  const ceiling = LOC_BASELINE.get(from);
  if (ceiling == null) locOversize.push(`${from} (${lines} linhas)`);
  else if (lines > ceiling) locGrew.push(`${from}: ${lines} (teto registrado ${ceiling})`);
}
for (const [from, ceiling] of LOC_BASELINE) {
  if (!locFiles.some((f) => rel(f) === from)) locPaid.push(`${from} sumiu (remova da allowlist)`);
}
check("arquivos: nada acima de 300 linhas fora da allowlist", locOversize, `${locFiles.length} arquivos varridos, ${LOC_BASELINE.size} na dívida`);
check("arquivos: allowlist só encolhe (teto registrado)", locGrew, LOC_BASELINE.size ? "dívida monotônica" : "");
for (const note of locPaid) console.log(`NOTE ${note}`);

// ── 8. gerenciador de pacotes único (ADR-034, dívida 4) ─────────────────────
// O lockfile versionado é o package-lock.json (v3) e o CI instala com `npm ci`.
// Um segundo manifesto convida a instalar com outra ferramenta e a divergir do
// único lockfile que o CI honra.
const FOREIGN_MANIFESTS = [
  "pnpm-workspace.yaml", "pnpm-lock.yaml", "yarn.lock", ".yarnrc.yml",
  "bun.lock", "bun.lockb",
];
const managerProblems = FOREIGN_MANIFESTS
  .filter((f) => fs.existsSync(path.join(ROOT, f)))
  .map((f) => `${f} existe (o repo instala com npm; lockfile único é package-lock.json)`);

const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
if (!String(rootPkg.packageManager ?? "").startsWith("npm@")) {
  managerProblems.push(
    `package.json: packageManager ausente ou não-npm (hoje: ${rootPkg.packageManager ?? "ausente"})`,
  );
}
check("repo: gerenciador único (npm) com packageManager declarado", managerProblems);

// ── resultado ───────────────────────────────────────────────────────────────
console.log(bad ? `BOUNDARIES FAIL (${bad} regra(s))` : "BOUNDARIES OK");
process.exit(bad ? 1 : 0);
