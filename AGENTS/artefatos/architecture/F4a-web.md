# F4a — Web modular e resiliente

- Data: 2026-10-24
- Status: concluída (F0–F4a do plano da ADR-033)
- Pré-requisito: ADR-033 (F3), ADR-034, ADR-035
- Decisão: ADR-036

## 1. Problema

A web funcionava, mas tinha quatro dívidas estruturais e uma de resiliência:

| Sintoma | Evidência (antes) |
|---|---|
| Ciclo de importação | `useFilters` em `App.tsx`; 11 páginas com `import { useFilters } from "../App"` |
| Formatação duplicada | `signed` reimplementado em 4 arquivos, `pp`/`fmt`/`fmtLift`/`fmtDelta` em mais 6 |
| Tela branca em erro de render | nenhum `getDerivedStateFromError`/`componentDidCatch` no app |
| Bundle único | entry de **984,62 kB** (266,62 kB gzip), 1 JS |
| Código morto | `pages/.old/` (6 telas), `DddModal.tsx`, `idd/ExportEvidence.tsx`, `hero/heroSeal.ts` sem importador |

## 2. Decisão (resumo)

`app/filters.ts` é dono do filtro global (mata o ciclo); `shared/format.ts` é dono
de `pct/num/signed/pp/ago` (`lib/api.ts` reexporta por compatibilidade); as 12
rotas são `React.lazy` sob um `<Suspense>` com fallback acessível; `ErrorBoundary`
na raiz e por rota (`key=pathname`); 9 arquivos mortos removidos; guardian estático
com 20 checks. Detalhes e alternativas na ADR-036.

## 3. Arquivos

Novos:

```
apps/web/src/app/filters.ts              useFilters + filtersQuery
apps/web/src/app/ErrorBoundary.tsx       limite de erro (retry/reload/início)
apps/web/src/shared/format.ts            pct/num/signed/pp/ago (fonte única)
apps/web/test/guardian-f4a.mjs           20 invariantes estáticas
```

Alterados (principais):

```
apps/web/src/App.tsx                     12 lazy + Suspense + boundary por rota; sem useFilters
apps/web/src/main.tsx                    ErrorBoundary na raiz
apps/web/src/lib/api.ts                  reexporta { ago, num, pct }; sem definição local
apps/web/src/lib/combiner.ts             import "../shared/format.ts" (type-stripping)
apps/web/src/pages/{Dashboard,Herois,Forca,Confianca,Ranks,Tempo,
  Confrontos,Draft,Blind,Builds,Exposicao}.tsx   import de "../app/filters"
apps/web/src/components/dashboard/BuildsTab.tsx  signed no lugar de fmtLift/signed
apps/web/src/components/idd/SigmaBanCard.tsx     num no lugar de fmt local
apps/web/src/pages/hero/sections/{BuildsSection,matchupAtoms}.tsx
apps/web/src/pages/panels/{BuildsPowerPanel,BuildsCombinerPanel,
  BuildsAggregatePanel}.tsx              remoção de signed/pp locais
apps/web/test/smoke.mjs                  exige app/ e shared/; proíbe .old
apps/web/package.json                    "test" inclui guardian-f4a.mjs
apps/web/tsconfig.json                   allowImportingTsExtensions
```

Removidos:

```
apps/web/src/pages/.old/{Gems,HeroDetail,Method,Modules,Panorama,Views}.tsx
apps/web/src/components/DddModal.tsx
apps/web/src/components/idd/ExportEvidence.tsx
apps/web/src/pages/hero/heroSeal.ts
```

Diff rastreado: **34 arquivos, +122/−1052** (não conta os 4 novos).

## 4. Detalhes que importam

### 4.1 Filtro global

- `useFilters()` lê `rank` (default `mythic`), `window` (default `7`) e `hero`
  (default vazio) da URL.
- `set(k, v)` **copia** o `URLSearchParams` antes de mutar e usa `replace: true`.
- `filtersQuery({rank, window, hero})` monta a query de `/dashboard`,
  `/hero?...` etc. em um lugar só.
- `App.tsx` não exporta mais `useFilters`; nenhuma página importa `../App`.

### 4.2 Formatação

| Dono | Antes | Depois |
|---|---|---|
| `pct`, `num`, `ago` | `lib/api.ts` | `shared/format.ts` (reexportados por `api.ts`) |
| `signed` | 4 cópias (`BuildsTab`, `BuildsSection`, `BuildsPowerPanel`, `BuildsCombinerPanel`) | `shared/format.ts` |
| `pp` | 2 cópias (`BuildsAggregatePanel`, `combiner.ts`) | `shared/format.ts` |
| `fmt`/`fmtLift`/`fmtDelta` | locais | `num`/`signed` compartilhados |

