# F5 — Portão de qualidade (evidência de execução)

- Data: 2026-10-24
- Status: concluída (F5 da ADR-033)
- Pré-requisito: ADRs 033, 034 (F2), 035 (F3), 036 (F4a), 037 (F4b)
- Decisão: ADR-038
- Natureza da mudança: **infraestrutura de verificação**. Nenhuma regra de
  negócio, contrato público de endpoint ou comportamento de tela foi alterado.

## 1. O que passou a ser verificado

| # | Gate | Comando | Falha quando |
|---|---|---|---|
| 1 | Direção de dependência + contrato do motor | `npm run check:boundaries` | import escapa de app/pacote, feature importa feature, import sem declaração no `d.ts`, declaração sem runtime |
| 2 | Tipos da API (`checkJs`) | `npm run check:api` | qualquer erro de tipo em `apps/api/src/**/*.js` |
| 3 | Tipos da web | `npm run check:web` | `tsc --noEmit` não passa |
| 4 | Comportamento | `npm test` | motor, API (124) ou web falham |
| 5 | Cobertura da API | `npm run test:coverage` | linhas < 90, branches < 60, funções < 85 (escopo `apps/api/src`) |
| 6 | Tudo junto | `npm run verify` | 1–4 falham |

CI (`.github/workflows/ci.yml`) roda 1→4, depois 5 e o build, em Node 24.

## 2. Baseline e resultado

### 2.1 `checkJs` na API

| Momento | Erros |
|---|---|
| Primeira execução com `checkJs: true` | **62** |
| Antes dos ajustes de tipo no `.d.ts` do motor | 62 (20 nomes importados não declarados) |
| **Final** | **0** |

Distribuição inicial por arquivo (top): `buildsAggregate` 10, `rankLot` 9,
`server` 7, `heroDetails` 7, `snapshotHistory` 6, `matchups` 5, `heroes` 4,
`builds` 3, `meta` 2, `router` 2, `rateLimit` 2, `snapshots` 2, `db` 1,
`static` 1.

As correções foram todas no ponto frouxo, sem `any` global nem `@ts-ignore`:

- `@radar/proprietary-engine/src/index.d.ts`: os 20 exports importados pela API +
  primitivas da mesma família + tipos de retorno (ver §3.1).
- JSDoc onde o parâmetro era inferido como `{}`: `lastVerifiedPosterior`,
  `listSnapshots`, `getSnapshot`, `createRateLimiter`, `serveStatic`,
  `ApiServerOptions`, `startServer`.
- Casts pontuais e justificados: `NodeJS.ErrnoException` no listener de `error`,
  `server.address()` (união `string | AddressInfo | null`), `typeof import("node:sqlite")`
  no import opcional, `(string | number)[]` nos args de `getSnapshot`,
  `Promise<any>` na cadeia de serialização do agregado.
- `args` mortos removidos em `router.js` (`heroCatalogRoute()` /
  `equipmentRoute()` não recebem `sp`).

### 2.2 Fronteiras

```
PASS engine: todo import tem contrato no index.d.ts — 239 nomes declarados, 43 imports
PASS engine: toda declaração de valor existe no runtime — 164 valores declarados
PASS engine: sem import do interior nem do workspace removido
PASS apps: nenhum import relativo escapa da app
PASS packages: não importam apps
PASS web: features não importam outras features
PASS web: app|shared|lib não importam features
PASS web: lib → shared só via shared/format
PASS web: só App.tsx carrega features — App.tsx
PASS web: sem src/pages e src/components
BOUNDARIES OK
```

A regra nova (**declaração → runtime**) existe porque o `index.d.ts` sombreia o
`index.js`: um `export declare const` sem export real só aparece como `undefined`
em runtime. Ela nasceu já mordendo — acusou 3 constantes declaradas e não
reexportadas (`EMBLEM_MIN_CONTEXTS`, `EMBLEM_MIN_BUILDS`, `EMBLEMS_MAX_ROWS`),
corrigidas no barrel do motor.

**Validação negativa** (3 probes temporários, removidos depois — um gate que nunca
falhou não é evidência):

| Probe | Regra acionada | Resultado |
|---|---|---|
| `import { median } from "../../../../packages/proprietary-engine/src/index.js"` em `apps/api/src/application/` | apps não escapam | FAIL, apontando arquivo e spec |
| `import { nope } from "@radar/proprietary-engine"` | contrato do motor | FAIL: `importa "nope" (sem declaração no index.d.ts)` |
| `import { Avatar } from "../shared/ui"` em `apps/web/src/lib/` | `lib → shared` | FAIL: `lib só pode usar shared/format` |

### 2.3 Cobertura da API

Escopo `apps/api/src` (`--test-coverage-exclude=**/packages/**` e `**/test/**`):

```
ℹ all files | 93.70 | 65.75 | 89.27 |
```

