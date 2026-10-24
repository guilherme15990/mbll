import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const must = ["src/main.tsx", "src/App.tsx", "src/pages/Forca.tsx", "src/pages/Confianca.tsx", "src/pages/Ranks.tsx", "src/pages/Tempo.tsx", "src/pages/Confrontos.tsx", "src/pages/Draft.tsx", "src/pages/Blind.tsx", "src/pages/Builds.tsx", "src/pages/Exposicao.tsx", "src/components/HeroPicker.tsx", "src/pages/.old/Panorama.tsx", "src/pages/.old/HeroDetail.tsx", "src/pages/.old/Views.tsx", "src/pages/.old/Gems.tsx", "src/pages/.old/Method.tsx", "package.json", "vite.config.ts", "index.html"];
let bad = 0;
for (const f of must) if (!fs.existsSync(path.join(root, f))) { console.error("falta " + f); bad++; }
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json")));
for (const d of ["react", "recharts", "lucide-react", "@tanstack/react-query", "react-router-dom"]) {
  if (!pkg.dependencies[d]) { console.error("sem dep " + d); bad++; }
}
console.log(bad ? `SMOKE FAIL (${bad})` : "SMOKE OK");
process.exit(bad ? 1 : 0);
