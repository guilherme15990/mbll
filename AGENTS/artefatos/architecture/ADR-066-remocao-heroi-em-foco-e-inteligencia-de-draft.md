# ADR-066 — Remoção do "Herói em foco" e do agrupador "Inteligência de Draft" do topo

- Data: 2026-11-01
- Status: aceita e implementada
- Relaciona-se a: ADR-055 (shell com menu horizontal — parcialmente revertida: D2 e D3),
  ADR-054 (`/draft-score`), ADR-052/053 (`/draft`), ADR-047 (`/build`).

## Contexto

O shell (ADR-055) colocou no topo do sistema dois controles que o usuário decidiu
remover:

1. **"Herói em foco"** (`app/HeroFocus.tsx`, na Row 1 do cabeçalho, ao lado da
   cápsula de contexto global): um botão com `HeroPicker` + mini-dossiê que
   gravava o herói em `?hero=`.
2. **"Inteligência de Draft"** (o `<details>` à direita do `app/TopNav.tsx`, Row 2):
   um agrupador que levava a **Draft Score** (`/draft-score`) e **Confrontos**
   (`/confrontos`).

## Decisão

Remover os dois controles da barra superior. **As rotas e as telas permanecem** —
o pedido é de navegação, não de produto.

### 1. "Herói em foco" sai

- `app/HeroFocus.tsx` apagado; `App.tsx` deixa de importá-lo e de renderizá-lo.
- O contrato `?hero=` **continua íntegro**: ele é gravado por vários pontos
  (`HeroList`, `Builds`/`BuildsPanel`, `Matchups`/`ConfrontosPanel`,
  `useBuildEditor`) e lido pelo `BuildManager` e pela ficha. Nada ficou órfão.
- O `BuildManager` já tem `HeroPicker` próprio no estado vazio, então `/build`
  continua escolhendo herói sem o controle do cabeçalho. A copy do estado vazio
  foi ajustada para não citar o controle removido.

### 2. "Inteligência de Draft" sai

- O bloco `<details>` e a constante `DRAFT_CONTEXTS` saem de `app/TopNav.tsx`; os
  imports agora ociosos (`useRef`, `ChevronDown`, `FlaskConical`, `Swords`) saem
  junto. As cinco abas primárias permanecem.
- `/confrontos` continua alcançável: o `HeroDossier` (usado em `Matchups` e
  `Builds`, com um herói selecionado) tem a entrada "M6 · Confrontos".
- `/draft-score` — página de **TESTE** do motor `hero-draft-score-v1` — passa a ser
  alcançável **apenas por URL direta** (`/draft-score`). Aceito: é uma superfície
  de teste, e o pedido era tirá-la do menu. Isto **contraria parcialmente** o
  princípio "nada de rota órfã" da ADR-055 D2; registrado aqui como decisão L2.

### 3. Guardiões ajustados

- `smoke.mjs`: `src/app/HeroFocus.tsx` sai da lista de arquivos obrigatórios.
- `guardian-draft-management.mjs`: saem o check "stream de draft continua único e
  nomeado" (exigia "Inteligência de Draft" no menu) e o check "menu horizontal tem
  a entrada do Draft Score". As checagens de rota, hook e tabela do Draft Score
  permanecem — só a entrada de menu deixou de existir.

## Alternativas rejeitadas

1. **Remover também as rotas `/draft-score` e `/confrontos`.** O pedido foi sobre o
   menu; as telas continuam úteis (Confrontos é reusado pela ficha e pelo
   `HeroDossier`; Draft Score é a página de teste do motor). Rejeitada.
2. **Mover "Inteligência de Draft" para dentro de `/draft`.** Preserva o acesso ao
   Draft Score, mas cria navegação nova não pedida; a página de teste não pede
   destaque. Rejeitada.
3. **Deixar o `HeroFocus` como está e só tirar o agrupador.** Ignora metade do
   pedido. Rejeitada.

## Consequências

- Topo mais enxuto: uma cápsula de filtros globais e as cinco abas primárias.
- `?hero=` e `/build` seguem funcionando (verificado nos guardiões).
- `/draft-score` fica sem link de UI (acesso por URL). Se a página de teste ganhar
  uso, reavaliar onde expô-la.

## Verificação

`npm run check:web` (tsc), `npm run test -w web` (smoke + guardiões + vitest) e
`npm run check:boundaries` verdes após a mudança.