| Métrica | Medido | Threshold |
|---|---|---|
| Linhas | **93,70%** | 90 |
| Branches | **65,75–65,82%** | 60 |
| Funções | **89,27%** | 85 |

Exit **0**. Sem os excludes, o relatório misturava o motor (219 testes próprios) e
os próprios arquivos de teste — número bonito e inútil.

A variação de branches (0,07 pp) é ordem de execução entre arquivos de teste, não
código novo; linhas e funções são estáveis. No caminho de `cacheStore` que variava
mais (JSON corrompido = miss) foi adicionado um caso explícito em `db.test.js`:
antes ele só era coberto por acidente de ordem, agora sempre. Foi o único teste
novo da F5 — 123 → 124.

### 2.4 Suítes

| Suíte | Resultado |
|---|---|
| Motor (`node:test`) | **219/219**, 0 falhas |
| API (`node:test`) | **124/124**, 0 falhas |
| Web (`smoke` + itemsets + combiner + 4 guardians) | **24/24**, 0 falhas |

Guardians da web na mesma execução: `SMOKE OK`, `GUARDIAN OK`,
`GUARDIAN CONFRONTOS OK`, `GUARDIAN F4A OK`, `GUARDIAN F4B OK`.

### 2.5 Build e runtime

```
npm run build
proprietary-ok
api-ok
dist/assets/index-*.css   49,06 kB │ gzip   8,97 kB
dist/assets/index-*.js   289,76 kB │ gzip  88,32 kB
30 chunks
```

Runtime smoke (processo real, `DATA_DIR` em tmp):

| Verificação | Resultado |
|---|---|
| `GET /health` | 200, `ok`, `no-store` |
| `GET /v1/modules` | 200, `x-request-id` ecoado, 9 módulos |
| `GET /v1/nao-existe` | 404 JSON |
| `GET /` | HTML `no-cache`, sem charset errado |
| `GET /assets/index-*.js` | 200 + `immutable` |
| `GET` com `If-None-Match` | 304 sem corpo |
| Rajada acima do limite | 429 com `retry-after` + `x-ratelimit-*` + request-id |
| `SIGINT` | `shutdown_done ... "dbClosed":true`, exit 0 |

O build saiu com os **mesmos tamanhos** da F4b: a F5 não mudou o grafo de execução,
só o verificador. O entry segue 289,76 kB em 30 chunks.

## 3. Mudanças estruturais (não comportamentais)

### 3.1 Contrato do motor

`packages/proprietary-engine/src/index.d.ts` sombreia `index.js` para qualquer
consumidor TypeScript. Estava escrito só para a web; a API consome 20 nomes que
não estavam lá. Foram adicionados:

`median`, `checkPickSum`, `summarizeWalkPosterior`, `isValidWalkPrior`,
`walkPriorStamp`, `requireLane`, `LANES`, `C_REFERENCE`, `buildLift`,
`buildReferences`, `confidenceTrio`, `rankDifference`, `temporalDelta`,
`assessSeries`, `distortionResidual`, `durationCurve`, `classifyDuration`,
`makePairKey`, `evidenceQuality`, `blindProxy`, `STRENGTH_INDEX_VERSION` — mais
`mean`, `medianNull`, `mad`, `quantile`, `DELTA_DEFAULT`, `DURATION_BANDS`,
`WF_VERSION_BREAK_VARIANCE_FACTOR` e as interfaces de retorno.

Três ajustes de tipo vieram do comportamento real do motor (documentados na
ADR-038): `HeroScore` tem índice `any` porque o motor **ecoa** o input;
`buildAggregate` devolve documento dinâmico (`context`/`sources` são escritos na
borda); `requireLane` devolve união discriminada por literal booleano.

O gate exige declaração para todo nome **importado**, não para os 204 exports do
runtime. Declarar assinatura que ninguém usa é drift garantido.

### 3.2 Imports do motor

14 imports (9 em `src`, 5 em `test`, incluindo `await import(...)`) trocaram
`"../../../../packages/proprietary-engine/src/index.js"` por
`"@radar/proprietary-engine"`. `apps/api/package.json` declara a dependência de
workspace (`file:../../packages/proprietary-engine`). Zero imports relativos
atravessando a árvore.

Lockfile: 177 entradas antes e depois, mesmo layout, apenas os metadados de
`apps/api` e a remoção de um pacote `extraneous` (`@napi-rs/lzma-linux-x64-gnu`).

### 3.3 Ferramentas novas

| Arquivo | Papel |
|---|---|
| `tools/check-boundaries.mjs` | 9 regras, ~200 linhas, zero dependências |
| `tools/tsc.mjs` | resolve `typescript` nos dois layouts de install e executa o `bin/tsc` |
| `apps/api/jsconfig.json` | `allowJs` + `checkJs`, `strict: false`, escopo `src/**/*.js` |
| `.github/workflows/ci.yml` | os mesmos gates em Node 24, com `concurrency` |

