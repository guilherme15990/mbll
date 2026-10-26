# Auditoria — "as telas não conversam": experiência, contratos e gates

- Data: 2026-10-25
- Status: **diagnóstico + proposta** (nenhuma mudança de código feita neste documento)
- Base: código atual do repo + `ChatGPT.md` (conversa de produto) + `ADR-041`/`ADR-043`
- Relação: complementa `AGENTS/artefatos/spec/experiencias-ooux.md` (job/objeto/tela).
  Este arquivo é a metade **técnica**: o que o código permite hoje, onde o contrato
  mente e o que precisa virar gate.
- Método: leitura de código e execução de `npm run verify` (resultado no §9).
  Nada aqui é estimativa de produto: cada afirmação cita `arquivo:linha`.

---

## 0. Veredito em uma página

**A engenharia não é o gargalo.** Fronteiras passam, typecheck passa, 394 testes
passam, 4 guardiões passam (§9). O que quebra é a **arquitetura de produto**:

1. **Build observada não é um objeto navegável.** Ela é um desenho (`BuildLoadout`,
   em 4 arquivos) ou markup local repetido em 5 superfícies. Só uma delas sabe
   transformá-la em carga (`hero-detail/sections/BuildsSection.tsx:54-80`). Todas
   as outras exibem a composição e param ali.
2. **A carga endereçável (`/preparar`) já existe e já está certa no essencial** —
   codec puro, proveniência, evidência só com match exato (`shared/domain/loadout.ts`).
   Mas é **inalcançável** (sem entrada na sidebar), **não tem início do zero** e
   **não recebe edição de volta**.
3. **O contrato do agregado na web não é o contrato da API.** O tipo declara dois
   campos que o servidor nunca envia e omite a nota onde está a ressalva de
   honestidade (`shared/api/queries/builds.ts:262` × `application/buildsAggregate.js:283-288`).
4. **A UI promete janela onde a build não tem janela.** `BuildsSection.tsx:192` e
   `Preparar.tsx:154,174` dizem "janela Nd" ao lado de builds; a fonte não tem
   janela de build (`builds.js:50-57,113`; `buildsAggregate.js:287`).

**Conclusão:** o trabalho não é "criar a Preparação". É **ligar as pontas** e
**parar de mentir no copy**. P0 = continuidade + honestidade. O resto pode esperar.

---

## 1. O que já está resolvido (não refazer)

| Item | Evidência | Por que está certo |
|---|---|---|
| Loadout puro e versionado | `app/web/src/shared/domain/loadout.ts:24,34-50,193-226` | Só `import type`; codec `v1`; `decodeLoadout` nunca lança e limita tamanho |
| URL é dado não confiável | `loadout.ts:220-289`; `test/loadout.test.mjs` (11 casos de codec) | Recusa vazio, lixo, versão, >6 itens, excesso de tamanho |
| Fork não inventa id | `loadout.ts:309-351`; `:325,330,337` | Item/emblema/talento sem id é **descartado**, não chutado |
| Evidência só com igualdade | `loadout.ts:434-476`; `Preparar.tsx:201-254` | `exact` mostra win; `partial` diz o que não dá para comparar; `none` não mostra número |
| Contexto da carga manda na tela | `Preparar.tsx:119,157-162` | Avisa quando o filtro global diverge do loadout, em vez de trocar silenciosamente |
| Fronteiras de código | `tools/check-boundaries.mjs`; 13 PASS | `shared` não importa feature; `features` não se importam |
| Build sem default silencioso de lane | `builds.js:53-56` (422) | Coerente com o gate "sem default silencioso" |

Isso é base. O problema começa quando o objeto precisa atravessar uma tela.

---

## 2. Achados

Legenda de gravidade: **P0** = quebra o produto hoje; **P1** = dívida que vai
cobrar preço na próxima feature; **P2** = higiene/estrutura.

### A1 · Continuidade unidirecional (P0)

Seis superfícies renderizam composição. Só uma oferece "Preparar":

