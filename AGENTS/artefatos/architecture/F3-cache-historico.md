# F3 — Cache, histórico e dados

- Data: 2026-10-24
- Status: concluída (F0, F1, F2 e F3 do plano da ADR-033)
- Pré-requisito: ADR-033 (F2), ADR-034
- Decisão: ADR-035

## 1. Problema

Depois da F2 o HTTP estava sólido, mas o estado persistente continuava frágil:
`SQLITE_FILE` relativo ao CWD criou 4 bancos (~15 MB), não havia PRAGMA algum
(sem WAL, sem `busy_timeout`), cada operação preparava o SQL de novo, o histórico
append-only crescia sem retenção, a deduplicação estava duplicada e a infra
(`config`, `arena`, `cache`) morava na raiz de `src/`.

## 2. Evidência (antes)

| Sintoma | Evidência |
|---|---|
| Banco por CWD | `data/`, `apps/api/data` (~950 KB), `apps/web/data` (~14,5 MB), `apps/api/src/data` (~94 KB) |
| Sem concorrência saudável | banco aberto sem `journal_mode`/`busy_timeout` |
| Parse de SQL por chamada | `db.prepare(...)` dentro de `cacheGet`/`cacheSet`/histórico |
| Histórico sem limite | nenhuma rotina de retenção; `snapshot_history` só crescia |
| Dedupe duplicado | `emblemsInFlight` + `aggInFlight`; `fetchRankAll`/`heroLanes` sem flight |
| Infra fora de camada | `src/config.js`, `src/arena.js`, `src/cache.js` |

## 3. Decisão (resumo)

`DATA_DIR` absoluto (default `<repo>/data`), com `SQLITE_FILE` só como override;
split de `cache.js` em `infra/cacheStore.js` + `infra/snapshotHistory.js` +
`infra/db.js` + `application/canonical.js`; WAL/`synchronous=NORMAL`/`busy_timeout`
e statements preparados; retenção por arquivamento em `snapshot_history_archive`
(opt-in, transacional, sem `VACUUM`); single-flight compartilhado em catálogos,
lanes, `fetchRankAll` e agregado; `closeDb()` no shutdown. Detalhes e trade-offs
na ADR-035.

## 4. Arquivos

Novos:

```
apps/api/src/infra/config.js              config + DATA_DIR + retenção (movido de src/config.js)
apps/api/src/infra/db.js                  conexão única, WAL, schema, prepare/close
apps/api/src/infra/cacheStore.js          KV/TTL com statements preparados
apps/api/src/infra/snapshotHistory.js     append-only + archiveHistory
apps/api/src/infra/arena.js               cliente Arena (movido de src/arena.js)
apps/api/src/application/canonical.js     canonicalPayload/payloadHash
apps/api/src/application/singleFlight.js  dedupe compartilhado
apps/api/test/db.test.js                  6 testes (WAL, schema, prepare, close)
apps/api/test/history.test.js             4 testes (arquivamento/poda)
apps/api/test/history-retention.test.js   1 teste (retenção ligada por env)
apps/api/test/single-flight.test.js       4 testes
```

Removidos: `apps/api/src/config.js`, `apps/api/src/arena.js`, `apps/api/src/cache.js`.

Alterados:

```
apps/api/src/application/{buildsAggregate,catalogs,heroLanes,rankLot,
  scoring,validation,versions}.js          imports + single-flight
apps/api/src/routes/{builds,catalog,heroDetails,heroes,matchups,meta,
  snapshots,views}.js                      imports para infra/
apps/api/src/http/server.js                closeDb() no shutdown + dbClosed no log
apps/api/test/{builds-aggregate,config,contracts,routes}.test.js
apps/api/test/support/env.mjs              comentário/ordem do novo db.js
apps/api/package.json                      test com 10 arquivos
.env.example                               DATA_DIR, HISTORY_RETENTION_DAYS
```

## 5. Detalhes que importam

### 5.1 `DATA_DIR` e `SQLITE_FILE`

- `DATA_DIR` relativo → `resolve(REPO_ROOT, valor)`; absoluto → mantido.
- Default do arquivo: `$DATA_DIR/cache.sqlite` (absoluto).
- `SQLITE_FILE` definido → `resolve(valor)` (relativo ao CWD, compat).
- `config.test.js` cobre os três casos, incluindo `DATA_DIR` e override.

### 5.2 Schema e migração

