# ADR-055 — Shell com menu horizontal (sai a sidebar) e limpeza da página Heróis

**Data:** 2026-10-30 · **Status:** aceito · **Contexto:** o usuário pediu para mover a
navegação da sidebar para um **menu horizontal** no topo, com as seções Dashboard,
Heróis, Builds, Gerenciar build e Draft management; e, em seguida, remover da
página Heróis os textos de scaffolding (faixa de contexto, ação primária, legenda de
rota, atalhos de PRD). **Relaciona-se a:** ADR-036/ADR-037 (F4a/F4b — shell e
feature-first), ADR-043 (`app/router` como único loader de features), ADR-052/053
(`/draft`), ADR-054 (`/draft-score`).

## Contexto

O shell tinha **duas** navegações acopladas: uma sidebar fixa no desktop
(`app/Sidebar.tsx`, sticky) e um drawer no mobile, abertos pelo hambúrguer do
cabeçalho. A sidebar acumulava três papéis: (1) navegação primária; (2) um
agrupador de contexto ("Inteligência de Draft" → Draft score, Confrontos); e (3)
a ferramenta "Herói em foco" (`HeroPicker` + mini-dossiê, que grava `?hero=`).

A página Heróis (`/hero`) carregava, no topo, copy de scaffolding que não é
navegação nem dado: a faixa de contexto `CtxBar` ("Inferência & Força · CTX-SHR ·
Qual herói abrir na ficha? · provisório (entrada)"), o cartão `PrimaryAction`
("Abrir a Ficha do Herói", redundante com os cartões clicáveis), a legenda
"filtro global de rota … · X de Y heróis" e os atalhos "Casos de Estudo dos PRDs"
dentro do `HeroPicker`.

## Decisão

### D1 · Menu horizontal substitui a sidebar
A navegação primária vira `app/TopNav.tsx`, uma barra horizontal logo abaixo do
cabeçalho (sticky junto dele). Cinco seções, na ordem pedida: **Dashboard**
(`/dashboard`), **Heróis** (`/hero`), **Builds** (`/builds`), **Gerenciar build**
(`/build`) e **Draft management** (`/draft`). Cada aba preserva o contexto global
(elo/janela/rota/herói) via `getNavUrl` — o mesmo contrato de link da sidebar.

### D2 · Contextos secundários ficam num agrupador à direita
`Draft Score` (`/draft-score`) e `Confrontos` (`/confrontos`) continuam com rota
própria e passam para um `<details>` à direita da barra (fecha ao navegar). Nada
de rota órfã: o que saiu da lista primária continua alcançável.

### D3 · "Herói em foco" vai para o cabeçalho
O seletor + mini-dossiê viram `app/HeroFocus.tsx`, um controle compacto à direita
da barra de contexto, que abre um painel com o `HeroPicker` (compacto) e o
dossiê do herói ativo. O contrato de URL (`?hero=`) é o mesmo; `BuildManager` já
o consome por "param ou query" e não muda.

### D4 · Um só breakpoint: a barra rola; o dropdown não é cortado
O hambúrguer e o drawer saem. No mobile, as cinco abas ficam num contêiner
`overflow-x-auto`; o agrupador de draft fica **fora** desse contêiner (irmão), para
o painel absoluto não ser recortado pelo scroll do eixo X.

### D5 · Limpeza da página Heróis
Em `/hero` saem: a `CtxBar`, o `PrimaryAction`, a legenda de rota (o estado
"mapa de rotas indisponível" permanece) e o subtítulo do `SectionTitle`. Os
atalhos de PRD do `HeroPicker` somem **só nessa página** via nova prop
`showPrdSuggestions` (default `true`; a página passa `false`), porque o componente
é compartilhado (cabeçalho e Build Manager). Restam: o título "Heróis", a busca e
a grade de cartões.

## Consequências

- `app/Sidebar.tsx` é removido; o shell em `App.tsx` passa a header + `TopNav` +
  main de largura cheia + footer. `smoke.mjs` e os guardiões de Build Manager e
  Draft Management passam a ler `TopNav.tsx` (mesmas strings de contrato). A
  entrada `Sidebar.tsx` sai da allowlist de tamanho do `check-boundaries.mjs`.
- A sidebar era o único lugar com `HeroPicker`; a ferramenta não se perde — muda
  de casa para o cabeçalho.
- Sem drawer, o `body` não é mais travado (o efeito de scroll da sidebar sai).

## Alternativas consideradas

- **Manter a sidebar e só adicionar o menu horizontal:** duplicaria a navegação.
- **Dropdown "Mais" com as cinco seções no mobile:** a barra rolável é mais
  direta e mantém as seções visíveis.
- **Remover os atalhos de PRD do `HeroPicker` globalmente:** afetaria cabeçalho e
  Build Manager sem pedido; a prop por página é reversível e explícita.
