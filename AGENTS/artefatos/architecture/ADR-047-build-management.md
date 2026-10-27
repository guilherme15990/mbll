# ADR-047 — Build Management como superfície de decisão do herói

- **Data:** 2026-10-26
- **Status:** aceita
- **Contexto:** o fluxo do jogador é meta → herói → build → draft. A build
  observada aparece em 5 superfícies, mas nenhuma junta núcleo, builds do
  sistema, slots livres e próximo passo no mesmo lugar.
- **Decisão:** criar `/build` (alias `/build/:id`) como tela de decisão do
  herói, reaproveitando os contratos existentes.

## Decisões

1. **Rota e navegação.** `/build` entra na sidebar em Visão geral, depois de
   Builds. O herói vem de `/build/:id` ou `?hero=`, preservado pelo shell.
2. **Sem backend novo.** Identidade (`useHero`), rotas (`useHeroLanes`), builds
   (`useBuilds`) e pesos (`useBuildsAggregate`). Nenhuma rota HTTP nova.
3. **Lógica pura em `shared/domain/buildManager.ts`.** Núcleo, fork de pick e
   sugestões de completar são funções puras, testáveis sem React.
4. **Seleção endereçável.** `?build=<signatureOfPick>`; a assinatura já é o
   contrato do loadout. Trocar lane/hero remove `build`.
5. **Honestidade.** O índice é `scoreCombination` (ADR-030), rotulado como
   relativo. Sugestões só usam componentes com contraste; itens adicionados
   tornam a carga `custom` e não herdam win/pick/lift.
6. **Limites de slot.** 6 itens, sem repetição, uma bota no máximo — as mesmas
   regras de `validatePick`.

## Consequências

- O jogador fecha a sessão com uma composição endereçável e um caminho para
  Preparação/Combinador/Confrontos/Draft.
- A tela depende do agregado da lane (fan-out no servidor), mas usa o mesmo
  cache de `/builds`; não há fan-out no cliente.
- Nenhuma promessa nova de sinergia, previsão ou recomendação.
