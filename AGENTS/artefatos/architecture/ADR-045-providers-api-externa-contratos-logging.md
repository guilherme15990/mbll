# ADR-045 — Camada `providers/` do backend: API externa tipada, contratos internos e logging

- Data: 2026-10-25
- Status: aceita e implementada
- Base: ADR-025 (fronteira única), ADR-033 (monolito modular), ADR-034 (HTTP e
  operação), ADR-038 (portão de qualidade), auditoria
  `2026-10-25-auditoria-experiencia-e-contratos.md` (A13: ADR-044 citada e ausente
  — por isso esta é a 045)
- Escopo: `app/api/src/providers/**`, migração dos chamadores, `http/log.js`,
  `infra/config.js`, gate de fronteiras e testes. **Zero mudança de produto.**

## Contexto

Três problemas concretos, todos de fronteira:

1. **Forma da fonte sem dono.** O cliente externo (`src/infra/arena.js`)
   devolvia `any`. Cada rota adivinhava o envelope (`raw?.data?.records?.[0]?.data?.build`)
   e um campo renomeado no upstream virava `undefined` silencioso — sem erro,
   sem log, sem teste.
2. **Erro de upstream sem taxonomia.** Falha de rede, timeout, 500, HTML no lugar
   de JSON e breaker aberto chegavam como `Error` genérico. Quem decide 502 vs
   504 tinha que parsear string de mensagem.
3. **Log duplicado e sem contexto.** `http/log.js` era a única implementação,
   importada "de baixo para cima" por módulos de aplicação; `requestId` só
   existia no log do servidor. O log do cliente do upstream — exatamente onde a
   correlação importa — não tinha como saber de qual request veio.
4. **Fronteira invertida.** `application/*` e `routes/*` importavam
   `infra/arena.js` diretamente. Nada impedia um provider de importar regra de
   negócio, e o compilador não vê direção de dependência.

## Decisão

`providers/` passa a ser a **base da pilha** do backend:

```
providers → application → routes → http
```

Nenhum arquivo de `providers/` importa `application/`, `routes/` ou `http/`
(regra executável em `tools/check-boundaries.mjs`).

```
app/api/src/providers/
  index.js                 # raiz: arena + logging + contracts
  arena/
    client.js              # transporte: timeout, retry, hop, breaker, ArenaError
    types.js               # contrato da API EXTERNA (o que a fonte manda)
    index.js               # fachada tipada por caso de uso (getRankPage, ...)
  logging/
    index.js               # logger JSON, níveis, redação, configureLogging
    context.js             # AsyncLocalStorage (requestId sem threading)
  contracts.js             # contrato da API INTERNA (status/body, erro, envelope)
```

### 1. A fonte tem um contrato declarado (`arena/types.js`)

Só é tipado o que o código realmente lê hoje, com a forma observada nos
fixtures (`app/api/test/support/upstream.mjs`). Regras:

- campo que a fonte pode omitir é opcional — nada é inventado como obrigatório;
- número que chega como string (`"0.512"`) é `number | string`: a normalização
  (`Number(...)`) continua sendo de quem consome;
- estes tipos **não** são o contrato interno. São o formato de entrada.

### 2. A fachada esconde path e query (`arena/index.js`)

`getRankPage`, `getHeroesPage`, `getEquipmentPage`, `getExpandedEquipment`,
`getEmblems`, `getSpells`, `getPositions`, `getHeroLane`, `getHeroBuilds`,
`getTrends`, `getCounters`, `getCompatibility`, `getVersion`.

Path e query ficam em um lugar só — antes cada chamador montava
`?size=200&index=1` na mão. `getRaw` existe como escape hatch explícito para
endpoint ainda não promovido; código novo não usa.

### 3. Erro tipado (`ArenaError`)

`kind`: `circuit_open | timeout | network | upstream_status | non_json |
invalid_json | unknown`, mais `status`, `path` e `attempts`. O comportamento de
transporte é o mesmo da implementação anterior (timeout, retry com backoff +
jitter, 1 hop para host alternativo em allowlist, breaker de 5 falhas/60 s,
recusa de HTML). O que muda é a decisão de erro: ela para de depender de string.

`lastErr` de tentativa anterior é reembrulhado com `attempts = retries + 1` para
que a contagem final reflita o trabalho real, não a primeira tentativa.

### 4. Logging com contexto de request (`logging/`)

- Níveis: `silent < error < warn < info < debug`. `warn` foi adicionado porque
  falha de upstream não é 500 de aplicação; precisa aparecer sem disparar o
  alerta de bug.
- Uma linha JSON por evento (`ts`, `level`, `msg`, campos).
- `AsyncLocalStorage` anexa `requestId` a **todo** evento emitido dentro do
  request, inclusive no cliente externo, sem passar `req` por parâmetro.
