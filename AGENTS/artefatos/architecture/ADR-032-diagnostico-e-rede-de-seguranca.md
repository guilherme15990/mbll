# ADR-032 — Diagnóstico e rede de segurança antes da refatoração (Fase F0)

- Data: 2026-10-24
- Status: aceito
- Escopo: `apps/api`, `apps/web`, `packages/proprietary-engine`, processo de trabalho

## Contexto

O projeto nasceu como protótipo de análise (fase 1) e evoluiu para 18,6k linhas
(api 1.410 · engine 5.471 · web 12.281) sem controle de versão, lint, CI ou
cobertura medida. Antes de mover qualquer arquivo era preciso responder: *o que
está quebrado hoje, e como saber que continua igual depois?*

Baseline medido nesta máquina (Node v24.11.1), antes de qualquer alteração:

| Suíte | Resultado |
|---|---|
| `packages/proprietary-engine` | 219/219 · cobertura 94,60% linhas / 74,78% branches / 91,60% funcs |
| `apps/api` | 26/27 — **1 falha pré-existente** · cobertura 47,32% linhas / 39,95% funcs (`routes.js` 46,98%) |
| `apps/web` | guards + smoke PASS · `tsc --noEmit` exit 0 · cobertura não mensurável (sem runner de DOM) |

## Decisão 1 — Versionar o estado atual antes de tocar em código

`git init` + commit de baseline do estado verificado. Sem isso não há diff,
revert nem revisão para uma refatoração estrutural.

Consequências: `*.zip` (33 MB + 2 arquivos) passam a ser ignorados; `data/`,
`dist/`, `*.sqlite` e `.env*` já estavam/são ignorados. `.env.example` é o único
arquivo de configuração versionado.

> **NOTA (2026-11-01, ADR-068).** O `.env.example` foi **removido**; a
> documentação das variáveis passou para o topo de `app/api/src/infra/config.js`.

## Decisão 2 — Testes da API deixam de compartilhar o SQLite de dev

**Problema comprovado.** `apps/api/src/cache.js` resolve `SQLITE_FILE` e abre o
banco no topo do módulo (top-level await). Sem env própria, todo `node --test`
gravava no `./data/cache.sqlite` **relativo ao cwd** — o mesmo arquivo do dev.
Como o histórico é append-only, cada execução acumulava linhas:

- `apps/api/data/cache.sqlite`: 701 linhas em `snapshot_history` (201 de `test_hist`);
- `apps/web/data/cache.sqlite`: 800 linhas; `apps/api/src/data/`: 3; `data/`: 2
  → **quatro bancos** por causa de um caminho relativo ao cwd.

**Falha reproduzível** (`apps/api/test/routes.test.js:95`): o teste insere o
snapshot nº 202 e busca em `listSnapshots(..., limit=200)`; a consulta usava
`ORDER BY coletado_em ASC LIMIT 200`, ou seja, devolvia **as 200 mais antigas** —
a linha recém-gravada nunca voltava. O teste ficava vermelho para sempre e piorava
a cada execução.

**Decisão:** `apps/api/test/support/env.mjs` (primeiro import do arquivo de teste)
aponta `SQLITE_FILE` para um arquivo temporário único por processo e remove no
exit. `SQLITE_CACHE=on` de propósito: o caminho SQLite precisa ser exercitado —
foi nele que o bug apareceu (`builds-aggregate.test.js` já usava `SQLITE_CACHE=off`,
o que mascarava essa classe de falha).

## Decisão 3 — `listSnapshots` seleciona a janela MAIS RECENTE, mantendo ordem ASC

`ORDER BY coletado_em DESC LIMIT n` + `reverse()` (e `slice(-lim)` no fallback em
memória). A ordem de saída continua **ASC** porque os consumidores dependem disso:
`lastVerifiedPosterior` lê o último item como "mais novo" e `/snapshots/:ts/diff`
usa `filter(t < ts).pop()` / `find(t > ts)`.

Isso corrige duas coisas de uma vez: o teste (evidência) e a semântica da rota
`/snapshots`, que devolvia o passado distante justamente quando a série crescia.

## Consequências

- Suíte da API: **28/28**, determinística em 3 execuções consecutivas.
- Nenhum contrato de resposta mudou (`/snapshots` mantém `data` ASC, mesmos campos).
- Dados de teste antigos em `apps/api/data/cache.sqlite` **não** foram apagados
  (append-only; remoção exige decisão explícita) — eles agora são irrelevantes
  para os testes.
- Fica registrado como dívida: o caminho do banco depende do `cwd` (resolver na
  F3 com `DATA_DIR` explícito) e a escrita SQLite é síncrona no event loop.
