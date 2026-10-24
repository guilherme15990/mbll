import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Guardião estático da F4a (ADR-036):
// 1. `useFilters` fora do App (ciclo página → App → página morto);
// 2. páginas em chunks independentes (React.lazy + Suspense);
// 3. ErrorBoundary cobrindo rota e raiz;
// 4. `shared/format` como dona da formatação;
// 5. código morto removido (`.old`, DddModal, ExportEvidence, heroSeal).
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

let bad = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) bad++;
};

const app = read("src/App.tsx");
const main = read("src/main.tsx");
const pagesDir = path.join(root, "src", "features");
const pageFiles = walk(pagesDir);
const pageText = pageFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");

// 1 — filtro global sem depender do shell.
check("useFilters fora do App", !/export function useFilters/.test(app));
check("filters.ts existe", exists("src/app/filters.ts"));
check("páginas não importam App (ciclo morto)", !/from ["'][^"']*\/App["']/.test(pageText));
check("páginas importam app/filters", /from ["'][^"']*app\/filters["']/.test(pageText));

// 2 — code splitting por rota.
const lazyCount = (app.match(/lazy\(\(\) => import\("\.\/features\//g) ?? []).length;
check("rotas lazy (>= 10)", lazyCount >= 10, `${lazyCount} rotas`);
check("Suspense com fallback", /<Suspense\s+fallback=/.test(app));
check("fallback acessível", /data-testid="route-loading"/.test(app));

// 3 — limite de erro.
const eb = read("src/app/ErrorBoundary.tsx");
check("ErrorBoundary na rota", /<ErrorBoundary\s+key=/.test(app));
check("ErrorBoundary na raiz", /<ErrorBoundary>/.test(main));
check("boundary captura render", /getDerivedStateFromError/.test(eb) && /componentDidCatch/.test(eb));
check("fallback com retry e reload", /Tentar de novo/.test(eb) && /window\.location\.reload\(\)/.test(eb));

// 4 — formatação com dono único.
const fmt = read("src/shared/format.ts");
const api = read("src/lib/api.ts");
check("shared/format exporta pct/num/ago", /export function pct/.test(fmt) && /export function num/.test(fmt) && /export function ago/.test(fmt));
check("shared/format exporta signed/pp", /export function signed/.test(fmt) && /export function pp/.test(fmt));
check("api reexporta shared/format", /export \{ ago, num, pct \} from "\.\.\/shared\/format"/.test(api));
check("api não redefine pct/num", !/export const (pct|num) =/.test(api));
check("sem signed local duplicado", !/function signed\(/.test(pageText) && !/function signed\(/.test(read("src/features/dashboard/BuildsTab.tsx")));

// 5 — código morto.
for (const p of [
  "src/pages",
  "src/pages/.old",
  "src/pages/hero/heroSeal.ts",
  "src/components",
  "src/components/DddModal.tsx",
  "src/components/idd/ExportEvidence.tsx",
]) {
  check(`sem código morto: ${p}`, !exists(p));
}

console.log(bad ? `GUARDIAN F4A FAIL (${bad})` : "GUARDIAN F4A OK");
process.exit(bad ? 1 : 0);
