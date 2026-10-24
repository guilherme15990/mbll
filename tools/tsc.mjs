// Resolvedor do TypeScript para os workspaces.
//
// O repo tem UMA instalação de `typescript` (devDependency de `apps/web`), e a
// posição física depende de como o npm instalou: no install "lean" ela fica em
// `apps/web/node_modules`; num install normal pode ser hoisted para a raiz.
// Em vez de fixar um caminho (que quebra no outro layout), este runner procura
// o pacote nos lugares possíveis e executa o `bin/tsc` real.
//
// Uso: node tools/tsc.mjs -p apps/api/jsconfig.json
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const req = createRequire(import.meta.url);
const searchPaths = [root, path.join(root, "apps/web"), path.join(root, "apps/api")];

let main = null;
for (const p of searchPaths) {
  try {
    main = req.resolve("typescript", { paths: [p] });
    break;
  } catch {
    /* tenta o próximo layout */
  }
}

if (!main) {
  console.error(
    "typescript não encontrado (procurei em " +
      searchPaths.map((p) => path.relative(root, p) || ".").join(", ") +
      "). Rode `npm install` ou o bootstrap de `tools/bootstrap-web.ps1`.",
  );
  process.exit(1);
}

// main = .../typescript/lib/typescript.js → .../typescript/bin/tsc
const bin = path.join(path.dirname(main), "..", "bin", "tsc");
const res = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(res.status ?? 1);