`db.js` cria no boot, com `IF NOT EXISTS`: `cache`, `snapshot_history`,
`snapshot_history_archive` e os índices `idx_snapshot_history_serie`,
`idx_snapshot_history_ts` e `idx_snapshot_history_archive_ts`. Bancos antigos
ganham o arquivo frio sem migração destrutiva.

### 5.3 Retenção

- `HISTORY_RETENTION_DAYS=0` (default): `archiveHistory` devolve
  `{archived:0, skipped:true, reason:"disabled"}` e não toca em nada.
- `>0`: `BEGIN IMMEDIATE` → `INSERT OR IGNORE ... SELECT` para o arquivo →
  `DELETE` da tabela quente → `COMMIT`; em erro, `ROLLBACK` e `{skipped:true}`.
- `recordSnapshot` chama `archiveHistory()` depois do insert quando ligada.
- `historyStats()` expõe `archived`; a API lê a janela quente.
- O archive preserva `status`/`motivo` (inclusive `violado`) e adiciona
  `archived_at`.

### 5.4 Single-flight

- `catalogs.js`: chaves `catalog`, `equipment`, `emblems:v1`.
- `heroLanes.js`: `lanes:<rank>`.
- `rankLot.js`: `rank:<rank>:<days>:<retries>:<timeoutMs>`.
- `buildsAggregate.js`: `aggFlight` no lugar de `aggInFlight`, com o mesmo
  encadeamento serial (`aggChain`).

### 5.5 Bug encontrado e corrigido

O primeiro corte do `INSERT` reutilizou a lista `COLS` **com `id`**, deslocando
todos os valores uma coluna (o teste de apêndice `posterior` falhou com
`null`). Corrigido separando `INSERT_COLS` (sem `id`) de `COLS` (SELECT). Fica
registrado porque é exatamente o tipo de erro que o teste de contrato pegou.

## 6. Evidência (depois)

Comandos executados na raiz do repo:

```
npm test -w apps-api                     # 3 execuções
npm test -w packages/proprietary-engine
npm test -w apps-web
npm run build
node <tmp>/f2-runtime-smoke.mjs          # DATA_DIR em tmp
node --experimental-test-coverage --test-coverage-include="src/**" --test <10 arquivos>
```

Resultados:

| Verificação | Resultado |
|---|---|
| API (`apps-api`) | **123/123**, 31 suítes, 0 falhas — 3 execuções |
| Motor | **219/219**, 42 suítes, 0 falhas |
| Web | smoke OK, itemsets/combiner verdes, guardians `BUILDS OK`/`CONFRONTOS OK` |
| Build | engine `proprietary-ok`, api `api-ok`, web 2522 módulos → `dist` |
| Runtime smoke | health/modules/404/estático/ETag/429 OK; `shutdown_done ... "dbClosed":true`, exit 0 |
| Cobertura `src/**` | **93,75% linhas**, 65,82% branches, 89,27% funções |
| Cobertura F3 | `config`/`cacheStore`/`canonical`/`singleFlight` 100%; `db` 96,26%; `snapshotHistory` 90,50% |

Testes novos: 15 casos (6 db + 4 history + 1 retention + 4 single-flight),
14 no bloco filtrado + 1 em processo próprio (`history-retention.test.js`).

## 7. Riscos e pendências

1. **Bancos órfãos**: os 4 bancos antigos continuam no disco (gitignored/untracked).
   `data/cache.sqlite` é o canônico; os outros três não são mais usados. **Não
   foram removidos** — exclusão é decisão do usuário. Comandos sugeridos:
   `apps/api/data`, `apps/web/data` e `apps/api/src/data` (~15 MB no total).
2. **Poda síncrona**: com retenção ligada, o arquivamento roda no event loop a
   cada snapshot. Volume esperado é baixo; medir se `HISTORY_RETENTION_DAYS>0`
   for usado em produção.
3. **Arquivo frio sem política**: `snapshot_history_archive` cresce e não tem
   retenção própria; `VACUUM` é manual.
4. **Fronteira do engine**: imports por caminho relativo continuam (F5).
5. **`SQLITE_FILE` override**: se usado com caminho relativo, volta a depender do
   CWD; recomendação documentada no `.env.example` é `DATA_DIR`.
6. **pnpm + npm / `.old/` / `web/pages`**: seguem para F4a/F5, fora da F3.
