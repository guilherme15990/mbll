# Radar de Balanceamento MLBB

Ferramenta de leitura do meta de Mobile Legends: transforma a Rone Arena API em
**índice de pressão** por herói (força ajustada, incerteza, tendência e pares).
Não é previsão de partida nem recomendação de pick.

Tudo que aparece na tela é derivado de dados observados com o status de
evidência explícito (`provisional`, `inconclusivo`, `sem dado`) — ver
`AGENTS/artefatos/architecture/`.

## Stack

| Camada | Tecnologia |
|---|---|
| Web (`apps/web`) | React 18, TypeScript, TanStack Query, React Router, Recharts, lucide-react, Tailwind |
| API (`apps/api`) | Node 24, `node:http`, `node:sqlite`, `fetch` — **zero dependências externas** de runtime* |
| Motor (`packages/proprietary-engine`) | JS puro, sem I/O: modelos, primitivas e agregados |
| Persistência | SQLite **só cache** (TTL A=2h/B=6h/C=24h + SWR) e histórico append-only de snapshots |

\* o único "pacote" de runtime da API é o workspace interno `@radar/proprietary-engine`.
Sem login/usuário (fora de escopo).

## Estrutura

```
apps/api/src
  http/          servidor, router, estáticos, erros, log (sem regra de negócio)
  routes/        handlers verticais por contexto (fio HTTP)
  application/   coleta, pontuação, catálogos, agregados (sem HTTP)
  infra/         arena, cache, snapshot history, config, db

apps/web/src
  App.tsx        rotas lazy (12) + shell
  app/           shell e infra de UI (filters, ErrorBoundary, Sidebar, IddModal)
  features/      um diretório por contexto: dashboard, heroes, hero, forca,
                 confianca, ranks, tempo, confrontos, draft, blind, builds, exposicao
  shared/        reuso sem dono de contexto (ui, charts, format, heroPanel, idd)
  lib/           dados e lógica pura da web (api, combiner, buildLabel, itemsets)

packages/proprietary-engine
  src/index.js   barrel público (fronteira única)
  src/index.d.ts contrato de tipos consumido por web e API

tools/           bootstrap lean, resolvedor do tsc, gate de fronteiras
```

Direções permitidas: `features/a` **não** importa `features/b`; `app|shared|lib`
**não** importam `features`; só `App.tsx` carrega features. `apps/*` importam o
motor pelo nome do workspace, nunca por caminho relativo. O gate
`npm run check:boundaries` falha se qualquer regra quebrar.

## Rodar

```powershell
npm install                 # monorepo (workspaces)
npm run dev                 # :5173 — web + /v1 no mesmo processo (Vite plugin)
```

API isolada (para consumir `/v1` sem o front):

```powershell
npm run dev:api             # :3001
```

Produção (origem única: estáticos + API):

```powershell
npm run build               # engine + api + web -> apps/web/dist
npm start                   # :3001
```

### Nesta máquina (4 GB RAM)

`npm install` completo estoura a memória. O bootstrap baixa só o necessário via
curl+tar nativos:

```powershell
powershell -ExecutionPolicy Bypass -File tools\bootstrap-web.ps1
```

A API não precisa instalar nada (zero-dep). Ver `ADR-003-bootstrap.md`.

## Gates (rodam no CI e local)

| Comando | O que prova |
|---|---|
| `npm run check:boundaries` | direção de dependência entre zonas + todo import do motor declarado no `index.d.ts` |
| `npm run check:api` | `checkJs` da API (JS puro + JSDoc, `apps/api/jsconfig.json`) |
| `npm run check:web` | typecheck da web (`tsc --noEmit`) |
| `npm test` | motor (`node:test`) + API (123 testes) + web (smoke + guardians) |
| `npm run test:coverage` | cobertura da API com thresholds **linhas 90 / branches 60 / funções 85** |
| `npm run verify` | boundaries + typechecks + todos os testes |

O CI (`.github/workflows/ci.yml`) roda os mesmos comandos em Node 24, mais o
build de produção.

## Configuração (env, fail-fast)

Valor inválido derruba o processo no boot com o nome e o valor recebido — não há
fallback silencioso (`apps/api/src/infra/config.js`).

| Variável | Default | Efeito |
|---|---|---|
| `PORT` | `3001` | porta HTTP |
| `DATA_DIR` | `<repo>/data` | raiz de todo estado persistente (SQLite) |
| `SQLITE_FILE` | `$DATA_DIR/cache.sqlite` | override explícito do arquivo |
| `SQLITE_CACHE` | ligado | `off` desliga SQLite (fallback em memória) |
| `HISTORY_RETENTION_DAYS` | `0` | `0` = append-only; `>0` arquiva e poda a tabela quente |
| `ARENA_BASE` | `https://arena.fastapicloud.dev` | fonte |
| `ARENA_ALT_HOSTS` | vazio | hosts de failover permitidos (lista por vírgula) |
| `ARENA_CONC` | `4` | fan-out concorrente (1..32) |
| `LOG_LEVEL` | `info` | `silent｜error｜info｜debug` |
| `TRUST_PROXY` | `false` | confia em `X-Forwarded-For` (só atrás de proxy) |
| `RATE_LIMIT_OFF` | `false` | desliga o token bucket |
| `RATE_LIMIT_RPS` / `RATE_LIMIT_BURST` | `20` / `60` | taxa por cliente |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | prazo do shutdown gracioso |
| `WEB_DIST` | `apps/web/dist` | diretório servido em produção |

## API (`/v1`, JSON, GET)

| Rota | Conteúdo |
|---|---|
| `/health` | liveness (fora de `/v1`) |
| `/v1/heroes?rank=&window=&class=&sort=&order=&size=&index=` | lote pontuado + `meta`, `pickSumCheck`, `prior` |
| `/v1/heroes/:id` | herói + trends 30d + meta do lote |
| `/v1/heroes/:id/confidence` | trio posterior/IC/probabilidade (provisório) |
| `/v1/heroes/:id/rank-diff?a=&b=` | diferença ajustada entre ranks |
| `/v1/heroes/:id/temporal?window=&base=` | delta temporal + avaliação da série |
| `/v1/heroes/:id/distortion` | resíduos de pick/ban (nunca somados) |
| `/v1/heroes/:id/matchups` | counters/sinergias (δ do par) |
| `/v1/heroes/:id/blind` | proxy de blind pick (p10 adverso) |
| `/v1/heroes/:id/builds?lane=` | builds + lift (422 sem lane) |
| `/v1/builds/aggregate?lane=&rank=&window=&top=` | agregado de sistema B0–B5 |
| `/v1/views/:view` | recortes (semana/elo/tier) |
| `/v1/gems` | joias (q baixo, força alta, pick/ban baixos) |
| `/v1/catalog`, `/v1/equipment`, `/v1/heroes/lanes` | catálogos e lanes |
| `/v1/snapshots`, `/v1/snapshots/:ts/diff` | histórico append-only e diff de payload |
| `/v1/modules`, `/v1/meta/status` | catálogo dos módulos, saúde, cache e versões |

Limites e semântica de cada indicador estão nos ADRs e nos docs de módulo em
`AGENTS/artefatos/`.

## Documentação

- ADRs: `AGENTS/artefatos/architecture/` (comece por `ADR-033` — arquitetura-alvo)
- Contratos de tela e UX: `AGENTS/artefatos/`
- Regras de negócio/evidência: `packages/proprietary-engine/src` (comentários de
  módulo explicam a unidade de cada número)
