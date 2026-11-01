# ADR-060 — Remediação da auditoria 2026-10-31: fatiar arquivos grandes e DI no composition root

- Data: 2026-10-31 · Autor: saas-lead
- Status: **aceito e executado**
- Relação: executa a `auditoria-arquitetura-2026-10-31.md` (Problemas 1–4) e o
  critério de aceite nº 1 da ADR-041 (teto de 300 linhas). O Problema 5 já estava
  resolvido e não foi tocado.

## Contexto

A auditoria de 2026-10-31 apontou cinco problemas. Quatro exigiam ação:

1. **P1/P2 — arquivos de 800+ linhas** na web (`BuildManager.tsx` 1008,
   `ItemComposer.tsx` 834, `buildManager.ts` 566, `HeroDetail.tsx` 500) e
   `suggestions.ts`, que concentravam render, orquestração e cálculo.
2. **P3 — sem DI no composition root:** `rankLot.js`, `buildsAggregate.js` e
   `routes/builds.js` importavam `infra/cacheStore.js` e `providers/arena`
   diretamente (o que a ADR-033 previa proibir, registrado como desvio da F5).
3. **P4 — handler HTTP acumulando orquestração:** `routes/builds.js:50-115`
   orquestrava 3 chamadas concorrentes e mapeava ~66 linhas de payload.
4. **P5 — manifestos de pacote** — já resolvido (`"packageManager": "npm@11.12.1"`
   presente, sem `bun.lock`); **não mexer**.

## D1 · Web fatia pelos eixos de responsabilidade (P1/P2)

Nenhum arquivo grande foi apenas "cortado em pedaços": cada extração tem um eixo
(núcleo puro / hook de estado / apresentação) e um motivo.

| Arquivo original | Antes | Depois | Extraídos |
|---|---|---|---|
| `shared/domain/buildManager.ts` | 566 | 225 (núcleo + barrel) | `buildCommon.ts`, `buildSlotEdit.ts`, `buildRunes.ts` |
| `features/build-manager/BuildManager.tsx` | 1008 | 243 | `useBuildManagerUrl`, `useBuildManagerData`, `useBuildDerivations`, `usePickerCatalogs`, `useBuildEditor`, `BuildManagerAtoms.tsx`, `BuildManagerBaseCard.tsx` |
| `shared/ui/patterns/ItemComposer.tsx` | 834 | 234 | `composerModel.ts` (puro), `ComposerSlots/Nav/Power/Catalog/ItemGrid/SpellGrid.tsx` |
| `features/hero-detail/HeroDetail.tsx` | 500 | 259 | `HeroTabs.tsx`, `HeroEmptyState.tsx`, `sections/LaneBuilds.tsx` |
| `model/suggestions.ts` | — | 218 | `model/suggestionFactors.ts` |

- `buildManager.ts` virou **núcleo + barrel** (`export * from "./buildSlotEdit.js"`):
  os ~40 call sites e os testes existentes não mudam de `from`.
- `ItemComposer.tsx` **reexporta** `ComposerItem`/`ComposerSpell`/`ComposerPower`/
  `ItemComposerProps`, preservando a superfície pública consumida por
  `BuildManager.tsx`.
- Guardião `guardian-build-manager.mjs` passou a concatenar a **camada de tela da
  feature** (BuildManager + hooks + átomos), não um arquivo só: os invariantes da
  ADR-047 valem para a camada, não para um arquivo.

## D2 · Gate: pureza de `shared/domain` por transitividade

- A regra "`shared/domain/*` só importa runtimes de `shared/format`" foi relaxada
  para **permitir importar runtime de irmão de `shared/domain/`**. A pureza passa a
  ser avaliada **por transitividade**: o grafo de domínio continua sem `api`/React,
  mas um núcleo pode compor outro núcleo irmão (foi o que o split exigiu).
- `LOC_BASELINE` caiu de **12 → 8** entradas. Foram pagas: `BuildManager.tsx`
  (1008), `ItemComposer.tsx` (834), `buildManager.ts` (566) e `HeroDetail.tsx`
  (500). `buildsAggregate.js` da API **encolheu** 394 → 371 (segue na dívida, mas
  não cresceu).