`tsc` continua sendo devDependency de `apps/web` (a web já o usa). Nenhum script
fixa caminho de `node_modules`.

### 3.4 Scripts

Raiz: `check:boundaries`, `check:api`, `check:web`, `test:coverage` e
`verify` (boundaries → typechecks → testes). `apps-api`: `typecheck` e
`test:coverage`. Os comandos antigos não mudaram.

### 3.5 Lockfile multiplataforma (achado da revisão)

O lockfile tinha **só** os binários nativos do Windows
(`@rollup/rollup-win32-x64-msvc`, `@esbuild/win32-x64`) — consequência do
bootstrap magro, que baixa via `curl`+`tar` o que a máquina usa. Como o rollup 4 e
o esbuild resolvem o binding nativo em runtime, `npm ci` + `vite build` num runner
Ubuntu falharia com `Cannot find module @rollup/rollup-linux-x64-gnu`: todo gate
verde no Windows e o CI vermelho no passo de build.

Correção: as 36 variantes que faltavam (rollup e esbuild) entraram no lock com
`resolved`/`integrity` do registry, **sem** regenerar o arquivo — regenerar
resolveria as ranges de novo (rollup 4.24 → 4.65, postcss-load-config 4 → 6) e
mudaria o layout. As duas entradas win32 que o bootstrap registrou sem integridade
foram corrigidas também, e `fsevents` (opcional do rollup em macOS) entrou para
fechar o último buraco. 177 → 215 entradas, versões existentes intactas.

Validação: `npm ci --dry-run` (Windows), `--os=linux --cpu=x64 --libc=glibc` e
`--os=darwin --cpu=arm64` — todos exit 0, sem aviso de lock dessincronizado.

### 3.6 Scripts agnósticos de layout

O lockfile do bootstrap é **aninhado** (`apps/web/node_modules/*`); um `npm ci`
normal **hoisted** põe tudo na raiz. Scripts que fixavam
`node node_modules/vite/bin/vite.js` só funcionavam no layout aninhado.

- `apps/web`: `dev`/`build`/`preview`/`typecheck` usam `vite` e `tsc` pelo nome —
  o npm injeta o `.bin` do workspace e da raiz no `PATH`. Resolve nos dois layouts.
- `apps/web/build.mjs`: o CLI do Tailwind passou de caminho fixo para
  `require.resolve("tailwindcss/lib/cli.js")`.
- `tools/tsc.mjs` já procurava o compilador nos dois layouts.

O build continua **idêntico**: mesmos hashes, 289,76 kB, 30 chunks.

## 4. Desvios registrados

1. **`strict: false` no `checkJs`.** `strictNullChecks` habilitado abre **67**
   erros (26 além dos 41 já corrigidos), majoritariamente retornos `| null` que o
   fio já trata. Fica para fase própria. Efeito colateral: com
   `strictNullChecks: false`, `if (!chk.ok)` **não** estreita
   `{ok:true}|{ok:false}` — os 2 call sites de `requireLane` usam
   `if (chk.ok === false)`, comentado no código.
2. **Tabela de dependências da ADR-033 não implementada como escrita.** Ela previa
   `routes ↛ infra`, `application ↛ infra` (injeção no composition root) e um
   `packages/contracts` de tipos. O código consolidado em F1–F3 importa `infra`
   direto e o contrato ficou no `.d.ts` do motor. O gate verifica os invariantes
   que **existem** hoje; inverter a injeção e criar o pacote de contratos seguem
   como trabalho possível — não como dívida escondida.
3. **`typescript` fora da API.** Declará-lo em `apps/api` duplicaria o compilador
   no workspace e mexeria no layout do lockfile; `tools/tsc.mjs` resolve o
   existente.
4. **`checkJs` cobre `src`, não `test`.** Incluir `apps/api/test/**` abre 15 erros,
   todos de infraestrutura de teste (stub de `fetch` tipado como `typeof fetch`,
   `assert` do `node:test` com `strict: false`, `server.address()`). Ampliar o
   escopo exige tipar os fakes — trabalho próprio; o comportamento dos testes já é
   verificado por `npm test`.

## 5. Como reproduzir

```powershell
npm ci
npm run check:boundaries
npm run check:api
npm run check:web
npm test
npm run test:coverage
npm run build
```

Ou, para 1–4 de uma vez: `npm run verify` (exit 0).

## 6. Pendências naturais (fora da F5)

1. `strictNullChecks` na API (67 erros, fase própria).
2. Injeção de `infra` no composition root + eventual `packages/contracts`, se a
   fronteira passar a doer.
3. `checkJs` nos testes da API (15 erros de fake, ver §4.4).
4. Bancos SQLite órfãos fora de `DATA_DIR`: os 3 de `apps/web/data`,
   `apps/api/data` e `apps/api/src/data` (~15 MB) foram removidos; sobrou só
   `data/cache.sqlite`, que é o atual. Cache se reconstrói no próximo fetch.
