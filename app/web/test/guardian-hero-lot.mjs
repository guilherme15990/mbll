import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Guardião do LOTE de heróis: o tamanho do lote NÃO pode ser fixado no código.
//
// Motivo: a lista de heróis cresce com o jogo. Um `size=133` (ou `LOT_SIZE`)
// congelado no cliente esconderia todo herói novo. O contrato é:
// 1. a página 1 descobre `total` e as páginas extras saem de `ceil(total / 1ª página)`;
// 2. cada página é pedida por `index` com o teto do SERVIDOR (`HEROES_PAGE_CAP`);
// 3. nenhuma feature fixa tamanho de lote nem monta URL de `/v1` na mão.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));

let bad = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) bad++;
};

const lotHookPath = "src/shared/api/queries/heroes.ts";
const lotHook = exists(lotHookPath) ? read(lotHookPath) : "";
const heroList = exists("src/features/hero-list/HeroList.tsx") ? read("src/features/hero-list/HeroList.tsx") : "";
const draftData = exists("src/features/draft-management/useDraftData.ts")
  ? read("src/features/draft-management/useDraftData.ts")
  : "";

// 1. O hook do lote completo existe e pagina pelo TOTAL (nada de lote fixo).
check("hook do lote completo existe", /export function useAllHeroes/.test(lotHook), lotHookPath);
check(
  "teto de request é do servidor, declarado e usado",
  /export const HEROES_PAGE_CAP = 133/.test(lotHook) && /size=\$\{HEROES_PAGE_CAP\}/.test(lotHook),
);
check(
  "número de páginas sai do TOTAL, não de constante de lote",
  /first\.data\?\.total/.test(lotHook) && /Math\.ceil\(total \/ firstCount\)/.test(lotHook),
);
check("páginas extras são pedidas por index", /useQueries/.test(lotHook) && /index=\$\{index\}/.test(lotHook));

// 2. Consumidores usam o lote completo e não fixam tamanho.
check("lista /hero usa o lote completo", /useAllHeroes\s*\(/.test(heroList) && !/useHeroes\s*\(/.test(heroList));
check("lista /hero sem tamanho de lote fixo", !/LOT_SIZE|size\s*[:=]\s*\d|,\s*133\s*,/.test(heroList));
check("draft usa o lote completo", /useAllHeroes\s*\(/.test(draftData) && !/useHeroes\s*\(/.test(draftData));
check("draft sem tamanho de lote fixo", !/\bLOT_SIZE\b|size\s*[:=]\s*\d|,\s*133\s*,/.test(draftData));

// 3. Nenhuma feature monta URL de `/v1` na mão (paginação vive no shared/api).
const featuresDir = path.join(root, "src/features");
const offenders = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && /\/v1\//.test(read(path.relative(root, full).replace(/\\/g, "/")))) {
      offenders.push(path.relative(root, full).replace(/\\/g, "/"));
    }
  }
})(featuresDir);
check("nenhuma feature com endpoint literal /v1/", offenders.length === 0, offenders.join(", "));

console.log(bad ? `GUARDIAN HERO LOT FAIL (${bad})` : "GUARDIAN HERO LOT OK");
process.exit(bad ? 1 : 0);
