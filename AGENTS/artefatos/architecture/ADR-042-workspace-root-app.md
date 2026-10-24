# ADR-042 — Workspace root `apps/` → `app/` e pacotes `api`/`web`

- Data: 2026-10-24
- Status: aceita e implementada
- Escopo: raiz do repositório, `package.json`, `package-lock.json`, `tools/`,
  `app/api/src/infra/config.js` e 1 teste. Zero mudança de comportamento.

## Problema

O repositório tem **dois** apps, um motor e um deploy. `apps/` (plural) é o nome
canônico de monorepo com múltiplos produtos; aqui o produto é um só e `app/api` +
`app/web` são as duas metades dele. Além disso o prefixo aparecia duas vezes no
nome do pacote (`apps/api` → `apps-api`), o que produzia scripts como
`npm run dev -w apps-web` — três vezes a mesma palavra para dizer "a web".

## Decisão

1. `apps/` → **`app/`** (singular).
2. Pacotes `apps-api` → **`api`** e `apps-web` → **`web`**.
3. Scripts passam a usar `-w api` / `-w web`.

Mantido: `packages/*` (plural, correto — são vários) e o motor com o nome atual
(`@radar/proprietary-engine`, ver ADR-039).

## O que essa renomeação **não** é

Não é o começo da ADR-041. Só o nome da raiz foi adotado. `data/` continua
`data/`, ADRs continuam em `AGENTS/artefatos/architecture/`, `lib` e `shared`
continuam separados. A ADR-041 segue como proposta.

## O que quebrava (e foi corrigido)

Renomear pasta em monorepo npm não é `mv`: há quatro pontos funcionais, não
cosméticos.

| Arquivo | Ponto | Se ficar para trás |
|---|---|---|
| `app/api/src/infra/config.js:17` | `join(REPO_ROOT, "app", "web", "dist")` | API serve 404 em produção: `WEB_DIST` default apontaria para pasta inexistente |
| `app/api/test/config.test.js:43` | `/app[\\/]web[\\/]dist$/` | teste falha (ou passa mentindo, se o regex fosse frouxo) |
| `tools/check-boundaries.mjs:160` | `path.join(ROOT, "app")` | **falha silenciosa**: a regra "packages não importam app" varre um diretório inexistente e nunca acusa nada |
| `tools/tsc.mjs:17` | `searchPaths` | `check:api` não acha o `tsc` no layout lean |

Ainda: `tools/bootstrap-web.ps1`, `pin-rollup.ps1` e `fix-missing.ps1` tinham
`..\apps\web\node_modules` (o bootstrap magro quebrava), e o `package-lock.json`
precisava trocar `app/web/node_modules/*` (≈170 chaves) e o link
`node_modules/apps-web` → `node_modules/web`.

O `REPO_ROOT` **não** mudou: `app/api/src/infra` continua a 4 níveis da raiz.

## Execução

1. `Move-Item apps app` (move `node_modules` aninhado junto — `git mv` deixaria
   os diretórios ignorados para trás).
2. 25 arquivos com substituição ordenada (`apps-api`→`api` antes de `apps/`→`app/`).
3. `npm install --package-lock-only --offline` → lock reescrito preservando as
   versões resolvidas (sem o risco de re-resolve descrito na ADR-038).
4. O npm deixou dois blocos órfãos no lock (`"apps/api"` e `"apps/web"` marcados
   `extraneous: true`); removidos à mão. Lock validado com `JSON.parse`.
5. Junction morto `node_modules/apps-web` removido.

## Evidência

- `npm run check:boundaries` → `BOUNDARIES OK` (regra 3 agora aponta para `app`)
- `npm run verify` → **exit 0** (typecheck api + web, motor, API 124, web + 4 guardiões)
- `npm run build` → **exit 0**, `api-ok`, 31 chunks em `app/web/dist`

## Consequências

Positivas: `app/web` e `app/api` dizem o que são; `npm run dev:web -w web` para de
gaguejar; o caminho `app/web/src/app/` (shell) fica legível — raiz, app, shell.

Custos: um rename de raiz é o tipo de mudança que quebra clone antigo, script
local de alguém e bookmark de IDE. Vale a nota no README e a ADR; não vale
repetir por motivos estéticos.
