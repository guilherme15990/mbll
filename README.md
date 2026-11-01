<p align="center">
  <img alt="Mobile Legends: Bang Bang" src="docs/logo.png" width="520">
</p>

<h1 align="center">Radar de Balanceamento MLBB</h1>

<p align="center">
  <em>Leitura do meta de Mobile Legends: Bang Bang a partir de dados observados —
  índice de pressão por herói com força ajustada, incerteza, tendência e pares,
  e o status de evidência sempre explícito.</em>
</p>

<p align="center">
  <img alt="Node 24" src="https://img.shields.io/badge/node-24-339933?logo=node.js&logoColor=white">
  <img alt="npm workspaces" src="https://img.shields.io/badge/npm-workspaces-CB3837?logo=npm&logoColor=white">
  <img alt="API zero-dep" src="https://img.shields.io/badge/API-zero--depend%C3%AAncia-000000">
  <img alt="Cobertura da API" src="https://img.shields.io/badge/cobertura%20da%20API-%E2%89%A590%25%20linhas-brightgreen">
</p>

> Transforma a Rone Arena API em um **radar de balanceamento**: para cada herói,
> quão forte ele é de verdade (força ajustada por shrinkage), quanta evidência
> existe, para onde a tendência aponta e quais pares ajudam ou atrapalham.
>
> **Não é previsão de partida, não é recomendação de pick e não é
> probabilidade de vitória.** Todo número carrega seu limite: `provisório`,
> `inconclusivo` ou `sem dado` — nunca uma certeza que os dados não sustentam.

## Por que o Radar

A maioria dos painéis de meta responde à pergunta errada: "qual o win rate?".
O Radar parte de outra: **"quanto disso é sinal e quanto é ruído?"** — e responde
com evidência, não com uma tabela plana.

- **Força ajustada, não win rate cru.** O módulo de shrinkage (M1) modela o win
  rate observado com incerteza: uma amostra pequena encolhe para a média, uma
  amostra grande fala por si. O constante `c` do modelo é **declarado uma vez** —
  sem "grade" de hiperparâmetros escondendo escolhas.

- **A evidência vem no fio.** Cada módulo tem um **status** próprio (`validado`,
  `descritivo`, `proposta`, `proxy`, `camada-A`). Você vê a diferença entre um
  número consolidado e um proxy declarado na própria resposta da API.

- **δ nunca é somado.** O efeito de um confronto (`δ`) é evidência **singular**
  de um par canônico. Cinco inimigos não viram um "score aditivo de draft".
  Counters são antissimétricos; teammates são simétricos; pick e ban nunca se
  somam.

- **Zero-dependência de runtime na API.** O backend é Node 24 puro: `node:http`,
  `node:sqlite` e `fetch`. O único "pacote" é o workspace interno `@radar/engine`.
  Menos superfície, menos CVE, deploy trivial.

- **Um motor, uma fronteira.** Toda a matemática vive em `@radar/engine`
  (funções puras, sem I/O). Web e API consomem o motor **pelo nome do workspace**,
  e um gate de fronteiras falha se alguém escapar por caminho relativo ou
  inventar dependência entre zonas.

- **Contratos de wire em um lugar só.** Os DTOs da API moram em `@radar/contracts`
  (só tipos). O gate impede uma terceira cópia de um DTO aparecer no backend ou na web.

- **Cache é cache — e se pode perdê-lo.** A persistência é **só** a tabela
  `cache` (TTL por camada + stale-while-revalidate). Ela é reconstruível: apagar
  o banco não perde dado nenhum, porque não é fonte de verdade.

- **Honesto sobre o que não dá para saber.** A API expõe uma lista de
  **impossibilidades** (`/v1/meta/status`): sem contagem por partida, sem draft
  completo, sem causalidade. O que não tem lastro aparece como tal.

## O que o sistema responde

Seis módulos ativos, cada um com fórmula, status e endpoint declarados
(`/v1/modules`):

| ID | Módulo | Pergunta | Status |
|---|---|---|---|
| **EXP** | Exposição | Quanto observamos de cada herói? | validado |
| **SHR** | Força e Shrinkage (M1) | Quão forte o herói é de verdade? | validado |
| **M6** | Confrontos e Sinergias | Quais pares ajudam ou atrapalham? | descritivo |
| **DRF** | Distorção de Draft | Pressão de pick/ban acompanha a força? | proposta |
| **BPS** | Blind Pick | Dá para escolher sem ver o inimigo? | proxy |
| **BDL** | Builds e Lift | Qual build rende mais — e contra qual referência? | camada-A |

## Telas

Shell: header (marca, status, filtros globais de **elo**, **janela** e **rota**)
+ menu horizontal (ADR-055) + conteúdo + footer. Cada seção primária preserva o
contexto global na URL.

