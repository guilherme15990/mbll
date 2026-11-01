# ADR-035 — Cache, histórico e dados: DATA_DIR, WAL, split e retenção por arquivamento

> **PARCIALMENTE SUPERADA pela ADR-065 (2026-11-01).** As decisões de `DATA_DIR`,
> WAL, conexão única/statements preparados e single-flight continuam válidas. O
> **histórico append-only, a retenção por arquivamento e o schema
> `snapshot_history`/`snapshot_history_archive` foram removidos** (ADR-065).

- Data: 2026-10-24
- Status: aceita e implementada (F3 da ADR-033); histórico/retenção superados pela ADR-065
- Contexto: `apps/api` zero-dep, SQLite da stdlib (`node:sqlite`), um processo,
  histórico append-only (ADR-021-09 / DDD-V4-05) e cache derivado reconstruível.

## Problema

1. **Um banco por diretório de execução.** `SQLITE_FILE=./data/cache.sqlite` era
   resolvido contra o CWD. Rodar a API da raiz, de `apps/api` ou de `apps/web`
   criava bancos diferentes. Existiam 4 bancos (~15 MB), e a suíte de testes já
   tinha precisado de `SQLITE_FILE` em tmp para não gravar no banco de dev.
2. **Sem PRAGMAs.** O banco abria em rollback journal, sem `busy_timeout`; duas
   instâncias disputando escrita falhavam na hora com `SQLITE_BUSY`.
3. **`prepare()` por chamada.** Cada `cacheGet`/`cacheSet`/insert/select preparava
   o SQL de novo.
4. **Histórico cresce para sempre.** Append-only é contrato, mas não havia
   mecanismo algum de retenção; o banco só aumentava.
5. **Deduplicação duplicada.** `emblemsInFlight` (catálogos) e `aggInFlight`
   (agregado) eram implementações separadas da mesma ideia; `fetchRankAll` e
   `heroLanes` não deduplicavam nada — duas abas podiam disparar duas coletas e
   dois snapshots idênticos.
6. **Infra na raiz de `src/`.** `config.js`, `arena.js` e `cache.js` violavam a
   tabela de camadas da ADR-033 (`infra/` é adaptador de I/O).

## Decisões

### 1. `DATA_DIR` explícito, ancorado na raiz do repo

`config.dataDir` é sempre absoluto e o default é `<repo>/data`. Um `DATA_DIR`
relativo resolve **contra a raiz do repo**, nunca contra o CWD. O arquivo do
SQLite passa a ser `$DATA_DIR/cache.sqlite`.

`SQLITE_FILE` continua existindo como **override** e mantém a semântica antiga
(relativo ao CWD, compatibilidade com scripts/ambientes já configurados). O
default deixa de depender do CWD, que era a causa dos bancos órfãos.

### 2. Split de `cache.js` em módulos com dono

| Antes (`src/cache.js`) | Depois |
|---|---|
| KV/TTL + `cacheStats` | `src/infra/cacheStore.js` |
| `recordSnapshot`/`listSnapshots`/`getSnapshot`/`historyStats` | `src/infra/snapshotHistory.js` |
| `canonicalPayload`/`payloadHash` | `src/application/canonical.js` |
| conexão, PRAGMAs, schema, `prepare` | `src/infra/db.js` |
| cliente HTTP da Arena | `src/infra/arena.js` (movido) |
| config | `src/infra/config.js` (movido) |

`src/config.js`, `src/arena.js` e `src/cache.js` foram removidos; todos os
consumidores e testes apontam para os novos caminhos. `snapshotHistory.js`
reexporta `canonicalPayload`/`payloadHash` para preservar a superfície usada
pelo agregado de builds e pelos testes.

### 3. Conexão única + WAL + statements preparados

`src/infra/db.js` abre o banco uma vez no import e aplica:

```
PRAGMA journal_mode=WAL
PRAGMA synchronous=NORMAL
PRAGMA busy_timeout=5000
PRAGMA foreign_keys=ON
```

O schema (`cache`, `snapshot_history`, `snapshot_history_archive` e índices) é
criado no boot com `CREATE ... IF NOT EXISTS`, então bancos existentes ganham a
tabela de arquivo sem migração destrutiva. `prepare(sql)` reaproveita um
`StatementSync` por SQL; `closeDb()` limpa o cache e fecha a conexão no shutdown
(o log passa a registrar `dbClosed`). Se `node:sqlite` não existir ou falhar, os
módulos continuam no fallback em memória — comportamento anterior preservado.

