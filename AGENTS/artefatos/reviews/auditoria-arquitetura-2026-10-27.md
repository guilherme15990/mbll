# Auditoria de arquitetura — verificação independente

- Data: 2026-10-27
- Escopo: validar a auditoria externa (ZIP `radar-mlbb(1).zip`) contra o repositório real
- Status: **diagnóstico concluído. Nenhum arquivo movido, nenhum código alterado.**
- Método: execução dos gates + leitura dos arquivos citados + leitura dos ADRs que a auditoria não teve acesso

---

## Veredito

A tese central está correta e **já era decisão registrada**: manter o monorepo, adotar
híbrido (feature-first + separação por responsabilidade), refatorar incrementalmente e
não migrar para Clean Architecture. Isso está na ADR-033 (monólito modular) e na ADR-041
(estrutura de pastas alvo), com os mesmos argumentos e mais medições.

A auditoria externa erra em 3 fatos verificáveis e **prioriza o problema errado**. O
passivo caro do projeto não é taxonomia de pastas — é concentração de responsabilidade
dentro de arquivos grandes, que viola o critério de aceite nº 1 da própria ADR-041.

---

## Evidência executada

| Comando | Resultado |
|---|---|
| `npm run check:boundaries` | **21 PASS / 0 FAIL — BOUNDARIES OK** |
| `npm run check:web` (`tsc --noEmit`) | exit 0, sem saída |
| `npm test -w packages/proprietary-engine` | **211 testes, 41 suítes, 0 falhas** (15,1 s) |
| `npm test -w api` | **149 testes, 35 suítes, 0 falhas** (14,2 s) |
| `npm test -w web` | **93 testes, 0 falhas** — 79 `node:test` (itemsets, combiner, loadout, build-manager) + 14 vitest (UI) |
| `npm run build` | **exit 0** — engine + api + web (45,5 s) |

A auditoria externa declarou não ter rodado a suíte da web, o typecheck e o build.
Os três foram fechados nesta rodada, todos verdes. Total: **453 testes**
(211 motor + 149 api + 93 web).

> Contar a web só pelo vitest subestima a suíte em 79 testes: `npm test -w web` roda
> `node:test` (itemsets, combiner, loadout, build-manager) **antes** do vitest. Mesma
> família de erro da contagem de linhas por `Measure-Object -Line`.

---

## O que a auditoria externa acertou

1. **Não reescrever.** Correto e já decidido. ADR-041 §"O que eu não faria", item 3:
   "Clean Architecture / use-cases / repositórios — já rejeitado com motivo na ADR-033:
   não há agregado mutável para proteger".
2. **Gate verde não prova responsabilidade no lugar certo.** Correto. O gate é de
   *direção de dependência* e *forma de arquivo*; não mede coesão.
3. **Handlers acumulam transformação.** Confirmado em
   `app/api/src/routes/builds.js:50-115`: validação, cache, fan-out de 3 chamadas ao
   upstream, cálculo de lift pelo motor e mapeamento do formato bruto da Arena para o
   contrato do fio — 66 linhas de mapeamento dentro do handler.
4. **Os dois `BuildRow.tsx` não são automaticamente duplicação.** Acertou ao não
   concluir. A conclusão correta está abaixo.

## Erros factuais

### 1. `AGENTS/artefatos/architecture/` existe — o ZIP estava incompleto

A auditoria afirma que a pasta não estava no ZIP e que por isso não pôde comparar com os
ADRs. No repositório há **31 artefatos**, incluindo `ADR-033`, `ADR-034`, `ADR-041`,
`ADR-043`, `ADR-045`.

Consequência direta: a estrutura-alvo proposta no §5 da auditoria é ~90% idêntica à
ADR-041 já escrita — `modules/{heroes,builds,matchups,meta,snapshots,health}`,
`platform/{http,cache,db,history,guard,config}`, `upstream/arena`, e a mesma divisão
`primitives`/`patterns` na web. A diferença é que a ADR-041 tem contagem de linhas por
arquivo, fases F1–F7, risco por fase e critérios de aceite. **A auditoria propôs como
novidade algo já decidido e mais bem especificado no repo.**

### 2. "O README descreve `providers/`" — falso. A divergência é a oposta

O README (linhas 26–30) lista apenas `http/`, `routes/`, `application/`, `infra/`.
**Não menciona `providers/`.** E ainda diz:

```text
infra/         arena, cache, snapshot history, config, db
```

Mas a ADR-045 moveu o cliente externo para `providers/arena/`, e o gate **proíbe**
recriar `infra/arena.js` (`check-boundaries.mjs:296-310`). Ou seja: a documentação está
atrasada em relação ao código, não o contrário.