Contrato preservado: valor ausente/não finito → `"—"`, nunca `0`. `dir`, `dirWord`
e `cx` continuam em `lib/api.ts` (não são formatação numérica).

### 4.3 Rotas e boundary

- 12 `lazy()` (11 telas + `HeroDetails`), um chunk por página.
- `HeroDetails` declarado uma vez para `/hero/:id`, `/hero/detalhes` e `/heroi`.
- `RouteFallback`: `role="status"`, `aria-live="polite"`, `data-testid="route-loading"`.
- `ErrorBoundary` raiz em `main.tsx`; boundary de rota dentro de `<main>` com
  `key={location.pathname}`. A UI mostra a mensagem (sem stack), loga `ui_error`
  no console e oferece tentar de novo / recarregar / ir ao início.

### 4.4 Ajuste de TypeScript/Node

O teste `combiner.test.mjs` roda com type-stripping (Node 24) e importa
`../src/lib/combiner.ts`; import de valor sem extensão falha com
`ERR_MODULE_NOT_FOUND`. Solução: `import { signed } from "../shared/format.ts"` no
`combiner.ts` + `allowImportingTsExtensions: true` no `tsconfig` (válido porque o
projeto é `noEmit`).

### 4.5 Guardian F4a (20 checks)

1. `useFilters` fora do App; `filters.ts` existe.
2. Páginas não importam `App`; importam `app/filters`.
3. ≥10 rotas lazy (hoje 12); Suspense com fallback e testid.
4. Boundary na rota (com `key=`) e na raiz; captura via `getDerivedStateFromError`
   + `componentDidCatch`; retry e reload presentes.
5. `shared/format` exporta `pct/num/ago/signed/pp`; `api.ts` reexporta e não
   redefine; nenhum `function signed(` local.
6. Os 4 caminhos de código morto não existem.

## 5. Evidência (depois)

Comandos executados na raiz do repo:

```
npm run typecheck -w apps-web
npm test -w apps-web
node --test ./test/itemsets.test.mjs ./test/combiner.test.mjs   # em apps/web
npm test -w apps-api
npm test -w packages/proprietary-engine
npm run build:fast -w apps-web
npm run build
node <tmp>/f2-runtime-smoke.mjs                                  # DATA_DIR em tmp
node <tmp>/unused-web.mjs                                        # alcançabilidade
```

Resultados:

| Verificação | Resultado |
|---|---|
| Typecheck web | exit **0** |
| Web (`npm test -w apps-web`) | smoke OK; `GUARDIAN BUILDS OK`; `GUARDIAN CONFRONTOS OK`; **`GUARDIAN F4A OK` (20/20)** |
| Itemsets + combiner | **24/24**, 6 suítes, 0 falhas |
| API | **123/123**, 31 suítes, 0 falhas |
| Motor | **219/219**, 42 suítes, 0 falhas |
| `build:fast` | OK (esbuild, 1022,7 kB single-file — caminho alternativo) |
| `build` (Vite) | OK; 30 assets JS |
| Entry | **289,76 kB** (gzip 88,32) — antes 984,62 kB (gzip 266,62) |
| Maiores chunks | `charts` 411,0 kB; `Builds` 82,8 kB; `HeroDetails` 73,8 kB |
| Runtime smoke | health/modules/404/estático/ETag/304/429 OK; `shutdown_done ... "dbClosed":true`, exit 0 |
| Arquivos sem importador | **0** (56 arquivos; antes 9 de 62) |

## 6. Riscos e pendências

1. **Chunk por rota no primeiro acesso**: HTTP/1.1, sem `prefetch`. Se o custo de
   navegação incomodar, adicionar `modulepreload`/prefetch das rotas do menu.
2. **Fallback genérico**: não replica o esqueleto de cada tela; layout shift
   pequeno na primeira visita.
3. **`lib/api.ts` ainda concentra dados + `cx`/`dir`/`dirWord` + reexports**:
   separar em `shared/` é F4b/F5.
4. **F4b (features por contexto) não foi feita**: `pages/` continua sendo depósito
   (panels, hero/sections). A ADR-033 marca F4b como opcional; a F4a entrega os
   ganhos verificáveis sem misturar reorg.
5. **Bancos órfãos** (~15 MB) continuam no disco aguardando limpeza manual
   (decisão do usuário; ver F3 §7).
6. **`build:fast`** continua gerando bundle único (1022,7 kB): é o caminho de
   contingência para a máquina de 4 GB, não o build de produção.
