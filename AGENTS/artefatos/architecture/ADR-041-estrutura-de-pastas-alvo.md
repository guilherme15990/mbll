# ADR-041 — Estrutura de pastas alvo (proposta, não implementada)

- Data: 2026-10-24
- Status: **proposta parcialmente implementada** — F0–F4 executadas (ADR-043)
- Base: medido no repo (contagens de arquivo e de linha), não estimado
- Raiz: `app/` desde a ADR-042 (este documento nasceu com `apps/`)
- Relação: complementa ADR-033 (monólito modular), ADR-037 (web feature-first),
  ADR-039 (motor público) e ADR-040 (camada de dados da web)

## Problema

A estrutura atual não é amadora, mas tem quatro ambiguidades que cobram preço
todo dia:

1. **`lib` × `shared` não tem regra.** Onze arquivos em `lib/` e doze em
   `shared/`. Ninguém que chega decide sozinho onde um módulo novo mora. Foi
   exatamente esse atrito que fez `lib/api.ts` virar 524 linhas.
2. **`shared/` mistura níveis diferentes no mesmo balde.** `ui.tsx` (átomos),
   `charts.tsx` (gráfico), `HeroPicker.tsx` (padrão de produto que faz fetch) e
   `heroPanel.ts` (contrato de props) têm o mesmo status hierárquico hoje.
3. **A API separa por camada, mas o produto é por contexto.** `routes/heroes.js`,
   `routes/heroDetails.js`, `application/rankLot.js`, `application/scoring.js` e
   `application/heroLanes.js` são **um** contexto espalhado em duas pastas. A web
   já é por contexto; os dois apps não compartilham taxonomia.
4. **A camada `application/` tem código que não é aplicação.** `rateLimit.js` e
   `singleFlight.js` são infraestrutura transversal (guarda de borda e primitiva
   de concorrência), não caso de uso.

E há um dado que muda a prioridade: **o monólito não desapareceu, mudou de
lugar.**

| Arquivo | Linhas |
|---|---|
| `app/web/src/shared/ui.tsx` | **493** |
| `app/web/src/app/IddModal.tsx` | 463 |
| `app/web/src/shared/idd.tsx` | 382 |
| `app/web/src/app/Sidebar.tsx` | 367 |

Quatro arquivos somam **1.705 linhas**. `shared/ui.tsx` é hoje maior que o
`lib/api.ts` que acabamos de fatiar. Reorganizar pasta sem tratar isso seria
mudar o endereço do problema.

## Estrutura alvo

### `app/web`

```
app/web/src/
├── main.tsx
├── App.tsx
├── app/                         # shell: só composição e infraestrutura de UI
│   ├── router.tsx               # as 12 rotas lazy (hoje dentro de App.tsx)
│   ├── Sidebar.tsx
│   ├── ErrorBoundary.tsx
│   └── filters.ts
├── features/                    # 12 contextos, código em EN, kebab-case
│   ├── dashboard/
│   ├── hero-list/               # era `heroes`  (Herois.tsx → HeroList.tsx)
│   ├── hero-detail/             # era `hero`    (HeroDetails.tsx → HeroDetail.tsx + sections/)
│   ├── strength/                # era `forca`
│   ├── confidence/              # era `confianca`
│   ├── ranks/
│   ├── temporal/                # era `tempo`
│   ├── matchups/                # era `confrontos`
│   ├── draft/
│   ├── blind/
│   ├── builds/
│   └── exposure/                # era `exposicao`
│
├── shared/                      # tudo que é transversal, com sub-fronteira explícita
│   ├── format.ts                # fonte única de formatação (fica na raiz de propósito)
│   ├── api/                     # ↓ consome rede
│   │   ├── http.ts              # ex-lib/http.ts
│   │   └── queries/
│   │       ├── filters.ts       # ex-lib/api/filters.ts
│   │       ├── heroes.ts
│   │       ├── builds.ts        # 355 linhas — maior contrato do produto
│   │       ├── matchups.ts
│   │       └── insights.ts
│   ├── domain/                  # ↓ lógica pura, zero React, zero fetch
│   │   ├── combiner.ts
│   │   ├── itemsets.ts
│   │   ├── buildLabel.ts
│   │   └── present.ts           # cx / dir / dirWord
│   ├── idd/                     # conceito transversal com dono (não é rota, não é átomo)
│   │   ├── IddModal.tsx         # ex-app/IddModal.tsx (463)
│   │   ├── idd.tsx              # 382
│   │   └── cards/               # ex-shared/idd/*
│   └── ui/
│       ├── primitives/          # 1 componente por arquivo; sem fetch, sem domínio
│       │   ├── Button.tsx
│       │   ├── Card.tsx
│       │   ├── Badge.tsx
│       │   ├── Table.tsx
│       │   └── …                # ex-shared/ui.tsx (493) fatiado
│       ├── patterns/            # composições do produto: PODEM usar api/domain
│       │   ├── HeroPicker.tsx
│       │   ├── HeroDossier.tsx
│       │   ├── PickVerdict.tsx
│       │   ├── BuildLoadout.tsx
│       │   ├── heroPanel.ts
│       │   └── charts.tsx
│       └── …
└── test/
```

