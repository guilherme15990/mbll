# ADR-040 — Fatiamento da camada de dados da web (`lib/api.ts` → `lib/api/*`)

- Data: 2026-10-24
- Status: aceita e implementada
- Escopo: `apps/web/src/lib` + 2 guardiões de teste. Zero mudança de contrato
  público, de comportamento ou de request.

## Problema

`apps/web/src/lib/api.ts` tinha **524 linhas** concentrando três
responsabilidades distintas de **12 domínios**:

1. Primitiva HTTP (`getJSON`).
2. Contrato do fio: **~40 tipos** (`Hero`, `Pair`, `Build`, a família
   `Aggregate*` inteira, `BuildsAggregateResponse`, `LotMeta`…).
3. **18 hooks** de TanStack Query (`useHeroes`, `useHero`, `useCatalog`,
   `useHeroLanes`, `useMatchups`, `useBuilds`, `useBuildsAggregate`,
   `useTrends`, `useViews`, `useGems`, `useMeta`, `useModules`, `useConfidence`,
   `useRankDiff`, `useTemporal`, `useDistortion`, `useBlind`) + vocabulário de
   filtros (`LANES`, `RANKS`, `PAGE_SIZE`, `GRID_SERVER_SORT`) + 3 helpers de
   apresentação (`cx`, `dir`, `dirWord`).

Sintoma concreto: qualquer mudança em builds abria um arquivo que também
descreve heróis, confrontos, confiança e tempo. O arquivo era o maior risco de
conflito do repo.

## Decisão

Fatiar por **domínio**, mantendo `lib/api.ts` como barrel com a superfície
idêntica. Os ~40 call sites **não foram tocados** — a migração é invisível.

```
src/lib/
  http.ts              getJSON (primitiva, sem domínio)
  present.ts           cx / dir / dirWord (apresentação)
  api.ts               barrel: reexporta tudo + { ago, num, pct } de shared/format
  api/
    filters.ts         LANES, RANKS, PAGE_SIZE, GridSort, GRID_SERVER_SORT
    heroes.ts          Hero, LotMeta, HeroesResponse, CatalogEntry,
                       useHeroes, useHero, useCatalog, useHeroLanes
    builds.ts          Build, BuildTalent, todos os Aggregate*, useBuilds,
                       useBuildsAggregate
    matchups.ts        Pair, useMatchups
    insights.ts        TrendPoint, useTrends, useViews, useGems, useMeta,
                       useModules, useConfidence, useRankDiff, useTemporal,
                       useDistortion, useBlind
```

### Por que não `features/<ctx>/api/` (como a auditoria propôs)

A auditoria sugeria mover as queries para dentro de cada feature. Neste repo
isso é **bloqueado pelo próprio gate** (`tools/check-boundaries.mjs`):

| Consumidor | Hook | Regra violada |
|---|---|---|
| `app/Sidebar.tsx:7` | `useHero`, `useHeroes`, `useMeta` | `:201` app\|shared\|lib não importam features |
| `shared/HeroPicker.tsx:3` | `useCatalog` | `:201` idem |
| `shared/HeroDossier.tsx:2` | `useHero` | `:201` idem |
| `features/hero/sections/BuildsSection.tsx:3` | `useBuilds` | `:200` features não importam outras features |
| `features/hero/sections/ConfrontosSection.tsx:3` | `useMatchups` | `:200` idem |

A camada de dados é **transversal ao produto**: uma tela de herói consome
builds, confrontos, confiança e tempo; o shell consome heróis. Mover os hooks
para dentro das features exigiria **afrouxar duas regras de firewall** que hoje
são a garantia de que a web não vira uma teia — trocar acoplamento de arquivo
grande por acoplamento entre features seria regressão, não melhoria.

Regra que fica valendo: **`lib/api/*` é a camada de dados; features apenas
consomem.** O que precisa de isolamento por feature é a UI, e isso continua como
está (ADR-037).

## Guardiões ajustados

Dois guardiões liam o arquivo único e passaram a ler a camada inteira:

- `test/guardian-builds-global.mjs` — "key `[builds,id,rank,lane]` definida 1x".
- `test/guardian-hero-confrontos.mjs` — "mesma key do hook (api única)".

O invariante preservado é o que importa (**key definida uma única vez na camada
de dados**), não o número de arquivos. A leitura passou a ser
`src/lib/api.ts` + `src/lib/api/*.ts`.

## Alternativas rejeitadas

1. **Manter tudo e só quebrar em `// seções` no mesmo arquivo.** Não resolve
   conflito de merge nem propriedade; é cosmético.
2. **`export *` de tudo no `lib/api.ts` sem mover nada.** Mesmo problema.
3. **Um arquivo por hook (18 arquivos).** Fragmentação sem ganho: hook e tipo do
   mesmo domínio devem morar juntos.
4. **Criar `packages/shared-contracts` para os tipos.** Os tipos descrevem o fio
   de `/v1`, não o motor; a API JS não os consome. Pacote a mais sem consumidor.
5. **Mover hooks para as features** — ver tabela acima.

## Consequências

Positivas: o maior arquivo da web caiu de **524 → ~30 linhas** (barrel); builds
passou a ter um dono (`lib/api/builds.ts`, 330 linhas de contrato de agregado,
isolado de propósito); mudança em heróis não abre arquivo de tempo; nenhum call
site mudou, então o risco de regressão foi zero; o firewall continua intacto.

Custos: mais 7 arquivos para navegar; `export *` no barrel pode esconder colisão
de nome no futuro (o `tsc` acusa); dois guardiões agora dependem de `fs`
`readdirSync` — se alguém criar um `.ts` na camada com key duplicada, os dois
pegam, o que é o comportamento desejado.

## Evidência

- `npm run check:web` → 0 erros de tipo (o barrel reexporta a superfície
  completa; nenhum import quebrou).
- `npm run check:boundaries` → `BOUNDARIES OK` (10 regras).
- `npm run verify` → **exit 0**, incluindo os 4 guardiões da web.
- `npm run build` → **exit 0** (esbuild + Tailwind, 1m06s).