### 3. `BuildRow` não é duplicação — é colisão de nome

| | `features/dashboard/builds/BuildRow.tsx` | `features/builds/power/BuildRow.tsx` |
|---|---|---|
| Linhas | 101 | 232 |
| Props | `{ build: Build }` | 10 props, incl. `hero`, `extras`, `score`, `itemById`, `onOpen`, `onAdd`, `onRemove` |
| Responsabilidade | leitura pura de uma build | editor com composição de itens e índice estimado |
| Estado | nenhum | delega ao painel, mas emite 3 comandos |
| Reuso interno | `ItemSlot` local | `ItemSlot` local, com parâmetro `size`/`added` |

Contratos disjuntos. Extrair um componente comum produziria um componente com 10 props
opcionais e dois modos de render — pior que a duplicação de ~20 linhas de `ItemSlot`.
**Decisão: manter separados. Renomear para `ReadonlyBuildRow` e `CombinerBuildRow`
elimina a confusão de busca por nome.** (L1, não requer ADR.)

---

## O que a auditoria externa não viu — o passivo real

**Critério de aceite nº 1 da ADR-041:** "nenhum arquivo acima de 300 linhas fora de
`packages/proprietary-engine`". Medido hoje com `wc -l` (linhas totais, incluindo
brancas), está violado em **14 arquivos**:

| Linhas | Arquivo |
|---|---|
| **1008** | `app/web/src/features/build-manager/BuildManager.tsx` |
| **834** | `app/web/src/shared/ui/patterns/ItemComposer.tsx` |
| **566** | `app/web/src/shared/domain/buildManager.ts` |
| **500** | `app/web/src/features/hero-detail/HeroDetail.tsx` |
| 476 | `app/web/src/shared/domain/loadout.ts` |
| 430 | `app/web/src/features/build-manager/SlotPicker.tsx` |
| 394 | `app/api/src/application/buildsAggregate.js` |
| 349 | `app/web/src/features/hero-detail/sections/BuildsSection.tsx` |
| 338 | `app/web/src/features/builds/BuildsPowerPanel.tsx` |
| 333 | `app/web/src/features/dashboard/Dashboard.tsx` |
| 312 | `app/web/src/features/hero-detail/sections/ConfrontosPreview.tsx` |
| 310 | `app/web/src/app/Sidebar.tsx` |
| 309 | `app/web/src/features/builds/BuildsAggregatePanel.tsx` |
| 302 | `app/web/src/features/hero-detail/sections/ConfrontosSection.tsx` |

Excluído da regra: `packages/contracts/src/index.ts` (325) — é declaração de tipo do
fio, sem lógica; crescer ali é adicionar endpoint, não concentrar responsabilidade.

> Método importa: `Get-Content | Measure-Object -Line` conta só linhas não vazias e
> reporta 939 para o `BuildManager.tsx`. O número real é 1008. Foi por medir assim
> que os 3 últimos arquivos da tabela (`Sidebar`, `BuildsAggregatePanel`,
> `ConfrontosSection`) ficaram invisíveis na primeira varredura manual. É o mesmo
> motivo pelo qual este critério precisa ser script, não disciplina.

`BuildManager.tsx` concentra ~20 `useMemo`/`useState` no mesmo componente: derivação de
lanes, ordenação por lift, núcleo de itens, decode de loadout da URL, combos de runas,
sugestões de completude e 4 catálogos de picker (itens, emblemas, talentos, feitiços).
É o maior risco de manutenção do projeto, e a auditoria externa não o citou.

### Dívidas menores confirmadas

- `app/api/src/routes.js` — shim de compatibilidade da F1, sem lógica, com 3
  consumidores declarados (`vite.config.ts`, `index.js`, testes).
- A regra de 300 linhas é **critério escrito, nunca automatizado**. Por isso regrediu.

---

## Diagnóstico

O gargalo não é "camadas vs features". É:

1. **Coesão dentro de arquivos** — 14 arquivos acima do próprio limite do projeto.
2. **Documentação desatualizada em 2 pontos** — README sem `providers/`, ainda listando
   `arena` em `infra/`; ADR-041 com fases que não refletem o estado atual.
3. **Critério sem gate** — a regra de 300 linhas existia no papel e não no script.

Mover `routes/` para `modules/` (F6 da ADR-041) **não resolve nenhum dos três**. Move
111 linhas de um arquivo coeso para outra pasta e deixa `BuildManager.tsx` com 1008.

---

## Decisão recomendada

**Não executar F6 agora.** Ordem por custo/benefício:

### P0 — barato, sem risco de comportamento (1 sessão) — **EXECUTADO**

