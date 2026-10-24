# ADR-033 — Arquitetura-alvo: monólito modular com rotas verticais e portas finas

- Data: 2026-10-24
- Status: aceito (implementação incremental, fases F0–F5)
- Substitui: nada. Complementa ADR-025 (fronteira única do motor).

## Contexto

O domínio (`@radar/proprietary-engine`) já é exemplar: puro, sem I/O, limiares com
dono único (`utils/thresholds.js`, `utils/config.js`), 219 testes, 94,6% de
cobertura. O débito está concentrado na **camada de entrega**: `apps/api/src/routes.js`
concentra 20 endpoints em uma única função `router()` de 575 linhas, chama a si
mesma por dentro (3×), duplica a validação de `rank/window` 12× e declara handlers
como closures por request — o que os torna inalcançáveis por teste (cobertura 47%).

## Decisão

**Monólito modular em camadas, com rotas verticais por contexto e portas apenas
onde existe fronteira real.** Não adotamos Clean Architecture / DDD tático
completos. Motivo: o sistema é leitura analítica sobre uma fonte externa, sem
agregados mutáveis, transações de negócio ou múltiplos clientes. Use Cases,
Entities e Repositories cerimoniais adicionariam dezenas de arquivos sem remover
um único risco identificado.

Camadas e direção de dependência (verificável por script):

```
http/ + routes/  →  application/  →  domain/ (@radar/proprietary-engine)
       ↘                ↘
        infra/  ← injetado no composition root; routes/ NÃO importa infra/
```

| Camada | Responsabilidade | Exemplos |
|---|---|---|
| `domain/` (engine) | modelos e primitivas puras; zero I/O | `scoreBatch`, `classOf`, `buildAggregate` |
| `application/` | orquestração de um caso de uso | `rankLot` (cache→upstream→snapshot→prior), `buildsAggregate`, `catalog`, `snapshotDiff` |
| `routes/` | validação de entrada + serialização de saída; 1 arquivo por contexto | `heroes`, `views`, `builds`, `snapshots` |
| `http/` | servidor, tabela de rotas, headers, erros, estático | `server`, `router`, `respond`, `errors` |
| `infra/` | adaptadores de I/O | `arenaClient`, `cache/store`, `cache/history` |

Portas (interfaces) só para as duas fronteiras reais: **ArenaGateway** e
**CacheStore/SnapshotHistory**. Nada de interface para código puro.

## Alternativas rejeitadas

1. **Reescrever o backend em framework (Fastify/Express).** Quebra a restrição
   zero-dep (ADR-003/README, máquina de 4 GB), não resolve nenhum problema
   listado e reabre contratos de 20 endpoints.
2. **Clean Architecture completa (entities/use-cases/repositories).** Cerimônia
   sem invariante de negócio mutável para proteger; custo alto, ganho nulo.
3. **Microserviços por contexto.** 9 contextos, um único consumidor, um único
   deploy — distribuir aumentaria o custo operacional sem demanda.
4. **Migrar `apps/api` para TypeScript agora.** Ganho real, mas acoplado a uma
   varredura de 1,4k linhas simultânea à mudança estrutural. Caminho escolhido:
   `jsconfig` + `checkJs` incremental na F5, com tipos do wire em
   `packages/contracts` (só `.d.ts`, zero runtime).

## Regras de dependência (checadas no build)

| De → Para | Permitido |
|---|---|
| `routes/*` → `application/*` | sim |
| `routes/*` → `infra/*` | **não** (recebe services do composition root) |
| `application/*` → `infra/*` | **não** (injeção) |
| `application/*`, `routes/*` → engine | sim |
| engine → `apps/*` | **não** |
| `apps/api` → engine por caminho relativo | **não** (declarar dependência de workspace) |
| `web/pages/*` → `App.tsx` (`useFilters`) | **não** (mover para `app/filters.ts`) |

## Consequências

Positivas: cada endpoint testável sem rede e sem SQLite; `router()` vira dispatch
de ~40 linhas; erros com taxonomia (400/404/422/500/502) em vez de 502 para tudo;
uma única fonte de configuração com fail-fast; fronteiras verificáveis.

Negativas / custos: mais arquivos (≈12) na API; `routes.js` precisa sobreviver como
**shim** temporário para `vite.config.ts` e para os testes existentes; a migração
tem de ser feita em passos com diff pequeno, nunca junto com mudanças de lógica.

## Plano (fases, cada uma = 1 commit com gate verde)

- **F0** rede de segurança (ADR-032) — concluída.
- **F1** testes de contrato dos 20 endpoints **antes** de fatiar; tabela de rotas,
  `routes/*`, `application/*`; matar auto-recursão e validação duplicada.
- **F2** HTTP/operação: taxonomia de erro, request-id/log, headers, rate-limit,
  estático binário-safe com cache, `config.js` fail-fast, graceful shutdown.
- **F3** cache/histórico: split store/history, prepared statements, WAL,
  `DATA_DIR` explícito, retenção por arquivamento, single-flight compartilhado.
- **F4a** web obrigatório: `shared/format`, `app/filters` (mata ciclo), ErrorBoundary,
  lazy routes, remoção de código morto; **F4b** opcional: features por contexto.
- **F5** portão: `checkJs` na API, script de fronteiras, coverage com thresholds,
  CI, README/ADRs.
