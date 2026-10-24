# ADR-036 — Web modular e resiliente: filtros sem ciclo, formatação com dono, rotas lazy e limite de erro

- Data: 2026-10-24
- Status: aceita e implementada (F4a da ADR-033)
- Contexto: `apps/web` (React 18 + Vite/esbuild, um único deploy servido por
  `apps/api`), máquina de 4 GB, zero dependência nova.

## Problema

1. **Ciclo de importação no shell.** `useFilters` morava em `App.tsx` e 11 páginas
   importavam `../App` só para ler `rank/window/hero`. O bundler puxava o shell
   inteiro por causa de um hook, e qualquer mudança no App repercutia em todas as
   páginas (`App → página → App`).
2. **Formatação duplicada.** `pct`/`num` viviam em `lib/api.ts`, mas `signed` foi
   reimplementado em 4 arquivos, `pp` em outros 2, `fmtLift`/`fmt`/`fmtDelta` em
   mais 4 — cada cópia com um default de casas diferente. O contrato "valor ausente
   nunca vira 0" era repetido (e podia divergir) em cada cópia.
3. **Sem limite de erro.** Um `throw` no render de uma página derrubava a árvore
   inteira: tela branca, sem mensagem, sem ação. Não havia `getDerivedStateFromError`
   nem `componentDidCatch` em lugar algum.
4. **Um único bundle.** Todas as 12 rotas entravam no entry: **984,62 kB**
   (266,62 kB gzip). Abrir `/dashboard` baixava também `Builds`, `HeroDetails` e o
   `recharts`, mesmo sem visitar essas telas.
5. **Código morto versionado.** `src/pages/.old/` (6 telas), `DddModal.tsx`,
   `idd/ExportEvidence.tsx` e `hero/heroSeal.ts` não eram importados por ninguém,
   mas continuavam no repo, no typecheck e no inventário de arquivos.

## Decisões

### 1. `src/app/filters.ts` é o dono do filtro global

`useFilters` e `filtersQuery` saem de `App.tsx` para um módulo sem dependência de
componente. As 11 páginas importam `../app/filters`; o App importa o mesmo hook.
`App.tsx` deixa de exportar `useFilters`.

`filtersQuery` centraliza a montagem da query de navegação (antes repetida dentro
de `getNavUrl`). O `set` passou a **copiar** o `URLSearchParams` antes de mutar:
o objeto devolvido pelo hook pode ser compartilhado entre renders, e mutar direto
já causou perda de parâmetro. A atualização continua `replace: true` (não polui o
histórico a cada troca de filtro).

Regra da ADR-033 (`web/pages/* → App.tsx` proibido) passa a ser verificada pelo
guardian, não só documentada.

### 2. `src/shared/format.ts` é a fonte única da formatação

| Função | Contrato |
|---|---|
| `pct(v, digits=1)` | fração 0..1 → `"52.3%"`; inválido → `"—"` |
| `num(v, digits=2)` | número fixo; inválido → `"—"` |
| `signed(v, digits=1, suffix="")` | sinal explícito `+`/`−`; `null`/`NaN` → `"—"` |
| `pp(v, digits=1)` | `signed(v, digits, " pp")` |
| `ago(ms?)` | `"agora"`, `"há 5 min"`, `"há 3.2 h"` |

`lib/api.ts` reexporta `{ ago, num, pct }` por compatibilidade — os ~30 imports
existentes continuam válidos e são migrados aos poucos. `signed`/`pp` são usados
diretamente de `shared/format`; as 9 cópias locais foram removidas.

`dir`/`dirWord` (semântica de z-score: sobe/cai/estável) e `cx` (helper de classe)
**não** entraram em `shared/format`: não são formatação numérica. Ficam em
`lib/api.ts` nesta fase e viram dívida de F4b/F5 (ver Riscos).

### 3. `ErrorBoundary` na raiz e por rota

`src/app/ErrorBoundary.tsx` é um class component (os hooks de erro
`getDerivedStateFromError`/`componentDidCatch` não têm equivalente funcional).
Comportamento:

- isola a falha e mantém header/sidebar/footer vivos;
- mostra a mensagem do erro (sem stack na UI) e registra `ui_error` no console com
  `componentStack`;
- oferece **Tentar de novo** (re-render), **Recarregar página** e **Ir para o início**;
- `role="alert"` + `data-testid="error-boundary"`.

Dois níveis: na raiz (`main.tsx`, cobre falha do próprio shell) e dentro de
`<main>`, com `key={location.pathname}` — navegar para outra rota limpa o erro da
anterior, em vez de manter a tela de falha presa.

### 4. Rotas lazy com fallback acessível

As 12 páginas usam `React.lazy(() => import(...))`, envolvidas por um único
`<Suspense fallback={<RouteFallback/>}>`. O fallback tem `role="status"`,
`aria-live="polite"` e `data-testid="route-loading"`.

