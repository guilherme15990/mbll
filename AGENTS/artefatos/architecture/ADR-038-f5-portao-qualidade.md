# ADR-038 — Portão de qualidade F5: `checkJs` na API, fronteiras executáveis, cobertura e CI

- Data: 2026-10-24
- Status: aceita e implementada (F5 da ADR-033)
- Contexto: F0–F4b concluídas. Sem dependência nova de runtime; sem mudança de
  contrato público ou de comportamento.

## Problema

A F1–F4b deixou a arquitetura na forma alvo, mas **nenhum gate impedia a
regressão**:

1. **API sem verificação de tipos.** 15 arquivos em `apps/api/src` são JS puro
   com JSDoc; `npm test` prova comportamento, não contratos. Um campo lido de um
   objeto que não o tem (ex.: `body.context` vindo do motor) só quebra em runtime.
2. **Motor importado por caminho relativo.** Nove módulos da API faziam
   `import ... from "../../../../packages/proprietary-engine/src/index.js"`.
   Mover qualquer arquivo quebra todos; o nome do workspace não era a fronteira.
3. **O `index.d.ts` do motor mentia por omissão.** Ele foi escrito só para a web
   (194 nomes) e **sombreia** `index.js` para qualquer consumidor TS. A API usa 20
   exports que não estavam declarados — o `checkJs` os via como inexistentes.
4. **Fronteiras eram convenção.** O guardian F4b cobre a web; nada cobria
   `apps/*` → `packages/*`, `packages` → `apps`, ou o import de interior de pacote.
5. **Cobertura não era medida nem limitada.** O número existia em relatórios
   antigos, sem threshold que falhasse o build.
6. **Sem CI.** Os gates só rodavam na máquina de quem lembrava.
7. **README da Fase 1.** Descrevia `/v1/balance/*`, `build.mjs` e comandos que não
   existem mais.

## Decisão

Sete peças, todas executáveis por um comando e repetidas no CI.

### 1. `checkJs` na API, sem reescrever a API

`apps/api/jsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "strict": false,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src/**/*.js"],
  "exclude": ["node_modules", "src/data"]
}
```

`strict: false` é deliberado: o objetivo da F5 é **zero erro com o código atual**,
sem reescrever 15 módulos de uma vez. As assinaturas vêm de JSDoc incremental —
cada correção foi feita no ponto onde o tipo estava frouxo, não com `any` global.

`typescript` continua sendo devDependency de `apps/web` (a web já o usa para
`vite build`). Como a posição física do pacote depende do layout de install
(`apps/web/node_modules` no bootstrap lean, raiz num `npm install` normal),
`tools/tsc.mjs` resolve o pacote nos dois layouts e executa o `bin/tsc` real.
Nenhum script fixa caminho de `node_modules`.

### 2. Um único contrato do motor

`packages/proprietary-engine/src/index.d.ts` é o contrato de tipos de **web e
API**. Foram adicionados os 20 nomes que a API importa (`median`, `checkPickSum`,
`summarizeWalkPosterior`, `isValidWalkPrior`, `walkPriorStamp`, `requireLane`,
`LANES`, `C_REFERENCE`, `buildLift`, `buildReferences`, `confidenceTrio`,
`rankDifference`, `temporalDelta`, `assessSeries`, `distortionResidual`,
`durationCurve`, `classifyDuration`, `makePairKey`, `evidenceQuality`,
`blindProxy`, `STRENGTH_INDEX_VERSION`) mais as primitivas da mesma família
(`mean`, `medianNull`, `mad`, `quantile`, `DELTA_DEFAULT`, `DURATION_BANDS`,
`WF_VERSION_BREAK_VARIANCE_FACTOR`) e os tipos de retorno que a API espalha no fio.

O gate não exige declarar os 204 exports do runtime: exige que **todo nome
efetivamente importado** exista no `.d.ts`. Classes e helpers internos que
nenhum app consome continuam sem declaração — declarar assinatura não usada é
drift garantido.

### 3. A API consome o workspace, não a árvore

