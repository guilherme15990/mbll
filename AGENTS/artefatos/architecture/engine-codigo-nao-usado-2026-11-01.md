# Auditoria — uso do código da `@radar/engine`

- Data: 2026-11-01 · Autor: saas-lead
- Escopo: todo o `packages/engine/src` (20 arquivos, 275 declarações de topo exportadas)
- Objetivo: identificar código **não usado** (morto ou só exposto sem consumidor real)
- Relação: continua as ADR-061/062/063 (limpeza da engine). Complementa o laudo
  `engine-legado-2026-11-01.md`.

## Como foi medido

Script de cruzamento (não inspeção visual):

1. Extrai **todo** nome exportado de cada arquivo de `packages/engine/src`
   (`export function|class|const|let|var` + blocos `export { … }`).
2. Conta ocorrências como **palavra inteira** (`(?<![\w$])NAME(?![\w$])`) em cada
   grupo de consumidores, com **comentários removidos** (evita falso-positivo de JSDoc;
   strings preservadas — método do laudo).
3. Grupos: **app** = `app/api/src` + `app/web/src`; **teste** = `packages/engine/test`
   + `app/{api,web}/test`; **interno** = outros arquivos de `src` da engine (import por
   caminho profundo). O **barrel (`index.js`) é excluído** como consumidor (re-export
   não é uso).

Caveats honestos:
- Nomes acessados só de forma dinâmica (`obj[name]`) ou como chave de string não são
  vistos. Não é o caso aqui (a engine é consumida por import estático).
- `import type { … }` do app **conta** como uso (é contrato de tipo, legítimo).
- O app também consome a engine por um **namespace** (`composition.js` →
  `createRankLot`/`createBuildsAggregate` destruturam `engine`), por isso a contagem
  por palavra (57) é maior que os 34 imports nomeados explícitos.

## Resumo executivo

| Categoria | Qtd |
|---|---:|
| Exportadas (topo) | 275 |
| **A. Código morto de verdade** (0 referência em qualquer lugar) | **0** |
| **E. Locais não-exportados nunca referenciados** | **0** |
| B. `export` redundante (usado **só** no próprio arquivo) | 110 |
| C. Só-testes (contrato público sem consumidor no app) | 67 |
| C2. Teste + interno (app não usa) | 10 |
| D. Só-interno-engine (app/teste não usam) | 31 |
| App-referenciadas | 57 |

**Punchline:** *nenhum* trecho da engine é código morto — tudo executa e é exercitado.
O problema não é código morto, é **superfície pública excedente**: o barrel expõe 141
nomes, dos quais só **48** têm consumidor no app; os outros **93** existem só para
testes, só para uso interno ou nem isso.

## Barrel (`index.js`) — o contrato público

| Medida | Valor |
|---|---:|
| Nomes exportados pelo barrel | 141 |
| Com consumidor no app | **48** |
| **Sem** consumidor no app | **93** |
| ↳ só-testes | 67 |
| ↳ só-interno | 16 |
| ↳ teste + interno | 10 |
| ↳ mortos | **0** |

> Dos 141, 9 nomes aparecem no app apenas como **tipo** (não têm export runtime no
> barrel): `BuildTagKey`, `BuildTagTone`, `PatternScope`, `DiscoveryStatus`,
> `WeightingSensitivity`, `ItemsetStatus`, `Tier`, `pairSynergy`, `pairMatchup`.

## A / E — Código morto de verdade: **nenhum**

Nenhuma função/classe/constante exportada ficou sem **nenhuma** referência, e nenhum
local não-exportado de topo ficou órfão. A limpeza das ADR-062 (códigos mortos) e a
poda de versões/structs (ADR-063) já eliminaram os órfãos.

## B — `export` redundante (110)

Usados **apenas dentro do próprio arquivo**: o `export` não serve a ninguém.
O **código é vivo** (executa), só a palavra-chave `export` é dispensável — ou é uma
escolha consciente de "API de módulo".

Sub-natureza:

- **Structs de estado (por design — ADR-063):** `AggregateKind`, `CellStatus`,
  `EquipmentArchetype`, `EquipmentType`, `SupportMode`, `SupportStatus`, `PickSumStatus`,
  `BuildQuadrant`, `ComponentKind`, `ContrastEvidence`, `ContrastMode`, `BuildSupport`,
  `BuildUnit`, `CalibrationVerdict`, `PlaystyleKey`, `HeroContractCategory`,
  `TrendDir`, `DatedDirection`, `Robustness`, `MetaTrendVerdict`, `LaneTimingVerdict`,
  `SegmentMove`, `TrendWord`, `SignalState`, `SeriesAssessmentStatus`, `SnapshotStatus`,
  `CounterVerdict`, `EvidenceQuality`, `DurationProfile`, `IntervalStatus`, `PairType`,
  `PairUnit`, `DsUnitStatus`, `SafetyStatus`, `RobustnessStatus`, `SafetyLabel`,
  `SafetyGuide`, `PickFavorabilityKey`, `PickFavorabilityLabel`, `PickFavorabilityTone`.
  → Foram exportados de propósito (não-barreados). Se nada importa, `export` é opcional.

- **Constantes de tuning internas:** `COMBINER_BASE/POINTS_PER_PP/SHRINK_K/SLOTS`,
  `ITEM_MIN_*`, `ITEMS_MAX_ROWS`, `EMBLEM_MIN_*`, `EMBLEMS_MAX_ROWS`, `PACKAGE_*`,
  `PACKAGES_MAX_ROWS`, `RUNE_MIN_*`, `RUNES_MAX_ROWS`, `SET_MIN_*`,
  `SET_MAX_PER_ARCHETYPE`, `TALENTS_MAX_PER_TIER`, `VARIANTS_MAX_CORES`, `BUILD_ADJUST_K`,
  `BUILD_QUADRANT_POPULAR_PICK`, `BUILD_QUADRANT_HIGH_LIFT`, `DS_K`, `DS_PAIR_DAMPING`,
  `PAIR_FALLBACK_PICK`, `VAR_UNIT`, `PICK_BASELINE_WR`, `TREND_DELTA_BAN/PICK/WIN`,
  `WF_VERSION_BREAK_VARIANCE_FACTOR`, `FDR_ALPHA`, `GEM_QUANTILE`, `EPS`,
  `STRENGTH_MODEL`, `ARCHETYPE_LABELS`, `EMPTY_BOOK`.

- **Funções/classes internas do arquivo:** `absDelta`, `asHero`, `exposurePick`, `idOf`,
  `numOrNull`, `pairExposure`, `shrinkEffect`, `durationCurveDetailed`, `parseRawBuilds`,
  `archetypeOfItems`, `pctFromRank`, `rankQuantiles`, `compareById`, `averageRanks`,
  `averageStrengthOfDetailed`, `selectLevelPopularityCandidates`, `HeroProfile`,
  `HeroLists`, `HeroSorting`, `HeroTier`, `StrengthIndex`, `HeroScorer`,
  `MadBaselineEstimator`, `EmpiricalBayesShrinkage`, `SignificanceTester`,
  `BatchMetaBuilder`, `HeroTrendAnalyzer`, `HeroTrustPolicy`.

**Concentração:** `builds/aggregate.js` (33), `heroes/trends.js` (15),
`matchups/draft-score.js` (13), `heroes/scoring.js` (11), `heroes/ranking.js` (10).

## C — Só-testes (67) — export público sem consumidor no app

Todos no barrel. Testados, mas **nenhuma tela/rota do app usa**. São a maior parte do
excedente do contrato. (Ver lista completa no Anexo I.)

## C2 — Teste + interno (10) — app não usa

`benjaminiHochberg`, `obsVariance`, `pFromZ`, `ebShrink` (statistics) · `mad`,
`medianNull`, `quantile` (math) · `CONTRAST_MIN`, `contrastEstimates`, `valueFieldsOf`
(contrast). São utilitários de estatística/contraste usados pela própria engine e
cobertos por teste.