### 4. Retenção por arquivamento (opt-in, transacional)

`HISTORY_RETENTION_DAYS` default **0 = desligado**: o histórico continua
append-only e cresce. Com valor `> 0`:

1. `archiveHistory()` calcula `cutoff = now - days * 86_400_000`;
2. em `BEGIN IMMEDIATE`, copia as linhas com `coletado_em < cutoff` para
   `snapshot_history_archive` (`INSERT OR IGNORE ... SELECT`, mesmo schema +
   `archived_at`);
3. **só então** remove essas linhas da tabela quente (`DELETE`);
4. `COMMIT`.

A evidência nunca é apagada sem cópia no arquivo frio. A operação é idempotente,
roda também automaticamente após `recordSnapshot` quando a retenção está ligada
e **nunca lança** para a coleta: em falha devolve `{skipped:true, reason}`.
Não há `VACUUM` automático — o arquivo não devolve espaço sozinho.

`historyStats()` expõe `archived`; a API lê somente a janela quente.

### 5. Single-flight compartilhado

`src/application/singleFlight.js` (`createSingleFlight`) é a única implementação:
`run(key, fn)` devolve a promise em andamento, `peek`/`has`/`size` inspecionam sem
iniciar. Usado em:

- `catalogs.js`: catálogo de heróis, equipamentos e emblemas (um flight por chave);
- `heroLanes.js`: uma coleta por rank;
- `rankLot.js`: `fetchRankAll`, com chave `rank:days:retries:timeoutMs` — um
  agregado com deadline curto não pega carona numa coleta configurada para
  esperar mais;
- `buildsAggregate.js`: substitui o `aggInFlight` local.

Além de economizar upstream, o flight de `fetchRankAll` evita snapshots
duplicados quando duas rotas pedem o mesmo lote ao mesmo tempo.

## Alternativas rejeitadas

1. **Retenção com `DELETE` puro.** Viola o contrato append-only: a evidência
   desapareceria sem rastro. Rejeitada pelo usuário na decisão L3; só foi aceita
   a forma “arquivar antes, podar depois”.
2. **Só arquivar, nunca podar.** Zero `DELETE`, mas o banco quente não encolhe e a
   retenção vira só cópia de segurança. Ficou como `HISTORY_RETENTION_DAYS=0`
   (default) — o operador escolhe.
3. **`VACUUM` automático após a poda.** Reescreve o banco inteiro de forma
   síncrona no event loop; com retenção diária seria pior que o problema.
   Documentado como operação manual.
4. **Manter `prepare()` por chamada.** Simples, mas cada request pagava o parse do
   SQL; o cache por string é seguro porque o SQL é constante no módulo.
5. **Uma biblioteca de cache/dedupe externa.** Contraria a restrição zero-dep.

## Consequências

Positivas: um único local de dados independente do CWD; leitura concorrente com
escrita (WAL) e espera em vez de `SQLITE_BUSY`; menos trabalho por request;
retenção auditável (arquivo frio) e desligada por padrão; menos chamadas ao
upstream e menos snapshots duplicados; infra na camada correta.

Negativas / custos:

- A poda copia e apaga na mesma transação: com retenção ligada, cada
  `recordSnapshot` paga o custo do arquivamento (síncrono no event loop). O
  volume esperado é pequeno, mas deve ser observado.
- O arquivo frio também cresce; não há política de retenção para ele.
- Sem `VACUUM`, o arquivo quente não devolve espaço após a poda.
- `SQLITE_FILE` como override relativo ao CWD ainda pode recriar bancos
  espalhados se for usado de propósito; `DATA_DIR` é o caminho recomendado.
- WAL cria `cache.sqlite-wal`/`-shm` ao lado do banco (esperado).
- A fronteira do engine (imports por caminho relativo) continua dívida da F5.

## Evidência de execução

Ver `F3-cache-historico.md`: API 123/123 em 3 execuções, motor 219/219, web
(smoke/itemsets/combiner/guardians) e build verdes, smoke de runtime com
`dbClosed:true`, cobertura de `apps/api/src` em 93,75% de linhas.
