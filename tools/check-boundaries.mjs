// Gate de fronteiras do monorepo (F5).
//
// Verifica o que o compilador não vê: direção de dependência entre zonas e o
// contrato do workspace do motor. Roda na raiz: `npm run check:boundaries`.
//
// Regras
//  1. Engine — todo nome importado de `@radar/proprietary-engine` tem declaração
//     em `packages/proprietary-engine/src/index.d.ts` (o d.ts sombreia o JS).
//  2. Engine — ninguém importa o interior do pacote (`/src/`, `/test/`) nem o
//     workspace removido `@radar/engine`.
//  3. Apps — nenhum import relativo que escape da própria app (o motor entra
//     pelo nome do workspace).
//  4. Packages — não importam `apps/` (dependência é sempre app → package).
//  5. Web — `features/a` não importa `features/b`; `app|shared|lib` não importam
//     `features`; só `App.tsx` carrega features; `src/pages` e `src/components`
//     não existem; `lib → shared` só via `shared/format`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const API = path.join(ROOT, "apps/api");
const WEB = path.join(ROOT, "apps/web");
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

// ── 2. interior do pacote / workspace morto ─────────────────────────────────
const deep = [];
for (const file of files) {
  for (const { spec } of importsOf(fs.readFileSync(file, "utf8"))) {
    if (/^@radar\/proprietary-engine\//.test(spec)) deep.push(`${rel(file)} → ${spec} (importe a raiz do pacote)`);
    if (spec === "@radar/engine" || spec.startsWith("@radar/engine/")) deep.push(`${rel(file)} → ${spec} (workspace removido, ADR-025)`);
  }
}
check("engine: sem import do interior nem do workspace removido", deep);

// ── 3/4. apps não escapam; packages não dependem de apps ────────────────────
const escapes = [];
const appPackages = [];
for (const file of files) {
  const inApi = isInside(file, API);
  const inWeb = isInside(file, WEB);
  const inPackages = isInside(file, PACKAGES);
  const zone = inApi ? "apps/api" : inWeb ? "apps/web" : inPackages ? "packages" : null;
  if (!zone) continue;
  for (const { spec } of importsOf(fs.readFileSync(file, "utf8"))) {
    if (!spec.startsWith(".")) continue;
    const target = resolveRel(file, spec);
    if (!target) continue; // path inexistente: o build/teste acusa
    if ((inApi && !isInside(target, API)) || (inWeb && !isInside(target, WEB))) {
      escapes.push(`${rel(file)} → ${spec} (sai de ${zone}; use o nome do workspace)`);
    }
    if (inPackages && isInside(target, path.join(ROOT, "apps"))) {
      appPackages.push(`${rel(file)} → ${spec} (package dependendo de app)`);
    }
  }
}
check("apps: nenhum import relativo escapa da app", escapes);
check("packages: não importam apps", appPackages);

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
const libToShared = [];
for (const { rel: from, imports } of webImports) {
  const fromFeature = /^features\/([^/]+)\//.exec(from);
  for (const { targetRel } of imports) {
    const toFeature = /^features\/([^/]+)\//.exec(targetRel);
    if (fromFeature && toFeature && toFeature[1] !== fromFeature[1]) {
      crossFeature.push(`${from} → ${targetRel}`);
    }
    const fromZone = /^(app|shared|lib)\//.exec(from);
    if (fromZone && toFeature) zoneToFeature.push(`${from} → ${targetRel}`);
    if (/^lib\//.test(from) && /^shared\//.test(targetRel) && !/^shared\/format(\.ts)?$/.test(targetRel)) {
      libToShared.push(`${from} → ${targetRel} (lib só pode usar shared/format)`);
    }
  }
}
check("web: features não importam outras features", crossFeature);
check("web: app|shared|lib não importam features", zoneToFeature);
check("web: lib → shared só via shared/format", libToShared);

const featureImporters = webImports
  .filter(({ rel: from }) => !/^features\//.test(from))
  .filter(({ imports }) => imports.some(({ targetRel }) => targetRel.startsWith("features/")))
  .map(({ rel: from }) => from);
const wrongLoaders = featureImporters.filter((f) => f !== "App.tsx");
check("web: só App.tsx carrega features", wrongLoaders, featureImporters.join(", "));

const legacy = ["pages", "components"].filter((d) => fs.existsSync(path.join(WEB_SRC, d)));
check("web: sem src/pages e src/components", legacy.map((d) => `src/${d} existe`));

// ── resultado ───────────────────────────────────────────────────────────────
console.log(bad ? `BOUNDARIES FAIL (${bad} regra(s))` : "BOUNDARIES OK");
process.exit(bad ? 1 : 0);
