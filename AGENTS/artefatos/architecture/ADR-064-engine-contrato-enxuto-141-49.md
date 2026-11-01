# ADR-064 — Contrato público enxuto da `@radar/engine` (barrel 141 → 49) e poda de `export` internos

- Data: 2026-11-01 · Autor: saas-lead
- Status: **aceito e executado**
- Relação: fecha a pendência **P2** registrada na ADR-062 (192 export → 154) e
  continua a limpeza da `@radar/engine` das ADR-061/062/063. **Não muda
  comportamento observável**: nenhuma saída do motor muda; o que muda é *quem
  pode importar o quê* pela raiz `@radar/engine`.
- Laudo/auditoria de origem:
  `AGENTS/artefatos/architecture/engine-codigo-nao-usado-2026-11-01.md`.

## Contexto

A auditoria mecânica de uso (275 declarações de topo × consumidores reais, com
comentários removidos) mostrou que **não existe código morto** na engine
(categorias A = 0 e E = 0), mas que a **superfície pública era excedente**:

- o barrel `index.js` exportava **141** nomes;
- apenas **48** tinham consumidor em `app/{api,web}/src`;
- **93** existiam só para testes internos, só para uso interno da engine, ou ambos.

Além disso, **110** declarações tinham `export` **redundante** — usadas somente
dentro do próprio arquivo (a palavra-chave `export` não servia a ninguém).

## Decisão

### D1 — Remover o `export` redundante (P1)

Removido o `export` (virou `const`/`function`/`class` local) de **110**
declarações usadas **apenas no próprio módulo**. Zero impacto em consumidor
(ninguém as importa). Inclui as **structs de estado** co-localizadas: elas são
`export` de módulo mas ninguém as importa → o `export` era dispensável.

> **Supersede a nuance da ADR-063:** esta ADR **substitui** a decisão de manter
> as structs co-localizadas como `export` de módulo "por design". Como nada as
> importa, mantê-las `export` era superfície sem consumidor. As **transversais**
> de `core/states.js` continuam `export` (a engine as importa entre módulos).

### D2 — Encolher o barrel para o contrato real (P2)

O barrel passa a exportar **apenas** os nomes que o **código do app** consome:
`app/{api,web}/src` **e os testes das apps**. Resultado: **141 → 49**.

**Critério de KEEP (e por que o teste da app conta).** As regras 2/3 do gate
`check:boundaries` proíbem o app de importar o interior do pacote
(`@radar/engine/src/...`) ou escapar por caminho relativo. Logo, **todo** o
código do app — incluindo seus testes — só alcança a engine pelo barrel; se um
nome que o app-test usa sair do barrel, aquele teste quebra sem alternativa
legítima. O único caso fora de `app/src` é **`assessSeries`**, consumido por
`app/api/test/routes.test.js` via `await import("@radar/engine")` — por isso
entra no contrato (48 + 1 = **49**).

**KEEP (49):**

`mean`, `median`, `C_REFERENCE`, `LANES`, `requireLane`, `classOf`,
`trendOfDated`, `assessSeries`, `dominantProfileOf`, `medianPickOf`,
`medianBanOf`, `selectLaneTopHeroesDetailed`, `scoreBatch`, `isValidWalkPrior`,
`walkPriorStamp`, `summarizeWalkPosterior`, `blindProxy`, `distortionResidual`,
`durationCurve`, `classifyDuration`, `evidenceQuality`, `makePairKey`,
`sortPairsByDeltaAsc`, `sortPairsByDeltaDesc`, `hasFiniteDelta`,
`selectTopCountersByDelta`, `selectTopSynergiesByDelta`, `classifyBlindPick`,
`classifyFirstPick`, `getDraftPatterns`, `scoreHeroDraftScore`, `buildLift`,
`buildReferences`, `getBuildTags`, `ITEMSET_M_MIN`, `ITEMSET_CUT_K`,
`ITEMSET_CUT_M`, `ITEMSET_MAX_ROWS`, `itemIdsOf`, `scoreAtomicItemset`,
`scoreRouteItemsets`, `orderBuildsByLift`, `selectTopBuildsByLift`,
`selectBuildsAboveMostUsed`, `normalizeEquipmentCatalog`, `normalizeEmblemCatalog`,
`normalizeSpellCatalog`, `buildAggregate`, `checkPickSum`.

**REMOVE do barrel (92):** os demais — só-teste, só-interno ou ambos. Os testes
internos da engine passam a importá-los por **caminho profundo**
(`../src/<bucket>/<arquivo>.js`), que é permitido (são o próprio pacote).

### D3 — Contrato TS acompanha o barril

`index.d.ts` removeu as **70** declarações de valor dos nomes que saíram e
preservou **todos os tipos** (`export type`/`interface`) usados pelo app.
Resta **exatamente** a mesma superfície de valor do barrel (49), o que o gate
`check:boundaries` valida nas duas direções (import ⇒ decl; decl de valor ⇒
existência no runtime). A referência `typeof DS_UNIT_STATUS` foi inlinada
(`"pp_hypothesis_strong"`) para não sobrar dependência de valor removido.

### D4 — Testes internos reescritos

11 arquivos de teste da engine trocaram o import do barrel por import profundo
do módulo dono. Os testes que usavam o alias `viaIndex` **apenas para provar a
paridade de reexportação** tiveram a asserção de paridade removida (o nome deixou
de ser público de propósito); o valor de domínio testado permaneceu intacto.

## Consequências

- Superfície pública = **exatamente** o que o app usa. Nada mais pode depender de
  nomes internos sem uma decisão explícita de contrato.
- Adicionar um nome público agora exige tocá-lo em `index.js`, `index.d.ts` e no
  consumidor — o gate acusa drift nas duas direções.
- `export` redundante zerado nos módulos da engine (110 → 0).
- Contrato público: **141 → 49** no barril; `index.d.ts` com 49 valores + tipos.
- Gates pós-execução: engine **252/252**, api **154/154**, web **40/40**,
  `check:boundaries` **OK** (49 valores, 0 import sem declaração, 0 fantasma),
  `check:api`/`check:web` (tsc) **OK**, `build` **OK**, 0 BOM.

## Não feito (fora de escopo)

- Nenhum código foi **deletado**: a auditoria provou A = 0 e E = 0 (não há código
  morto nem local órfão). A limpeza é de superfície, não de lógica.
- `LOADOUT_VERSION` (web) segue fora do escopo (schema de persistência do domínio
  web, não carimbo da engine) — como já registrado na ADR-063.

## Ajustes pós-revisão (software-critic, 2026-11-01)

Veredito **APROVADO COM RESSALVAS**, zero CRITICAL. Duas ressalvas acionáveis
tratadas:

1. **Gate não cobria `app/web/test`.** Como o critério de KEEP (D2) trata os testes
   das apps como contrato, o gate ficaria inconsistente cobrindo só `app/api/test`.
   `tools/check-boundaries.mjs` passou a varrer também `app/web/test` (nenhuma
   violação nova; os testes de web não importam a engine nem escapam da app).
2. **`export` redundante sobrevivente.** `builds/aggregate.js:59` ainda tinha
   `export { DeltaStatus };` — reexportação de binding importado de `core/states.js`
   que ninguém consome (`contrast.js` importa direto de `core/states.js`). Removido:
   o "export redundante → 0" agora vale para **todas** as pontas.

Ressalvas não acionadas: CRLF em 2 arquivos (benigno — git normaliza para LF no
commit) e a contagem "119 → 49" no laudo refere-se à baseline pós-ADR-063.