## D — Só-interno-engine (31) — export público redundante

16 estão no barrel mas só a própria engine consome:
`confidenceTrio`, `CONTRAST_EVIDENCE_RULE`, `CONTRAST_SHRINK_K`, `DELTA_DEFAULT`,
`DURATION_BANDS`, `HeroResultAssembler`, `HeroRowValidator`, `LotRanking`, `makeExposure`,
`MIN_LIFT_SIGNAL`, `MIN_SUPPORT_N`, `POPULAR_PICK_MIN`, `PRACTICAL_DELTA`, `RARE_PICK_MAX`,
`SEVERE_COUNTER_DELTA`, `WalkForwardPrior`.

15 **não** estão no barrel (exports de módulo para uso interno):
`BuildReferenceKind`, `CalibrationStatus`, `CausalStatus`, `ClassificationStatus`,
`Coverage`, `DataStatus`, `DeltaStatus`, `EvidenceStatus`, `ExposureStatus`,
`ExposureUnit`, `InferenceStatus`, `QStatus`, `TrustClass`, `UncertaintyStatus`,
`UnitStatus` — os structs transversais de `core/states.js`.

## Por arquivo

| Arquivo | decl | app | teste | interno | morto | só-próprio |
|---|---:|---:|---:|---:|---:|---:|
| builds/aggregate.js | 48 | 10 | 9 | 1 | 0 | 33 |
| builds/contrast.js | 14 | 0 | 6 | 5 | 0 | 6 |
| builds/itemsets.js | 8 | 8 | 7 | 2 | 0 | 0 |
| builds/lift.js | 11 | 5 | 6 | 1 | 0 | 3 |
| core/config.js | 5 | 3 | 2 | 3 | 0 | 0 |
| core/math.js | 5 | 2 | 5 | 5 | 0 | 0 |
| core/states.js | 13 | 0 | 0 | 13 | 0 | 0 |
| core/statistics.js | 7 | 0 | 7 | 4 | 0 | 0 |
| core/thresholds.js | 6 | 0 | 0 | 6 | 0 | 0 |
| heroes/assembler.js | 2 | 0 | 0 | 2 | 0 | 0 |
| heroes/profile.js | 11 | 1 | 8 | 0 | 0 | 3 |
| heroes/ranking.js | 30 | 4 | 17 | 2 | 0 | 10 |
| heroes/scoring.js | 14 | 1 | 3 | 0 | 0 | 11 |
| heroes/trends.js | 35 | 4 | 16 | 1 | 0 | 15 |
| heroes/trust.js | 6 | 1 | 3 | 2 | 0 | 1 |
| matchups/blind-pick.js | 13 | 3 | 5 | 0 | 0 | 8 |
| matchups/counters.js | 27 | 11 | 13 | 1 | 0 | 7 |
| matchups/draft-patterns.js | 1 | 1 | 1 | 0 | 0 | 0 |
| matchups/draft-score.js | 20 | 3 | 7 | 0 | 0 | 13 |

## Recomendações

> **EXECUTADO (2026-11-01) — ver ADR-064.** P1 e P2 abaixo foram aplicados. Resultado
> no fim deste relatório ("Resultado executado"). O item 3 (só-interno no barrel) foi
> absorvido pelo P2.

**Nada a *deletar*** (A/E = 0). O ganho está em **encolher a superfície e limpar
`export`**:

1. **P1 — tirar `export` dos 110 de B** (deixar só `const`/`function`/`class` locais).
   Zero impacto em consumidor (ninguém importa). ~~Exceto os structs, se quiser mantê-los
   como API de módulo por design.~~ → **decidido: também removidos** (ninguém os importa;
   supersede a nuance da ADR-063).
