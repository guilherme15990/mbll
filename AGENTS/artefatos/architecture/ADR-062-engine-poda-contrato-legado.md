# ADR-062 — Poda da superfície pública da `@radar/engine` (código e export mortos)

- Data: 2026-11-01 · Autor: saas-lead
- Status: **aceito e executado**
- Relação: complementa a ADR-061 (que registrou a poda como pendência). **Não muda
  comportamento**: só remove nomes sem consumidor do barrel e código inalcançável.
  Laudo de origem: `AGENTS/artefatos/architecture/engine-legado-2026-11-01.md`.

## Contexto

Após a consolidação da ADR-061, o barrel (`packages/engine/src/index.js`) expunha
**212** nomes. Medição limpa (comentários/strings removidos antes de contar)
categorizou cada nome por consumidor:

| Categoria | Qtd |
|---|---:|
| Contrato real (app) | 52 |
| Só testes | 75 |
| Interno da engine (import por caminho profundo) | 27 |
| **Export morto** — nenhum consumidor | 53 |
| **Código morto** — declarado e nunca referenciado | 5 |

Nenhum arquivo `src` importa do barrel; o contrato real é, portanto, o que
app/teste puxam por `@radar/engine`.

## Decisão

### D1 — Apagar o código morto (P0)

Removidos (declaração + linha do barrel + linha do `index.d.ts`):

| Nome | Arquivo |
|---|---|
| `DS_FALLBACK_PICK` | `matchups/draft-score.js` |
| `durationCurveV2` | `matchups/counters.js` |
| `trendSeriesDated` | `heroes/trends.js` |
| `TREND_PRACTICAL_DELTA_PP` | `heroes/trends.js` |
| `THRESHOLDS_VERSION` | `core/thresholds.js` |

Locais não-exportados nunca usados (deletados, sem efeito no contrato):
`PRIMARY_ARCHETYPES` e `CATALOG_ARCHETYPES` em `builds/aggregate.js`.

### D2 — Encolher o barrel: remover os 53 export mortos (P1)

Nomes sem **nenhum** consumidor (nem app, nem `src` de outro módulo, nem testes):
`AGGREGATE_VERSION`, `ARCHETYPE_LABELS`, `BUILD_ADJUST_K`,
`BUILD_QUADRANT_HIGH_LIFT`, `BUILD_QUADRANT_POPULAR_PICK`, `BatchMetaBuilder`,
`DS_K`, `DS_PAIR_DAMPING`, `EMBLEMS_MAX_ROWS`, `EMBLEM_MIN_BUILDS`,
`EMBLEM_MIN_CONTEXTS`, `EmpiricalBayesShrinkage`, `HeroLists`, `HeroProfile`,
`HeroScorer`, `HeroSorting`, `HeroTier`, `HeroTrendAnalyzer`, `HeroTrustPolicy`,
`ITEMS_MAX_ROWS`, `ITEM_MIN_BUILDS`, `ITEM_MIN_CONTEXTS`, `MadBaselineEstimator`,
`PACKAGES_MAX_ROWS`, `PACKAGE_INSEPARABLE_MIN`, `PACKAGE_MIN_BOTH`,
`PACKAGE_MIN_BUILDS`, `PACKAGE_MIN_CONTEXTS`, `PICK_BASELINE_WR`,
`PICK_FAVORABILITY_VERSION`, `RUNES_MAX_ROWS`, `RUNE_MIN_BUILDS`,
`RUNE_MIN_CONTEXTS`, `SET_MAX_PER_ARCHETYPE`, `SET_MIN_BUILDS`,
`SET_MIN_HEROES`, `SignificanceTester`, `StrengthIndex`, `TREND_DELTA_BAN`,
`TREND_DELTA_PICK`, `TREND_DELTA_WIN`, `TREND_VERSION`, `VARIANTS_MAX_CORES`,
`WF_VERSION_BREAK_VARIANCE_FACTOR`, `archetypeOfItems`, `averageRanks`,
`averageStrengthOfDetailed`, `compareById`, `durationCurveDetailed`,
`parseRawBuilds`, `pctFromRank`, `rankQuantiles`,
`selectLevelPopularityCandidates`.

O **código** desses nomes permanece nos módulos (podem virar uso interno); só
saem do barrel e do `index.d.ts`.

### D3 — Ajuste de tipo colateral

`PICK_FAVORABILITY_VERSION` era referenciado como *tipo*
(`formula: typeof PICK_FAVORABILITY_VERSION`) em `PickFavorability`, apesar de
nenhum valor importá-lo. Inlinado para o literal `"pick-favorability-v1"`, o que
permitiu removê-lo do contrato sem drift de tipo.

## Consequências

- Barrel: **212 → 154** nomes; `index.d.ts` 209 declarados / 130 valores no runtime.
- Nenhum importador de app muda (`import * as engine` + destructuring preservados).
- Gates: engine **255/255**, api **154/154**, web **40/40**, `check:boundaries`
  OK, `build` OK, 0 BOM.

## Pendência (não executada)

Dentro do antigo bucket "só testes" (75), **54** nomes são importados pelos testes
**por caminho profundo** (`../src/<bucket>/<arq>.js`), não pelo barrel — e outros
**27** são importados só por outro `src` por caminho profundo. Para esses, o export
no barrel também é redundante: reescrever os testes para o caminho profundo e podar
o barrel deixaria o contrato público mínimo (≈ 52 nomes do app + 21 testados via
barrel). Ex.: `refWinsOf` (test `builds-ordering.test.js`) está nesse grupo — foi
**mantido** no barrel por estar fora do escopo aprovado (P0+P1), embora seja
candidato. Isso é mudança de **contrato** e deve ser uma ADR própria.