**Regras de dependência** (novas, executáveis em `tools/check-boundaries.mjs`):

| # | Regra | Motivo |
|---|---|---|
| 11 | `ui/primitives/*` não importam `shared/api`, `shared/domain`, `shared/idd`, `shared/ui/patterns` | átomo burro: se precisa de hook, é pattern |
| 12 | `shared/domain/*` só importa `@radar/proprietary-engine` e `shared/format` | lógica pura testável sem React |
| 13 | `shared/idd/*` não importa `features/*` | idd é transversal, não pertence a contexto |
| 14 | `primitives/` tem 1 componente exportado por arquivo | mata o retorno do `ui.tsx` de 493 linhas |
| 15 | `features/*` não importa `app/*` exceto `app/filters` | mantém ADR-036 |

### `app/api`

```
app/api/src/
├── main.js                     # composition root: monta deps e injeta
├── modules/                    # 1 pasta = 1 contexto (mesma taxonomia da web)
│   ├── heroes/
│   │   ├── route.js            # ex-routes/heroes.js + routes/heroDetails.js
│   │   ├── service.js          # ex-application/rankLot.js (138)
│   │   ├── scoring.js          # ex-application/scoring.js
│   │   └── lanes.js            # ex-application/heroLanes.js
│   ├── builds/
│   │   ├── route.js            # ex-routes/builds.js (111)
│   │   └── aggregate.js        # ex-application/buildsAggregate.js (339)
│   ├── matchups/route.js       # ex-routes/matchups.js
│   ├── meta/                   # meta, views, gems, catalog — mesma família de leitura
│   │   ├── route.js            # ex-routes/{meta,views,gems,catalog}.js
│   │   ├── catalogs.js         # ex-application/catalogs.js
│   │   ├── canonical.js        # ex-application/canonical.js
│   │   └── versions.js         # ex-application/versions.js
│   ├── snapshots/route.js      # ex-routes/snapshots.js
│   └── health/route.js         # ex-application/health.js
├── platform/                   # transversal, nunca importa modules/
│   ├── http/                   # ex-http/{server,router,respond,errors,log,static}.js
│   │   └── validation.js       # ex-application/validation.js
│   ├── cache/                  # ex-infra/cacheStore.js + ex-application/singleFlight.js
│   ├── db/                     # ex-infra/db.js
│   ├── history/                # ex-infra/snapshotHistory.js (196)
│   ├── guard/                  # ex-application/rateLimit.js
│   └── config.js               # ex-infra/config.js
└── upstream/
    └── arena/client.js         # ex-infra/arena.js
```

**Regras novas:**

| # | Regra |
|---|---|
| 16 | `modules/*` não importam outro `modules/*` (irmãos só via composição em `main.js`) |
| 17 | `platform/*` e `upstream/*` não importam `modules/*` |
| 18 | `modules/*` não importam `platform/db`, `platform/cache`, `platform/history` direto — recebem no composition root (a regra que a ADR-033 prometeu e não implementou) |

A regra 18 é a única que exige mudança de arquitetura de verdade (injeção). As
outras 15 são movimentação + script.

### Raiz do repositório