2. **P2 — encolher o barrel para o contrato real do app (48)**: remover os 93 sem
   consumidor no app do `index.js` + `index.d.ts`. Exige reescrever os testes que
   importam pelo barrel para caminho profundo. **Mudança de contrato → ADR própria**
   (feito: ADR-064). Na execução, o KEEP virou **49** (entrou `assessSeries`, usado pelo
   teste da API — ver ADR-064, D2).
3. **Opcional** — para os 16 "só-interno" no barrel, a remoção é ainda mais segura: os
   consumidores já são a própria engine.

## Anexo I — lista dos 67 "só-testes"

`adjustedLiftByAttr`, `agreementForPair`, `assessSeries`, `averageStrengthOf`,
`buildQuadrant`, `calibrateOwnVsGlobal`, `classifyEquipmentItem`, `clusterPlaystyle`,
`compareCounterRelation`, `comparePairsByDeltaAsc`, `comparePairsByDeltaDesc`,
`compareToPattern`, `componentsOfBuild`, `contextContrasts`, `COUNTER_MIN_ABS_DELTA`,
`COUNTER_MIN_PAIRS`, `detectMetaTrend`, `detectPackages`, `DS_OFFLANE_PENALTY_PP`,
`DS_PRIOR_VAR`, `DS_UNIT_STATUS`, `expectedForTarget`, `firstPairByDeltaAsc`,
`getRankProfileLabel`, `getSafetyClassification`, `getSignalStateBadge`, `HERO_CONTRACT`,
`heroRankPosition`, `heroRankPositions`, `interpretProbBand`, `invLogit`, `isShortSeries`,
`LANE_TIMING_DELTA`, `LANE_TIMING_MIN_WINDOWS`, `laneTimingCurve`, `logit`, `medianOf`,
`medianWrAdj`, `META_TREND_MIN_POINTS`, `parseBuild`, `percentileRank`, `PERSONAL_MIN_N`,
`PERSONAL_Z`, `PLAYSTYLE_MIN_MATCHES`, `poolProfile`, `PRACTICAL_DELTA_PP`, `RANK_ORDER`,
`refWinsOf`, `resolveTemporalSignal`, `safetyToGuide`, `scoreDraftCandidates`,
`scoreHeroes`, `selectConsistentCandidates`, `selectLaneTopHeroes`, `seriesSpanDays`,
`seriesSpanMs`, `sortHeroesByMetric`, `strengthIndexByRank`, `TIER_ORDER`, `tierOf`,
`topBansByBan`, `topGemsByStrengthLowPick`, `TREND_DELTA`, `TREND_N`, `trendDirectionOf`,
`trendOf`, `verdictShort`.

## Anexo II — lista dos 110 "só-próprio-arquivo"