| Superfície | Onde | Ação de continuidade |
|---|---|---|
| Aba Builds da ficha | `hero-detail/sections/BuildsSection.tsx:322-330` | **Sim** — `ForkLink` (`:54-80`) |
| Home da ficha (`LaneBuilds`) | `hero-detail/HeroDetail.tsx:49-122` | Não. O card inteiro é um `<Link>` para a aba (`:55-58`) |
| Rota plana "Por herói" | `features/builds/BuildsPanel.tsx:235` | Não. `<BuildLoadout>` solto, sem ação |
| Dashboard · aba Builds | `features/dashboard/BuildsTab.tsx:38-59,385` | Não. `BuildLine` é texto; link só para a ficha (`:204`) |
| Builds + poder | `features/builds/BuildsPowerPanel.tsx:430` (531 linhas) | Não. Monta a composição em markup próprio (`:85-93`) e adiciona extras (`:326`) — nada exporta para `/preparar` |
| Agregado B0–B5 | `features/builds/BuildsAggregatePanel.tsx` (849 linhas) | Não se aplica: exibe item/pacote/runa, não build individual. Não há `loadoutHref` no arquivo (grep) |

Consequência observável: o jogador vê a build no dashboard, decide que quer
testá-la, e **não existe caminho** que leve a composição junto. Ele refaz a
composição à mão — ou desiste. É exatamente o problema descrito na conversa.

**Causa raiz:** `forkObservedBuild` está implementado em `hero-detail` (feature A)
e não pode ser importado por `features/builds` (feature B) nem pelo dashboard —
o gate proíbe (`check-boundaries.mjs`, regra 5). O domínio está certo; o **ponto
de uso** está no lugar errado. Deveria ser um par domínio+padrão em `shared/`
(`shared/domain/loadout.ts` já tem a função; falta o componente de ação).

### A2 · Combinador lê `?l=` e nunca escreve de volta (P0)

- Hidratação: `features/builds/BuildsCombinerPanel.tsx:170-181` (`decodeLoadout` → `setPick`).
- Edição: `:222,232,235,245,458,478` — tudo em `useState`.
- Nenhum `encodeLoadout`/`history.replaceState` no arquivo.

Consequência: a composição que o jogador acabou de montar **morre no F5**, no
botão voltar e no link compartilhado. `Preparar` manda para o combinador com
`&l=${code}` (`Preparar.tsx:138`), mas o combinador não devolve nada. A
continuidade é um beco sem saída de um lado só.

### A3 · `/preparar` é invisível e não começa do zero (P0)

- Rota existe: `app/router.tsx:24,57`.
- Sidebar não tem entrada: `app/Sidebar.tsx:21-48` (3 streams, 8 contextos internos).
- Sem `?l=`, a tela só diz "Nenhum loadout nesta URL" e manda para `/hero`
  (`Preparar.tsx:99-111`). Não há seletor de herói/lane nem composição vazia.
- `grep -r "preparar|loadout" app/web/test` retorna **só** `loadout.test.mjs`:
  nenhum guardião/smoke conhece a feature.

Consequência: a experiência central da conversa é alcançável apenas por um botão
dentro de uma aba de uma ficha. Funciona; não existe.

### A4 · `skipped` é calculado e jogado fora (P0, custo baixo)

`forkObservedBuild` devolve `skipped` (`loadout.ts:291-292,318-351`) para
explicar o que foi descartado. `ForkLink` usa só `fork.loadout` e mostra a
contagem de itens (`BuildsSection.tsx:67-78`). O usuário nunca sabe que o
emblema/talento ficou de fora — e a tela pode parecer "incompleta" sem motivo.

### A5 · `window` ambíguo: contexto de força vs. janela de build (P0 no copy)

Fatos:

- `/heroes/:id/builds` **não lê `window`** (`builds.js:50-57`); a query não envia
  (`shared/api/queries/builds.ts:342-347`); o corpo não devolve (`builds.js:113`).
- O agregado declara em `notes`: "window afeta apenas a ordem dos heróis; builds
  não têm janela na fonte" (`buildsAggregate.js:283-288`).
- Ainda assim: `BuildsSection.tsx:192` escreve "janela {window}d"; `Preparar.tsx:154,174`
  mostra "janela 7d" e um chip "Janela" ao lado da composição.

O loadout carrega `window` e o usa corretamente para o **herói**
(`Preparar.tsx:92` → `useHero`), não para a build. O campo é legítimo; o rótulo
não. Hoje a tela sugere que a composição foi observada naquela janela.

### A6 · Contrato fantasma no agregado (P1)

`shared/api/queries/builds.ts:262` declara:

```ts
window_applies_to: string; build_window: null;
```

Nenhum dos dois existe no servidor (`grep` em `app/`: só essa linha). Em
compensação, o tipo **omite `notes`**, onde o servidor publica a ressalva de
honestidade (`buildsAggregate.js:283-288`). `tsc` não pega: tipo escrito à mão
não é validado contra o corpo. Quem confiar no tipo pode ler `undefined` e não
tem acesso ao aviso que o backend mandou.

### A7 · "Herói em foco" (`?hero=`) ≠ herói aberto (`/hero/:id`) (P1)

`Sidebar.tsx:50-88` monta o mini-dossiê a partir de `?hero=` do shell. A ficha
(`/hero/:id`) usa `useParams`. São duas fontes de verdade para "herói atual": dá
para estar em `/hero/42` com o sidebar mostrando "Herói em foco: 17" — ou nenhum.
`HeroList.tsx:23-26` mantém `?hero=` ao navegar; nada reconcilia com o path.

### A8 · Mutação direta de `URLSearchParams` (P1)

`app/filters.ts:14-20` documenta que mutar o objeto direto **já causou perda de
parâmetro** e centraliza a cópia em `set()`. Ainda assim:

- `BuildsSection.tsx:114-116` (`sp.set("lane", l); setSp(sp)`)
- `HeroList.tsx:24-26` (`sp.set/delete` + `setSp(sp)`)
- `Sidebar.tsx:55-58` (`sp.delete` + `setSp(sp)`)

Cada um é uma reincidência do bug já conhecido, em código novo.

### A9 · Navegação expõe contexto interno, não tarefa (P1)

`Sidebar.tsx:20-48` organiza por "Inferência & Força / M1 Engine / M6 & Tactical /
Governança / IDD". São nomes de bounded context e de módulo de engine. Nenhum
deles é uma tarefa do jogador. "Preparação" não aparece. 13 rotas lazy
(`app/router.tsx`; `guardian-f4b` conta 13) e nenhuma é "o que eu faço agora".

### A10 · `<BuildLoadout>` é desenho, não objeto (P1)

O padrão recebe `{items, emblem, talents, spell}` e só desenha
(`shared/ui/patterns/BuildLoadout.tsx:7-15`). Isso é bom para consistência e ruim
para continuidade: como não há identidade no componente, cada tela inventa (ou
não inventa) a ação seguinte. A ação precisa subir para o padrão, não ser
repetida em cada painel.

### A11 · `LaneBuilds`: link que engole botão (P1, a11y)

`HeroDetail.tsx:55-122` envolve o card inteiro em `<Link>`; dentro dele há
`ErrBox` com `onRetry` (`:73-75`, botão) e conteúdo interativo. HTML inválido
(`<a>` com botão dentro) e leitor de tela anuncia uma coisa só. Também é o motivo
técnico pelo qual "Preparar" não cabe ali sem reestruturar o card.

### A12 · Gates não conhecem a feature nova (P1)

`app/web/package.json:11` lista os guardiões; `test/smoke.mjs:5` lista os
arquivos obrigatórios. Nenhum cita `features/loadout` ou `/preparar`. O gate de
fronteiras também não exige que uma rota lazy tenha entrada de navegação. Ou
seja: **o código pode regredir a Preparação inteira e o CI continua verde.**

### A13 · ADR-044 citado, arquivo ausente (P2)

`loadout.ts:4`, `Preparar.tsx:16,148` citam ADR-044. `AGENTS/artefatos/architecture/`
não tem `ADR-044` (verificado por listagem). O contrato mais delicado do produto
(codec + honestidade) não tem documento — quem mexer depois não tem o "porquê".

### A14 · Monólitos de UI confirmados (P2)

`BuildsAggregatePanel.tsx` 849 linhas; `BuildsPowerPanel.tsx` ~531. `ADR-043:150`
já mandou decompor os 3 painéis de builds ("806/581/531 na medição") — o agregado
**cresceu** para 849 depois disso. Não é urgente; é o que transforma cada melhoria
de continuidade em edição de arquivo grande.

### A15 · `radar:lane` tem 6 escritores e 0 leitores (P1)

