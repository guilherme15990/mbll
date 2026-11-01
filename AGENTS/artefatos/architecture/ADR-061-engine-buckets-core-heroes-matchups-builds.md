# ADR-061 — Engine consolidada em 4 buckets (`core` · `heroes` · `matchups` · `builds`)

- Data: 2026-11-01 · Autor: saas-lead
- Status: **aceito e executado**
- Relação: aplica `engine.md`; encaixa na ADR-059 (nome do pacote) e na ADR-025
  (fronteira única). **Não muda comportamento** e preserva a superfície pública —
  exceto pela remoção de 2 módulos mortos.

## Contexto

A engine tinha ~57 módulos JS distribuídos em 12 pastas planas
(`builds/`, `confidence/`, `counters/`, `draft/`, `governance/`, `hero/`, `meta/`,
`personal/`, `picks/`, `ranks/`, `utils/`, `walkforward/`) — organização por
"quando foi escrito", não por domínio. O `engine.md` propõe 4 buckets + barrel.

Medição antes da mudança (script de alcance + superfície):

- 57 módulos; **nenhum** era inalcançável (todo módulo tem ≥1 importador).
- O barrel exportava **214** nomes.
- **2** módulos não têm nenhum consumidor — nem via barrel por app/API-teste, nem
  import interno, nem teste dedicado: `ranks/rank-difference.js` e
  `meta/temporal-delta.js`.

## Decisão

### D1 — 4 buckets com consolidação real (fundir, não só mover de pasta)

| Bucket | Arquivo-alvo | Absorve |
|---|---|---|
| `core/` | `math.js` | `utils/math.js` |
| `core/` | `statistics.js` | `utils/statistics.js` |
| `core/` | `thresholds.js` | `utils/thresholds.js` |
| `core/` | `config.js` | `utils/config.js` |
| `heroes/` | `scoring.js` | `hero/score-heroes`, `hero/hero-scorer`, `hero/baseline-estimator`, `hero/shrinkage-model`, `hero/significance-tester`, `hero/batch-meta-builder`, `hero/constants` |
| `heroes/` | `ranking.js` | `hero/lot-ranking`, `hero/forca-sorting`, `hero/strength-index`, `hero/tierOf`, `hero/hero-lists`, `ranks/rank-profile` |
| `heroes/` | `assembler.js` | `hero/hero-result-assembler`, `hero/hero-row-validator` |
| `heroes/` | `trust.js` | `hero/trust`, `confidence/confidence-bands`, `confidence/confidence-trio` |
| `heroes/` | `trends.js` | `hero/hero-trend`, `hero/walk-forward-prior`, `walkforward/walkforward`, `meta/meta-trend`, `meta/tempo-signal`, `meta/lane-timing`, `meta/assess-series` |
| `heroes/` | `profile.js` | `hero/hero-profile`, `personal/playstyle`, `personal/personal-calibration` |
| `matchups/` | `counters.js` | `counters/counter`, `counters/pair-key`, `counters/evidence`, `counters/distortion`, `counters/duration`, `counters/matchup-ordering`, `counters/relations-agreement`, `governance/exposure` |
| `matchups/` | `blind-pick.js` | `picks/pick-favorability`, `counters/blind-safety`, `counters/blind-proxy` |
| `matchups/` | `draft-score.js` | `draft/draft-score`, `draft/pair-effect`, `draft/hero-draft-score` |
| `matchups/` | `draft-patterns.js` | `draft/draft-patterns` |
| `builds/` | `aggregate.js` | `builds/builds-aggregate`, `builds/build-tags` |
| `builds/` | `lift.js` | `builds/build-lift`, `builds/build-adjusted`, `builds/builds-ordering` |
| `builds/` | `itemsets.js` | `builds/itemsets` |
| `builds/` | `contrast.js` | `builds/component-contrast`, `builds/build-quadrant` |

Regra aplicada aos módulos que o spec não cita: **bucket mais próximo** (só as 4
pastas). `meta/` + `walkforward/` → `heroes/trends`; `ranks/` → `heroes/ranking`;
`confidence/` → `heroes/trust`; `picks/` → `matchups/blind-pick`; `governance/` →
`matchups/counters`; `personal/` → `heroes/profile`.

### D2 — `heroes/profile.js` (desvio consciente do `engine.md`)

O spec não prevê arquivo para "perfil". `hero/hero-profile.js` +
`personal/playstyle.js` + `personal/personal-calibration.js` foram para
`heroes/profile.js`, mantendo as 4 pastas e o encaixe mais próximo (L2 registrado).

### D3 — Arquivos mortos removidos

Critério objetivo — **morto = nenhuma referência fora do próprio módulo + barrel
(+ declaração no `index.d.ts`)**: nem app/web, nem app/api, nem import interno,
nem teste. Só 2 módulos passaram:

| Módulo removido | Nomes públicos removidos |
|---|---|
| `ranks/rank-difference.js` | `rankDifference` |
| `meta/temporal-delta.js` | `temporalDelta` |

Os nomes saíram do `index.js` e do `index.d.ts` (o portão exige que toda
declaração de valor exista no runtime). Os módulos `builds/build-adjusted.js` e
`builds/build-quadrant.js` **não** são mortos: são consumidos pelo
`test/build-models.test.js` via barrel e foram consolidados em `builds/lift.js` /
`builds/contrast.js`.

### D4 — Superfície pública é a fronteira (nada muda para os apps)

`index.js` (barrel) e `index.d.ts` (contrato) continuam o único ponto de entrada.
Nenhum importador externo muda de nome; **214 → 212** nomes exportados (só os 2
mortos saíram). Os 30 testes da engine passaram a importar os novos caminhos.

## Verificação (executada)

- `packages/engine`: **255/255** testes; `app/api`: **154/154**; `app/web`: 40 (vitest) + guardiões.
- `npm run check:boundaries` → `BOUNDARIES OK` (183 arquivos varridos, 8 na dívida).
- `npm run check:api`, `npm run check:web` → limpos.
- `npm run build` → engine-ok / api-ok / web built.
- Equivalência de superfície: cada arquivo-alvo exporta **exatamente** a união dos
  módulos de origem (script de verificação); o barrel exporta 212 nomes, sem os 2 mortos.

## Consequências

- (+) Navegação por domínio; um assunto por arquivo; menos arquivos (57 → 18).
- (+) `engine.md` passa a descrever a árvore real (com `heroes/profile.js`).
- (−) Arquivos maiores (`builds/aggregate.js` 1562, `heroes/trends.js` 666,
  `heroes/ranking.js` 512, `matchups/draft-score.js` 508). O teto de 300 linhas
  **não** vale para `packages/engine` (ADR-041: "nenhum arquivo acima de 300 linhas
  **fora de** `packages/engine`"), então não há violação do portão.
- (−) Observação para poda futura (não feita aqui): ~55 nomes públicos do barrel
  não têm consumidor externo declarado (ex.: `archetypeOfItems`, `parseRawBuilds`,
  `COMBINER_*`, `BUILD_QUADRANT_POPULAR_PICK`). Removê-los é contrato, não
  refatoração — fica para uma ADR própria.