`AggregateKind`, `ARCHETYPE_LABELS`, `archetypeOfItems`, `CellStatus`, `COMBINER_BASE`,
`COMBINER_POINTS_PER_PP`, `COMBINER_SHRINK_K`, `COMBINER_SLOTS`, `EMBLEM_MIN_BUILDS`,
`EMBLEM_MIN_CONTEXTS`, `EMBLEMS_MAX_ROWS`, `EquipmentArchetype`, `EquipmentType`,
`ITEM_MIN_BUILDS`, `ITEM_MIN_CONTEXTS`, `ITEMS_MAX_ROWS`, `PACKAGE_INSEPARABLE_MIN`,
`PACKAGE_MIN_BOTH`, `PACKAGE_MIN_BUILDS`, `PACKAGE_MIN_CONTEXTS`, `PACKAGES_MAX_ROWS`,
`parseRawBuilds`, `PickSumStatus`, `RUNE_MIN_BUILDS`, `RUNE_MIN_CONTEXTS`,
`RUNES_MAX_ROWS`, `SET_MAX_PER_ARCHETYPE`, `SET_MIN_BUILDS`, `SET_MIN_HEROES`,
`SupportMode`, `SupportStatus`, `TALENTS_MAX_PER_TIER`, `VARIANTS_MAX_CORES`,
`BUILD_QUADRANT_HIGH_LIFT`, `BUILD_QUADRANT_POPULAR_PICK`, `BuildQuadrant`,
`ComponentKind`, `ContrastEvidence`, `ContrastMode`, `BUILD_ADJUST_K`, `BuildSupport`,
`BuildUnit`, `CalibrationVerdict`, `HeroProfile`, `PlaystyleKey`, `averageRanks`,
`averageStrengthOfDetailed`, `compareById`, `HeroLists`, `HeroSorting`, `HeroTier`,
`pctFromRank`, `rankQuantiles`, `selectLevelPopularityCandidates`, `StrengthIndex`,
`BatchMetaBuilder`, `EmpiricalBayesShrinkage`, `EPS`, `FDR_ALPHA`, `GEM_QUANTILE`,
`HeroContractCategory`, `HeroScorer`, `MadBaselineEstimator`, `SignificanceTester`,
`STRENGTH_MODEL`, `DatedDirection`, `HeroTrendAnalyzer`, `LaneTimingVerdict`,
`MetaTrendVerdict`, `Robustness`, `SegmentMove`, `SeriesAssessmentStatus`, `SignalState`,
`SnapshotStatus`, `TREND_DELTA_BAN`, `TREND_DELTA_PICK`, `TREND_DELTA_WIN`, `TrendDir`,
`TrendWord`, `WF_VERSION_BREAK_VARIANCE_FACTOR`, `HeroTrustPolicy`, `PICK_BASELINE_WR`,
`PickFavorabilityKey`, `PickFavorabilityLabel`, `PickFavorabilityTone`, `RobustnessStatus`,
`SafetyGuide`, `SafetyLabel`, `SafetyStatus`, `CounterVerdict`, `durationCurveDetailed`,
`DurationProfile`, `EvidenceQuality`, `IntervalStatus`, `PairType`, `PairUnit`, `absDelta`,
`asHero`, `DS_K`, `DS_PAIR_DAMPING`, `DsUnitStatus`, `EMPTY_BOOK`, `exposurePick`, `idOf`,
`numOrNull`, `PAIR_FALLBACK_PICK`, `pairExposure`, `shrinkEffect`, `VAR_UNIT`.

## Resultado executado (P1 + P2) — 2026-11-01

Decisão em ADR-064. Resumo do que mudou:

| Ação | Antes | Depois |
|---|---:|---:|
| `export` redundante nos módulos (P1) | 110 | **0** |
| Nomes exportados pelo barrel `index.js` (P2) | 141 | **49** |
| Valores declarados em `index.d.ts` | 119 | **49** (+ todos os tipos preservados) |
| Testes da engine importando pelo barril | 12 | 5 (só KEEP) |
| Testes da engine por caminho profundo | — | 11 arquivos ajustados |

- **KEEP = 49** = tudo o que o código do app consome (`app/{api,web}/src` **e** os
  testes das apps). O único fora de `app/src` é `assessSeries` (usado por
  `app/api/test/routes.test.js`; o app não pode importar o interior do pacote).
- **REMOVE do barrel = 92** (só-teste + só-interno + teste-e-interno). Os testes
  internos da engine passaram a importá-los por caminho profundo
  (`../src/<bucket>/<arquivo>.js`).
- **Structs**: as co-localizadas perderam o `export` (P1); as transversais de
  `core/states.js` continuam `export` (a engine as importa). Nenhuma entrou no barrel.
- **Nada foi deletado** — a auditoria provou 0 código morto (A) e 0 local órfão (E).

**Gates (pós-execução, todos verdes):** engine 252/252 · api 154/154 · web 40/40 ·
`check:boundaries` OK (49 valores, 0 import sem declaração, 0 fantasma) ·
`check:api`/`check:web` (tsc) OK · `build` OK · 0 BOM.

> A contagem de testes da engine caiu de 253 → 252 porque o bloco `it("reexport")` de
> `relations-agreement.test.js` (que só provava a paridade de reexportação pelo barrel,
> agora inexistente por decisão) foi removido.
