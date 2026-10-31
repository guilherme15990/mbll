# ADR-056 — Builds → Sistema: recorte pela rota global e profundidade máxima

**Data:** 2026-10-30 · **Status:** aceito · **Contexto:** depois do menu horizontal
(ADR-055), o usuário pediu para limpar a aba **Builds → Sistema**: remover o cartão
de contexto `CTX-BDL`, remover o cartão "Lane + Profundidade" (com a legenda
"frio/quente"), usar as **rotas globais** do topo e considerar **sempre a maior
profundidade** (todos os heróis com dados, ignorando top-10/top-20).
**Relaciona-se a:** ADR-026 (fonte real), ADR-030 (builds + poder), ADR-047
(build management), ADR-055 (shell com menu horizontal).

## Contexto

O painel `/builds` (`view=system`, `BuildsAggregatePanel`) mantinha o recorte em
estado local da página:

- uma `CtxBar` (`CTX-BDL`) só de scaffolding;
- o cartão `LaneControls` com a lane (1 por carga) **e** a profundidade top-10/20,
  mais a legenda "frio: 4 cat. + 3 rank + N builds · quente: 0";
- a lane vinha de `?lane=` e a profundidade de `?top=`, parâmetros desconectados
  do filtro global de rota (`?lanes=`) que existe no cabeçalho.

O backend aceitava `top ∈ {10, 20}` (`AGG_TOP_VALUES`) e cortava o *roster* em
`ranked.slice(0, top)`: o agregado olhava só os N heróis mais usados da lane,
mesmo que a fonte tivesse 39–50 heróis com dados.

## Decisão

### D1 · A rota do agregado vem do filtro global
O agregado é **por rota** (1 lane por carga na fonte). A rota passa a ser lida do
filtro global `?lanes=`: `lane = lanes.length === 1 ? lanes[0] : ""`. O cartão de
lane e a `CtxBar` saem da página. Sem exatamente **uma** rota marcada no topo
(nenhuma, ou mais de uma), a tela mostra estado vazio pedindo a escolha — nunca
escolhe sozinha nem soma rotas.

> **Decisão do usuário (L3):** "Da Rota global do topo"; vazio ou >1 rota → estado
> vazio pedindo UMA rota.

### D2 · Profundidade máxima: todos os heróis com dados
O painel passa a pedir `top=all`. No backend, `all` desliga o corte:
`roster = ranked` (todos os heróis com dados na lane). `depth` vira `"all"` e o
contrato (`@radar/contracts`) passa a admitir `context.top: number | "all"`.

> **Decisão do usuário (L3):** "Sim, sempre todos": se há 39 heróis com dados,
> o agregado usa os 39 — contrariando os tetos top-10/top-20.

### D3 · Custo aceito e explicado
O fan-out é **1 request de build por herói com dados**. Sair de ≤20 para ~40–50
heróis aumenta o custo frio e o risco de 429 da fonte. Por isso o modo `all` usa
`perReqTimeout = 12 s` e `buildDeadlineMs = 30 s` (vs. 6–9 s do top-N), e o
`top=10|20` continua válido para as telas que precisam dele. O cache derivado C
24 h (quente = 0 requests) não muda. A decisão de custo é **do usuário** e está
registrada aqui.

### D4 · Escopo: "Builds + poder" fica fora
A aba **Builds + poder** (`view=power`, `BuildsPowerPanel`) tem o seu próprio
recorte local (lane + top-10/20) porque é uma lista item-a-item por herói, não o
panorama do sistema. Ela **não** foi alterada nesta rodada; se o usuário quiser
alinhá-la ao filtro global, é uma mudança separada.

## Consequências

- `app/web/src/features/builds/aggregate/LaneControls.tsx` é removido (sem uso).
- `BuildsAggregatePanel` cai de 309 para ~284 linhas e sai da allowlist de tamanho
  do `tools/check-boundaries.mjs` (a dívida só encolhe).
- `AGG_TOP_VALUES` continua `{10, 20}`; entra `AGG_TOP_ALL = "all"`. A validação da
  rota aceita `top=10|20|all` e o hint documenta os três.
- Testes: `app/api/test/contracts.test.js` cobre `top=all` (12 heróis do mock);
  `app/api/test/builds-aggregate.test.js` cobre a validação + `all` via cache;
  `app/web/test/ui/builds-panels.test.tsx` passa a usar `?lanes=` e cobre o estado
  "mais de uma rota marcada".

## Alternativas consideradas

- **Manter o cartão e só tirar a legenda:** não atende "considerar as rotas
  globais"; perpetuaria dois filtros de rota concorrentes.
- **Rota global com fallback (primeira marcada):** esconde a ambiguidade e
  inventaria um recorte; o estado vazio é mais honesto.
- **Teto de segurança para `all` (ex.: 50):** o usuário escolheu "sempre todos";
  o deadline da fase de builds já protege contra lentidão sem cortar o recorte.
- **Trocar `all` por um número sentinela (`top=0`):** menos explícito no contrato
  e no cache key; `"all"` se lê sozinho.
