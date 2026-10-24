# F2 — HTTP e operação

- Data: 2026-10-24
- Status: concluída (F0, F1 e F2 do plano da ADR-033)
- Pré-requisito: ADR-032, ADR-033 (F1)
- Decisão: ADR-034

## 1. Problema

Depois da F1 o código estava fatiado e testado, mas o processo ainda era operacionalmente
frágil: exceção de código virava `502`, não havia log/`requestId`, estático era lido como
UTF-8 (corrompendo binário), não havia rate limit, a config era lida em cada módulo sem
validação e `SIGINT` matava requests em andamento.

## 2. Evidência (antes)

| Sintoma | Evidência no código |
|---|---|
| Bug mascarado de falha de rede | `server.js` antigo: `catch { send(502, ...) }` para toda exceção |
| Sem correlação | nenhum header/log de request |
| Binário corrompido | `readFile(file, "utf8")` para png/woff/ico |
| Sem cache | nenhum `ETag`/`Cache-Control`; todo request relia o arquivo |
| Rajada sem controle | nenhum limiter |
| Config silenciosa | `arena.js:4/7/9` e `cache.js:21/41` liam `process.env`; `ARENA_CONC=abc` → `NaN` |
| Shutdown abrupto | `server.close()` sem espera/limite |
| Sem headers de segurança | sem `nosniff`/`referrer-policy` |

## 3. Decisão (resumo)

`config.js` fail-fast como fonte única; `HttpError` + `500` para exceção não tratada
(`502` só upstream); `request-id` validado e ecoado; log JSON por request; token bucket
20 rps/60 burst por IP; estático em Buffer com ETag/304 e cache por classe; headers de
segurança; shutdown gracioso com timeout; `createApiServer` injetável para teste.
Detalhes e trade-offs na ADR-034.

## 4. Arquivos

Novos:

```
apps/api/src/config.js                    parseConfig/env fail-fast
apps/api/src/application/rateLimit.js     token bucket puro (relógio injetável)
apps/api/src/http/errors.js               HTTP, HttpError, toErrorResponse
apps/api/src/http/log.js                  createLogger (JSON, níveis)
apps/api/src/http/static.js               serveStatic (Buffer/ETag/cache/HEAD)
apps/api/test/config.test.js              16 testes
apps/api/test/rate-limit.test.js           6 testes
apps/api/test/http.test.js                21 testes (node:http cru)
```

Alterados:

```
apps/api/src/http/server.js     request-id, headers, rate limit, 500, shutdown, injeção
apps/api/src/http/respond.js    send/sendBuffer/sendEmpty (charset só em textual)
apps/api/src/index.js           import dinâmico com try/catch → mensagem + exit 1
apps/api/src/arena.js           config.arena.{base,altHosts,conc}
apps/api/src/cache.js           config.cache.{sqlite,file}
apps/api/package.json           build importa http/server.js; test com 6 arquivos
.env.example                    LOG_LEVEL, TRUST_PROXY, RATE_LIMIT_*, WEB_DIST, SHUTDOWN_TIMEOUT_MS
```

## 5. Implementação (o que mudou de comportamento)

1. **Erro**: exceção não tratada → `500 internal_error` com `requestId`; stack só no log.
   `HttpError` preserva status/código (ex.: 422 `lane_required`).
2. **Request-id**: aceito só `^[A-Za-z0-9._:-]{1,64}$`; inválido/ausente → UUID. Ecoado
   em todas as respostas, inclusive erro e 429.
3. **Log**: uma linha JSON por evento; `request` no `finish` com duração; `silent`
   permite testes sem ruído. `server_listening` agora loga a porta **efetiva**.
4. **Rate limit**: 429 + `retry-after` (s) + `x-ratelimit-*` + `retry_after_ms`; poda
   com teto de 10k chaves; `/health` e estático isentos; `RATE_LIMIT_OFF=1` desliga.
5. **Estático**: PNG byte a byte, sem `charset`; ETag fraco; 304; `immutable` para
   `assets/`/hash; `no-cache` para HTML; HEAD sem corpo; traversal/`%00` → 404.
6. **Segurança**: `x-content-type-options: nosniff`, `referrer-policy: no-referrer`,
   `no-store` em `/health`, `/v1/*` e 404.