`BuildsTab.tsx:98`, `BuildsSection.tsx:118`, `BuildsPanel.tsx:29`,
`BuildsPowerPanel.tsx:273`, `BuildsCombinerPanel.tsx:213`,
`BuildsAggregatePanel.tsx:477` gravam `localStorage.setItem("radar:lane", l)`.
Nenhum `getItem("radar:lane")` existe em `app/web/src` (grep). É memória morta:
o código parece lembrar a lane e não lembra. Pior: sugere que a lane é
preferência de dispositivo, quando ela é **contexto de análise** e precisa
viajar na URL.

### A16 · CTA que promete comando e faz navegação (P1, custo baixo)

`PrimaryAction` é, por construção, um `<Link>` (`shared/idd/cards/PrimaryAction.tsx:56-63`).
Os rótulos, porém, prometem ação:

| Rótulo | Onde | Destino real |
|---|---|---|
| "Copiar série CSV" | `features/temporal/TempoPanel.tsx:65-66` | `/tempo?...` — a própria tela |
| "Copiar veredito c/ carimbos" | `features/confidence/ConfiancaPanel.tsx:64` | provável mesma tela (mesmo padrão) |
| "Exportar relatório do lote" | `features/exposure/Exposure.tsx:42` | provável mesma tela (mesmo padrão) |
| "Fixar par a×b" | `features/ranks/RanksPanel.tsx:84`; `hero-detail/sections/RanksSection.tsx:164` | provável mesma tela (mesmo padrão) |
| "Fixar build de referência" | `features/builds/BuildsPanel.tsx:66-67` | `/builds?view=hero...` — a própria visão |

Para `TempoPanel` e `BuildsPanel` o destino foi lido e confirmado. Nos demais, o
padrão é idêntico (mesmo componente, `to` apontando para a rota corrente), mas
cada um precisa de confirmação linha a linha antes do fix. Isso não é cosmético:
é a mesma quebra de confiança do "janela Nd" — a tela diz que faz e não faz.

---

## 3. O contrato que falta: build observada como referência

Hoje existem três representações soltas da mesma coisa:

1. `Build` (payload da API) — `shared/api/queries/builds.ts:20+`
2. `CombinerPick` (estado do editor) — `shared/domain/combiner.ts`
3. `Loadout` (carga endereçável) — `shared/domain/loadout.ts:36-49`

Falta a **referência** que liga 1→3 sem cada tela reimplementar a ponte:

```ts
// shared/domain/loadout.ts (proposta; não implementado)
export type BuildRef = {
  heroId: number;
  lane: Lane;              // "exp" | "mid" | "roam" | "jungle" | "gold"
  rank: Rank;              // recorte em que a build foi observada
  signature: string;       // signatureOfPick(pickFromBuild(build))
  provenance: "observed";
};

export function buildRefHref(ref: BuildRef): string; // = loadoutHref(fork(...))
```

E, no nível de UI, **um** componente em `shared/ui/patterns`:

```
<BuildActions build={...} heroId lane rank window />
  ├─ Preparar            → /preparar?l=...
  ├─ Abrir no combinador → /builds?view=combiner&...&l=...
  └─ (opcional) Copiar link
```

Regras:

- Só `shared/` conhece `forkObservedBuild`; nenhuma feature monta código de loadout
  à mão.
- Se o fork recusar (build sem id), o componente mostra `fork.error` — **e o
  `skipped`**, que hoje é silencioso (A4).
- Toda superfície que renderiza `<BuildLoadout>` recebe `<BuildActions>` com o
  mesmo `Build` (A10). Isso é o "as telas conversam" em uma linha de JSX.
- `BuildActions` não faz I/O: só lê o `Build` que a tela já tem. Zero request novo.

**Decisão de transporte (L2):** a URL continua sendo o store. Não criar endpoint
de escrita de loadout agora. Motivos: (a) não há job declarado de "salvar minhas
cargas"; (b) API de escrita criaria uma segunda fonte de verdade para composição
sem evidência; (c) o codec já é testado e versionado. Se um dia houver
"compartilhar/coleção", aí sim avaliar persistência — e com identidade de usuário,
o que é L3.

---

## 4. Honestidade estatística: invariantes com ID

Estas já estão implementadas (ou quase). O objetivo de numerar é amarrar teste e
copy — o gate do projeto exige invariante com cenário.

