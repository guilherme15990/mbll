# F4b — Web feature-first

- Data: 2026-10-24
- Status: concluída (F4b da ADR-033; F4a já concluída)
- Pré-requisito: ADR-033, ADR-036 (F4a)
- Decisão: ADR-037

## 1. Problema

Depois da F4a, a web estava correta em comportamento (sem ciclo, com lazy routes e
boundary), mas ainda organizada por **tipo de arquivo**: `pages/` com 31 arquivos de
naturezas diferentes e `components/` misturando design system, telas e shell.
`HeroPanelProps` era importado de `pages/panels/ForcaPanel.tsx` por 7 painéis de
outros contextos, sem nenhuma barreira que impedisse uma feature de importar outra.

## 2. Evidência (antes)

| Sintoma | Evidência |
|---|---|
| Depósito | `pages/` com 31 arquivos: rota fina (835 B), página (19 kB), painel (11 kB), seção (13 kB) |
| Mistura de níveis | `components/ui.tsx` (design system) ao lado de `components/dashboard/BuildsTab.tsx` (tela) e `components/Sidebar.tsx` (shell) |
| Acoplamento | 7 painéis importam `HeroPanelProps` de `features/forca` (na época, `pages/panels/ForcaPanel`) |
| Descoberta | código de `/builds` espalhado em 4 pastas |

## 3. Decisão (resumo)

Quatro zonas: `app/` (shell), `features/<contexto>/` (12 contextos), `shared/`
(reuso: UI, formatação, contrato de painel) e `lib/` (dados/lógica). `features/a`
não importa `features/b`; `app|shared|lib` não importam features. `HeroPanelProps`
vai para `shared/heroPanel.ts`. Guardian F4b com 9 checks. Detalhes e alternativas
na ADR-037.

## 4. Estrutura final

```
src/
  App.tsx                rotas lazy (12) + shell
  main.tsx               boundary raiz
  app/
    filters.ts
    ErrorBoundary.tsx
    Sidebar.tsx
    IddModal.tsx
  features/
    dashboard/           Dashboard.tsx · BuildsTab.tsx · RankingsTab.tsx · HeroCard.tsx
    heroes/              Herois.tsx
    hero/                HeroDetails.tsx · sections/ (8)
    forca/               Forca.tsx · ForcaPanel.tsx
    confianca/           Confianca.tsx · ConfiancaPanel.tsx
    ranks/               Ranks.tsx · RanksPanel.tsx
    tempo/               Tempo.tsx · TempoPanel.tsx
    confrontos/          Confrontos.tsx · ConfrontosPanel.tsx
    draft/               Draft.tsx · DraftPanel.tsx
    blind/               Blind.tsx · BlindPanel.tsx
    builds/              Builds.tsx · BuildsPanel.tsx · BuildsAggregatePanel.tsx
                         BuildsCombinerPanel.tsx · BuildsPowerPanel.tsx
    exposicao/           Exposicao.tsx
  shared/
    format.ts · ui.tsx · charts.tsx · heroPanel.ts · idd.tsx
    HeroPicker.tsx · HeroDossier.tsx · BuildLoadout.tsx · PickVerdict.tsx
    idd/{NeedsRankLane,PrimaryAction,SigmaBanCard}.tsx
  lib/
    api.ts · combiner.ts · buildLabel.ts · itemsets.ts
```

46 arquivos movidos, 200 imports relativos reescritos. `src/pages` e
`src/components` não existem mais.

## 5. Detalhes que importam

### 5.1 Migração

Script de uso único resolve o import na árvore antiga e recalcula o caminho a partir
do novo local — não houve edição manual de `../../../`. As extensões que o
resolvedor adicionou foram removidas para manter o estilo do repo; a única exceção
é `lib/combiner.ts → ../shared/format.ts`, exigida pelo type-stripping do Node.

### 5.2 Contrato compartilhado

`shared/heroPanel.ts` contém `HeroPanelProps` (rank, window, hero, dossier, picker,
ficha). `ForcaPanel` e os 7 painéis de outros contextos importam de `shared`; o
guardian falha se qualquer feature importar outra.

### 5.3 Direções verificadas

| Regra | Check |
|---|---|
| `src/pages` e `src/components` ausentes | 2 |
| ≥10 contextos em `features/` | 1 |
| 12 rotas lazy começando em `./features/` | 1 |
| zero import entre features | 1 |
| `app`/`shared`/`lib` não importam features | 1 |
| cada contexto tem página com `export default` | 1 |
| `HeroPanelProps` em `shared` e importado de lá | 2 |

### 5.4 Testes atualizados

- `smoke.mjs`: exige a nova árvore e proíbe `src/pages`/`src/components`.
- `guardian-f4a.mjs`: caminha `src/features`, regex de lazy e de `app/filters`
  atualizados; `BuildsTab` em `features/dashboard`.
- `guardian-hero-confrontos.mjs`: ficha e seções em `features/hero`.
- `guardian-builds-global.mjs`: `BuildsTab` e `BuildsPanel` em `features/`.

## 6. Evidência (depois)

```
npm run typecheck -w apps-web
npm test -w apps-web
npm run build -w apps-web
node <tmp>/f2-runtime-smoke.mjs      # DATA_DIR em tmp
node <tmp>/unused-web.mjs            # alcançabilidade
```

| Verificação | Resultado |
|---|---|
| Typecheck | exit **0** |
| Web | smoke OK; **F4A OK** (20 checks); **F4B OK** (9 checks); Builds OK; Confrontos OK |
| Itemsets + combiner | **24/24** |
| Build Vite | OK; entry **289,76 kB** (gzip 88,32); **30 chunks** |
| Maiores chunks | `charts` 411,04 · `Builds` 82,22 · `HeroDetails` 73,23 · `Dashboard` 39,78 |
| Runtime smoke | health/404/estático/304/429 OK; `shutdown_done ... "dbClosed":true`, exit 0 |
| Arquivos sem importador | **0** (57 arquivos ts/tsx) |
| Referências antigas em `src` | 0 (só checks negativos nos testes) |

O build saiu com os **mesmos hashes e tamanhos** da F4a: a mudança é estrutural e
não altera o grafo de execução.

## 7. Riscos e pendências

1. **Rotas finas repetem scaffold** (`useFilters` + `HeroPicker` + `HeroDossier` +
   `Panel` em 8 arquivos). Extrair `PageScaffold` é refatoração de comportamento;
   próximo passo natural.
2. **Caminhos profundos** em `features/hero/sections` (`../../../shared/ui`). Path
   alias foi rejeitado por exigir configuração duplicada (Vite + esbuild).
3. **Mutação de `URLSearchParams`** em páginas/painéis (`sp.set(...); setSp(sp)`)
   continua; `app/filters.ts` já clona. Corrigir em commit próprio se houver sinal
   de perda de parâmetro.
4. **`modules-map.md`** descreve a estrutura antiga (pré-F4a) e é histórico; não foi
   reescrito.
5. **`lib/api.ts`** continua centralizando tipos + hooks + helpers de apresentação
   (`cx`, `dir`, `dirWord`); fatiar exige mudar query keys — fora do escopo.