1. ~~Corrigir README: adicionar `providers/` e remover `arena` de `infra/`.~~
2. ~~Remover o shim `app/api/src/routes.js` e apontar os 3 consumidores para os módulos reais.~~
3. ~~Adicionar ao `check-boundaries` a regra de 300 linhas **com allowlist explícita e
   datada** dos 14 arquivos atuais — impede regressão sem bloquear o presente.~~
4. ~~Renomear os dois `BuildRow` (L1).~~

Aceite: `npm run verify` exit 0; gate falha se um 15º arquivo passar de 300. → **cumprido**
(resultado e evidência na seção "P0 executado", ao fim).

### P1 — o que realmente dói (o trabalho de verdade)

5. Fatiar `BuildManager.tsx` (1008) por responsabilidade: `useBuildDerivations` (memos de
   derivação), `usePickerCatalogs` (4 catálogos), `DecisionBoard` (apresentação).
   Existem 3 testes de caracterização em `test/ui/build-manager.test.tsx` — a rede está posta.
6. Fatiar `ItemComposer.tsx` (834) e `domain/buildManager.ts` (566).
7. Fatiar `HeroDetail.tsx` (500) — já tem `sections/`, o shell é que ficou grande.

Aceite: nenhum arquivo novo acima de 300; testes de caracterização passando sem alteração
de expectativa; comportamento idêntico.

### P2 — só se a API crescer além dos 20 endpoints

8. F6 da ADR-041 (`modules/` + `platform/` + `upstream/`), começando por `builds`.
   Inclui extrair de `builds.js` o mapeamento Arena → contrato, que é o único trecho
   hoje genuinamente mal alocado.
9. F7 (injeção no composition root) — a ADR-041 já diz que é opcional. Continua opcional.

### Não fazer (já rejeitado com motivo)

Clean Architecture cerimonial, `packages/ui` publicado, barrel por feature, troca de
gerenciador/build, microserviços por contexto, migração da API para TypeScript junto com
movimentação de pasta.

---

## Riscos

1. **Árvore de trabalho suja.** `git status` mostra mudanças não commitadas, incluindo
   `features/blind/*` deletado e `README.md` modificado. Refactor deve começar de árvore
   limpa — senão o diff de P1 fica irrevisável.
2. **Allowlist de LOC vira permissão permanente.** Cada entrada precisa de dono e prazo;
   caso contrário o gate passa a legitimar a dívida.
3. **P1 toca o fluxo mais testado do produto.** `build-manager.test.tsx` tem 3 testes de
   caracterização — suficiente para detectar quebra grosseira, não para garantir
   equivalência de layout. Fatiar com o painel visual disponível.
4. ~~**`npm run build` não foi executado.**~~ **Resolvido:** build verde antes do P0.

---

## P0 executado (2026-10-27)

| # | Mudança | Arquivos |
|---|---|---|
| 1 | README alinhado à ADR-045: `providers/` documentado, `arena` removido de `infra/` | `README.md` |
| 2 | Shim `routes.js` removido; 19 pontos de import em 4 arquivos apontados para `http/router.js`, `application/scoring.js`, `application/rankLot.js`, `application/buildsAggregate.js` | `app/api/src/routes.js` (removido), `test/routes.test.js`, `test/builds-aggregate.test.js`, `test/contracts.test.js`, `app/web/vite.config.ts`, `app/api/package.json` |
| 3 | Regra de 300 linhas no gate, com allowlist datada e **teto monotônico** (o arquivo pode encolher, não crescer) | `tools/check-boundaries.mjs` |
| 4 | Colisão de nome resolvida: `ReadonlyBuildRow` × `CombinerBuildRow` | `features/dashboard/builds/`, `features/builds/power/` + 2 importadores |

Também corrigido: comentário de `shared/api/queries/filters.ts` apontava `qHeroes` para
o shim extinto; agora aponta `application/scoring.js`.

### Evidência

| Comando | Resultado |
|---|---|
| `npm run check:boundaries` | **23 PASS / 0 FAIL — BOUNDARIES OK**, exit 0 |
| probe negativo (arquivo de 320 linhas plantado) | **FAIL, exit 1** — e revertido |
| `npm run verify` | exit 0 (boundaries + tsc api + tsc web + 211 + 149 + 93 testes) |
| `npm run build` | exit 0 |

O gate agora reporta `126 arquivos varridos, 14 na dívida`. A allowlist é a única
permissão existente, e ela é monotônica: qualquer linha nova em um dos 14 derruba o gate.

### O que o P0 **não** resolveu

`BuildManager.tsx` continua com 1008 linhas. O P0 comprou visibilidade e impediu
regressão; não pagou a dívida principal. Isso é P1.
