# Radar de Balanceamento MLBB — Fase 1

Fonte única: Rone Arena API v1.1.0 (`https://arena.rone.dev`). Índice de pressão, não previsão.

## Stack
React 18 + TypeScript + Recharts (charts) + lucide-react (ícones) + TanStack Query +
React Router. Backend **zero dependências** (só stdlib Node 22+: `node:http`, `node:sqlite`,
`fetch`). SQLite **só cache** (TTL A=2h/B=6h/C=24h + SWR; `SQLITE_CACHE=off` desliga).
Sem login/user (P4, fora de escopo). Ver ADRs em `AGENTS/artefatos/architecture/`.

## Rodar (máquina com RAM livre: `npm install` normal funciona)
```powershell
cd radar-mlbb
npm install
npm run dev:api   # :3001 (outro terminal) npm run dev:web
npm run dev:web    # :5173 -> proxy /v1 para :3001
```

## Nesta máquina (4 GB RAM): installs via script magro
`npm install` estoura a memória; o bootstrap usa só curl+tar nativos:
```powershell
powershell -ExecutionPolicy Bypass -File tools\bootstrap-web.ps1
```
Backend não precisa instalar nada (zero-dep). Ver `ADR-003-bootstrap.md`.

## Build / teste (verdes em 06/10/2026)
```powershell
node --test test/utils.test.js               # packages/proprietary-engine (primitivas + suites de modelo)
node --test test/routes.test.js              # apps/api (2 testes)
node ./test/smoke.mjs                        # apps/web (arquivos + deps)
node node_modules/typescript/bin/tsc --noEmit # apps/web (tipos limpos)
node build.mjs                               # apps/web -> dist/ (esbuild, 624KB)
node ./test/live-smoke.mjs                   # apps/api (fumaça ao vivo, exige rede)
```
Servir prod de origem única: `node apps/api/src/index.js` serve `apps/web/dist`.

## Endpoints internos (Fase 1)
- `GET /v1/balance/heroes?rank=&window=&class=&sort(d|win|pick|ban|q)=&order=&size=&index=`
  Cada item: `wrAdj, z, d, q (BH), qPick, qBan, presence, tier, class, confidence, isGem`.
- `GET /v1/balance/heroes/:id?rank=&window=` (+ trends 30d quando houver)
- `GET /v1/balance/views/:view(semana|elo|tier)?rank=&window=`
- `GET /v1/balance/gems?rank=&window=` (q≤0,05, θ̂>mediana, pick/ban<q25)
- `GET /v1/meta/status`

## ADR-001 (L2 registrado)
- "lucid charts" → Recharts (charts) + lucide-react (ícones); Lucid não é lib de charts.
- Spec previa Vue+PrimeVue/Go; usuário impôs React+sqlite → seguido, registrado aqui.
- SQLite só cache reconstruível (P3); sem histórico próprio como fonte de verdade.
- `appearance_rate ≈ pick_rate` unificado; `increase_win_rate` em quarentena (Fase 0 item 2).
