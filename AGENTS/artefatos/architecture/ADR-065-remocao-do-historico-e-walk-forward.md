# ADR-065 — Remoção do histórico append-only e do walk-forward

- Data: 2026-11-01
- Status: aceita e implementada
- Supersede: ADR-035 (a parte de retenção/arquivamento do histórico e o schema
  `snapshot_history`/`snapshot_history_archive`); ADR-032 (Decisão 3, `listSnapshots`
  janela recente); ADR-021-09 / DDD-V4-05 (BC-TEMPO root-série), na parte que a
  API consumia. A **`@radar/engine` permanece intacta** (ver Decisão 5).
- Contexto: `app/api` zero-dep, SQLite da stdlib (`node:sqlite`), um processo.

## Problema

O produto consome a API e exibe os dados. O mecanismo de **snapshot** fazia duas
coisas acopladas, nenhuma delas usada pela UI:

1. **Histórico append-only** (`snapshot_history` + `snapshot_history_archive`,
   `src/infra/snapshotHistory.js`): gravava cada coleta com `payload_json` +
   `payload_hash`, oferecia `GET /snapshots` e `GET /snapshots/:ts/diff` e alimentava
   `/meta/status.history`. Nenhuma tela do `app/web` chama essas rotas nem lê
   `history` (varredura em `app/web/src`: zero leitores).
2. **Walk-forward** (posterior de ontem = prior de hoje): `rankLot` lia o último
   posterior VERIFICADO da série (`lastVerifiedPosterior`) e o injetava como prior
   do lote seguinte, carimbando `meta.prior` = `walk-forward v{n}`. A UI declara
   `prior?` no tipo, mas **não lê** o campo (comentário `critic-017`: “zero leitores
   em web/src”).

Manter a máquina custa: 2 arquivos de produção (~290 linhas), ~2 arquivos de teste,
retenção opt-in, 2 rotas, schema, uma env var e o acoplamento tempo→prior em três
consumidores (`heroes`, `gems`, `views`, `buildsAggregate`).

## Decisão

**Remover totalmente** o histórico append-only e o encadeamento walk-forward da
API. O lote passa a ser servido sempre **flat** (`prior: null`). O cache com TTL
(tabela `cache`) permanece — é o que sustenta “consome API + mostra dados”.

### 1. Rotas

- Removidas `GET /snapshots` e `GET /snapshots/:ts/diff`
  (`src/routes/snapshots.js` apagado; dispatch em `src/http/router.js` limpo).
- `GET /meta/status` deixa de expor o campo `history` (`historyStats` removido).

### 2. Persistência

- `src/infra/snapshotHistory.js` apagado (`recordSnapshot`/`listSnapshots`/
  `getSnapshot`/`historyStats`/`archiveHistory`/`payloadHash`).
- Schema (`src/infra/db.js`) reduzido a `cache`. As tabelas `snapshot_history`,
  `snapshot_history_archive` e seus índices não são mais criadas. Bancos antigos
  mantêm as tabelas órfãs (o boot usa `CREATE ... IF NOT EXISTS`; não há migração
  destrutiva — a remoção é de código, não de arquivo em disco).
- Retenção removida: `config.history.retentionDays` e `HISTORY_RETENTION_DAYS`
  (`.env.example` e README atualizados).

### 3. Walk-forward

- `src/application/rankLot.js` reescrito: não lê nem grava histórico. `fetchRankAll`
  devolve `prior: null` fixo (cache quente e coleta fresca).
- Consumidores ajustados: `heroes.js` (fallback e lote usam `prior: null` /
  `walkPriorStamp(null)`), `gems.js` e `views.js` (herdavam `fetched.prior`, que
  agora é sempre `null`), `buildsAggregate.js` (fallback `prior: null`).

### 4. Contrato de wire preservado

`rankLot` continua expondo o campo `prior`, agora sempre `null`; `walkPriorStamp(null)`
devolve `"flat"`. Então:

- `/heroes` mantém `prior: "flat"` e `meta.prior: "flat"`;
- nenhuma rota que faz `f.prior ?? null` precisou mudar de forma;
- o tipo `prior?: string` em `app/web` segue válido (a web só não o exibe).

Os números de `/heroes`, porém, **mudam de valor**: sem prior encadeado, o shrinkage
de cada lote parte do zero (baseline do próprio lote). Não é quebra de tela — é
mudança de estimativa, aceita na decisão L3.

### 5. `@radar/engine` intocada

As primitivas puras `summarizeWalkPosterior`, `isValidWalkPrior`, `walkPriorStamp`
e `assessSeries` **permanecem** no barrel e no `index.d.ts`. Motivos:

- são biblioteca pura, sem I/O, com testes próprios (`engine.test.js`);
- o barrel é o contrato público do motor (ADR-064) e o gate de fronteiras não exige
  remoção do lado do pacote — removê-las seria uma segunda decisão (poda de
  contrato) fora do escopo desta tarefa;
- o app apenas deixou de consumi-las. A dívida fica registrada aqui: se ninguém
  voltar a consumir, elas são candidatas a poda numa futura revisão do contrato.

## Alternativas rejeitadas

1. **Manter só o último posterior (1 linha, sem histórico nem rotas).** Preserva os
   números do walk-forward com ~80% menos código. Rejeitada pelo usuário: o produto
   só exibe dados; o encadeamento temporal não agrega nada ao que é mostrado.
2. **Manter o histórico como auditoria, sem walk-forward.** Ainda carregaria
   `snapshotHistory.js`, 2 tabelas, retenção, 2 rotas e seus testes — custo sem
   consumidor. Rejeitada.
3. **Remover também as primitivas de walk-forward da engine.** Misturaria duas
   decisões (remoção do mecanismo na API + poda do contrato do motor). Fica adiada;
   ver Decisão 5.
4. **Desligar por flag (env) em vez de remover.** Deixaria o código morto no repo
   e a manutenção de dois caminhos. Rejeitada.

## Consequências

Positivas: menos ~290 linhas de produção e ~2 arquivos de teste; nenhuma superfície
HTTP/DB sem consumidor; `/meta/status` mais enxuto; sem acoplamento tempo→prior em
três consumidores; menos estado persistente para o produto “consome e exibe”.

Negativas / custos:

- Números de `/heroes` deixam de ser refinados por prior; `meta.prior` é sempre
  `"flat"`.
- Bancos já existentes ficam com tabelas `snapshot_history*` órfãs em disco (sem
  custo em runtime; limpeza manual se desejado).
- As primitivas de walk-forward da engine ficam órfãs no contrato (ver Decisão 5).

## Verificação

Gates executados após a mudança (todos verdes):

- `npm run check:boundaries` — BOUNDARIES OK (49 valores, 32 imports, 128 nomes).
- `npm run check:api` — `tsc`/`checkJs` OK.
- motor `packages/engine` 252/252; API 135/135; web 40/40.
