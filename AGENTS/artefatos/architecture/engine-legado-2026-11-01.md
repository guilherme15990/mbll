# Laudo de legado — superfície pública da `@radar/engine`

Data: 2026-11-01 · Contexto: pós-consolidação (ADR-061) · Escopo: 212 nomes do barrel `packages/engine/src/index.js`

## Como foi medido

- Extração do barrel por `export { ... } from "./bucket/arquivo.js"` (comentários removidos, strings preservadas).
- Contagem de identificadores com **comentários e strings removidos** (evita falso positivo tipo `mad` dentro de comentário).
- Consumidores: `app/api/src`, `app/web/src`, `app/api/test`, `app/web/test` (app), `packages/engine/test` (testes) e `src` da engine (interno), sempre excluindo o próprio arquivo dono.
- Reconciliação: `logit` aparecia no app só em comentário/string → falso positivo, descartado.

## Resultado (212 nomes)

| Categoria | Qtd | Significado |
|---|---:|---|
| Contrato real (app) | 52 | importado/consumido pelo app |
| Só testes | 75 | ninguém no app/src; importado por testes da engine |
| Interno da engine | 27 | importado só por outro arquivo da engine (via caminho profundo) |
| **Export morto** | **53** | código vivo, mas usado só dentro do próprio arquivo — ninguém importa |
| **Código morto** | **5** | declarado, exportado e **nunca referenciado em lugar nenhum** |

> "Sem consumidor externo" = 58 nomes (53 export morto + 5 código morto).
> Nenhum arquivo `src` importa do barrel — logo os 27 "internos" têm export **redundante** no barrel.

## 1. Código morto — 5 (deletar declaração + linha do barrel + linha do `index.d.ts`)

| Nome | Arquivo | Observação |
|---|---|---|
| `DS_FALLBACK_PICK` | `matchups/draft-score.js` | alias de `PAIR_FALLBACK_PICK`, sem uso |
| `THRESHOLDS_VERSION` | `core/thresholds.js` | constante de versão sem uso |
| `TREND_PRACTICAL_DELTA_PP` | `heroes/trends.js` | threshold sem uso |
| `durationCurveV2` | `matchups/counters.js` | variante de `durationCurveDetailed`, nunca chamada |
| `trendSeriesDated` | `heroes/trends.js` | variante "dated", nunca chamada |

Estes dois últimos parecem **API escalonada** (V2/Dated) — confirmar intenção antes de apagar.

## 2. Locais não-exportados nunca usados — 2 (deletar direto, sem impacto no contrato)

- `builds/aggregate.js`: `PRIMARY_ARCHETYPES`, `CATALOG_ARCHETYPES` (arrays de string sem referência).

## 3. Export morto — 53 (tirar do barrel/`index.d.ts`; **manter o código**)

Usados só dentro do próprio arquivo. Nada externo (app/src/teste) importa.

- **Classes (16):** `HeroScorer`, `MadBaselineEstimator`, `EmpiricalBayesShrinkage`, `SignificanceTester`, `BatchMetaBuilder` (heroes/scoring) · `HeroLists`, `HeroSorting`, `HeroTier`, `StrengthIndex` (heroes/ranking) · `HeroProfile` (heroes/profile) · `HeroTrendAnalyzer` (heroes/trends) · `HeroTrustPolicy` (heroes/trust)
- **Const de versão/threshold:** `AGGREGATE_VERSION`, `ARCHETYPE_LABELS`, `BUILD_ADJUST_K`, `BUILD_QUADRANT_HIGH_LIFT`, `BUILD_QUADRANT_POPULAR_PICK`, `DS_K`, `DS_PAIR_DAMPING`, `PICK_BASELINE_WR`, `PICK_FAVORABILITY_VERSION`, `TREND_VERSION`, `TREND_DELTA_BAN/PICK/WIN`, `WF_VERSION_BREAK_VARIANCE_FACTOR`
- **Const de agregação (builds/aggregate):** `EMBLEMS_MAX_ROWS`, `EMBLEM_MIN_BUILDS`, `EMBLEM_MIN_CONTEXTS`, `ITEMS_MAX_ROWS`, `ITEM_MIN_BUILDS`, `ITEM_MIN_CONTEXTS`, `PACKAGES_MAX_ROWS`, `PACKAGE_INSEPARABLE_MIN`, `PACKAGE_MIN_BOTH`, `PACKAGE_MIN_BUILDS`, `PACKAGE_MIN_CONTEXTS`, `RUNES_MAX_ROWS`, `RUNE_MIN_BUILDS`, `RUNE_MIN_CONTEXTS`, `SET_MAX_PER_ARCHETYPE`, `SET_MIN_BUILDS`, `SET_MIN_HEROES`, `VARIANTS_MAX_CORES`
- **Funções:** `archetypeOfItems`, `parseRawBuilds`, `durationCurveDetailed`, `averageRanks`, `averageStrengthOfDetailed`, `compareById`, `pctFromRank`, `rankQuantiles`, `selectLevelPopularityCandidates`

