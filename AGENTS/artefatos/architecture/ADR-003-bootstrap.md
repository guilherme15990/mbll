# ADR-003 — Sobreviver com 4 GB RAM (bootstrap sem npm + backend zero-dep)

Data: 2026-10-06 · Status: aceito · Fase 1

## Contexto
Máquina com 3,9 GB RAM / 0,3–0,5 GB livre. Efeitos observados:
- `npm install` (workspace) morre com OOM na resolução; `pnpm install` idem.
- `vite build` morre com OOM (pico Vite+Rollup+sourcemaps do Recharts).
- Binários `@rollup/rollup-win32-x64-{msvc,gnu}@4.64.0` rejeitados pelo loader
  (erro 193) mesmo com PE x64 válido e após limpar o cache; 4.24.0 carrega
  (`process.dlopen` comprova). Release com binário quebrado ou toolchain incompatível.

## Decisão (L2)
1. **Backend zero dependências** (`apps/api`): trocado Express+Zod+CORS por
   `node:http` + validação manual + `node:sqlite`. Nada para instalar no backend.
2. **Bootstrap magro do web** (`tools/bootstrap-web.ps1`): resolve ranges
   (^ ~ exact `1 - 2`) via registry REST + curl.exe + tar.exe, extrai flat em
   `apps/web/node_modules`. Sem npm, <20 MB RAM. Inclui @types/* para o tsc.
3. **Build de prod via esbuild** (`apps/web/build.mjs`, ADR-002) + `rollup` pinado
   em `^4.24.0` (só para `vite dev` em máquinas normais).
4. Workspace npm/pnpm restaurado (`package.json` + `pnpm-workspace.yaml`): em
   máquina com RAM livre, `npm install` funciona normalmente e reconcilia os
   `node_modules` aninhados do bootstrap.
   → **Atualizado em 2026-10-27**: gerenciador único é npm. `pnpm-workspace.yaml`
   removido (ADR-034, dívida 4); `packageManager: npm@11.12.1` no `package.json`
   raiz e gate que falha se um segundo manifesto reaparecer.

## Consequências
- Verdes nesta máquina: engine 14/14, api 3/3 + smoke ao vivo 200/133,
  web tsc limpo + bundle esbuild 624 KB + smoke OK.
- `npm install` completo continua sendo o caminho oficial (README); o bootstrap
  é fallback documentado, não o padrão.
- **Instalação interrompida deixa entulho em `node_modules` de workspace.**
  Quando o `npm install` morre no meio (o caso desta máquina), sobram pastas de
  escopo vazias e diretórios de staging `<scope>/.<pkg>-<hash>` contendo o binário
  de plataforma: o npm só renomeia para o nome final quando conclui. Em 2026-10-27
  `app/web/node_modules` tinha 14 pastas, **11 vazias**, e `app/api/node_modules`
  um `@types` vazio — 24 MB sem um único pacote resolvível. Não é segunda
  instalação nem conflito de versão; é rastro de falha. Se um processo estiver
  rodando a partir dali (`vite` → `esbuild.exe`), o arquivo fica travado e só
  remove após encerrar o processo.
