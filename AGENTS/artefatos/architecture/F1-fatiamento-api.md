# F1 — Fatiamento da API: `routes.js` → `http/` + `routes/` + `application/`

- Data: 2026-10-24
- Status: concluída (F0 e F1 do plano da ADR-033)
- Pré-requisito: ADR-032 (diagnóstico + rede de segurança), ADR-033 (arquitetura-alvo)

## 1. Problema

`apps/api/src/routes.js` tinha **1066 linhas** e concentrava 20 endpoints dentro de
uma única `router()` de 575 linhas. Três consequências medidas:

1. **Auto-recursão**: handlers internos (`catalog`, `equipment`, `blind`) chamavam
   `router("/catalog")` / `router("/heroes/:id/matchups")` por dentro, criando
   reentrada no dispatcher e dificultando teste isolado.
2. **Validação duplicada**: o par `rank/window` era validado 12× com blocos
   copiados; `days` tinha três regras diferentes (janela fechada em matchups/blind,
   1..90 em trends).
3. **Baixa testabilidade**: 14 dos 20 endpoints não tinham teste direto; cobertura
   de `apps/api/src` em **47,32%** de linhas.

## 2. Decisão

Fatiar em **rotas verticais por contexto** + **camada de aplicação sem HTTP**,
mantendo `routes.js` como **shim de reexportação** (nenhuma lógica). Regra da fase:
**mover, não melhorar** — qualquer mudança de comportamento ficaria para F2/F3.

```
src/
  index.js                 (4 linhas: só startServer)
  routes.js                (14 linhas: shim de compatibilidade)
  http/
    router.js              tabela de dispatch (49)
    respond.js             send/CORS (11)
    server.js              servidor + estáticos (48)
  application/
    validation.js          rank/window/days (11)
    health.js              startedAt + layerHealth (25)
    versions.js            patches + currentGameVersion (32)
    scoring.js             qHeroes/scoreLot/score/paginate (66)
    rankLot.js             coleta + snapshot + prior + lanes puros (125)
    catalogs.js            herói/equipamento/emblema (76)
    heroLanes.js           mapa heroId → lanes (43)
    buildsAggregate.js     B0–B5 + dedupe/SWR (356)
  routes/
    heroes.js              GET /heroes (34)
    heroDetails.js         ficha + confidence/rank-diff/temporal/distortion/trends (122)
    views.js               /views/* (30)
    gems.js                /gems (10)
    catalog.js             /catalog, /equipment, /heroes/lanes (22)
    matchups.js            /heroes/:id/matchups + /blind (77)
    builds.js              /builds/aggregate + /heroes/:id/builds (116)
    snapshots.js           /snapshots + diff C-105 (80)
    meta.js                /modules + /meta/status (26)
```

Direção de dependência: `http/` e `routes/` → `application/` → engine (puro) +
`arena.js`/`cache.js` (portas). Nenhum módulo de `application/` importa rota.

## 3. O que mudou de fato

- **Auto-recursão eliminada**: `catalog()`, `equipment()` e `emblems()` viraram
  `heroCatalog()`, `equipmentCatalog()` e `emblemCatalog()` em `application/catalogs.js`;
  `/blind` chama `matchupsRoute` diretamente. Zero chamadas de handler para `router()`.
- **Validação centralizada** em `application/validation.js` (`isRank`, `isWindow`,
  `isDays`), preservando os códigos e mensagens do fio. `matchups`/`blind` continuam
  aceitando **apenas** as janelas `1/3/7/15/30`; `trends` continua `1..90`.
- **Estado de módulo migrado junto**: `patchCache` (versions), `layerHealth`/`startedAt`
  (health), `aggChain`/`aggInFlight` (buildsAggregate), `emblemsInFlight` (catalogs).
  O dedupe do agregado virou `runBuildsAggregate(params, key)` — mesma semântica.
- **Servidor** movido para `http/server.js`; `index.js` ficou com 4 linhas.
- `package.json` da API: `build` valida o grafo inteiro por import; `test` passou a
  incluir `contracts.test.js` (antes rodava só 2 arquivos).

## 4. Rede de segurança (antes de fatiar)

`test/contracts.test.js`: **31 testes** cobrindo os 20 endpoints — envelope de topo,
ordem, `null` vs zero, 400/404/410/422, fan-out e degradação. Usa
`test/support/upstream.mjs` (mock determinístico da Arena API, 12 heróis) e
`test/support/env.mjs` (SQLite em tmp). O breaker do `arena.js` é resetado entre
testes: um caso que simula upstream fora deixava o breaker aberto para os seguintes.

Três asserções escritas por leitura de código estavam erradas e foram corrigidas no
teste (o código estava certo): `/heroes` também devolve `latest`; a curva de duração
do mock é **snowball** (win cai com o tempo); e `/heroes/lanes` sem upstream cai no
catálogo em cache (ids com `[]`), não em `{}` — degradação honesta, sem lane inventada.

## 5. Verificação executada

| Verificação | Comando | Resultado |
|---|---|---|
| Motor | `node --test ./test/*.test.js` (engine) | **219/219**, 3× |
| API | `node --test routes + builds-aggregate + contracts` | **59/59**, 3× |
| Contratos | `node --test ./test/contracts.test.js` | **31/31** |
| Cobertura API | `--experimental-test-coverage --test-coverage-include="src/**"` | **93,92% linhas / 87,13% funções / 59,20% branches** (era 47,32% linhas) |
| Build API | `npm run build` | `api-ok` (importa o grafo + `--check`) |
| Web guards | smoke + itemsets/combiner + guardian builds/confrontos | PASS / 24/24 / OK / OK |
| Tipos web | `tsc --noEmit` | exit 0 (o shim `routes.js` continua servindo `vite.config.ts`) |

## 6. Riscos e dívidas (fora do escopo da F1)

- `http/server.js` ainda lê estáticos como `utf8` (quebra binário) e não envia cache
  headers — **F2**.
- `catch` genérico do servidor responde 502 para qualquer exceção — taxonomia de erro
  é **F2**.
- `cache.js` mantém 5 `catch {}` vazios e `rows.reverse()` em memória — **F3**.
- Branches em 59,20%: os caminhos de erro do agregado (`deadline_exceeded`, catálogo
  vazio, stale) ainda não têm teste dedicado — **F1.1/F3**.
- O shim `routes.js` deve ser removido só quando `vite.config.ts`, `index.js` e os
  testes apontarem direto para `http/router.js` e `application/*` — **F5**.
- `/heroes/lanes` sem upstream usando catálogo em cache é comportamento atual
  documentado no teste; se o produto quiser `{}` nesse caso, é decisão de **F2**
  (não é refatoração).

## 7. Como reproduzir

```powershell
cd apps/api
npm run build
npm test
node --test --experimental-test-coverage --test-coverage-include="src/**" ./test/routes.test.js ./test/builds-aggregate.test.js ./test/contracts.test.js

cd ../../apps/web
node ./test/smoke.mjs
node --test ./test/itemsets.test.mjs ./test/combiner.test.mjs
node ./test/guardian-builds-global.mjs
node ./test/guardian-hero-confrontos.mjs
node node_modules/typescript/bin/tsc --noEmit
```