## 4. Interno da engine — 27 (bolt no barrel é redundante)

Importados apenas por outro arquivo `src` por caminho profundo: `mad`, `quantile`, `medianNull`, `benjaminiHochberg`, `ebShrink`, `invLogit`, `logit`, `obsVariance`, `pFromZ`, `percentileRank`, `quantile`, `confidenceTrio`, `interpretProbBand`, `verdictShort`, `makeExposure`, `classOf`, `contrastEstimates`, `valueFieldsOf`, `CONTRAST_*` (3), `MIN_LIFT_SIGNAL`, `MIN_SUPPORT_N`, `POPULAR_PICK_MIN`, `PRACTICAL_DELTA`, `RARE_PICK_MAX`, `SEVERE_COUNTER_DELTA`, `DURATION_BANDS`, `DELTA_DEFAULT`, `TIER_VERSION`, `HeroResultAssembler`, `HeroRowValidator`, `LotRanking`, `WalkForwardPrior`.

## 5. Só testes — 75 (contrato testado; **manter**)

Importados por `packages/engine/test/*.test.js` (12 arquivos via barrel). Parte é API pública legítima e testada; podar só se os testes forem reescritos para outra fonte.

## Recomendação (3 passos, independentes)

1. **P0 — limpeza segura:** apagar os 5 mortos + 2 locais, e remover as linhas correspondentes de `index.js`/`index.d.ts`. Zero impacto em consumidor. Re-rodar `npm test -w packages/engine`, `check:boundaries`, `build`.
2. **P1 — encolher o barrel:** remover do barrel/d.ts os **53 export mortos** (código fica; só a superfície encolhe). Sem consumidor quebra.
3. **P2 — decidir sobre "só testes" (75)** e **"interno" (27):** reescrever os 12 testes para importar por caminho profundo e reduzir o contrato público ao que o app realmente usa (52). É mudança de **contrato**, não refatoração — exige atualizar ADR.

> P0/P1 não mudam comportamento. P2 muda o contrato público do pacote.

---

## Atualização — execução e refinamento (2026-11-01)

**P0 + P1 executados** (ADR-062). Barrel **212 → 154**; `index.d.ts` enxugado em
paridade. Gates verdes: engine 255/255, api 154/154, web 40/40, `check:boundaries`
OK, `build` OK, 0 BOM.

**Refinamento do bucket "só testes" (75), por origem do import:**

- **21** são importados pelos testes **via barrel** (`../src/index.js`) → contrato
  testado real, mantidos. Ex.: `logit`, `invLogit`, `percentileRank`, `parseBuild`,
  `buildQuadrant`, `adjustedLiftByAttr`, `BUILD_*_VERSION`.
- **54** são importados pelos testes **só por caminho profundo** → o export no
  barrel é redundante. Ex.: `COUNTER_*`, `DS_*`, `TREND_*`, `TIER_ORDER`,
  `RANK_ORDER`, `verdictShort`, `medianOf`, `refWinsOf`, `heroRankPosition`, …
  Estes **não** foram podados: estão fora do escopo aprovado (P0+P1).

**Escopo exato do P1:** os 53 "export mortos" (zero consumidor em qualquer forma).
`refWinsOf` pertence ao bucket "só testes" (deep), não aos 53 — foi mantido no
barrel por disciplina de escopo, embora seja candidato em P2.

**Contrato mínimo possível (P2, não feito):** ~52 (app) + 21 (testado via barrel)
= **73 nomes** públicos. Requer reescrever 12 testes para caminho profundo e nova ADR.

---

## Atualização — sem versão e structs de estado (2026-11-01, ADR-063)

Continuação da limpeza (ADR-063), sem mudar comportamento observável:

- **Carimbo de versão removido.** Apagadas as constantes `*_VERSION` do motor e os
  campos `version`/`formula`/`tier_version`/`model_version`; `index_basis.method` saiu
  do contrato; cache do hero-draft-score sem versão. JSDoc que anunciava `version` em
  `clusterPlaystyle`/`poolProfile`/`seriesDated`/`laneTimingCurve` foi corrigido.
  Mantidos por serem **domínio/config**: `game_version`, `version_break`/`versionBroken`,
  `WF_VERSION_BREAK_VARIANCE_FACTOR`, `STRENGTH_MODEL` (e `LOADOUT_VERSION`, web, fora do escopo).
- **Structs de estado.** 62 objetos congelados com os nomes canônicos; **transversais**
  em `core/states.js` (13) e **específicos** co-localizados no módulo dono (49). O
  `DeltaStatus` foi deduplicado para `core/states.js`. Structs **não** entram no barrel
  (evita exigir decl no `index.d.ts`; mantém a paridade do `check:boundaries`).
- Barrel do motor: **154 → 141** export. `index.d.ts` continua sem qualquer carimbo de
  versão (só `game_version`/`version_break` de domínio).
- Gates: engine **253/253**, api **154/154**, web **40/40**, `check:boundaries` OK,
  `check:api`/`check:web` OK, `build` OK, 0 BOM.
