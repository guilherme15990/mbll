# ADR-002 — Build de produção via esbuild + pin do rollup

Data: 2026-10-06 · Status: aceito · Fase 1

## Contexto
- `apps/web` usa Vite 5 (dev) + build de prod. `vite build` depende de rollup nativo.
- O release **rollup 4.64.0** publica binários `win32-x64-msvc/gnu` que o loader do
  Windows rejeita (`ERROR_BAD_EXE_FORMAT` 193), embora o PE declare x64 válido.
  Comprovado por `process.dlopen`: 4.64.0 falha (do npm cache limpo e reinstalado),
  4.24.0 carrega. Binário do release quebrado ou toolchain incompatível.
- A máquina tem **~4 GB RAM / ~0,3 GB livre**; o pico de memória do `vite build`
  (Vite + Rollup + sourcemaps do Recharts) estoura o heap e derruba o processo.
- O binário `esbuild.exe` 0.21.5 executa normalmente e o bundle precisa só de
  TSX/JS (sem CSS modules, sem plugins Vite além de React JSX).

## Decisão (L2)
1. Pinar `rollup` em `^4.24.0` nos devDeps do web (binário íntegro e verificado).
2. Build de produção verificado = `node build.mjs` (esbuild nativo, bundle ESM
   minificado + sourcemap + `dist/index.html` reescrito). `tsc --noEmit` antes.
3. `npm run build:vite` preservado para máquinas com mais RAM (paridade de dev).
4. Dev (`vite dev`) inalterado — usa esbuild internamente, sem rollup.

## Consequências
- `npm run build -w apps-web` verde em máquina de 4 GB.
- Sem HMR/plugins Vite no bundle de prod (não usados pelo app: só inline styles).
- Reavaliar quando rollup publicar binário win32 íntegro ou a RAM aumentar.