`apps/api/package.json` declara `"@radar/proprietary-engine": "file:../../packages/proprietary-engine"`
(workspace) e os 14 imports relativos viraram `from "@radar/proprietary-engine"`.
O backend continua com **zero dependências externas** de runtime; o pacote é
interno e resolvido por symlink do workspace.

### 4. Fronteiras como teste

`tools/check-boundaries.mjs` (raiz, `npm run check:boundaries`) — 10 regras:

| # | Regra |
|---|---|
| 1 | todo nome importado de `@radar/proprietary-engine` está declarado no `index.d.ts` |
| 1b | toda declaração de **valor** (`function`/`const`/`class`) existe no runtime |
| 2 | ninguém importa `@radar/proprietary-engine/src/*` nem o workspace morto `@radar/engine` |
| 3 | nenhum import relativo escapa da própria app (`apps/api`, `apps/web`) |
| 4 | `packages/*` não importam `apps/*` |
| 5 | `features/a` não importa `features/b` |
| 6 | `app|shared|lib` não importam `features` |
| 7 | `lib → shared` só via `shared/format` |
| 8 | só `App.tsx` carrega features |
| 9 | `src/pages` e `src/components` não existem |

As regras 5–9 repetem parte do guardian F4b de propósito: o guardian roda no
teste da web (rápido, específico), o gate roda na raiz e cobre também API e
packages. As regras 1–4 são novas.

### 5. Cobertura com threshold

`npm run test:coverage -w apps-api` usa o reporter nativo
(`--experimental-test-coverage`) com:

```
--test-coverage-lines=90 --test-coverage-branches=60 --test-coverage-functions=85
--test-coverage-exclude=**/packages/** --test-coverage-exclude=**/test/**
```

O escopo é `apps/api/src`: o motor tem suíte própria (219 testes) e seria
medido como código de outro pacote; os arquivos de teste não são código de
produção. Medido: **93,70% linhas / 65,75–65,82% branches / 89,27% funções**
(a variação de branches é ordem de execução entre arquivos, não código novo).

### 6. CI

`.github/workflows/ci.yml`, Node 24, `npm ci` (lockfile respeita o layout de
`apps/web`), rodando na ordem: boundaries → typecheck API → typecheck web →
testes → cobertura → build. `concurrency` cancela run anterior do mesmo ref.

### 7. README e ADRs

README reescrito para o estado real: estrutura, comandos que existem, tabela de
env (fail-fast), endpoints vigentes, gates. Este ADR + `F5-gate.md` (evidência
de execução).

## Desvios e decisões registradas

1. **`strictNullChecks` fica off.** Habilitá-lo abriu 67 erros (26 a mais) por
   causa de retornos `| null` que o fio já trata como null. É trabalho real, mas
   muda semântica de tipos em toda a API e merece fase própria. Com isso,
   *narrowing por boolean literal* não funciona: `if (!chk.ok)` não estreita
   `{ok:true}|{ok:false}`; os 2 call sites de `requireLane` usam
   `if (chk.ok === false)`. Está comentado no código e aqui para não virar
   armadilha.
2. **`buildAggregate` devolve documento dinâmico.** O agregado tem dezenas de
   campos montados por contexto; tipar cada um no `.d.ts` seria duplicar o
   motor. O retorno é `{ context: Record<string, any>; sources: ...; [k: string]: any }`,
   que é o que o consumidor realmente faz (lê e escreve metadados na borda).
3. **`HeroScore` tem `[k: string]: any`.** O motor ecoa o input (`...h`), então
   campos como `head` existem no runtime sem serem contrato. `unknown` quebrava a
   aritmética em `paginate` (indexação dinâmica); `any` reflete o eco.
4. **A tabela de dependências da ADR-033 não foi implementada como escrita.**
   Ela previa `routes/* ↛ infra/*`, `application/* ↛ infra/*` (injeção) e um
   `packages/contracts` de tipos. O código consolidado em F1–F3 importa `infra`
   direto de `routes` e `application`, e o contrato ficou no `.d.ts` do próprio
   motor. O gate verifica os invariantes que **existem** hoje; inverter a
   injeção de dependência e criar um pacote de contratos separado seguem como
   trabalho possível, não como dívida escondida.

