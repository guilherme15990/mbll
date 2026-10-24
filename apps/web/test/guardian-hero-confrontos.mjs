import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Guardião estático (sem rede): prévia de Confrontos da visão geral.
// P0: sem elo = sem fetch; erro com retry fora de <Link>; δ em 3 casas;
// átomos compartilhados (sem tone map duplicado) e copy sem causalidade.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const strip = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^\S\n])\/\/[^\n]*$/gm, "$1");

const hero = strip(read("src/pages/hero/HeroDetails.tsx"));
const preview = strip(read("src/pages/hero/sections/ConfrontosPreview.tsx"));
const section = strip(read("src/pages/hero/sections/ConfrontosSection.tsx"));
const atoms = strip(read("src/pages/hero/sections/matchupAtoms.tsx"));
const api = read("src/lib/api.ts");

let bad = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) bad++;
};

// 1 — a capa monta a prévia e não duplica a busca de matchups.
check("prévia montada na visão geral", /<ConfrontosPreview\b/.test(hero));
check("HeroDetails sem mQuery paralela", !/mQuery/.test(hero));
check("prévia usa useMatchups 1x", (preview.match(/useMatchups\(/g) ?? []).length === 1);
check("rank=all não dispara matchup", /needsRank\s*\?\s*null\s*:\s*heroId/.test(preview));
check("gate de elo com CAP-M6-01", /preview-needs-rank/.test(preview) && /CAP-M6-01/.test(preview));
check("mesma key do hook (api única)", /\["matchups",\s*id,\s*rank,\s*days\]/.test(api));

// 2 — honestidade e copy sem antropomorfismo/causalidade.
check("sem Teme/ama na capa", !/Teme|·\s*ama/.test(hero));
check("capa declara associação, não probabilidade", /n.o probabilidade/.test(preview));
check("par ausente nunca vira 0", /nunca 0/.test(preview));
check("δ do par em 3 casas (sem 4 casas)", !/num\([^)]*delta[^)]*,\s*4\)/.test(hero + preview));

// 3 — átomos compartilhados, sem tone map/DeltaChip duplicados.
check("atoms exporta MatchupPairRow", /export function MatchupPairRow/.test(atoms));
check("atoms exporta MatchupDeltaChip", /export function MatchupDeltaChip/.test(atoms));
check("seção reusa átomos", /from "\.\/matchupAtoms"/.test(section) && /MatchupPairRow/.test(section));
check("seção sem tone map local", !/const TONE_TEXT\s*:/.test(section) && !/function DeltaChip\b/.test(section));

// 4 — semântica: raiz é <section>; retry acionável fora de <a>.
check("prévia enraizada em <section>", /return \(\s*<section[\s\S]{0,400}data-testid="hero-confrontos-preview"/.test(preview));
check("erro com button + q.refetch", /role="alert"[\s\S]{0,900}<button[\s\S]{0,300}q\.refetch\(\)/.test(preview));

// 5 — grupos da aba ordenados por δ (asc para risco, desc para favor).
check("grupos ordenados por δ", /sortPairsByDeltaAsc\(m\.countersDown/.test(section));
check("grupos a favor em δ desc", /sortPairsByDeltaDesc\(m\.synergiesUp/.test(section) && /sortPairsByDeltaDesc\(m\.countersUp/.test(section));

console.log(bad ? `GUARDIAN CONFRONTOS FAIL (${bad})` : "GUARDIAN CONFRONTOS OK");
process.exit(bad ? 1 : 0);
