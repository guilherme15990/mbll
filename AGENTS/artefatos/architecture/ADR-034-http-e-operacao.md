# ADR-034 — HTTP e operação: erro, request-id, rate limit, estático e shutdown

- Data: 2026-10-24
- Status: aceita e implementada (F2 da ADR-033)
- Contexto: `apps/api` zero-dep, Node 22+ (`node:http`), máquina de 4 GB, um único
  processo servindo `/v1/*` + `apps/web/dist`.

> **NOTA (2026-11-01, ADR-068).** A documentação das variáveis de ambiente vive
> agora no topo de `app/api/src/infra/config.js`; o `.env.example` foi removido.

## Problema

O servidor da F1 era funcional, mas operacionalmente cego e frágil:

1. **Erro sem taxonomia**: qualquer exceção virava `502` ("upstream indisponível"),
   inclusive bug de código. Não havia `500`, nem `requestId` para correlacionar.
2. **Sem observabilidade**: nenhum log de request, nenhum id de correlação.
3. **Estático corrompia binário**: `readFile(file, "utf8")` era usado para tudo;
   PNG/font/ico saíam alterados. Sem `ETag`, sem `Cache-Control`, sem `HEAD`.
4. **Sem rate limit**: um cliente em rajada derrubava o processo e a fonte externa.
5. **Config espalhada e silenciosa**: `Number(process.env.ARENA_CONC ?? 4)` aceitava
   `ARENA_CONC=abc` → `NaN` → fan-out vazio; cada módulo lia `process.env` por conta.
6. **Shutdown abrupto**: `SIGINT` matava o processo no meio de requests.
7. **Headers de segurança ausentes** (`nosniff`, `referrer-policy`).

## Decisões

### 1. Configuração única e fail-fast (`src/config.js`)

`parseConfig(env)` é pura e testável; `config` é a leitura do `process.env` no import.
Cada variável valida tipo/faixa e a exceção cita **nome e valor recebido**. Defaults
preservam o comportamento anterior (`PORT=3001`, `ARENA_BASE=fastapicloud`,
`ARENA_CONC=4`, SQLite ligado, `WEB_DIST=apps/web/dist`). Compat mantida:
**só** `SQLITE_CACHE=off` desliga o banco (qualquer outro valor liga).

Novas: `LOG_LEVEL`, `TRUST_PROXY`, `RATE_LIMIT_OFF/RPS/BURST`, `WEB_DIST`,
`SHUTDOWN_TIMEOUT_MS`. `arena.js` e `cache.js` deixaram de ler `process.env`.

### 2. Taxonomia de erro no fio (`src/http/errors.js`)

- `HttpError(status, code, message, extra)` para erros previstos (400/404/410/422/429).
- Exceção não tratada → **`500 internal_error`**, corpo `{error, message, requestId}`,
  detalhe/stack **só no log**. Mudança intencional: antes era `502`.
- `502` fica reservado a falha **real** de upstream (os handlers já o produzem).
- 404 de rota/estático e 429 seguem o mesmo envelope.

### 3. Request-id e log (`src/http/log.js`)

- `x-request-id` do cliente é aceito se casar `^[A-Za-z0-9._:-]{1,64}$`; senão é
  substituído por `randomUUID()` (evita injeção no log). Sempre ecoado na resposta.
- Log = uma linha JSON por evento (`ts, level, msg, ...`), níveis
  `silent < error < info < debug` (default `info`). Um evento `request` no `finish`
  com `requestId/method/path/status/ms`; `unhandled_error` inclui `err` e `stack`.

### 4. Rate limit por cliente (`src/application/rateLimit.js`)

Token bucket em memória, sem timer: `rps` tokens/s até `burst`. Default **20 rps /
60 burst** por IP. `RATE_LIMIT_OFF=1` desliga. `TRUST_PROXY=1` usa o 1º IP de
`x-forwarded-for` (default **false**: header é forjável). Resposta `429` com
`retry-after`, `x-ratelimit-limit`, `x-ratelimit-remaining` e `retry_after_ms`.
O mapa tem teto (`maxKeys=10.000`) e poda buckets ociosos/antigos — IP forjado não
cresce memória sem limite. `/health` e estático não consomem token.

