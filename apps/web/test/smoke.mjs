import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const must = [
  "src/main.tsx",
  "src/App.tsx",
  "src/app/filters.ts",
  "src/app/ErrorBoundary.tsx",
  "src/app/Sidebar.tsx",
  "src/app/IddModal.tsx",
  "src/shared/format.ts",
  "src/shared/ui.tsx",
  "src/shared/charts.tsx",
  "src/shared/HeroPicker.tsx",
  "src/shared/HeroDossier.tsx",
  "src/shared/heroPanel.ts",
  "src/shared/idd.tsx",
  "src/shared/idd/SigmaBanCard.tsx",
  "src/features/dashboard/Dashboard.tsx",
  "src/features/dashboard/BuildsTab.tsx",
  "src/features/heroes/Herois.tsx",
  "src/features/hero/HeroDetails.tsx",
  "src/features/forca/Forca.tsx",
  "src/features/confianca/Confianca.tsx",
  "src/features/ranks/Ranks.tsx",
  "src/features/tempo/Tempo.tsx",
  "src/features/confrontos/Confrontos.tsx",
  "src/features/draft/Draft.tsx",
  "src/features/blind/Blind.tsx",
  "src/features/builds/Builds.tsx",
  "src/features/exposicao/Exposicao.tsx",
  "package.json",
  "vite.config.ts",
  "index.html",
];
let bad = 0;
for (const f of must) if (!fs.existsSync(path.join(root, f))) { console.error("falta " + f); bad++; }
// F4b: a árvore é feature-first; `pages/` e `components/` não podem voltar.
for (const dead of ["src/pages", "src/components"]) {
  if (fs.existsSync(path.join(root, dead))) { console.error("estrutura antiga: " + dead); bad++; }
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json")));
for (const d of ["react", "recharts", "lucide-react", "@tanstack/react-query", "react-router-dom"]) {
  if (!pkg.dependencies[d]) { console.error("sem dep " + d); bad++; }
}
console.log(bad ? `SMOKE FAIL (${bad})` : "SMOKE OK");
process.exit(bad ? 1 : 0);