## Alternativas rejeitadas

1. **`strict: true` / `strictNullChecks: true` agora.** 67 erros, maioria em
   retornos opcionais; o ganho de segurança não paga o risco de um diff grande
   sem cobertura de tipos própria.
2. **`@ts-check` arquivo por arquivo.** Verifica menos e não dá um comando único;
   o `jsconfig.json` já limita o escopo a `src/**/*.js`.
3. **JSDoc manual em cada import do motor em vez de completar o `.d.ts`.** O
   `.d.ts` é a fronteira pública; deixá-lo incompleto empurra a mentira para cada
   consumidor.
4. **`typescript` como dependência da API.** Duplicaria o compilador no
   workspace e mudaria o layout do lockfile; `tools/tsc.mjs` resolve o existente.
5. **Cobertura global (incluindo o motor).** 81,50% de linhas — mediria o
   engine, que tem suíte e thresholds próprios, e esconderia a cobertura da API.
6. **ESLint/tseslint como gate.** Mais uma toolchain para manter; as regras que
   importam aqui (direção de dependência, contrato do motor) não são expressas
   bem por lint de estilo.

## Consequências

Positivas: a API passa a ter contrato verificado (62 → 0 erros); o motor tem uma
única fronteira tipada usada pelos dois apps; mover arquivo não quebra import de
outro pacote; cobertura e fronteiras falham o build; o CI reproduz tudo; o README
descreve o sistema que existe.

Custos: mais um script para manter (`check-boundaries`, ~200 linhas) e um
resolvedor de `tsc`; `strict: false` deixa erros de null para uma fase futura;
o `index.d.ts` precisa ser atualizado quando a API passar a importar um export
novo — o gate avisa na hora, mas é trabalho manual; o relatório de cobertura do
`node:test` é verboso no log.

## 8. Revisão crítica e correções (pós-implementação)

O commit inicial da F5 passou nos gates locais, mas a revisão de código achou um
**P1** que os gates não podiam ver: o lockfile carregava só os binários nativos de
**Windows**. Como rollup 4 e esbuild resolvem binding por plataforma, `npm ci` +
`vite build` no runner Ubuntu falharia com `Cannot find module
@rollup/rollup-linux-x64-gnu` — o CI nasceria vermelho exatamente no passo que
existe para ser a autoridade.

Corrigido por cirurgia no lock (36 variantes adicionadas com
`resolved`/`integrity` do registry + `fsevents` para macOS, versões existentes
preservadas; 177 → 215 entradas) e por scripts agnósticos de layout (`vite`/`tsc`
pelo `PATH` do npm, `require.resolve` para o CLI do Tailwind). Regenerar o lock do
zero resolveria as ranges de novo (rollup 4.24 → 4.65, postcss-load-config 4 → 6)
e mudaria o layout aninhado que o bootstrap magro usa.

Três P2 também foram fechados:

1. **Contrato mentiroso.** `EMBLEM_MIN_CONTEXTS`, `EMBLEM_MIN_BUILDS` e
   `EMBLEMS_MAX_ROWS` eram declarados no `index.d.ts` e não reexportados pelo
   barrel — `undefined` em runtime. Além de exportá-los, o gate ganhou a regra
   **declaração → runtime** (1b), que agora pega essa classe de drift para sempre.
2. **`mean()` tipado como `number`.** Retorna `null` sem valores finitos; o
   contrato passou a `number | null`.
3. **`ApiServerOptions.rateLimit` exigia `rps`/`burst`.** O runtime aceita
   `{ enabled: false }`; a declaração mentia e impedia testes parciais.

Ficou registrado (não corrigido) que o `checkJs` cobre `src` e não `test`:
incluir `apps/api/test/**` abre 15 erros, todos de fake de teste.

## Evidência

Ver `F5-gate.md`.
