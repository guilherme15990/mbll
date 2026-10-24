import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Guardião estático da F4b (ADR-037): a web é feature-first.
// 1. `pages/` e `components/` não existem;
// 2. toda rota lazy aponta para `features/`;
// 3. feature não importa outra feature (contrato compartilhado vai para shared/);
// 4. `app/` (shell) não importa feature; `shared/` não importa feature;
// 5. cada contexto tem uma página com export default.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, "src");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const rel = (f) => path.relative(src, f).replace(/\\/g, "/");
const read = (f) => fs.readFileSync(f, "utf8");
const specifiers = (text) =>
  [...text.matchAll(/(?:from|import\()\s*["'](\.[^"']+)["']/g)].map((m) => m[1]);
const resolveRel = (fileRel, spec) =>
  path.posix.normalize(path.posix.join(path.posix.dirname(fileRel), spec));

let bad = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) bad++;
};

check("sem src/pages", !fs.existsSync(path.join(src, "pages")));
check("sem src/components", !fs.existsSync(path.join(src, "components")));

const features = fs.existsSync(path.join(src, "features"))
  ? fs.readdirSync(path.join(src, "features"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : [];
check("features/ com >= 10 contextos", features.length >= 10, `${features.length} contextos`);

const router = read(path.join(src, "app", "router.tsx"));
const lazyRoutes = [...router.matchAll(/lazy\(\(\) => import\("([^"]+)"\)\)/g)].map((m) => m[1]);
check("rotas lazy em features/", lazyRoutes.length >= 12 && lazyRoutes.every((s) => s.startsWith("../features/")), `${lazyRoutes.length} rotas`);

const files = walk(src).map((f) => ({ f, r: rel(f), t: read(f) }));

// 3 — nenhuma feature importa outra feature.
const cross = [];
for (const { r, t } of files) {
  const m = /^features\/([^/]+)\//.exec(r);
  if (!m) continue;
  for (const s of specifiers(t)) {
    const target = resolveRel(r, s);
    const tm = /^features\/([^/]+)\//.exec(target);
    if (tm && tm[1] !== m[1]) cross.push(`${r} -> ${target}`);
  }
}
check("features não importam outras features", cross.length === 0, cross.slice(0, 3).join("; "));

// 4 — direções proibidas: só o shell carrega features (App + mapa de rotas).
// `app/router.tsx` é o loader legítimo desde a ADR-043; qualquer outro arquivo
// de app/shared que toque features continua proibido.
const FEATURE_LOADERS = new Set(["app/router.tsx"]);
const forbidden = [];
for (const { r, t } of files) {
  if (FEATURE_LOADERS.has(r)) continue;
  const zone = r.startsWith("app/") ? "app" : r.startsWith("shared/") ? "shared" : null;
  if (!zone) continue;
  for (const s of specifiers(t)) {
    const target = resolveRel(r, s);
    if (target.startsWith("features/")) forbidden.push(`${r} -> ${target}`);
  }
}
check("app/shared não importam features (exceto app/router.tsx)", forbidden.length === 0, forbidden.slice(0, 3).join("; "));

// 5 — cada contexto tem página default export.
const missing = features.filter((ctx) => {
  const dir = path.join(src, "features", ctx);
  const pages = fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.tsx$/.test(e.name))
    .map((e) => path.join(dir, e.name));
  return !pages.some((p) => /export default/.test(read(p)));
});
check("cada contexto tem página default", missing.length === 0, missing.join(", "));

// 6 — contrato de painel por herói em shared/ (patterns desde ADR-043).
check("HeroPanelProps em shared", fs.existsSync(path.join(src, "shared", "ui", "patterns", "heroPanel.ts")));
const consumers = files.filter(({ t }) => /HeroPanelProps/.test(t));
const wrong = consumers.filter(({ r }) => /^features\//.test(r) && !/from ["'][^"']*shared\/ui\/patterns\/heroPanel["']/.test(read(path.join(src, r))));
check("painéis importam HeroPanelProps de shared", wrong.length === 0, wrong.map((x) => x.r).join(", "));

console.log(bad ? `GUARDIAN F4B FAIL (${bad})` : "GUARDIAN F4B OK");
process.exit(bad ? 1 : 0);