| Rota | Tela |
|---|---|
| `/dashboard` | Panorama do meta (T1) |
| `/hero` | Grade de heróis com paginação/ordenação no servidor (T2) |
| `/hero/:id` | Ficha do herói: **Visão geral · Confrontos · Draft · Builds** |
| `/draft` | Draft Management — composição e poder (DMP) |
| `/builds` | Builds — visão de sistema e por herói (BDL) |
| `/build`, `/build/:id` | Gerenciar build — núcleo, builds e slots (BMS) |

## Como funciona

```
 Rone Arena API
      │  coleta (rankLot + cache TTL, single-flight)
      ▼
 @radar/engine                      app/api (/v1, JSON, GET)
  exposição · shrinkage M1  ──────▶  rotas verticais por contexto
  matchups (δ) · draft               │
  blind · builds/lift                ▼
      ▲                       app/web (React 18 + TanStack Query)
      └──── @radar/contracts (DTOs do fio, só tipos)
```

1. **Coleta.** `rankLot` busca os lotes por rank/janela, normaliza e cacheia
   (TTL **A=2h / B=6h / C=24h** + SWR). Chamadas concorrentes idênticas compartilham
   uma única coleta (single-flight).
2. **Modelagem.** As rotas delegam ao `@radar/engine` — funções puras de
   estatística, inferência e agregação. Nada de I/O dentro do motor.
3. **Contrato.** Cada `/v1/*` devolve um envelope JSON estável, com `meta`,
   verificações (`pickSumCheck`) e o status de evidência de cada número.
4. **Apresentação.** A web consome os DTOs de `@radar/contracts` via hooks do
   TanStack Query; cada rota é um chunk lazy (ADR-043).

## Stack

| Camada | Tecnologia |
|---|---|
| Web (`app/web`) | React 18, TypeScript, Vite, TanStack Query, React Router, Recharts, lucide-react, Tailwind |
| API (`app/api`) | Node 24, `node:http`, `node:sqlite`, `fetch` — **zero dependências externas** de runtime\* |
| Motor (`packages/engine`) | JS puro, sem I/O: estatística, inferência, matchups e builds |
| Contratos (`packages/contracts`) | TypeScript só-tipos: os DTOs do fio, fonte única |
| Persistência | SQLite **só cache** (TTL por camada + SWR). Reconstruível; o histórico append-only foi removido (ADR-065) |

\* o único "pacote" de runtime da API é o workspace interno `@radar/engine`.
Sem login/usuário — fora de escopo.

## Estrutura

```
app/api/src
  http/          servidor, router, estáticos, erros, log (sem regra de negócio)
  routes/        handlers verticais por contexto (fio HTTP)
  application/   coleta, pontuação, catálogos, agregados (sem HTTP)
  infra/         cache, config, db
  providers/     clientes externos (arena), contratos e logging

app/web/src
  App.tsx        shell: header + menu horizontal + main + footer
  app/           infra de UI (router, providers, filters, TopNav, ErrorBoundary)
  features/      um diretório por contexto: dashboard, hero-list, hero-detail,
                 builds, build-manager, draft-management
  shared/        reuso sem dono de contexto
    format.ts    formatação numérica defensiva (fonte única)
    api/         transporte + dados: http, errors, queries/<domínio> e o barrel
    domain/      lógica pura, zero React: combiner, buildLabel, itemsets, present
    ui/          index (fachada) · primitives/ (1 componente por arquivo)
                 · patterns/ (HeroPicker, HeroDossier, charts…)

packages/engine/src    core/ · heroes/ · matchups/ · builds/ + barrel index.js
packages/contracts/src index.ts — DTOs do fio (só tipos)

tools/           bootstrap lean, resolvedor do tsc, gate de fronteiras
```

**Direções permitidas** (o gate `npm run check:boundaries` falha se quebrar):
`features/a` **não** importa `features/b`; `app|shared` **não** importam
`features`; só `app/router.tsx` carrega features; `shared/domain` é lógica pura
(motor + `shared/format`, nunca React/fetch); `app/*` importam o motor pelo nome
do workspace, nunca por caminho relativo.

## Rodar

```powershell
npm install                 # monorepo (workspaces)
npm run dev                 # :5173 — web + /v1 no mesmo processo (Vite plugin)
```

Gerenciador único: **npm** (`package-lock.json`, lockfile v3). O gate falha se um
segundo manifesto de gerenciador reaparecer.

API isolada (consumir `/v1` sem o front):

```powershell
npm run dev:api             # :3001
```

Produção (origem única: estáticos + API):

```powershell
npm run build               # engine + api + web -> app/web/dist
npm start                   # :3001
```

### Nesta máquina (4 GB RAM)

`npm install` completo estoura a memória. O bootstrap baixa só o necessário via
`curl`+`tar` nativos:

```powershell
powershell -ExecutionPolicy Bypass -File tools\bootstrap-web.ps1
```

A API não precisa instalar nada (zero-dep). Ver `ADR-003-bootstrap.md`.

