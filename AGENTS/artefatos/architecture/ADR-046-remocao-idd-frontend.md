# ADR-046 — Remoção do IDD do frontend e filtro de rota global

- **Data:** 2026-10-25
- **Status:** aceita
- **Contexto:** o shell web carregava o subsistema Interface Domain Design
  (`shared/idd/**`): provider, modal, inspetor de zonas, badges de capacidade e
  um wrapper `IddZone` usado em quase toda página. O produto não expõe mais esse
  método na interface; os rótulos de zona/estado poluíam telas de leitura e o
  modal ocupava espaço no header. Em paralelo, o filtro de rota vivia dentro do
  Dashboard, então não sobrevivia à navegação nem aparecia junto de elo/janela.

## Decisão

1. **Remover o IDD do frontend por completo.** Saíram `shared/idd/index.tsx`,
   `IddModal.tsx`, `IddZone.tsx`, `IddTraceBadge.tsx`, `IddProvider`, o botão
   “Interface Domain Designer (IDD)”, o toggle “Zonas IDD”, as menções no
   header/footer, a Sidebar e os reexports em `shared/ui/index.tsx`.
2. **Preservar componentes de produto que moravam em `shared/idd/cards`.**
   `PrimaryAction`, `SigmaBanCard` e `NeedsRankLane` foram movidos para
   `shared/ui/patterns/`, sem `capId`, `contextId`, `zone` ou `IddZone`.
   O conteúdo visual e o comportamento (CTA, conservação do lote, vazios
   orientados) foram mantidos.
3. **Substituir `IddZone` por `<div>` com o mesmo `className`.** O wrapper,
   com o inspetor desligado, já renderizava só uma `div`; a troca preserva
   layout, acessibilidade e remove o `data-testid="idd-zone-*"`.
4. **Filtro de rota global.** `app/filters.ts` passou a expor `lanes`
   (`?lanes=mid,jungle`, vazio = todas), `setLanes` e `toggleLane`. O controle
   fica no header ao lado de elo e janela. `filtersQuery` e o redirect de `/`
   preservam `lanes`; links de conteúdo usam `withLanes` para não perder a
   seleção ao abrir ficha/ranking. Dashboard e HeroList consomem o mesmo estado.
5. **Manter a IA de produto** (`CtxBar`, IDs SHR/CNF/RNK/TMP/M6/DRF/BPS/BDL/EXP
   e `DomainStateBadge`): são navegação/estado de confiança, não o inspetor IDD.

## Consequências

- Frontend ~1.400 linhas menor; nenhuma referência a IDD/`idd-zone` no código.
- `smoke.mjs` proíbe `src/shared/idd` e exige os três patterns no novo caminho.
- `guardian-hero-confrontos.mjs` deixou de exigir `data-capid`; valida o gate de
  elo por `data-testid="preview-needs-rank"`.
- Rotas não entram em query key: o filtro é join client com `/heroes/lanes`,
  aplicado à página atual. O aviso nas telas deixa isso explícito.
- Artefatos históricos (ADR-037/041/043, F4b e OOUX) ainda citam o IDD como
  registro do estado anterior; não foram reescritos.

## Verificação

`npm run verify` (boundaries, typecheck API/web, testes API/web) e
`npm run build -w web` verdes. `npm test -w web` com `SMOKE OK`,
`GUARDIAN CONFRONTOS/F4A/F4B OK` e `fail 0`.