| ID | Invariante | Onde vive | Teste que cobre |
|---|---|---|---|
| INV-PREP-01 | Composição editada **nunca** herda win rate de build observada | `loadout.ts:434-476` | "trocar um item cai para `none` e zera a evidência" |
| INV-PREP-02 | Campo sem id não vira "igual": `partial`, nunca `exact` | `loadout.ts:434+`; `:330` | "emblema sem id na fonte vira partial — nunca exact" |
| INV-PREP-03 | URL é entrada não confiável; `decode` não lança e limita | `loadout.ts:220-289` | 11 casos de codec |
| INV-PREP-04 | Fork nunca inventa id; descarta e **reporta** | `loadout.ts:309-351` | "reporta o que foi descartado" |
| INV-PREP-05 | A carga carrega contexto e a tela avisa divergência com o filtro global | `Preparar.tsx:119,157-162` | (sem teste) |
| INV-PREP-06 | Build não tem janela na fonte; copy não pode sugerir que tem | `buildsAggregate.js:287`; `builds.js:50-57` | **nenhum** — P0 de copy |
| INV-PREP-07 | Toda superfície que mostra composição oferece continuidade **ou** declara que é só leitura | proposta | **nenhum** — novo guardião |

`INV-PREP-04` está implementada mas **não exposta** (A4); `INV-PREP-06` está
violada no copy (A5); `INV-PREP-07` não existe (A1/A12).

---

## 5. Roadmap priorizado

### P0 — sem isso a experiência não existe

| # | Entrega | Critério de aceite observável | Esforço |
|---|---|---|---|
| P0-1 | **Entrada para a Preparação** na sidebar + `<BuildActions>` nas superfícies de build (ficha, home da ficha, rota plana por herói, dashboard, power) | Partindo de qualquer uma das 5 superfícies, "Preparar" abre `/preparar` com o mesmo herói, lane, elo, itens, emblema, talentos e feitiço | M |
| P0-2 | **Combinador escreve `?l=` de volta** (replace) + "Copiar link" | Editar no combinador e dar F5 preserva a composição; voltar retorna à composição anterior; o link copiado decodifica em `/preparar` | S |
| P0-3 | **Copy de janela** | Nenhuma tela de build diz "janela Nd"; o contexto do agregado expõe a nota "builds não têm janela na fonte" | S |
| P0-4 | **`/preparar` sem `?l=` começa do zero** (herói + lane → composição `custom` vazia) | Abrir `/preparar` direto permite montar uma composição e sair com `?l=` válido | M |
| P0-5 | **Expor `skipped` no fork** | Ao preparar uma build com emblema sem id, a tela diz o que ficou de fora | XS |
| P0-6 | **CTA que faz o que o rótulo diz** | "Copiar" escreve no clipboard; "Exportar" gera arquivo; "Fixar" persiste na URL; nenhum CTA navega para a própria rota | S |

P0-3 e P0-6 são os itens de **honestidade** — e são os mais baratos. Se só um
P0 couber hoje, é o P0-3 (a mentira estatística); em seguida, o P0-6.

### P1 — dívida que a próxima feature cobra

| # | Entrega | Aceite | Esforço |
|---|---|---|---|
| P1-1 | `BuildRef` + `<BuildActions>` em `shared` | Nenhuma feature chama `forkObservedBuild` direto; uma única implementação de ação | M |
| P1-2 | Reconciliar `?hero=` com `/hero/:id` | O sidebar nunca mostra herói diferente do aberto; ou `?hero=` deixa de existir como fonte | S |
| P1-3 | `guardian-preparar.mjs` | Falha se: `/preparar` sair da sidebar; `<BuildLoadout>` aparecer sem ação; copy "janela" em build; codec importar runtime | S |
| P1-4 | Corrigir contrato do agregado | Tipo web = corpo real (remover `window_applies_to`/`build_window`; incluir `notes`); teste de contrato compara chaves | S |
| P1-5 | `LaneBuilds` sem `<Link>` envolvendo botão | Card com link no título + ações separadas; sem `<a>` aninhado | S |
| P1-6 | Migrar `sp.set` para helper | `grep` sem mutação direta de `URLSearchParams` fora de `app/filters.ts` | S |
| P1-7 | Remover `radar:lane` morto **ou** ler de volta | `grep` sem `setItem` sem `getItem`; a lane viaja na URL em toda navegação de build | XS |

### P2 — estrutura

