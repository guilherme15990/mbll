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
  "src/shared/format.ts",
  "src/shared/ui/index.tsx",
  "src/shared/ui/primitives/Avatar.tsx",
  "src/shared/ui/primitives/ErrBox.tsx",
  "src/shared/ui/patterns/charts.tsx",
  "src/shared/ui/patterns/HeroPicker.tsx",
  "src/shared/ui/patterns/HeroDossier.tsx",
  "src/shared/ui/patterns/heroPanel.ts",
  "src/shared/ui/patterns/PrimaryAction.tsx",
  "src/shared/ui/patterns/SigmaBanCard.tsx",
  "src/shared/ui/patterns/NeedsRankLane.tsx",
  "src/features/dashboard/Dashboard.tsx",
  "src/features/dashboard/BuildsTab.tsx",
  "src/features/hero-list/HeroList.tsx",
  "src/features/hero-detail/HeroDetail.tsx",
  "src/features/strength/Strength.tsx",
  "src/features/confidence/Confidence.tsx",
  "src/features/ranks/Ranks.tsx",
  "src/features/temporal/Temporal.tsx",
  "src/features/matchups/Matchups.tsx",
  "src/features/draft/Draft.tsx",
  "src/features/blind/Blind.tsx",
  "src/features/builds/Builds.tsx",
  "src/features/build-manager/BuildManager.tsx",
  "src/shared/domain/buildManager.ts",
  "src/features/exposure/Exposure.tsx",
  "package.json",
  "vite.config.ts",
  "index.html",
];
let bad = 0;
for (const f of must) if (!fs.existsSync(path.join(root, f))) { console.error("falta " + f); bad++; }
// F4b: a árvore é feature-first; `pages/` e `components/` não podem voltar.
for (const dead of ["src/pages", "src/components", "src/shared/idd"]) {
  if (fs.existsSync(path.join(root, dead))) { console.error("estrutura antiga: " + dead); bad++; }
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json")));
for (const d of ["react", "recharts", "lucide-react", "@tanstack/react-query", "react-router-dom"]) {
  if (!pkg.dependencies[d]) { console.error("sem dep " + d); bad++; }
}
console.log(bad ? `SMOKE FAIL (${bad})` : "SMOKE OK");
process.exit(bad ? 1 : 0);