```
radar-mlbb/
├── app/{api,web}/
├── packages/proprietary-engine/     # nome mantido (ver ADR-039)
├── tools/                           # bootstrap, tsc, check-boundaries
├── docs/
│   ├── adr/                         # ADR-001..041 (saem de AGENTS/artefatos/architecture)
│   ├── architecture.md              # 1 página: camadas, regras, mapa de contexto
│   └── runbook.md                   # env, deploy, diagnóstico de upstream
├── var/                             # estado de runtime: cache.sqlite, history, logs (gitignored)
├── AGENTS/                          # só artefatos de trabalho de agente (spec, qa, reviews)
└── .github/workflows/ci.yml
```

`data/` → `var/`: `data/` sugere "dados de entrada/seed" e hoje guarda estado
mutável (cache SQLite + histórico). `var/` é a convenção para estado gravável e
deixa claro que nada ali é fonte.

`AGENTS/artefatos/architecture/` → `docs/adr/`: 41 ADRs num diretório de
workflow de agente é documentação escondida de humano. O `AGENTS/` fica com o
que é dele (spec, qa, reviews).

## Fases (cada uma = 1 commit com gate verde, sem mudança de lógica)

| Fase | Escopo | Arquivos | Risco | Ganho |
|---|---|---|---|---|
| **F1** | `lib/` + `shared/` → `shared/{api,domain,ui,idd}` | ~20 | baixo (mecânico) | acaba a ambiguidade nº 1 |
| **F2** | fatiar `shared/ui.tsx` (493) em `primitives/` | 1 → ~12 | baixo | mata o maior arquivo da web |
| **F3** | renomear 12 features (EN/kebab) + `hero-detail`×`hero-list` | 35 + imports | baixo | taxonomia clara, fim do par `hero/heroes` |
| **F4** | `app/IddModal` → `shared/idd/` | 2 | baixo | shell sem regra de produto |
| **F5** | `data/` → `var/`, `docs/adr/` | raiz | baixo | higiene de repo |
| **F6** | API `modules/` + `platform/` (31 arquivos) | 31 | médio | contexto único por mudança |
| **F7** | regra 18: injeção no composition root | ~10 | **alto** | a promessa não cumprida da ADR-033 |

Ordem: web antes de API (o blast radius cresce), estrutura antes de injeção.
F1–F5 são mecânicas e podem entrar em série. F6 exige rodar `verify` completo a
cada commit. **F7 é opcional** — só vale se a API crescer além dos 20 endpoints.

## Critérios de aceite

1. Nenhum arquivo acima de **300 linhas** fora de `packages/proprietary-engine`
   (hoje: 4 na web, 1 na API).
2. `primitives/`: 1 componente por arquivo, nenhum import de `api`/`domain`.
3. Nenhuma pasta sem dono declarado em `docs/architecture.md` (1 frase cada).
4. `npm run verify` e `npm run build` exit 0 ao fim de cada fase.
5. `check-boundaries` com 18 regras, validado com probe negativo (uma violação
   plantada de propósito deve falhar).

## O que eu **não** faria

1. **Trocar de gerenciador/build** (pnpm, turbo, nx). Nenhum problema atual é
   resolvido por isso; só muda o lockfile que já exigiu cirurgia (ADR-038).
2. **Migrar a API para TypeScript agora.** Ganho real, mas é uma varredura de
   ~1,4k linhas; fazer junto com movimento de pasta viola a lição da ADR-033.
3. **Clean Architecture / use-cases / repositórios.** Já rejeitado com motivo na
   ADR-033 e continua válido: não há agregado mutável para proteger.
4. **`packages/ui` como design system publicado.** Um app consumindo; publicar
   pacote é custo de versão sem beneficiário.
5. **Barrel por feature (`features/x/index.ts`).** Cria ciclo e esconde
   dependência; o barrel único de `shared/api` já resolve o que precisava.
6. **Renomear `proprietary-engine`.** O nome não corresponde ao que o pacote é
   (ADR-039), mas o rename toca 64 imports e o gate. Registrado, não pago.
7. **Microserviços por contexto.** Um consumidor, um deploy (ADR-033).

## Trade-off honesto

A estrutura alvo adiciona **7 pastas e ~30 arquivos** (o fatiamento de
`ui.tsx`). O ganho não é estético: é que cada um dos quatro problemas medidos
vira uma regra executável em vez de uma convenção que se perde no terceiro
dev. Se o projeto parar de crescer hoje, F6 e F7 não se pagam — F1 a F5 se
pagam mesmo assim, porque atacam os arquivos de 400+ linhas que qualquer
mudança futura vai precisar abrir.