## D3 · Backend: DI no composition root (P3)

O padrão adotado é **fábrica + composition root**, sem framework:

- `application/rankLot.js` → `createRankLot({ arena, cacheStore, snapshotHistory, versions, engine })`.
  As funções **puras** `normalize`, `lanesFromRoadsort` e `ROAD_SORT_TO_LANE`
  continuam exportadas no módulo (os testes importam direto).
- `application/buildsAggregate.js` → `createBuildsAggregate({ arena, cacheStore, singleFlight, scoring, rankLot, versions, canonical, engine })`.
  As peças puras da borda (`AGG_TOP_VALUES`, `AGG_TOP_ALL`, `aggCacheKey`,
  `withAggCacheMeta`) foram para `buildsAggregateModel.js` (reexportadas) e a prep
  de catálogos/posições para `buildsAggregateCatalog.js` — corte feito **para
  respeitar o teto de 300 linhas**.
- `app/api/src/composition.js` (novo) é o **único módulo** que liga `providers/`
  (Arena) e `infra/` (cache, histórico) a esses casos de uso. Ele publica as
  instâncias (`rankLot`, `buildsAggregate`, `heroBuilds`); os consumidores
  (`application/heroLanes.js`, `application/heroDraftScore.js` e as rotas
  `heroes`/`views`/`heroDetails`/`gems`/`builds`) importam a instância já ligada
  dali — nunca a infraestrutura.

**Escopo pago e dívida registrada (honestidade):** este ADR paga exatamente os três
arquivos que a auditoria **evidenciou** no Problema 3 (`rankLot.js`,
`buildsAggregate.js`, `routes/builds.js`) e estabelece o composition root. Outros
módulos de `application/`/`routes/` ainda importam `infra`/`providers`
diretamente (`catalogs`, `matchupBook`, `heroLanes`, `heroDraftScore`, `scoring`,
`validation`, `versions` e as rotas de catálogo/matchups/snapshots/meta). Eles
migram para o mesmo desenho quando tocados — a fundação já existe.

## D4 · Rota fina + `heroBuilds.js` (P4)

- `routes/builds.js` caiu de **125 → 49 linhas**: só valida (status codes, ranks,
  janela, lane, top, population) e delega. O agregado ganhou `buildsAggregate.serve(params)`
  (cache quente/SWR/fan-out) e a rota não toca cache nem upstream.
- **Desvio registrado:** a auditoria sugeria mover a normalização de builds por
  herói para `application/buildsAggregate.js`. Destino escolhido:
  **`application/heroBuilds.js`** (novo), porque "builds de UM herói numa lane" é
  um caso de uso **distinto** da "visão de sistema" agregada — juntar os dois
  recriaria o arquivo grande que a auditoria quer eliminar. `normalizeHeroBuilds`
  fica **puro e testável**; a fábrica `createHeroBuilds({ arena, cacheStore, catalogs })`
  faz cache + orquestração.

## D5 · Manifestos (P5)

Já conforme: `"packageManager": "npm@11.12.1"` no `package.json` raiz e ausência de
`bun.lock`. Sem ação.

## Critérios de aceite

- [x] Nenhum arquivo acima de 300 linhas fora da allowlist (`check:boundaries`
      100% PASS; dívida **12 → 8**).
- [x] `buildsAggregate.js` não cresceu (394 → 371).
- [x] Os três arquivos do Problema 3 não importam mais `infra`/`providers`.
- [x] `routes/builds.js` só valida e delega.
- [x] `npm test` da API verde (154/154) e da web verde; `typecheck` e `build` OK.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Framework de DI (awilix/tsyringe) | Um grafo pequeno e explícito não justifica dependência nova; a ADR-041 item 3 já rejeitou peso de camada. |
| Deixar `rankLot` como singleton importando a infra | É exatamente o acoplamento do Problema 3; sem fábrica não há como injetar. |
| Mover a normalização por herói para `buildsAggregate.js` | Recria arquivo grande (auditoria P1) e mistura dois casos de uso. |
| Cortar os arquivos grandes por "linhas" e não por eixo | Produz fragmentos sem dono; cada extração precisa de responsabilidade declarada. |