### 5. Estático binário-safe (`src/http/static.js`)

Buffer intacto, `Content-Length` correto, `Content-Type` sem `charset` em binário.
`ETag` fraco `W/"<size hex>-<mtime hex>"` + `Last-Modified`; `304` em
`If-None-Match` (lista e `*`). Cache: `assets/` e nomes com hash →
`public, max-age=31536000, immutable`; HTML → `no-cache`; resto → `max-age=3600`.
`HEAD` devolve headers sem corpo. Path é decodificado, normalizado e contido em
`webDist`; traversal e byte nulo → 404 (nunca lê fora da raiz).

### 6. Shutdown e boot

`SIGINT`/`SIGTERM` (uma vez): para de aceitar, espera conexões, e após
`SHUTDOWN_TIMEOUT_MS` (10 s) chama `closeAllConnections()` e encerra com `forced:true`
(exit 1). Boot com config inválida ou `listen` falhando → exit 1 com log claro.
`startServer` loga a porta **efetiva** (com `PORT=0`, a escolhida pelo SO).

### 7. Testabilidade

`createApiServer({router, webDist, logLevel, trustProxy, rateLimit, logger})` permite
dist temporário, router que lança e limite baixo sem env global. `http.test.js` usa
`node:http` cru para exercitar `%2e%2e`/`%00` (clientes normalizam path).

## Consequências

Positivas: bug de código passa a ser 500 rastreável por `requestId`; binário deixa de
corromper; rajada recebe 429 em vez de derrubar o processo; deploy tem cache correto e
shutdown previsível; config inválida falha no boot, não em produção.

Negativas / custos: rate limit é **por processo** (não compartilhado entre instâncias,
zera no restart); `TRUST_PROXY` mal configurado permite spoof de IP; ETag fraco colide
em arquivos de mesmo tamanho/mtime; estático lê o arquivo inteiro em memória (sem
Range/streaming); `startServer`/sinais são cobertos por smoke de runtime, não por
`node:test`.

## Dívidas registradas (não são F2)

1. **Bancos SQLite espalhados**: `SQLITE_FILE` relativo ao CWD criou 4 bancos
   (`data/`, `apps/api/data`, `apps/web/data` com 14,5 MB e `apps/api/src/data`).
   Corrigir na **F3** com `DATA_DIR` ancorado na raiz do repo + WAL + retenção.
   → **Resolvido na F3** (ADR-035): default passa a ser `$DATA_DIR/cache.sqlite`.
   Os arquivos antigos continuam no disco aguardando limpeza manual.
2. **Infra na raiz de `src/`**: `config.js`, `arena.js`, `cache.js` deveriam estar em
   `src/infra/` conforme a tabela de dependências da ADR-033. Movimento mecânico,
   adiado para não misturar reorg com F2.
   → **Resolvido na F3** (ADR-035): `src/infra/{config,db,cacheStore,snapshotHistory,arena}.js`.
3. **Fronteira do engine**: 9 imports `../../../../packages/proprietary-engine/src/index.js`
   ignoram o pacote `@radar/proprietary-engine`. Decidir workspace dep × caminho
   relativo (trade-off: rodar sem `npm install`) na F3/F5.
4. **Dois gerenciadores**: `pnpm-workspace.yaml` + `workspaces` npm + `package-lock.json`.
   Padronizar npm e remover o arquivo pnpm.
   → **Resolvido em 2026-10-27**: `pnpm-workspace.yaml` removido; `packageManager: npm@11.12.1`
   no `package.json` raiz; o gate falha se `pnpm-*`, `yarn.lock`, `.yarnrc.yml` ou `bun.lock*`
   reaparecerem. O bootstrap lean (`tools/bootstrap-web.ps1`) não usa pnpm e não foi afetado.
5. **Web**: `.old/` versionado e `pages/` como depósito de features — F4a.
   → **Resolvido na F4a** (ADR-036): `.old/`, `DddModal`, `ExportEvidence` e
   `heroSeal` removidos; ciclo `página → App` morto; rotas lazy e boundary.
   `pages/` continuar como depósito de features fica para a F4b (opcional).

## Evidência de execução

Ver `AGENTS/artefatos/architecture/F2-http-e-operacao.md` (números, comandos e riscos).