| # | Entrega | Por quê agora não |
|---|---|---|
| P2-1 | Camada `experiences/` (Explorar/Preparar/Analisar) compondo features | Depende do artefato OOUX; mover pasta antes de fechar a experiência só espalha o problema (ADR-041 já avisa) |
| P2-2 | Proveniência `recommended` | Exige regra explícita + teste; hoje só há `observed|custom` (`loadout.ts:34`) e o vocabulário "recomendação" é proibido por guardião |
| P2-3 | Fatiar `BuildsAggregatePanel`/`BuildsPowerPanel` | Não bloqueia continuidade; ADR-043 já registrou |
| P2-4 | Persistência de loadout | Sem job declarado; criaria fonte de verdade paralela |
| P2-5 | `ADR-044` escrita | Barato e necessário para o próximo que mexer; pode entrar junto de P0-1 |

---

## 6. Decisões registradas

- **L2-1 · URL como transporte da carga.** Sem backend de escrita, sem store
  global. O codec já garante integridade e versão; a composição sobrevive a
  reload quando o editor escreve de volta (P0-2). Reavaliar apenas com job de
  coleção/compartilhamento.
- **L2-2 · `window` no loadout é contexto de força, não de build.** Mantém o
  campo (o `useHero` precisa dele) e corrige o rótulo. Renomear para
  `strengthWindow` num codec `v2` só quando houver motivo para quebrar URL.
- **L2-3 · Ação de continuidade vive em `shared/ui/patterns`.** Não em cada
  feature: 5 features precisam dela e `shared` pode importar `shared/domain`.
  Não viola `check-boundaries` (shared → shared é permitido; shared → feature não).
- **L1 · Rótulos.** "Preparar", "Abrir no combinador", "Copiar link". Sem
  "salvar", sem "minha build" (não há conta).
- **Decisão já tomada, não reabrir:** composição editada não exibe win rate.
  Está implementado e testado (`INV-PREP-01/02`).

---

## 7. O que **não** fazer

1. **Não criar dashboards por persona.** A conversa rejeitou; o código atual já
   tem contexto demais na navegação (A9). Adicionar "perfil" piora.
2. **Não duplicar endpoint de build** para "salvar composição". A fonte continua
   sendo `/heroes/:id/builds` + agregado.
3. **Não transformar o loadout em estado global.** A URL já é o store; um
   provider global cria duas verdades e quebra o link compartilhado.
4. **Não inventar score de composição.** O combinador já é explícito: índice
   aditivo por contraste, não previsão (`BuildsCombinerPanel.tsx:18-22`).
5. **Não mover pastas antes de fechar P0.** Estrutura não conserta continuidade.
6. **Não usar "melhor build" / "build ideal" / "win rate da composição".**
   Guardião já veta (`guardian-builds-global.mjs:52`); a regra vale para as telas
   novas também.

---

## 8. Mapa rápido: rota → objeto → próxima ação

| Rota | Objeto exibido | Próxima ação hoje | Próxima ação que falta |
|---|---|---|---|
| `/` (dashboard) | heróis + builds por lane | abrir ficha | preparar build |
| `/hero` | lista de heróis | abrir ficha | preparar build do herói |
| `/hero/:id` | ficha, 8 abas | aba builds → preparar (1 caminho) | preparar da home; reconciliar `?hero=` |
| `/hero/:id?tab=builds` | builds + `ForkLink` | preparar | — (já existe) |
| `/builds?view=system` | agregado B0–B5 | trocar lane/rank | preparar a partir de item/pacote |
| `/builds?view=combiner` | composição editável | montar (efêmero) | persistir na URL; copiar link |
| `/builds?view=power` | builds observadas + índice | completar itens (efêmero) | preparar build |
| `/builds?view=hero` | builds por herói | abrir ficha | preparar build |
| `/preparar` | carga endereçável | abrir combinador / voltar | começar do zero; editar |
| `/forca`, `/confianca`, `/ranks`, `/tempo` | estatística | ler | — (análise, não preparação) |
| `/confrontos`, `/draft`, `/blind` | draft/matchup | ler | preparar counter |
| `/exposicao` | governança | ler | — |

---

## 9. Verificação executada

`npm run verify` em 2026-10-25, exit code **0**:

- `check:boundaries` — 13 PASS, `BOUNDARIES OK`
- `check:api` / `check:web` — typecheck OK
- engine 219 testes, API 124, web 51 — 0 falhas
- guardiões: builds-global OK, hero-confrontos OK, F4A OK, F4B OK

**O que o verify não cobre** (e por isso os P0 passam verdes):

- continuidade entre telas (A1) — nenhum teste abre `/preparar` a partir de uma build;
- empty state de `/preparar` sem `?l=` (A3);
- copy de janela (A5/INV-PREP-06);
- contrato fantasma do agregado (A6) — `tsc` acredita no tipo escrito à mão;
- navegação: rota existe ≠ rota alcançável (A3/A12).

É por isso que P1-3 (`guardian-preparar`) é parte da solução, não "teste extra".

---

## 10. Conciliação com `spec/experiencias-ooux.md`

Os dois artefatos convergem nos três P0 de produto. O que precisa ficar
explícito é onde eles **divergem** — e por quê.

### 10.1 Convergência

| OOUX (`experiencias-ooux.md`) | Técnico (este arquivo) |
|---|---|
| P0-1 build endereçável + "Preparar" em 5 superfícies | P0-1 + P1-1 (`BuildActions` em `shared`) |
| P0-2 contexto viaja na URL; 6 `setItem` sem `getItem` | A8 + A15 + P1-6/P1-7 |
| P0-3 `/preparar` visível + combiner escreve `?l=` | P0-2 + P0-4 + A2/A3 |
| P1-4 "CTA que faz o que diz" | A16 + P0-6 (subiu para P0) |
| P1-5 ficha como hub, 1 ação primária | A1/A7/A11 |
| P2-7 composição de time `?team=`, sem estatística | P2-4 (não fazer score); L3 se um dia persistir |
| Não usar `localStorage` como store | A15 |

### 10.2 Divergência resolvida: `?build=` × `?l=`

O OOUX propõe um parâmetro `?build=`/`?ref=` para "endereçar a build" e exige,
no aceite, que "cada build tenha endereço único e F5 retorne a ela". Este
documento **não recomenda** esse parâmetro no P0.

Motivo técnico: a build observada **não tem id estável**. Ela vem da fonte como
top-6 da lane (`builds.js:65` — `size=6&index=1`), sem chave própria; a
"assinatura" (`signatureOfPick`, `loadout.ts:164`) é derivada dos componentes.
Um `?build=<assinatura>` só resolve se a build ainda estiver naquela lista; se
sair do top-6 (a fonte muda a cada coleta), o link quebra **sem explicar**. O
`?l=` já resolve o mesmo problema com uma vantagem: a carga sobrevive
independentemente de a build existir, e a evidência degrada honestamente para
`none` (`loadout.ts:467+`).

**Decisão (L2):** a URL da carga (`/preparar?l=`) é **o** endereço da
composição. "Preparar" leva direto para ela; não há segunda espaço de endereço.
Se aparecer o job específico "link para a linha da build dentro da lista",
implementar `?build=` como *deep link de leitura*, resolvido dentro do recorte
(`hero+lane+rank`) e com estado explícito de "build não está mais neste
recorte" — nunca como pré-requisito da Preparação.

### 10.3 O que o OOUX viu e este documento não tinha

- **A16** (CTA falso) — confirmado no código; entrou como P0-6.
- **A15** (`radar:lane` morto) — confirmado por grep; entrou como P1-7.
- **19 superfícies** (contra 5 de build aqui): o inventário completo está no
  OOUX §3; este documento só analisa as que exibem composição.
- **`?pair_key` / `?days`**: o "levar par" de `/confrontos` perde o par. Não é
  continuidade de build, mas é a mesma classe de bug (A8). Fica registrado para
  o P1-6; não entra no P0 de build para não misturar escopo.

### 10.4 Ordem de execução acordada

1. **P0-3** (copy de janela) — S, corrige a única mentira estatística ativa.
2. **P0-6** (CTA falso) — S, mesma classe de confiança.
3. **P0-2** (combiner → URL) — S, destrava o ciclo de edição.
4. **P0-1/P1-1** (`BuildActions`) — M, é o "as telas conversam".
5. **P0-4** (`/preparar` do zero) — M, dá sentido à entrada.
6. **P1-3** (guardião) — S, congela o ganho.

P0-5 (`skipped`) entra junto de P0-1 porque é o mesmo arquivo/componente.

