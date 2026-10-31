## Veredito: APROVADO COM RESSALVAS

Escopo revisado: entrega da tela `/draft` (ADR-052) — `features/draft-management/` (página, hook de dados, 4 componentes), `model/` puro em 7 módulos + barrel, `shared/api/queries/matchups.ts` (query compartilhada), rota em `app/router.tsx`, entrada `DMP` na `Sidebar`, testes `test/draft-management.test.mjs` (40), `test/guardian-draft-management.mjs`, `test/ui/draft-management.test.tsx` (8), `smoke.mjs` e script `test` do workspace.

Sondagem executada: `npm run verify` (exit 0 — boundaries OK, `check:api`, `check:web`, engine/api verdes, web node:test 119 / 0 fail, 6 guardiões OK, vitest 22 / 22), `npm run build -w web` (✓ built, chunk `DraftManagement` 44,77 kB / gzip 14,38 kB), `node --test test/draft-management.test.mjs` (40/40), `node test/guardian-draft-management.mjs` (OK). Leitura integral dos 5 arquivos de UI + 7 módulos do modelo.

Elogio em uma linha: o modelo puro separa honestidade estrutural de verdade — ausência de par vira `null` em vez de `0`, a direção do confronto vem da lista e não do sinal do δ, e o veredito se recusa a existir com menos de 3 heróis por lado.

### CRITICAL (bloqueia)
- Nenhum.

### HIGH
- Nenhum.

### MEDIUM
- [banda de incerteza cobre só a força, mas é desenhada no índice composto] — `band` é calculada com `se` de θ̂ (`model/power.ts:104-113`) enquanto o índice inclui sinergia e confronto, cujos δ não têm IC no contrato (`Pair` só traz `delta`, ver `shared/api/queries/matchups.ts:11-19`). Mitigado nesta entrega com o rótulo “banda da força” (`PowerPanel.tsx:45`) e com `parcial`/`suporte x/y` em cada componente; a banda não deve ser lida como intervalo do índice. (dono: web + produto · prazo: se/quando o contrato expuser IC de par)
- [erro de par vira contagem agregada, sem autoria] — `bookErrors` conta quantos heróis ficaram sem matriz (`useDraftData.ts:127`) e a tela mostra o total (`DraftManagement.tsx:150-152`); o usuário não sabe **qual** herói perdeu o componente — ele só desaparece da média e o índice marca `parcial`. Comportamento correto por INV-DMP-002/003, mas a leitura fica opaca em matriz esparsa. (dono: web · prazo: próxima passada — listar os heróis sem par ou tooltip por linha)
- [`se` do time divide por heróis com IC, não por heróis preenchidos] — `teamStrength` usa `intervals.length` no denominador (`model/pairs.ts:140-145`), então time com 2 heróis sem IC e 3 com IC tem `se` calculado sobre 3. Está coerente com a spec (`seTime = √Σseᵢ²/n`) e com “sem IC não há banda”, mas o `n` não é o do time — documentado, não silencioso. (dono: web · prazo: sem prazo, manter documentado)

### LOW
- `PairAggregate.contested` existe e é sempre `0` em `pairSynergy` (`model/pairs.ts:56-76`); campo morto, remover na próxima limpeza (não afeta a tela).
- `TeamColumn` monta 133 `<option>` por select de ban, 6 selects por render (`TeamColumn.tsx:72-77,249-253`); medido sem impacto perceptível com o catálogo atual, mas cresce linear com o catálogo — filtrar para top-N por `ban` + o valor atual.
- Link editado à mão com herói repetido agora é corrigido em silêncio na leitura (`parseDraft` → `dedupe`, `model/state.ts:62-92`); a tela não avisa que descartou. Aceitável: o estado gravado volta correto no primeiro clique.
- Fora de escopo declarado na spec e não implementado: persistência por usuário, telemetria, bans com ordem oficial de torneio.

## Checagem dos gates

| # | Gate | Evidência | Status |
|---|---|---|---|
| 1 | spec sem L3 aberta | `spec/draft-management.md` §1–§8; L2 registrados em `ADR-052` D1–D8 (inclui D8: modelo na feature) | APROVADO |
| 2 | fluxo cobre vazio/erro/loading/sucesso | `DraftManagement.tsx:158-227` (`NeedsRank` → `ErrBox` → `Loading` → conteúdo, com bloco de draft vazio) + teste de UI “draft vazio”, “elo ALL”, “erro do lote”, “carregando” | APROVADO |
| 3 | invariantes com ID + cenário QA | tabela abaixo: INV-DMP-001..009 todos com teste nomeado | APROVADO |
| 4 | P0 do hunter zerado | nenhum P0 encontrado nesta revisão; CRITICAL/HIGH = 0 | APROVADO |
| 5 | zero CRITICAL de security/critic | sem superfície nova: nenhum endpoint, nenhum fetch cru, nenhum `dangerouslySetInnerHTML`, nenhuma query key nova na feature (guardão verifica) | APROVADO |
| 6 | build + testes verdes | `npm run verify` exit 0; `npm run build -w web` exit 0; boundaries OK sem crescimento de allowlist | APROVADO |