## Gates

Os gates rodam **localmente** (`npm run verify`); o repositório não usa CI.

| Comando | O que prova |
|---|---|
| `npm run check:boundaries` | direção de dependência entre zonas + contrato do motor (import declarado no `index.d.ts` e declaração existente no runtime) |
| `npm run check:api` | `checkJs` da API (JS puro + JSDoc, `app/api/jsconfig.json`) |
| `npm run check:web` | typecheck da web (`tsc --noEmit`) |
| `npm test` | motor (`node:test`) + API (`node:test`) + web (smoke + guardiões estáticos + vitest) |
| `npm run test:coverage` | cobertura da API com thresholds **linhas 90 / branches 60 / funções 85** |
| `npm run verify` | boundaries + typechecks + todos os testes |

## Configuração (env, fail-fast)

Valor inválido derruba o processo no boot com o nome e o valor recebido — sem
fallback silencioso (`app/api/src/infra/config.js`).

| Variável | Default | Efeito |
|---|---|---|
| `PORT` | `3001` | porta HTTP |
| `DATA_DIR` | `<repo>/data` | raiz de todo estado persistente (SQLite) |
| `SQLITE_FILE` | `$DATA_DIR/cache.sqlite` | override explícito do arquivo |
| `SQLITE_CACHE` | ligado | `off` desliga SQLite (fallback em memória) |
| `ARENA_BASE` | `https://arena.fastapicloud.dev` | fonte |
| `ARENA_ALT_HOSTS` | vazio | hosts de failover aceitos (o header `x-alt-host` da fonte só é seguido se o host estiver nesta lista); vazio = sem failover |
| `ARENA_CONC` | `4` | requisições paralelas à fonte (1..32; acima disso a fonte responde **429**) |
| `LOG_LEVEL` | `info` | `silent｜error｜info｜debug` |
| `TRUST_PROXY` | `false` | confia em `X-Forwarded-For` p/ o rate limit — **só ligue atrás de proxy conhecido**; sem proxy é irrelevante (e o header vira forjável) |
| `RATE_LIMIT_OFF` | `false` | `1` desliga o rate limit por IP (útil em teste de carga local) |
| `RATE_LIMIT_RPS` / `RATE_LIMIT_BURST` | `20` / `60` | taxa por cliente |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | prazo do shutdown gracioso |
| `WEB_DIST` | `app/web/dist` | diretório servido em produção |

A documentação completa de cada variável (default e efeito) vive em
`app/api/src/infra/config.js`.

## API (`/v1`, JSON, GET)

| Rota | Conteúdo |
|---|---|
| `/health` | liveness (fora de `/v1`) |
| `/v1/heroes?rank=&window=&class=&sort=&order=&size=&index=` | lote pontuado + `meta`, `pickSumCheck`, `prior` (sempre `flat` desde a ADR-065) |
| `/v1/heroes/:id` | herói + meta do lote |
| `/v1/heroes/:id/trends` | série temporal 30d (média móvel) |
| `/v1/heroes/:id/distortion` | resíduos de pick/ban (nunca somados) |
| `/v1/heroes/:id/matchups` | counters/sinergias (δ do par) |
| `/v1/heroes/:id/blind` | proxy de blind pick (p10 adverso) |
| `/v1/heroes/:id/builds?lane=` | builds + lift (**422** sem lane) |
| `/v1/builds/aggregate?lane=&rank=&window=&top=` | agregado de sistema B0–B5 (`top=10\|20\|all`) |
| `/v1/views/:view` | recortes (semana/elo/tier) |
| `/v1/gems` | joias (q baixo, força alta, pick/ban baixos) |
| `/v1/catalog`, `/v1/equipment`, `/v1/heroes/lanes` | catálogos e lanes |
| `/v1/modules`, `/v1/meta/status` | catálogo dos módulos, saúde, cache, versões e **impossibilidades** |

Limites e semântica de cada indicador estão nos ADRs e nos docs de módulo em
`AGENTS/artefatos/`.

## Documentação

- **ADRs** — `AGENTS/artefatos/architecture/`. Comece por `ADR-033`
  (arquitetura-alvo, monólito modular). As decisões recentes: `ADR-061` a `ADR-068`.
- **Contratos de tela e UX** — `AGENTS/artefatos/{spec,ux,qa,reviews}/`.
- **Regras de negócio / evidência** — `packages/engine/src` (os comentários de
  módulo explicam a unidade e o limite de cada número).

## Escopo e limites

- **Não é** previsão de partida, recomendação de pick nem probabilidade de vitória.
- Sem login/usuário, sem dados por partida, sem draft completo — a fonte não os
  oferece, e o sistema diz isso em vez de inventar.
- `pick_rate` é `slot_share` **unvalidated** (sem contagem absoluta).
- Janelas sobrepostas não contam como replicação independente.

## Licença

Projeto privado, sem licença pública declarada.
