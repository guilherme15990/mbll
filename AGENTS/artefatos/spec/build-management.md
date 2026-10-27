# Build Management — tela do herói

Data: 2026-10-26 · Destino: produto, frontend e QA
Base: `experiencias-ooux.md` (J3/J4), `builds-combinations-tab.md`,
`builds-aggregate-ui-copy.md`, ADR-030 e ADR-044.

## 1. Job do jogador

**Quando** abro o Radar e descubro um herói forte no meta, **quero** entender o
núcleo dele, comparar as builds que o sistema já observou e completar os slots
que faltam, **para** sair com uma composição defensável e ir para o draft sem
montar de cabeça.

A tela responde, nesta ordem:

1. **Qual é o núcleo deste herói nesta lane?** (itens que se repetem)
2. **Quais builds o sistema já observou?** (com win/pick/lift e índice relativo)
3. **O que faz sentido colocar nos slots livres?** (peso por contraste + adoção)
4. **Qual é o próximo passo?** (Preparação, Combinador, Confrontos, Draft)

## 2. Entrada e contexto

- Herói: `?hero=` (sidebar/hero picker) ou `/build/:id` (link direto).
- Lane: `?lane=`; sem lane, a primeira rota mapeada do herói é sugerida.
- Build selecionada: `?build=<assinatura>` — assinatura estável de
  `signatureOfPick` (itens/emblema/talentos/feitiço). F5 preserva a seleção.
- Elo e janela: `?rank=` e `?window=` do shell.

Sem herói: empty state + `HeroPicker`. Sem lane: `NeedsLane`; nenhuma query de
builds dispara.

## 3. Fonte de dados (nenhum endpoint novo)

| Bloco | Fonte | Uso |
|---|---|---|
| Identidade e força | `GET /v1/heroes/:id` | nome, avatar, tier, θ̂, win/pick/ban |
| Rotas do herói | `GET /v1/heroes/lanes` | sugerir lane |
| Builds observadas | `GET /v1/heroes/:id/builds?rank&lane` | itens, emblema, talentos, feitiço, win, pick, lift |
| Pesos por componente | `GET /v1/builds/aggregate?...` | `combiner.items` (peso por contraste, adoção, arquétipo) |

O agregado é o mesmo hook/cache já usado por `/builds`; a tela não cria chave
paralela nem fan-out no cliente.

## 4. Decisões L2

1. **Rota nova, dados existentes.** `/build` e `/build/:id`; não criar endpoint.
2. **URL como store.** `hero`, `lane`, `rank`, `window` e `build` viajam; a
   seleção não vive só em `useState`.
3. **“Build do sistema” = build observada.** O rótulo não promete previsão. O
   índice é o mesmo `scoreCombination` do Combinador (ADR-030), claramente
   rotulado como relativo.
4. **Sugestão de item não é recomendação.** Só entram itens com
   `value_pp_source` diferente de `none` e valor disponível. Cada sugestão mostra
   selo de evidência (observado/estimado), peso, adoção e arquétipo.
5. **Adicionar item não herda win rate.** Ao levar para `/preparar`, a carga é
   `custom` quando há item adicionado; `observedItems` continua contando apenas
   os itens da build de origem (`ref`).
6. **Regras de slot.** Máximo 6 itens, sem repetição, uma bota no máximo.
7. **Sidebar.** “Gerenciar build” entra em Visão geral, depois de Builds,
   preservando o `?hero=` atual.

## 5. Invariantes

- **INV-BM-01** — Sem lane não há build, núcleo, índice nem sugestão.
- **INV-BM-02** — Nenhum número aparece como 0 quando a fonte não tem dado;
  ausência vira “—”, “sem contraste” ou “Poucos dados”.
- **INV-BM-03** — Item adicionado nunca herda win/pick/lift da build observada.
- **INV-BM-04** — Nenhuma copy de “melhor build”, “build recomendada”,
  “previsão”, “probabilidade” ou causalidade.
- **INV-BM-05** — A seleção de build sobrevive a F5 e à troca de lane é limpa
  (`?build=` é removido quando o recorte muda).
- **INV-BM-06** — Emblema continua descritivo e não soma no índice.

## 6. Estados

- Loading: skeletons por bloco (`Loading`).
- Erro de builds ou agregado: `ErrBox` com retry; a seção de núcleo continua se
  houver build em cache.
- Vazio de builds: “Nenhuma build observada neste herói + lane + elo”.
- Vazio de itens para completar: “Nenhum item com contraste suficiente neste
  recorte”.
- Stale: `FreshLine` com idade; nunca esconder.
- Build completa (6/6): sugestões desabilitadas, ação de preparar disponível.

## 7. Critérios de aceite

1. `/build` aparece na sidebar e abre com `?hero=` preservado.
2. Com herói + lane, a tela mostra núcleo, builds observadas, índice e sugestões.
3. Selecionar uma build grava `?build=` e F5 mantém a mesma build.
4. Adicionar/remover item respeita 6 slots e uma bota; o índice é recalculado.
5. “Levar para a preparação” abre `/preparar?l=` com a composição e contexto.
6. Composição com item adicionado não mostra win rate observado.
7. Trocar lane/hero limpa a build selecionada e os itens adicionados.
8. Nenhum endpoint novo; `useBuilds`/`useBuildsAggregate` usam as chaves oficiais.
9. Testes puros de núcleo, sugestão e slots passam; typecheck/build verdes.

## 8. Fora de escopo / L3

- Recomendação com score, previsão de vitória, sinergia de composição de time.
- Persistência por usuário, login, histórico entre dispositivos.
- Novo endpoint ou coleta de dado sensível.
