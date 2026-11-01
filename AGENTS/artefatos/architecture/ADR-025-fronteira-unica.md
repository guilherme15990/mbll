# ADR-025 — Fronteira única: `@radar/engine` removido, tudo em `@radar/proprietary-engine`

> **Superada em 2026-10-31 pela ADR-059.** O nome `@radar/engine` voltou: o pacote
> `@radar/proprietary-engine` foi **renomeado** para `@radar/engine` (pasta
> `packages/engine/`), pagando a ADR-041 §"não faria" item 6. O resto desta ADR
> continua válido — as primitivas seguem sob **um dono só**; o que muda é apenas
> o **nome**, não a duplicata de fronteira. Corpo abaixo mantido como histórico.

- Data: 2026-10-11 · Autor: arquiteto-implementador
- Status: aceito e executado.

## Contexto

`@radar/engine` guardava primitivas estatísticas genéricas (median, mad,
quantile, percentileRank, benjaminiHochberg, pFromZ, logit, invLogit,
ebShrink, obsVariance) + config (C_GRID, C_REFERENCE, C_GRADE_VERSION,
DELTA_DEFAULT, DURATION_BANDS, LANES, requireLane) e reexportava modelos
que já moravam em `@radar/proprietary-engine`. Os módulos proprietários
importavam as primitivas via `../../engine/src/index.js`, e `apps/api`
(`routes.js`, `routes.test.js`) importava tudo do engine. Duas fronteiras
para um dono só — ciclo e confusão.

## Decisão

Fronteira = **só `@radar/proprietary-engine`**. `packages/engine/` **removido**
em 2026-10-11. Corpos movidos byte-idênticos (zero mudança de lógica):

| Símbolo | Origem | Destino |
|---|---|---|
| mean, medianNull | proprietary `utils/math.js` (já era dona) | — (ficou) |
| median, mad, quantile | `packages/engine/src/index.js` | proprietary `utils/math.js` |
| percentileRank, benjaminiHochberg, pFromZ, logit, invLogit, ebShrink, obsVariance | `packages/engine/src/index.js` | proprietary `utils/statistics.js` |
| C_GRID, C_REFERENCE, C_GRADE_VERSION, DELTA_DEFAULT, DURATION_BANDS, LANES, requireLane | `packages/engine/src/index.js` (compat) | proprietary `utils/config.js` (já era dona — unificado) |
| tierOf | `packages/engine/src/index.js` (compat) | proprietary `hero/tierOf.js` (já era dona) |
| Modelos (scoreHeroes, strength-index, walkforward, confidence-trio, rank-difference, temporal-delta, assess-series, distortion, blind-proxy, duration, evidence, pair-key, build-lift, exposure) | `packages/engine/src/index.js` (só reexport) | já moravam em proprietary — reexport removido |

Barrel `proprietary/src/index.js` preserva **todos** os nomes públicos —
nenhum importador externo mudou de nome, só de `from`.

## Rewire

- `apps/api/src/routes.js` + `apps/api/test/routes.test.js` (4 imports):
  `packages/engine/src/index.js` → `packages/proprietary-engine/src/index.js`.
- Internos do proprietary (`hero/score-heroes.js`, `counters/duration.js`,
  `counters/blind-proxy.js`, `meta/temporal-delta.js`): `../../../engine/...`
  → caminhos locais (`../utils/...`).
- `packages/proprietary-engine/test/utils.test.js` (novo): primitivas
  mean/medianNull/median/quantile/ebShrink/percentileRank (+mad/BH/logit/
  invLogit/pFromZ/obsVariance) via barrel.
- Root `package.json`: chains `build`/`build:fast`/`test` sem engine.

## Descartado

Nada com dono/teste/importador foi deletado sem lar: os únicos corpos
canônicos do engine eram as 10 primitivas + config, todos movidos. Os
compat-reexports apontavam para código que já morava em proprietary.
Mortos (`theilSen`, `normalizeRankRecord`, `nullIfNoSupport`, `CUTS`,
`quadrant`) seguem fora — não ressuscitados.

## Verificação

`npm test` na raiz (proprietary + api + web) + builds proprietary/api/web
verdes em 2026-10-11 (placares no relatório de execução).
