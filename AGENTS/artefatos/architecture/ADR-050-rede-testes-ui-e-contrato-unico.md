# ADR-050 — Rede de testes de UI (E1) e contrato único do agregado (E2)

- **Status:** aceito
- **Data:** 2026-10-27
- **Origem:** auditoria arquitetural das Fases 1–2 do prompt mestre; plano
  **E1–E5** aprovado pelo usuário.
- **Escopo:** `app/web` (teste), `packages/contracts` (novo), `app/api`,
  `packages/proprietary-engine`. Nenhuma mudança de comportamento de produto.

## Contexto

O diagnóstico das Fases 1–2 apontou dois débitos que travavam qualquer
refatoração segura:

1. **Zero testes de componente.** A web tinha 79 testes de domínio, um `smoke.mjs`
   que checa existência de arquivo e guardiões que fazem `grep` no fonte. Nada
   provava que uma tela renderiza. Decompor `BuildManager` (955 linhas) ou os
   painéis de builds (806/581/544) sem rede = regressão descoberta só à mão.
2. **O contrato do agregado existia em três lugares.** O `index.d.ts` do motor
   devolvia `Record<string, any>`; a API montava o corpo em JS; a web declarava
   **29 tipos à mão** em `shared/api/queries/builds.ts`. API e web podiam
   divergir sem o `tsc` acusar — o tipo da web descrevia só a expectativa dela.

Havia ainda um registro antigo no próprio código, em
`app/api/src/providers/contracts.js`: *"publicar estes tipos para `app/web` …
para que o tipo do agregado na web deixe de ser escrito à mão"*. Nenhuma das
três descrições era a fonte.

## Decisão

### E1 — Vitest + Testing Library como rede de caracterização

- `app/web/vitest.config.ts` separado do `vite.config.ts` de propósito: aquele
  importa o router da API (SQLite, providers) só para o dev server; teste de UI
  não deve depender dessa pilha.
- `test/ui/setup.ts` faz `fetch` global nunca resolver e limpa o DOM entre
  testes; `test/ui/render.tsx` fornece `QueryClientProvider` + `MemoryRouter`
  com `staleTime: Infinity`. Resultado: hook não mockado fica em `isLoading`
  para sempre — o teste observa o estado que a tela desenha, sem rede e sem
  timer.
- Três suítes de **caracterização** (15 testes):
  `builds-panels.test.tsx` (8), `build-manager.test.tsx` (3),
  `hero-detail.test.tsx` (4). Elas descrevem o comportamento **atual**,
  inclusive o que parece estranho, para que a decomposição de E3 possa ser
  comparada antes/depois.
- Scripts: `test:ui` (`vitest run`) e `vitest run` ao final do `test` da web —
  CI passa a rodar UI sem passo novo.

### E2 — `@radar/contracts` como fonte única do DTO do fio

Novo workspace `packages/contracts`:

- **só tipos** (29 tipos do agregado, incluindo os compostos), sem import, sem
  runtime, sem dependência de `app/` ou do motor;
- descreve o que a API **promete** no fio, não o que a fonte externa manda;
- `main`/`types`/`exports` apontam para `src/index.ts` (o consumidor compila o
  próprio `.ts`; não há passo de build).

Ligações:

| Lado | Antes | Depois |
|---|---|---|
| Motor | `buildAggregate(): AggregateBody` com `Record<string, any>` | `AggregateBody = BuildsAggregateResponse` de `@radar/contracts` |
| Motor | `AggregateSupport`, `PatternScope`, `DiscoveryStatus` declarados no `.d.ts` | importados e reexportados do contrato |
| API | `const body = buildAggregate({...})` sem anotação | anotado com `import("@radar/contracts").BuildsAggregateResponse` |
| Web | 29 tipos escritos à mão (~250 linhas) | `export type { ... } from "@radar/contracts"` (~106 linhas no arquivo) |

O barrel da web continua reexportando **os mesmos nomes**, então nenhum call site
mudou — a refatoração é invisível para `features/`.

### Campos que a borda acrescenta

`deadline_scope`, `prep_ms` e `build_ms` são escritos em
`buildsAggregate.js` (não pelo motor) e entraram como **opcionais** em
`context`. Comparação automática do bloco antigo (git HEAD) com o novo pacote
mostrou **29 tipos, 0 faltando, 1 alterado** — exatamente esse acréscimo
aditivo. Nada foi estreitado.

### Gate executável

`tools/check-boundaries.mjs` ganhou a seção **6 · contrato**:

1. o pacote existe e exporta tipos;
2. o pacote é só tipo — falha se aparecer `import` ou `const`/`function`/`class`;
3. **nenhum DTO do fio é redeclarado fora do pacote** (a regra que impede a
   terceira cópia de voltar). Reexport (`export type { X } from ...`) é válido;
4. `shared/api/queries/builds.ts` importa de `@radar/contracts`;
5. `@radar/contracts` está declarado como dependência em web, api e motor — sem
   isso o import funciona por acaso (hoisting) e quebra num `npm ci` limpo.

### Correção de ambiente encontrada no caminho

Depois de instalar jsdom, o `npm install` hoisted `punycode` (jsdom → whatwg-url →
tr46) na raiz. `@types/node/process.d.ts` faz `typeof import("punycode")`; com
`allowJs: true` o tsc da API passou a **checar o `.js` de terceiro** e falhou com
16 erros sem relação com o projeto. Correção: `app/api/types/punycode.d.ts`
(shim de tipos) + `paths.punycode` no `jsconfig.json`. O resto do `@types/node`
continua intacto.

## Verificação

Executado nesta etapa:

| Comando | Resultado |
|---|---|
| `npm run check:boundaries` | **OK** — 21 verificações (16 + 5 do contrato) |
| `npm run check:api` | **OK** |
| `npm run check:web` | **OK** |
| `npm test` | engine **211**, api **149**, web **79** + **15** de UI |
| `npm run build` | ver relatório da etapa |

## Consequências

- Decompor os painéis de builds agora é verificável: os 15 testes falham se o
  comportamento exibido mudar.
- Um campo novo no agregado entra em **um** arquivo de tipo; o `tsc` da API e o
  da web verificam a mesma forma.
- O contrato é uma dependência de **tipo** (apagada no build). Se algum dia
  precisar de validação em runtime, isso é um pacote separado — o contrato não
  deve virar código.
- `packages/contracts` não substitui `providers/contracts.js` (envelope HTTP):
  são camadas diferentes, e a fusão só faria sentido se o envelope também
  virasse tipo compartilhado.

## Condições para revisão

- Se outro endpoint ganhar contrato compartilhado, ele entra neste pacote (não
  em um segundo `packages/contracts-*`).
- Se um nome do contrato divergir do runtime, o gate 3 acusa a redeclaração,
  mas não a forma: a defesa continua sendo `buildAggregate` tipado + os testes
  de UI que leem o payload.