## INV → cenário de QA

| INV | Cenário (arquivo:teste) |
|---|---|
| INV-DMP-001 (nada é probabilidade/previsão/win rate) | `guardian-draft-management.mjs` §6 (8 regex proibidas + ressalva obrigatória) e `ui/draft-management.test.tsx` “não é probabilidade de vitória” ausente |
| INV-DMP-002 (sem suporte = null, nunca 0) | `draft-management.test.mjs` “componente sem suporte sai do denominador”, “par sem sinergia observada é null” |
| INV-DMP-003 (par ausente = desconhecido) | “confronto desconhecido não entra no denominador”, “sem counter observado, a lista de bans é vazia” |
| INV-DMP-004 (direção vem da lista) | “confronto: direção vem de countersUp/countersDown, não do sinal do δ” |
| INV-DMP-005 (média por par, nunca soma) | mesmo teste acima (`total = n·m`, valor médio) |
| INV-DMP-006 (herói usado não volta) | “herói já usado não entra de novo”, “link com herói repetido perde a repetição” |
| INV-DMP-007 (URL como store, recorte global) | “encode/parse faz round-trip”, “link inválido degrada”, teste de UI do seletor de 1º pick gravando `first` |
| INV-DMP-008 (`rank=all` não calcula) | teste de UI “elo ALL não calcula proxy”, guardião “rank=all pede elo” |
| INV-DMP-009 (zero endpoint/query key novo) | guardião “fan-out usa a query oficial de matchups”, “nenhuma query key própria”, “nenhum fetch cru” |

## Notas de honestidade (o que a tela NÃO faz)

- Não converte índice em probabilidade, previsão ou “chance”: `K`, os pesos e os cortes (3/8/15) são **escala de exibição**, declarados em `model/common.ts` e `ADR-052` D2.
- Não soma δ entre os cinco inimigos; o componente é média por par.
- Não trata δ ausente como neutro, nem interpola par faltante.
- Não chama sugestão de recomendação; a ordenação é declarada (encaixe de rota → soma dos componentes → θ̂).
- Não cria endpoint novo: o fan-out usa `matchupsQuery` (mesma key do hook oficial) limitado aos ≤10 heróis do draft.

---

## Adendo v2 (ADR-053) — 2026-10-30

**Veredito:** APROVADO COM RESSALVAS (mantidas as MEDIUM/LOW acima; nenhuma CRITICAL/HIGH nova).

Escopo: layout em faixas horizontais (bans acima dos picks), força em %, matriz 5×5 em largura cheia, recomendador de 2 fatores por lane com card maior, curva de duração, mix de arquétipos, destaque de maior/menor θ̂ por time. `DraftTimeline`, `TeamColumn` e `SuggestionRail` removidos.

**Sondagem executada:** `npm run test -w web` exit 0 — smoke OK, 140 testes de domínio (`node --test`, 0 fail), 6 guardiões OK, vitest 25/25 (11 do draft); `npm run typecheck -w web` exit 0; `npm run build -w web`, `npm run check:boundaries` e `npm run verify` conforme bloco abaixo.

**Decisão reaberta nesta passada:** a curva de duração deixou de agregar o livro inteiro do herói (o que incluía pares contra heróis fora do draft e sinergias) e passou a agregar **as duplas do time** (2 a 2, até 10 em 5v5), um valor por dupla e por faixa. Cada lado tem uma série (nós × eles), calculada só por sinergia interna — o confronto continua na matriz 5×5. A tela não rotula early/mid/late: devolve a série.

**Diagnóstico que motivou o ajuste:** a primeira versão usava só as duplas **vizinhas** na ordem dos slots; como a fonte lista apenas os 5 melhores parceiros de cada herói, times reais ficavam com 0 duplas e a linha desaparecia de um lado. Verificado no cache real (`data/cache.sqlite`, `matchups:92 · synergiesUp → ids [112,55,14,34,102]`) e re-sondado com o modelo novo: time real `[92,108,14,130,88]` → 1 dupla listada / 8 faixas com valor (antes: 0). Quando um lado não tem dupla listada, a legenda diz “sem dupla listada” em vez de sumir com a linha.

| Gate | Evidência | Status |
|---|---|---|
| testes | `node --test app/web/test/draft-management.test.mjs` 61/61; `npm run test -w web` 140 + 25 | APROVADO |
| honestidade | guardião §6 (copy proibida) + rótulo “proxy, não win rate do time” na curva | APROVADO |
| contrato | `teamCurve(ids, books)` (duplas consecutivas → média por faixa); `analyzeDraft` chama uma vez por lado | APROVADO |
| build/boundaries | `tsc --noEmit` exit 0; build/boundaries executados nesta passada | APROVADO |