- Redação rasa de `authorization`, `cookie`, `token`, `password`, `secret` etc.
  (até 3 níveis). Log não é depósito de payload.
- `JSON.stringify` que lança (ciclo, `BigInt`) emite
  `log_error: "serialization_failed"` em vez de derrubar o processo.
- `configureLogging(logger)` instala o logger do processo; módulos de aplicação
  chamam `getLogger()` na hora de logar (nunca guardam a referência). O default
  é `silent` para que importar um módulo em teste/script não imprima nada.
- Logger injetado mínimo (`{ info, error }`, como os testes de HTTP já passavam)
  é normalizado: `warn` cai em `info`, `debug` vira no-op, `child` devolve o
  próprio logger e o `requestId` do contexto é anexado aos campos.

### 5. Contratos da API interna (`contracts.js`)

Só o que o fio promete e o web consome hoje: `RouteResult` (`{status, body}`),
`ErrorBody` (`error`/`message` obrigatórios), `ReadEnvelope` (`data` + `total?`,
`stale?`, `ageMs?`) e `ContractError`. Guardas `assertRouteResult`,
`assertErrorBody` e `assertEnvelope` rodam em teste — contrato que ninguém
verifica é comentário.

**DTOs de domínio não foram movidos para cá.** Herói, build e agregado ainda
vivem no motor/web; criar uma terceira cópia agora produziria mais drift, não
menos. Fica registrado como pendência: publicar os tipos internos para
`app/web` quando existir um caminho de import compartilhado.

### 6. `http/log.js` vira shim

Reexporta `providers/logging` para não quebrar import histórico. Nenhuma lógica
nova entra nele.

## Decisões L2 registradas

| Decisão | Por quê |
|---|---|
| `mapConc` com default `config.arena.conc` | as chamadas antigas passavam 2 argumentos; exigir o 3º quebraria o contrato sem ganho |
| `fetchImpl` resolvido **a cada chamada** (`fetchImpl ?? globalThis.fetch`) | o singleton é criado no import; capturar `globalThis.fetch` ali fazia os testes que trocam `fetch` depois do import irem à rede real |
| `getVersion` normaliza `data.records` **ou** `data` lista | a fonte devolve as duas formas; a normalização é da aplicação, o tipo declara a união |
| Log de sucesso do upstream em `debug`; falha em `warn` | sucesso por request é ruído em `info`; falha precisa de série temporal |
| `infra/config.js` aceita `LOG_LEVEL=warn` | sem isso o nível novo não seria configurável e o fail-fast do config rejeitaria o valor |

## Alternativas rejeitadas

- **Manter `infra/arena.js` e só adicionar tipos ao lado.** Reabre a segunda
  fonte de verdade e o segundo breaker. O gate proíbe recriar o arquivo.
- **Validação de schema em runtime (zod/valibot).** Adiciona dependência ao
  caminho quente e transforma campo extra do upstream em 502. O projeto é
  zero-dep por decisão (ADR-034); a tipagem + normalização cobre o risco atual.
- **Publicar DTOs de domínio agora.** Ver §5: terceira verdade sem consumidor.
- **Passar `requestId` como parâmetro até o cliente externo.** Atravessa
  application inteira e cria assinatura que ninguém testa. `AsyncLocalStorage`
  é nativo e o custo é um `run` por request.

## Consequências

- 13 módulos migrados para a fachada (nenhum importa `infra/arena`):
  `application/{rankLot,catalogs,heroLanes,buildsAggregate,versions,validation,scoring}.js`,
  `routes/{builds,matchups,heroDetails,views,snapshots,catalog}.js`.
- `infra/arena.js` **removido**. `test/contracts.test.js` passou a importar
  `providers/arena`.
- `http/server.js` instala o logger e envolve o router em `withRequestContext`.
- `test/providers.test.js` (28 testes) cobre níveis/redação/contexto,
  `ArenaError` (timeout, 500, non-JSON, breaker, hop), paths da fachada,
  `mapConc` e as guardas de contrato.
- Gate novo: `providers` não importa camadas superiores; ninguém importa
  `infra/arena`; `infra/arena.js` não existe.

## O que este ADR NÃO resolve

- O agregado de builds ainda tem drift documentado (`window_applies_to` /
  `build_window` fantasma, `notes` ausente) — é contrato interno, próxima etapa.
- O web continua com tipos escritos à mão; `providers/contracts.js` ainda não é
  consumido por `app/web`.
- Copy de janela e CTAs falsos apontados como P0 de honestidade na auditoria
  seguem fora do escopo desta camada.

## Verificação

```
npm run check:api          # typecheck estrito (JSDoc) verde
npm test -w api            # 152 testes, 152 passando
npm run check:boundaries   # 15 regras, BOUNDARIES OK
```
