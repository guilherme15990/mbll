// Build de produção via esbuild (binário nativo, ~30MB RAM) + Tailwind CLI.
// Motivo (ADR-002/003): `vite build` exige rollup nativo e estoura os 4GB de RAM.
// Dev continua em Vite (`npm run dev`); este script é o `build` verificado.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(root + "/package.json");
const esbuild = require("esbuild");

const outdir = join(root, "dist", "assets");
mkdirSync(outdir, { recursive: true });

// 1. Bundle JS (o esbuild também emite o CSS importado em app.css;
// o passo 2 sobrescreve com o Tailwind processado)
await esbuild.build({
  entryPoints: [join(root, "src", "main.tsx")],
  bundle: true,
  minify: true,
  sourcemap: true,
  format: "esm",
  target: ["chrome100", "firefox100", "safari15"],
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: join(outdir, "app.js"),
  logLevel: "info",
  loader: { ".js": "jsx" },
});

// 2. Tailwind -> dist/assets/app.css (usa postcss.config.cjs; sem --minify:
// o flag quebra silencioso neste ambiente e 24KB não-minificado é irrelevante)
// O CLI é resolvido pelo `require` do app: funciona com `node_modules` aninhado
// (bootstrap magro) e com tudo hoisted na raiz (`npm ci`).
execFileSync(process.execPath, [
  require.resolve("tailwindcss/lib/cli.js"),
  "-i", join(root, "src", "index.css"),
  "-o", join(outdir, "app.css"),
], { stdio: "inherit" });

const html = readFileSync(join(root, "index.html"), "utf8")
  .replace("</head>", '<link rel="stylesheet" href="/assets/app.css"></head>')
  .replace('<script type="module" src="/src/main.tsx"></script>', '<script type="module" src="/assets/app.js"></script>');
writeFileSync(join(root, "dist", "index.html"), html);
console.log("web dist ok");
