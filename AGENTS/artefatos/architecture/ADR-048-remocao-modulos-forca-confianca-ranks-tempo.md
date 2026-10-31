# ADR-048 — Remoção de Força, Confiança, Ranks e Tempo (rotas planas e abas da ficha)

- **Status:** aceito
- **Data:** 2026-10-27
- **Decisão do usuário (L3):** remover os módulos `SHR`, `CNF`, `RNK` e `TMP`
  da camada de apresentação **e** da camada de dados. A ficha `/hero/:id`
  permanece; o que sai são as abas desses quatro módulos e as rotas planas.

## Contexto

O produto expunha quatro páginas planas (`/forca`, `/confianca`, `/ranks`,
`/tempo`) e as mesmas leituras como abas em `/hero/:id`. O usuário pediu para
eliminar Força, Confiança, Ranks e Tempo do programa. Numa primeira passada a
ficha inteira também foi removida por engano; o usuário corrigiu: **a ficha
`/hero/:id` deve existir**, apenas sem as quatro abas.

## Decisão

### Apresentação (`app/web`)

- `features/strength`, `features/confidence`, `features/ranks` e
  `features/temporal` foram removidas, junto das rotas `/forca`, `/confianca`,
  `/ranks` e `/tempo` em `app/router.tsx` e dos links na `Sidebar`.
- `/hero/:id` (e os aliases `/hero/detalhes`, `/heroi`) continua, agora com
  **quatro abas + home**: Visão geral, Confrontos, Draft e Builds.
- `hero-detail/sections/{Forca,Confianca,Ranks,Tempo}Section.tsx` foram
  removidas. Links externos que apontavam para as rotas planas mortas foram
  reapontados:
  - `Exposure` → `/hero/:id` (dossiê do herói);
  - `DraftPanel` perdeu o CTA que ia para `/tempo`;
  - `HeroDossier` lista somente M6, DRF, BPS e BDL;
  - `HeroList` deixou de citar `/forca` em copy e `prdRef`.
- `HeroDetail` mantém os links internos de aba (`?tab=confrontos|draft|builds`).
  `?tab=forca|confianca|ranks|tempo` cai na home (não há mais slug).

### Dados (`app/api` + `app/web/src/shared/api`)

- Endpoints removidos do dispatcher e dos handlers:
  `/v1/heroes/:id/confidence`, `/v1/heroes/:id/rank-diff` e
  `/v1/heroes/:id/temporal`.
- Hooks removidos da camada de dados: `useConfidence`, `useRankDiff` e
  `useTemporal`.
- `/v1/modules` passa a anunciar 6 módulos (EXP, SHR, M6, DRF, BPS, BDL).
  `SHR` permanece porque o índice de força continua sendo calculado e exposto
  pelo endpoint central `/v1/heroes` (dashboard, lista e ficha).
- O **motor** (`packages/proprietary-engine`) não foi alterado: `confidenceTrio`,
  `rankDifference`, `temporalDelta` e `assessSeries` continuam exportadas e
  testadas. Sem consumidor HTTP, ficam disponíveis para uso futuro.

### Banco de dados

Não há tabela/coluna dedicada a nenhum dos quatro módulos. O SQLite guarda
apenas `cache` (TTL, chave-valor) e `snapshot_history`/`snapshot_history_archive`
(histórico compartilhado usado por `/exposicao` e `/snapshots`). Portanto:

- nenhum DDL é alterado ou removido;
- chaves de cache antigas dessas leituras simplesmente deixam de ser escritas
  e expiram pelo TTL; não é necessário `DELETE` destrutivo.

## Consequências

- Menu lateral mais curto: restam Draft (Confrontos, Distorção, Blind Pick) e
  Governança (Exposição), além de Dashboard, Heróis, Builds e Gerenciar build.
- A ficha do herói continua acessível pela lista de heróis, pelo dashboard,
  pela sidebar (`Ver herói no dossiê`) e por links de outras telas.
- Contratos e testes atualizados: `contracts.test.js` (3 testes removidos,
  `/modules` com 6), `smoke.mjs`, `guardian-f4a`, `guardian-f4b`. O guardião
  `guardian-hero-confrontos.mjs` continua válido (a ficha e as seções de
  confrontos permanecem).
- Rollback: `git revert` deste commit restaura páginas, abas e endpoints como
  estavam antes.

## Decisões L2 registradas

1. **Destino dos links órfãos:** telas que abriam a ficha continuam indo para
   `/hero/:id`; o CTA de `/tempo` em Draft foi removido por não ter substituto
   direto.
2. **`SHR` no catálogo de módulos:** mantido, pois o cálculo de força é a base
   de `/v1/heroes` e do índice exibido — só a página/tabela dedicada saiu.
3. **Dossiê (`HeroDossier`)**: mantém apenas os contextos com rota ativa
   (M6, DRF, BPS, BDL), evitando links para páginas removidas.
