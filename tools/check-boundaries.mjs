// Gate de fronteiras do monorepo (F5).
//
// Verifica o que o compilador não vê: direção de dependência entre zonas e o
// contrato do workspace do motor. Roda na raiz: `npm run check:boundaries`.
//
// Regras
//  1. Engine — todo nome importado de `@radar/proprietary-engine` tem declaração
//     em `packages/proprietary-engine/src/index.d.ts` (o d.ts sombreia o JS), e
//     toda declaração de VALOR (função/classe/const) existe no runtime.
//  2. Engine — ninguém importa o interior do pacote (`/src/`, `/test/`) nem o
//     workspace removido `@radar/engine`.
//  3. Apps — nenhum import relativo que escape da própria app (o motor entra
//     pelo nome do workspace).
//  4. Packages — não importam `app/` (dependência é sempre app → package).
//  5. Web — `features/a` não importa `features/b`; `app|shared|lib` não importam
//     `features`; só `App.tsx` carrega features; `src/pages` e `src/components`
//     não existem; `lib → shared` só via `shared/format`.
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
const dts = fs.readFileSync(path.join(PACKAGES, "proprietary-engine/src/index.d.ts"), "utf8");
const declared = new Set();
for (const m of dts.matchAll(/export\s+declare\s+(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) declared.add(m[1]);
for (const m of dts.matchAll(/export\s+(?:type|interface)\s+([A-Za-z0-9_$]+)/g)) declared.add(m[1]);

const undeclared = [];
let engineImports = 0;
for (const file of files) {
  for (const { clause, spec } of importsOf(fs.readFileSync(file, "utf8"))) {
    if (spec !== "@radar/proprietary-engine") continue;
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
const runtime = await import(pathToFileURL(path.join(PACKAGES, "proprietary-engine/src/index.js")).href);
const phantom = [...valueDecls].filter((n) => !(n in runtime)).sort();
check("engine: toda declaração de valor existe no runtime", phantom, `${valueDecls.size} valores declarados`);

// ── 2. interior do pacote / workspace morto ─────────────────────────────────
const deep = [];
for (const file of files) {
  for (const { spec } of importsOf(fs.readFileSync(file, "utf8"))) {
    if (/^@radar\/proprietary-engine\//.test(spec)) deep.push(`${rel(file)} → ${spec} (importe a raiz do pacote)`);
    if (spec === "@radar/engine" || spec.startsWith("@radar/engine/")) deep.push(`${rel(file)} → ${spec} (workspace removido, ADR-025)`);
  }
}
check("engine: sem import do interior nem do workspace removido", deep);

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

// ADR-043 / regra 12 da ADR-041: `shared/domain` é lógica pura — só o motor e
// `shared/format`. Tipos podem vir de `shared/api` (`import type`): são apagados
// no build e não criam dependência de runtime nem ciclo real.
const DOMAIN_PKGS = new Set(["@radar/proprietary-engine"]);
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
    if (!/^shared\/format(\.ts)?$/.test(targetRel)) domainImpure.push(`${from} → ${targetRel}`);
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

// ── resultado ───────────────────────────────────────────────────────────────
console.log(bad ? `BOUNDARIES FAIL (${bad} regra(s))` : "BOUNDARIES OK");
process.exit(bad ? 1 : 0);