7. **Config**: `PORT`, `ARENA_*`, `SQLITE_*`, `LOG_LEVEL`, `TRUST_PROXY`,
   `RATE_LIMIT_*`, `WEB_DIST`, `SHUTDOWN_TIMEOUT_MS` validados no boot. Compat:
   `SQLITE_CACHE` só desliga com `off`.
8. **Shutdown**: `SIGINT`/`SIGTERM` → `stopServer` (espera) → `closeAllConnections`
   após 10 s → exit 1 se forçado; exit 0 no caso normal.

## 6. Testes e gates (executados)

| Gate | Comando | Resultado |
|---|---|---|
| API 3× | `node --test ./test/routes.test.js ./test/builds-aggregate.test.js ./test/contracts.test.js ./test/config.test.js ./test/rate-limit.test.js ./test/http.test.js` | **104/104** em cada uma das 3 execuções, exit 0 |
| Engine 3× (F1) | `node --test ./test/*.test.js` | **219/219**, exit 0 |
| Web | smoke + itemsets/combiner + guardian builds + guardian confrontos | `SMOKE OK`, `GUARDIAN OK`, `GUARDIAN CONFRONTOS OK`, exit 0 |
| Tipos | `tsc --noEmit` | exit 0 |
| Build | `npm run build` (engine → api → web) | `proprietary-ok`, `api-ok`, `vite built in 1m 24s`, exit 0 |
| Cobertura (suite completa) | `node --test --experimental-test-coverage --test-coverage-include="src/**" ...` | **93,75% linhas / 64,13% branch / 88,10% funções** |

Cobertura dos arquivos da F2 (suite completa): `config.js` 100%, `rateLimit.js` 100%,
`errors.js` 100%, `respond.js` 100%, `static.js` 100% linhas, `router.js` 100% linhas,
`log.js` 89,47%, `server.js` 79,33% (linhas 126–150 = `startServer`/sinais, cobertas
pelo smoke de runtime, não pelo `node:test`).

**Smoke de runtime** (processo real, `PORT=0`, `RATE_LIMIT_RPS=2`, `BURST=3`):

```
PASS GET /health 200 + ok + no-store
PASS GET /v1/modules 200 + request-id ecoado + 9 módulos
PASS GET /v1/nao-existe 404 JSON
PASS GET / estático: html no-cache
PASS GET /assets/index-CnSB5-d7.js 200 + immutable
PASS 304 por ETag sem corpo
PASS 429 com retry-after/x-ratelimit e request-id
shutdown {"signal":"SIGINT","timeoutMs":10000}
shutdown_done {"signal":"SIGINT","forced":false}   exit=0
```

## 7. Riscos e limites conhecidos

- Rate limit é **por processo** e em memória: não vale entre réplicas e zera no restart.
- `TRUST_PROXY=1` só é seguro atrás de proxy conhecido; default é `false`.
- ETag fraco usa tamanho+mtime (colisão possível em arquivos idênticos no mesmo ms).
- Estático carrega o arquivo inteiro em memória; sem Range/streaming/compressão.
- `startServer` e sinais são verificados por smoke, não por teste automatizado no CI.
- Mudança de contrato intencional: exceção no router agora **500**, não 502 (a UI não
  depende de 502; `contracts.test.js` continua verde).
- `apps/web/vite.config.ts` importa o shim `routes.js` para servir `/v1` em dev; com
  isso, env inválida da API agora derruba também o `vite` (fail-fast coerente, mas o
  build web passa a depender do env da API).

## 8. Estrutura: achados registrados (não alterados nesta fase)

A pedido, a F2 fecha sem reorg. Fica registrado para as próximas fases:

| Achado | Onde | Fase |
|---|---|---|
| 4 bancos SQLite (~15 MB), um em `apps/api/src/data/` | `SQLITE_FILE` relativo ao CWD | F3 (`DATA_DIR`) |
| `config.js`/`arena.js`/`cache.js` fora de `src/infra/` | raiz de `src/` vs tabela da ADR-033 | F3 |
| 9 imports relativos profundos do engine | `apps/api` → `packages/proprietary-engine` | F3/F5 |
| `pnpm-workspace.yaml` + npm workspaces | raiz | F3 |
| `.old/` versionado + smoke dependente | `apps/web/src/pages/.old` | F4a |
| `pages/` como depósito de features | `apps/web/src/pages/{panels,hero}` | F4a |
| `tools/fix-missing.ps1` e `pin-rollup.ps1` sem referência | `tools/` | F5 (verificar e remover) |