`HeroDetails` é declarado **uma vez** e reutilizado por `/hero/:id`,
`/hero/detalhes` e `/heroi` — antes eram três imports do mesmo componente. O
redirect de `/` continua eager (`<Navigate>`, custo zero).

### 5. Remoção de código morto

Verificado por script de alcançabilidade (import specifier): 9 arquivos sem
nenhum importador. Removidos:

```
src/pages/.old/{Panorama,HeroDetail,Views,Gems,Method,Modules}.tsx
src/components/DddModal.tsx
src/components/idd/ExportEvidence.tsx
src/pages/hero/heroSeal.ts
```

Efeito: `src/` de 62 para 56 arquivos, 1.052 linhas removidas no diff. O build de
produção não muda de comportamento (nada disso era alcançável a partir de
`main.tsx`).

### 6. Compatibilidade Node/TypeScript

`test/combiner.test.mjs` importa `../src/lib/combiner.ts` e roda no `node --test`
com type-stripping nativo (Node 24), que **não resolve extensão omitida em import
de valor**. Por isso `combiner.ts` importa `"../shared/format.ts"` com extensão
explícita e o `tsconfig` ganhou `allowImportingTsExtensions: true` (o projeto já
usa `noEmit`, então a flag é válida). O bundler (Vite/esbuild) aceita a mesma
forma.

### 7. Guardião estático da F4a

`test/guardian-f4a.mjs` (20 checks, sem rede) trava as invariantes: `useFilters`
fora do App, páginas sem import de App, ≥10 rotas lazy, Suspense com fallback
acessível, boundary na rota e na raiz com retry/reload, `shared/format` dono de
`pct/num/ago/signed/pp`, `api.ts` reexportando e sem redefinir, ausência das 9
cópias e dos 4 caminhos de código morto. `smoke.mjs` passa a exigir `app/`,
`shared/` e a ausência de `.old`.

## Alternativas rejeitadas

1. **Passar filtros por Context/Provider.** Resolveria o ciclo, mas adicionaria um
   provider no caminho de toda página e um estado a mais para sincronizar com a
   URL. O hook lê a URL diretamente — a URL é a fonte única.
2. **Deixar `useFilters` em `App.tsx` e importar só o hook.** O import é do módulo,
   não do símbolo: o bundler continua puxando o shell. Só resolveria com arquivo
   separado.
3. **Mover toda a formatação para `lib/api.ts`.** Seria o menor diff, mas mantém a
   API de dados (`useQuery`, fetch) acoplada a apresentação. `shared/` separa sem
   quebrar imports existentes.
4. **`ErrorBoundary` único na raiz.** Simples, porém um erro em `/builds` apagaria
   o shell e a navegação; o usuário ficaria preso até recarregar. O boundary por
   rota isola e o da raiz cobre o que sobra.
5. **Lazy por componente (ex.: `charts` sob demanda).** `charts` já sai em chunk
   próprio por ser importado só por painéis; separar mais fragmentaria requests
   sem ganho de first paint.
6. **Reorg completo em `features/<contexto>` (F4b) agora.** Aumentaria o diff em
   ~50 arquivos junto com mudanças de comportamento. F4a entrega os ganhos
   verificáveis (ciclo, bundle, resiliência) sem misturar reorg estrutural.
7. **Router de dados (`createBrowserRouter` + loaders).** Exigiria reescrever o
   shell e os guards de URL; não é pré-requisito para code splitting.

## Consequências

Positivas: ciclo eliminado (página não puxa mais o shell); formatação com um único
contrato testável; falha de render isolada com ação de recuperação; entry
**984,62 → 289,76 kB** (−70,6%; gzip 266,62 → 88,32 kB) e 30 chunks JS; abrir uma
rota baixa só o módulo dela; 9 arquivos e ~1.052 linhas de código morto removidos;
regras viram teste (guardian), não convenção.

Negativas / custos:

- Cada navegação para uma rota ainda não visitada faz um request adicional de
  chunk. O servidor é HTTP/1.1 e o cache é `immutable`, então o custo é o primeiro
  acesso; sem `prefetch`/`preload` nesta fase.
- O fallback de Suspense é genérico (não replica o esqueleto de cada tela), o que
  gera um layout shift pequeno na primeira visita.
- Dois boundaries: um erro na raiz ainda derruba tudo (intencional — é o último
  recurso).
- `lib/api.ts` continua sendo um módulo grande (~23 kB) e reexporta formatação por
  compatibilidade; a limpeza total é F4b/F5.
- `allowImportingTsExtensions` é uma concessão ao teste Node; se o runner mudar
  (ex.: `tsx`), a flag pode sair.

## Evidência de execução

Ver `F4a-web.md`: typecheck 0; web smoke/guardians OK (F4A 20/20, Confrontos,
Builds global); itemsets+combiner 24/24; API 123/123; motor 219/219; build Vite e
`build:fast` verdes; smoke de runtime com `dbClosed:true`, exit 0; varredura de
arquivos não importados = 0.
