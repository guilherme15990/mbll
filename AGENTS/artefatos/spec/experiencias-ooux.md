# Experiências, objetos e jobs — Radar MLBB

> Auditoria OOUX/ORCA + JTBD das 13 rotas do web. Diagnóstico e proposta; **nenhuma linha de código alterada**.

- **Data:** 2026-10-25
- **Status:** diagnóstico + proposta (L1/L2 registradas; L3 não acionada)
- **Escopo:** as 13 rotas de `app/web/src/app/router.tsx:46-62`, com foco nas superfícies de herói, build, draft, confronto e preparação.
- **Fora de escopo:** implementação, redesign visual fechado, novo endpoint, persistência de carga, perfil de jogador.
- **Fontes:** código atual; `ChatGPT.md` (conversa de produto); `AGENTS/artefatos/architecture/2026-10-25-auditoria-experiencia-e-contratos.md` (auditoria técnica irmã, citada como **Auditoria irmã**).
- **Relação com a Auditoria irmã:** este arquivo é a metade **produto/experiência**; a Auditoria irmã é a metade **técnica** (contratos, gates, verificação). Onde o fato é técnico, remeto a ela e cito o código.

## Como ler

- Todo achado tem `arquivo:linha`. Quando a evidência é uma ausência, cito o ponto do código que mostra o limite (tipo, rota, tela) — não invento arquivo.
- **Fato** = está no código. **Proposta** = não está; é decisão de produto deste documento.
- Nenhuma proposta promete dado que a API não entrega. Em especial: não há sinergia de composição, win rate de time, tamanho de grupo/fila, “build recomendada” nem recomendação com score.
- Os caminhos são relativos à raiz do repositório.
- **Mapa dos nomes curtos** usados nas citações (o nome curto aparece em `arquivo:linha`; o caminho completo é este):

| Nome curto | Caminho completo |
|---|---|
| `App.tsx`, `Sidebar.tsx`, `router.tsx`, `filters.ts` | `app/web/src/App.tsx`; `app/web/src/app/Sidebar.tsx`; `app/web/src/app/router.tsx`; `app/web/src/app/filters.ts` |
| `HeroDetail.tsx`, `BuildsSection.tsx` | `app/web/src/features/hero-detail/HeroDetail.tsx`; `app/web/src/features/hero-detail/sections/BuildsSection.tsx` |
| `Preparar.tsx`, `loadout.ts` | `app/web/src/features/loadout/Preparar.tsx`; `app/web/src/shared/domain/loadout.ts` |
| `BuildsTab.tsx`, `HeroCard.tsx`, `HeroList.tsx` | `app/web/src/features/dashboard/BuildsTab.tsx`; `app/web/src/features/dashboard/HeroCard.tsx`; `app/web/src/features/hero-list/HeroList.tsx` |
| `Builds.tsx`, `BuildsPanel.tsx`, `BuildsPowerPanel.tsx`, `BuildsCombinerPanel.tsx`, `BuildsAggregatePanel.tsx` | `app/web/src/features/builds/…` (mesmo nome de arquivo) |
| `ConfrontosPanel.tsx`, `DraftPanel.tsx`, `BlindPanel.tsx`, `ForcaPanel.tsx`, `ConfiancaPanel.tsx`, `RanksPanel.tsx`, `TempoPanel.tsx`, `Exposure.tsx` | `app/web/src/features/{matchups,draft,blind,strength,confidence,ranks,temporal,exposure}/…` |
| `HeroDossier.tsx`, `PrimaryAction.tsx`, `idd/index.tsx` | `app/web/src/shared/ui/patterns/HeroDossier.tsx`; `app/web/src/shared/idd/cards/PrimaryAction.tsx`; `app/web/src/shared/idd/index.tsx` |
| `builds.ts`, `heroes.ts`, `matchups.ts` | `app/web/src/shared/api/queries/builds.ts`; `…/heroes.ts`; `…/matchups.ts` |

### Vocabulário mínimo

| Termo | Significado neste documento | Onde nasce no código |
|---|---|---|
| **Build observada** | Composição catalogada para herói × lane × elo, com win/pick e lift contra referência; **não tem janela própria** | `app/web/src/shared/api/queries/builds.ts:20-30` |
| **Carga / loadout** | Composição endereçável que o jogador leva: herói, lane, elo, itens, emblema, talentos, feitiço, proveniência e assinatura | `app/web/src/shared/domain/loadout.ts:36-48` |
| **Composição de time** | Conjunto de 5 heróis + rotas de uma partida. **Não existe como objeto no código** | ausência; ver O4 |
| **Evidência** | Lastro observado que autoriza um número. No loadout, só existe com match exato | `app/web/src/shared/domain/loadout.ts:434-476` |
| **Sinal** | Leitura derivada de evidência; **não** é recomendação, comando nem probabilidade | `app/web/src/shared/idd/index.tsx:53-58` (deliberar é leitura instrumentada, não comando) |
| **AnalysisContext** | Recorte que dá sentido ao número: elo, janela, lane, top, dias, população, herói | `app/web/src/app/filters.ts:8-23`; `app/web/src/shared/api/queries/builds.ts:257-263` |
| **ORCA** | Objects, Relationships, CTAs, Attributes | método desta auditoria |
| **JTBD** | Jobs To Be Done: “Quando… quero… para…” | método desta auditoria |

### Premissas do dono (não reabrir)

1. **Sem perfis de jogador e sem três apps.** Um sistema, várias jornadas; o jogador escolhe o que quer fazer, não “quem ele é” (`ChatGPT.md:1019-1025`).
2. **Sistema orientado a tarefas**, não a contextos internos (`ChatGPT.md:1023-1025`).
3. **Referência à tela “Preparação” do MLBB**: preparar a partida é um momento distinto de explorar o meta e de analisar dados (`ChatGPT.md:1724-1776`).
4. **Honestidade estatística é invariante**: composição editada nunca herda win rate de build observada; sem id, o campo é `partial`, nunca `exact` (`app/web/src/shared/domain/loadout.ts:13-18,434-476`).
5. **`experiences/` compõe `features/`**: a experiência organiza a jornada; a feature implementa a capacidade. A mesma feature pode aparecer em mais de uma experiência (`ChatGPT.md:1820-1868`).

---

## 0. Veredito em uma página

1. **A navegação é um mapa de contextos internos, não de tarefas.** A sidebar organiza 9 bounded contexts em 3 streams (`app/web/src/app/Sidebar.tsx:20-48,129-182`); o cabeçalho anuncia “9 Contextos” (`app/web/src/App.tsx:54`). As 13 rotas incluem 9 telas de contexto + dashboard + lista de heróis + ficha + `/preparar`. **`/preparar` é a única rota de produto sem entrada na navegação** (`router.tsx:57` × `Sidebar.tsx:21-48,129-182`).
2. **O objeto central não tem identidade.** Uma build observada é payload + markup repetido em 5 superfícies, mas o tipo `Build` não tem `id` nem `variant_key` (`builds.ts:20-30`) e a lista usa o índice do array como chave (`BuildsSection.tsx:253`). Só uma superfície oferece continuar **para a preparação** (`BuildsSection.tsx:54-80,322-330`).
3. **A carga endereçável existe e está certa no essencial, mas é invisível, não começa do zero e não recebe edição de volta.** Sem `?l=`, `/preparar` é um empty state que manda para `/hero` (`Preparar.tsx:99-111`); o combinador lê `?l=`, edita em `useState` e nunca escreve (`BuildsCombinerPanel.tsx:163-181,221-245`).
4. **O contexto não viaja.** A navegação preserva `rank`, `window` e `hero` (`App.tsx:18`), mas perde `lane`, `top`, `days`, `pair_key` e `l` (`HeroDossier.tsx:74`; `BuildsPowerPanel.tsx:245-247`; `BlindPanel.tsx:35`; `ConfrontosPanel.tsx:124`). A lane é gravada em `localStorage` por 6 arquivos e **lida por nenhum** (6 `setItem`, 0 `getItem`).
5. **A honestidade estatística está implementada onde há número, mas o copy e os CTAs a contradizem.** A carga só mostra evidência com match exato (`loadout.ts:467-476`); o combinador diz “não é previsão” (`BuildsCombinerPanel.tsx:18-22,96-100`). Mesmo assim, telas de build escrevem “janela Nd” (`BuildsSection.tsx:192`; `Preparar.tsx:154,174`) e existem CTAs que navegam para a própria tela (`BlindPanel.tsx:68-74`; `Exposure.tsx:39-45`; `ConfiancaPanel.tsx:61-67`; `TempoPanel.tsx:62-68`).
6. **Composição de time e recomendação não existem como objetos.** O draft é analisado por herói individual (`DraftPanel.tsx:17-25,93-193`); matchup é par (`matchups.ts:7-15`); a API não informa tamanho de grupo (`BlindPanel.tsx:209`) e o próprio produto proíbe somar δ entre 5 inimigos (`ConfrontosPanel.tsx:202`). **Não criar score de composição.**

**Convergência das quatro lentes:** o problema não é falta de tela; é **objeto sem casa + contexto que não viaja + navegação por contexto interno + ação de continuidade ausente**. As quatro lentes apontam para o mesmo ponto: a build observada não é um objeto navegável, e a Preparação não é uma experiência — é uma rota escondida.

**O que este documento decide (L1/L2):** vocabulário único; veredito por tela; ranking de jobs; proposta de IA em 3 experiências; URL como transporte; composição de time como lista endereçável sem estatística (P2). **O que escala (L3):** qualquer promessa de sinergia/win rate de composição, persistência com identidade de usuário ou coleta de dado novo sensível.

---

## 1. Jobs to be Done (JTBD)

**Método.** Os 8 jobs abaixo foram derivados das telas, das perguntas que cada `CtxBar` já declara (`ForcaPanel.tsx:57`; `ConfiancaPanel.tsx:45`; `RanksPanel.tsx:65`; `TempoPanel.tsx:46`; `ConfrontosPanel.tsx:133`; `DraftPanel.tsx:68`; `BlindPanel.tsx:52`; `Exposure.tsx:27`; `Preparar.tsx:145`) e da conversa de produto. **Não há telemetria de produto no repositório**; frequência e dor são julgamento declarado, não medição. A matriz e o ranking existem para priorizar, não para provar uso.

### 1.1 Os 8 jobs

**J1 · Descobrir o que está forte agora**
Quando abro o Radar sem herói em mente, quero ver o que sustenta leitura no meu elo e janela, **para** decidir em menos de um minuto se abro uma ficha ou vou preparar uma partida.
**Outcome observável:** em teste com 5 jogadores, 4/5 encontram um herói defensável e chegam a uma próxima ação (ficha ou preparação) em ≤60 s, sem usar a busca do navegador.
**Telas:** `/dashboard`, `/hero`, `/forca`, `/hero/:id`.

**J2 · Abrir e entender a ficha de um herói**
Quando um herói me interessa ou me derrubou, quero uma ficha que responda força, confrontos, draft e builds sem sair dela, **para** terminar com uma decisão: jogar, counterar ou descartar.
**Outcome observável:** o jogador responde às três perguntas (é forte? contra quem? com o quê?) em ≤3 min e clica em pelo menos uma ação de continuidade.
**Telas:** `/hero`, `/hero/:id` (8 abas), `/forca`.

**J3 · Preparar a build que vou levar**
Quando já escolhi herói e lane, quero sair com a composição completa — 6 itens, emblema, talentos e feitiço — e saber o que é observado e o que é escolha minha, **para** não montar de cabeça na sala de draft.
**Outcome observável:** `/preparar` abre com `?l=` válido e mostra `observedEvidence` **ou** o aviso de composição livre; a tarefa completa em ≤2 min; F5 preserva.
**Telas:** `/hero/:id?tab=builds`, `/builds?view=hero`, `/builds?view=power`, `/builds?view=combiner`, `/preparar`.

**J4 · Comparar builds sem inventar número**
Quando duas builds parecem boas, quero comparar item a item e ver lift **só** quando existe referência observada, **para** escolher sem transformar estimativa em certeza.
**Outcome observável:** em teste, o jogador identifica corretamente 2 casos — (a) build observada com lift; (b) composição editada sem win rate — e não menciona “win rate da composição”.
**Telas:** `/hero/:id?tab=builds`, `/builds?view=hero`, `/builds?view=power`, `/builds?view=combiner`, `/builds?view=system`, `/preparar`.

**J5 · Montar a composição do time**
Quando eu e meus amigos vamos jogar, quero registrar os 5 heróis e as rotas da nossa composição e ver o que o Radar sabe e não sabe, **para** não tratar sinergia como se fosse medida.
**Outcome observável:** sair com uma lista endereçável de 5 heróis + rotas, com rótulo explícito “sem sinergia medida” e **nenhum** win rate de composição. **Hoje: impossível** — não há objeto, rota nem endpoint.
**Telas:** nenhuma. As mais próximas (`/draft`, `/blind`, `/confrontos`) analisam **um herói**, não um time.

**J6 · Escolher com risco de draft**
Quando preciso pickar sem ver o inimigo ou responder a um pick, quero saber o pior confronto e a robustez de cauda, **para** escolher com o risco declarado.
**Outcome observável:** em ≤90 s, o jogador nomeia o pior par e o status (robusto/provisório/inconclusivo); “levar para o draft” mantém o par selecionado.
**Telas:** `/confrontos`, `/blind`, `/draft`, `/hero/:id?tab=confrontos|draft`.

**J7 · Rastrear por que o número existe**
Quando um número parece alto ou estranho, quero chegar à amostra, ao shrinkage e à qualidade da evidência em dois cliques, **para** decidir se uso o número ou ignoro.
**Outcome observável:** todo número selado tem caminho ≤2 cliques para a explicação, com `rank/window/hero` preservados; teste: 5/5 números rastreados.
**Telas:** `/forca`, `/confianca`, `/ranks`, `/tempo`, `/exposicao`, abas da ficha.

**J8 · Retomar de onde parei**
Quando paro no meio — build montada, herói escolhido, filtro aplicado — quero retomar exatamente de onde parei, **para** não refazer a composição.
**Outcome observável:** F5, voltar e link compartilhado preservam herói, lane, elo, janela e composição; 0 perdas em 5 cenários de navegação.
**Telas:** todas; em especial `/preparar`, `/builds?view=combiner`, `/hero/:id` e a sidebar.

### 1.2 Forças (push / pull / hábito / ansiedade)

| Job | Push (o que empurra) | Pull (o que atrai) | Hábito (o que já faz) | Ansiedade (o que teme) |
|---|---|---|---|---|
| J1 | “não sei o que mudou no patch” | θ̂/tier e panorama do elo | tier list externa, vídeo, print | dado stale ou de outro elo |
| J2 | “esse herói me derrubou” | ficha única com 8 abas | abrir 3 sites diferentes | não saber qual aba ler primeiro |
| J3 | tempo curto antes da partida | fork de build observada | copiar build de print/vídeo | não saber se o número é observado |
| J4 | medo de errar item | lift vs mais usada | copiar build de top player | índice estimado parecer win rate |
| J5 | coordenação do time | counters e cobertura de funções | print/WhatsApp | API não tem grupo nem composição |
| J6 | medo de tomar counter | pior par e p10 adverso | tier list / “counter pick” | matchup descritivo parecer probabilidade |
| J7 | número suspeito | selos e explicações | confiar no win rate bruto | não saber se o número é “real” |
| J8 | interrupção no meio | URL como store | abrir nova aba e perder tudo | perder a edição da composição |

### 1.3 Matriz job × tela

Legenda: **●** atende · **◐** atende em parte · **○** não atende.

| Tela | J1 | J2 | J3 | J4 | J5 | J6 | J7 | J8 |
|---|---|---|---|---|---|---|---|---|
| `/dashboard` | ● | ◐ | ○ | ○ | ○ | ○ | ◐ | ◐ |
| `/hero` | ● | ● | ○ | ○ | ○ | ○ | ○ | ◐ |
| `/hero/:id` (home) | ◐ | ● | ◐ | ◐ | ○ | ◐ | ● | ◐ |
| `/hero/:id?tab=builds` | ○ | ◐ | ◐ | ● | ○ | ○ | ○ | ◐ |
| `/forca` | ● | ◐ | ○ | ○ | ○ | ○ | ● | ◐ |
| `/confianca` | ○ | ◐ | ○ | ○ | ○ | ○ | ● | ◐ |
| `/ranks` | ○ | ◐ | ○ | ○ | ○ | ○ | ● | ◐ |
| `/tempo` | ○ | ◐ | ○ | ◐ | ○ | ○ | ● | ◐ |
| `/confrontos` | ○ | ◐ | ○ | ○ | ○ | ● | ◐ | ◐ |
| `/draft` | ◐ | ◐ | ○ | ○ | ○ | ◐ | ◐ | ◐ |
| `/blind` | ○ | ◐ | ○ | ○ | ○ | ● | ◐ | ◐ |
| `/builds?view=system` | ○ | ○ | ○ | ◐ | ○ | ○ | ◐ | ◐ |
| `/builds?view=combiner` | ○ | ○ | ◐ | ● | ○ | ○ | ◐ | ◐ |
| `/builds?view=power` | ○ | ◐ | ◐ | ● | ○ | ○ | ◐ | ◐ |
| `/builds?view=hero` | ○ | ◐ | ◐ | ● | ○ | ○ | ○ | ◐ |
| `/preparar` | ○ | ◐ | ● | ● | ○ | ○ | ◐ | ● |
| `/exposicao` | ○ | ○ | ○ | ○ | ○ | ○ | ● | ◐ |

**Leitura da matriz.** J3 e J4 têm a melhor cobertura — e quase toda ela concentrada em `/preparar` e nas builds. J5 não tem tela. J6 tem três telas, mas nenhuma leva o par adiante. J8 é parcial em quase tudo: o contexto chega, a composição não.

### 1.4 Ranking frequência × dor

| # | Job | Frequência (1–5) | Dor (1–5) | Score | Por que esta posição |
|---|---|---|---|---|---|
| 1 | J3 · preparar a build | 5 | 5 | 25 | é a tarefa que fecha a sessão e só tem 1 caminho de entrada |
| 2 | J8 · retomar contexto | 5 | 4 | 20 | afeta toda navegação; combiner e lane perdem estado |
| 3 | J6 · risco de draft | 4 | 4 | 16 | alta frequência e o par não viaja para o draft |
| 4 | J1 · descobrir o meta | 5 | 3 | 15 | alta frequência; a navegação interna atrapalha, mas o dashboard entrega |
| 5 | J2 · entender a ficha | 5 | 3 | 15 | 8 abas sem ordem de leitura; falta ação de preparar na home |
| 6 | J4 · comparar builds | 3 | 4 | 12 | dor alta, frequência média; 4 visões de build confundem |
| 7 | J5 · composição de time | 2 | 5 | 10 | frequência menor (jogo em grupo), mas é a maior lacuna de objeto; **não entra em P0 por falta de dado, não por falta de dor** |
| 8 | J7 · rastrear o número | 3 | 3 | 9 | há selos e FAQs; falta o link de contexto |

**Gate 1.** 7/8 jobs têm tela; **J5 não tem**. O gate não está verde, e a lacuna é declarada: não se resolve com uma tela que invente sinergia. Resolve-se, no máximo, com uma lista endereçável de 5 heróis + rotas, sem estatística (P2).

## 2. Mapa ORCA — os objetos, não as telas

**Método.** O OOUX/ORCA pergunta “quais são as coisas?” antes de “quais são as telas?”. Abaixo, cada objeto tem: definição em uma frase, atributos que existem no tipo e/ou aparecem na tela, relações, ações atuais, ações que faltam, estados e o lastro. **Objeto não é feature**: um objeto pode existir no tipo e não ter casa; outro pode ter tela e não existir como objeto.

### 2.1 O1 · Herói

**Definição:** unidade do catálogo que agrega força ajustada, exposição e rotas, e à qual se penduram builds, pares e leituras de draft.

| Eixo | Conteúdo | Evidência |
|---|---|---|
| **Atributos no tipo** | `id`, `name`, `head`, `win`, `pick`, `ban`, `wrAdj` (θ̂), `z`, `q`, `B`, `tier`, `isGem`, `degenerate`, `smallSample`, `credible_interval_95` | `shared/api/queries/heroes.ts:11-24` |
| **Atributos visíveis** | nome, avatar, tier, θ̂, win observado, pick, ban, classe, `B`, z, q, selo de confiança | `shared/ui/patterns/HeroDossier.tsx:45-60`; `features/dashboard/HeroCard.tsx:240-257`; `app/Sidebar.tsx:61-73` |
| **Relações** | 1:N builds; 1:N pares (counter/sinergia); 1:N leituras de distorção; 1:N leituras de blind; 1:N rotas | `queries/builds.ts:346`; `queries/matchups.ts:21`; `features/draft/DraftPanel.tsx:39`; `features/hero-detail/HeroDetail.tsx:183`; `queries/heroes.ts:49` |
| **Ações atuais** | selecionar no picker; abrir ficha; limpar foco; trocar de herói dentro da ficha | `app/Sidebar.tsx:120-124,238-246`; `features/hero-list/HeroList.tsx:23-27,53-59`; `features/hero-detail/HeroDetail.tsx:160-167`; `HeroDossier.tsx:36-39` |
| **Ações faltantes** | “preparar este herói” sem passar por build; comparar dois heróis no mesmo contexto; fixar herói numa composição de time | ausência; ver O4 e §3 |
| **Estados** | catalogado; fora do catálogo; amostra escassa; sem dado no recorte | `HeroDetail.tsx:169-173,198`; `app/Sidebar.tsx:74-76` |
| **Casa** | `/hero` (lista) e `/hero/:id` (ficha). O `?hero=` é uma **segunda** fonte de “herói atual” | `app/router.tsx:48,59`; `HeroDetail.tsx:151-152` |

**Ruptura:** o herói tem duas identidades de navegação. A sidebar escreve `?hero=` (`Sidebar.tsx:118-124`), a ficha prioriza o path (`HeroDetail.tsx:151-152`). O mesmo herói pode estar em `/hero/123?hero=456`; a tela resolve para 123, a sidebar mostra 456. É um hijack de identidade, não um detalhe de rota.

### 2.2 O2 · Build observada

**Definição:** composição catalogada para herói × lane × elo, com win/pick e lift contra uma referência; é **observada**, não montada pelo jogador, e não tem janela própria.

| Eixo | Conteúdo | Evidência |
|---|---|---|
| **Atributos no tipo** | `win`, `pick`, `lift_raw`, `lift_vs_most_used`, `lift_vs_mean`, `reference_win`, `reference_kind`, `references`, `exposure_status`, `classification_status`, `spell`, `emblem`, `talents`, `items` | `queries/builds.ts:20-30` |
| **Atributos visíveis** | win, pick, lift vs mais usada, lift vs média, referência, tags, itens, emblema, talentos, feitiço, posição por lift | `features/hero-detail/sections/BuildsSection.tsx:248-330`; `features/builds/BuildsPanel.tsx:175-236`; `features/dashboard/BuildsTab.tsx:38-86` |
| **O que não existe no tipo canônico** | `id`, `variant_key`, `window`, `build_window`; o índice do array vira chave de lista | `queries/builds.ts:20-30`; `BuildsSection.tsx:253`; `BuildsPanel.tsx:185`; `HeroDetail.tsx:82`; `BuildsTab.tsx:385` |
| **Relações** | N:1 herói; 1:N itens/talentos; 1:0..1 evidência; 1:0..N cargas (fork); N:1 contexto (rank/lane, sem janela) | `queries/builds.ts:342-347`; `shared/domain/loadout.ts:309-364` |
| **Ações atuais** | ver; ler lift; trocar lane; link “ficha” → painel de builds do herói; adicionar item extra no power (efêmero); preparar **só** na aba Builds | `BuildsSection.tsx:54-80,322-330`; `features/builds/BuildsPowerPanel.tsx:142,259-266,326-334`; `BuildsTab.tsx:388-394` |
| **Ações faltantes** | abrir a build como objeto endereçável; selecionar duas builds e comparar; preparar a partir das outras 4 superfícies; saber a que janela o número se refere | ausência; ver §3 e §7 |
| **Estados** | catalogada; acima/abaixo da referência; sem referência (lift em aberto); sem build na lane; build “completa” ou com slots livres no power | `BuildsSection.tsx:181-182,242-247`; `BuildsPowerPanel.tsx:170-173` |
| **Casa** | **sem casa.** Aparece em 5 superfícies, mas nenhuma tem endereço próprio da build | `HeroDetail.tsx:116`; `BuildsSection.tsx:319`; `BuildsPanel.tsx:235`; `BuildsTab.tsx:385`; `BuildsPowerPanel.tsx:289-300` |

**Ruptura:** a identidade existe em um lugar e não no outro. O agregado entrega `variant_key` (`queries/builds.ts:196,237`; uso em `BuildsPowerPanel.tsx:291`), mas o payload canônico de builds do herói não (`queries/builds.ts:20-30`). A mesma build é endereçável no power e anônima na ficha. **Decisão L2:** a referência estável deve ser a assinatura já usada pelo loadout (`signatureOfPick` em `loadout.ts:361`) ou o `variant_key` do agregado — nunca um id inventado no cliente.

### 2.3 O3 · Loadout / carga

**Definição:** a composição que o jogador leva, endereçável na URL, com proveniência observada/livre e evidência apenas quando coincide item a item com uma build catalogada.

| Eixo | Conteúdo | Evidência |
|---|---|---|
| **Atributos** | `v`, `heroId`, `lane`, `rank`, `window`, `pick{itemIds, emblemId, talentIds, spellName}`, `provenance`, `observedItems`, `ref` | `shared/domain/loadout.ts:36-48`; payload em `193-207` |
| **Endereço** | `encodeLoadout` → `?l=` + `rank` + `window`; decode valida versão, limites e nunca lança | `loadout.ts:193-218,220-287` |
| **Atributos visíveis** | herói, lane, elo, janela, proveniência, “itens observados x/y”, 6 itens, emblema, 3 talentos, feitiço; evidência só com match exato | `features/loadout/Preparar.tsx:142-178,181-254` |
| **Relações** | N:1 herói; N:0..1 build (match); 1:0..1 evidência (só `exact`); 0..N itens livres | `loadout.ts:434-476`; `Preparar.tsx:117-118` |
| **Ações atuais** | abrir no combinador; voltar à ficha; builds na rota plana; fork a partir da build | `Preparar.tsx:164-169,256-269`; `BuildsSection.tsx:54-80` |
| **Ações faltantes** | editar a carga **na própria** `/preparar`; gravar a edição de volta na URL; nomear/compartilhar sem depender de perfil; levar a carga para o draft | `BuildsCombinerPanel.tsx:163-181,221-245` (edita em `useState`, não escreve) |
| **Estados** | fork observado; composição livre; match `exact`/`partial`/`none`; URL inválida; shell divergente da carga; sem builds na lane | `loadout.ts:67-86,434-476`; `Preparar.tsx:99-111,157-162,193-198` |
| **Casa** | `/preparar` — única rota de produto **fora da navegação** | `app/router.tsx:57` × `Sidebar.tsx:129-182` |

**Ruptura:** o loadout é o único objeto com endereço completo e honestidade estatística implementada, mas a navegação o trata como detalhe. Sem `?l=`, a tela manda o jogador para `/hero` (`Preparar.tsx:99-111`); com `?l=`, o combinador hidrata e **não devolve** a edição (`BuildsCombinerPanel.tsx:170-181,221-245`). O ciclo “build → carga → edição → carga” está quebrado no último passo.

### 2.4 O4 · Composição de time

**Definição:** o conjunto de 5 heróis + rotas que um time leva para uma partida; não é a soma de cinco análises individuais.

| Eixo | Conteúdo | Evidência |
|---|---|---|
| **Atributos** | nenhum no código. Proposta mínima: 5 slots (`heroId`, `lane`, `role`), rótulo do time, contexto (`rank`, `window`) | ausência; `ChatGPT.md:1724-1776` |
| **Relações** | 1:N heróis (exatamente 5); N:1 contexto; 1:0..N pares internos (informativo, **não somável**) | `ConfrontosPanel.tsx:202` proíbe soma |
| **Ações atuais** | nenhuma. Draft, blind e confrontos analisam **um herói** | `DraftPanel.tsx:30,93-193`; `BlindPanel.tsx:66-74`; `ConfrontosPanel.tsx:116,149-155` |
| **Ações faltantes** | montar 5 slots; trocar herói/rota; ver o que o Radar sabe e não sabe; compartilhar a lista | ausência |
| **Estados** | inexistente. Se criado: incompleto (0–4), completo (5), “sem sinergia medida” | proposta deste documento |
| **Casa** | **sem casa.** Decisão L2: não criar rota nova; a lista vive em `/preparar?team=`, como modo da Preparação | ver §5 e §7 |

**Ruptura:** o produto tem um job (J5) sem objeto. A API não fornece tamanho de grupo/fila (`BlindPanel.tsx:209`) e o próprio código proíbe somar δ entre cinco inimigos (`ConfrontosPanel.tsx:202`). Qualquer tela de “composição” que exiba win rate ou sinergia seria invenção. **Decisão L2:** composição de time é lista endereçável, sem estatística; a sinergia medida continua fora de escopo. **Draft não é um objeto separado:** é a decisão que escolhe os 5 slots; hoje ele existe apenas como leitura de distorção por herói (`DraftPanel.tsx:30,93-193`).

### 2.5 O5 · Matchup / par

**Definição:** relação empírica entre dois heróis (counter ou teammate), com δ descritivo, qualidade de evidência e curva de duração; o par — não o herói isolado — é a unidade.

| Eixo | Conteúdo | Evidência |
|---|---|---|
| **Atributos** | `id`, `name`, `head`, `delta`, `win`, `pick`, `pair_key`, `relationship_type`, `effect_raw`, `evidence_quality`, `evidence_reasons`, `curve`, `profile` | `queries/matchups.ts:7-15` |
| **Atributos visíveis** | avatar, nome, δ, win, perfil, selo de qualidade, `pair_key`, grupos de sinergia/anti-sinergia | `ConfrontosPanel.tsx:20-63,196-229` |
| **Relações** | N:1 herói de referência; N:1 adversário/aliado; 1:0..N leituras de draft | `matchups.ts:17-21` |
| **Ações atuais** | ler; agrupar; “levar par p/ o draft” | `ConfrontosPanel.tsx:149-155` |
| **Ações faltantes** | selecionar o par (não só o herói); preservar `pair_key`; abrir o draft com o par visível; levar o par para o blind | `ConfrontosPanel.tsx:152-153` (leva só `hero`) |
| **Estados** | δ desconhecido; evidência robusta/provisória/inconclusiva; counter/teammate; sem par canônico | `PairCard` 22-58 |
| **Casa** | **sem casa.** Vive dentro de `/confrontos` e das abas, mas o par não tem endereço | `ConfrontosPanel.tsx:26,56-58` exibe `pair_key` sem escrevê-lo na URL |

**Ruptura:** o objeto tem chave canônica (`pair_key`) e a tela a exibe, mas o CTA “Levar par p/ o draft” monta `/draft?hero=...` sem o par (`ConfrontosPanel.tsx:149-155`). O objeto mais importante do job J6 é o único que não viaja.

### 2.6 O6 · Recomendação

**Definição:** uma leitura prescritiva com alvo, motivo, evidência e contexto. **Não existe como objeto no código** — e este documento decide não criá-lo como agregado.

| Eixo | Conteúdo | Evidência |
|---|---|---|
| **Atributos** | nenhum. Rótulos implícitos: “Maior lift”, “Candidato a Joia”, “Candidato Operacional Provisório” | `BuildsSection.tsx:278-281`; `DraftPanel.tsx:229,304`; `RankingsTab.tsx:92` |
| **Relações** | se existisse: N:1 herói/build/par; N:1 evidência; N:1 contexto | proposta |
| **Ações atuais** | nenhuma ação de “recomendar”. O agregado nega explicitamente recomendação | `BuildsAggregatePanel.tsx:765,784` |
| **Ações faltantes** | não faltam: **não deve existir** como score. O que falta é a leitura com motivo e evidência, sem autoridade de comando | decisão L2 |
| **Estados** | “rótulo solto” (perigoso) ou “leitura com lastro” (aceitável) | — |
| **Casa** | **sem casa por decisão.** Não criar rota, objeto ou badge “recomendado” | ver §8 |

**Ruptura:** “recomendação” é uma expectativa do jogador, mas o produto não tem objeto que a sustente. Os rótulos “Maior lift” e “Candidato a Joia” funcionam como recomendação implícita sem declarar o motivo no mesmo lugar. **Decisão L2:** trocar o vocabulário por “leitura” + “por quê” + evidência; nunca criar score de recomendação.

### 2.7 O7 · Evidência

**Definição:** o lastro que autoriza um número — amostra, referência, status de match, qualidade e razões — e que deve ser alcançável a partir do número, não de uma tela separada.

| Eixo | Conteúdo | Evidência |
|---|---|---|
| **Atributos** | `status` (`exact`/`partial`/`none`), `build`, `compared`, `unknown`, `mismatched`, `win`, `pick`, `liftVsMostUsed`, `liftVsMean`, `referenceWin` | `loadout.ts:67-86,434-476` |
| **Atributos de par** | `evidence_quality`, `evidence_reasons`, `exposure_status` | `matchups.ts:12`; `ConfrontosPanel.tsx:52-55` |
| **Atributos de lote** | selo de conservação, lote stale, idade, falhas de fonte, `partial` | `app/Sidebar.tsx:92-110`; `features/exposure/Exposure.tsx:47-53`; `queries/builds.ts:334-337` |
| **Relações** | N:1 build; N:1 par; N:1 lote; 1:0..1 número selado | `loadout.ts:467-476` |
| **Ações atuais** | ler selo; ver “composição idêntica” ou “não observada”; ver razões do par; auditar lote em `/exposicao` | `Preparar.tsx:201-254`; `ConfrontosPanel.tsx:52-55`; `Exposure.tsx:22-53` |
| **Ações faltantes** | ir do número ao “por quê” em ≤2 cliques, preservando herói/rank/janela/lane; abrir a evidência como sobreposição, sem perder a tela | ausência; `/exposicao` é lote, não número |
| **Estados** | exata; parcial (campo sem id); divergente; sem base; robusta/provisória/inconclusiva; stale | `loadout.ts:427-459`; `HeroCard.tsx:265`; `Sidebar.tsx:109` |
| **Casa** | **sem casa própria por decisão.** É camada transversal (drawer/popover), não rota. `/exposicao` é a casa da evidência **do lote** | `router.tsx:58` |

**Ruptura:** a evidência mais forte do produto (match exato do loadout) está presa a `/preparar`; fora dela, o número selado não tem caminho de explicação. O jogador vê o selo, não o lastro.

### 2.8 O8 · AnalysisContext

**Definição:** o recorte que dá sentido ao número — elo, janela, herói, lane, dias, top, população — e que precisa viajar com o objeto, não com a tela.

| Eixo | Conteúdo | Evidência |
|---|---|---|
| **Atributos** | `rank`, `window`, `hero`, `lane`, `days`, `top`, `population` | `app/filters.ts:8-23`; `queries/builds.ts:257-263`; `ConfrontosPanel.tsx:124`; `BuildsCombinerPanel.tsx:155-157` |
| **Atributos de lote** | `window_applies_to`, `build_window` (nulo), `stale`, `age_ms`, `partial` | `queries/builds.ts:260-263,334-337` |
| **Relações** | 1:N builds; 1:N pares; 1:N leituras; 1:N cargas (a carga tem rank/window próprios) | `queries/builds.ts:342-347`; `loadout.ts:40-41`; `Preparar.tsx:119` |
| **Ações atuais** | trocar elo/janela no header; escolher herói; escolher lane; escolher top; escolher dias; escolher A×B | `App.tsx:18,67-98`; `BuildsTab.tsx:208-218`; `BuildsPowerPanel.tsx:349-350`; `RanksPanel.tsx:90-113` |
| **Ações faltantes** | fixar/“copiar contexto”; preservar lane/top/days/pair ao navegar; declarar que a build não tem janela; um único lugar que diga qual contexto manda | `App.tsx:18` preserva só rank/window/hero; `BuildsSection.tsx:192` escreve “janela Nd” sem janela na build |
| **Estados** | default (`mythic`/`7`); `rank=all`; lane obrigatória; shell divergente da carga; stale | `filters.ts:10-12`; `BlindPanel.tsx:76-85`; `BuildsTab.tsx:216-218`; `Preparar.tsx:157-162` |

**Ruptura:** o contexto é o objeto mais transversal e o menos respeitado. O shell preserva três campos (`App.tsx:18`), cada feature inventa os seus, e a build observada **não tem janela** (`build_window: null` em `queries/builds.ts:262`) embora a tela escreva “janela {window}d” (`BuildsSection.tsx:192`). O número parece recortado por tempo; a fonte diz que não.

### 2.9 Relações entre objetos

| De | Para | Cardinalidade | Existe? | O que falha | Evidência |
|---|---|---|---|---|---|
| Herói | Build observada | 1:N | sim | sem identidade da build | `queries/builds.ts:342-347` |
| Herói | Par | 1:N | sim | par não endereçável | `queries/matchups.ts:17-21` |
| Build observada | Loadout | 1:0..N | sim | fork só em 1 das 5 superfícies | `BuildsSection.tsx:54-80` |
| Loadout | Evidência | 1:0..1 | sim | só `exact`; sem link a partir de outros números | `loadout.ts:467-476` |
| Loadout | Herói | N:1 | sim | herói do loadout pode divergir do `?hero=` | `loadout.ts:38`; `HeroDetail.tsx:151-152` |
| Loadout | Build | N:0..1 | sim | match não é escrito de volta na URL | `loadout.ts:434-459` |
| AnalysisContext | Build | 1:N | sim | janela do shell não se aplica à build | `queries/builds.ts:262` |
| AnalysisContext | Loadout | 1:N | sim | shell e carga podem divergir sem bloquear | `Preparar.tsx:119,157-162` |
| Composição de time | Herói | 1:5 | **não** | sem tipo, rota, endpoint | ausência; `BlindPanel.tsx:209` |
| Recomendação | Herói/Build/Evidência | N:N | **não** | rótulos implícitos sem lastro no mesmo lugar | `BuildsSection.tsx:278-281`; `DraftPanel.tsx:304` |

### 2.10 Hijacks de vocabulário

| Termo | O que nomeia hoje | O que o jogador espera | Tipo | Decisão L2 | Evidência |
|---|---|---|---|---|---|
| **Build** | (a) payload observado; (b) composição editada; (c) índice estimado; (d) agregado B0–B5 | uma coisa que se abre, compara e leva | nome duplo (4 referentes) | reservar “build” para a observada; “carga” para a editada; “índice” para o estimado; “agregado” para B0–B5 | `queries/builds.ts:20-30`; `loadout.ts:36-48`; `BuildsPowerPanel.tsx:52`; `Builds.tsx:14-19` |
| **Preparar** | rota `/preparar` (carga) × job IDD “configurar parâmetros” | preparar a partida | nome duplo | “Preparação” = experiência/carga; “configurar” = job IDD | `router.tsx:57`; `shared/idd/index.tsx:37-42` |
| **Draft** | distorção de pick/ban por herói × composição de draft | escolher 5 heróis com risco | nome duplo | “Draft” = decisão de pick; “Distorção” = leitura de pressão | `DraftPanel.tsx:65-72`; `ConfrontosPanel.tsx:152` |
| **Confrontos** | pares counter/sinergia | partida ou time | objeto sem casa | “Confrontos” = pares; “time” = composição | `ConfrontosPanel.tsx:20-63` |
| **Recomendação** | rótulos “Maior lift” e “Candidato a Joia” | comando com score | ação órfã | não criar; usar “leitura + motivo + evidência” | `BuildsSection.tsx:278-281`; `DraftPanel.tsx:304`; `BuildsAggregatePanel.tsx:765,784` |
| **Herói atual** | `?hero=` (sidebar) × `/hero/:id` (ficha) | um só herói em foco | identidade dupla | path manda; query é fallback declarado | `Sidebar.tsx:118-124`; `HeroDetail.tsx:151-152` |
| **Janela** | janela do shell × build sem janela | número recortado por tempo | atributo sem ação | exibir “sem recorte temporal” quando `build_window` for nulo | `queries/builds.ts:262`; `BuildsSection.tsx:192` |
| **Exposição** | tela de governança × item “Fonte / Exposição” duplicado | um só lugar | duplicata de navegação | manter `/exposicao`; remover o segundo item da sidebar | `Sidebar.tsx:41-47,256-268` |

**Gate 2.** O vocabulário está decidido (todo termo duplo tem regra acima), mas **três objetos não têm casa**: build observada (O2), composição de time (O4) e par (O5). A recomendação (O6) e a evidência (O7) são “sem casa **por decisão**”: não viram rota. **Status: verde no vocabulário, amarelo na casa.** A lacuna de O2/O5 é resolvível com URL; a de O4 é P2 e não autoriza estatística.

---

## 3. Telas, objetos e continuidade

Legenda de veredito: **manter** (a tela cumpre o papel), **migrar** (o papel fica, a ação/estrutura muda), **redesenhar** (a hierarquia da tela muda). O veredito é L2 e está registrado aqui; não é redesign visual fechado.

| # | Tela | Objeto central | Próxima ação **atual** | Próxima ação **faltante** | Duplicação / atrito | Veredito |
|---|---|---|---|---|---|---|
| 1 | `/dashboard` | Herói, Contexto, Build (aba) | “Abrir a Ficha do Herói” (só com `?hero=`) / cards “Detalhes” / aba Builds → “Ver ficha” | “Preparar” a partir da build; abrir build; comparar heróis | Aba Builds lista builds que também aparecem em `/builds` e na ficha; CTA primário depende de herói já selecionado | **migrar** |
| 2 | `/hero` | Herói | selecionar no picker → “Abrir a Ficha” / cards | abrir a Preparação com o herói (sem build); comparar; ver lane | `HeroPicker` também vive na sidebar e em toda tela de contexto | **manter** |
| 3 | `/hero/:id` (home) | Herói + Build (top 3 por lane) | abrir aba; trocar lane; “ver na aba” | **“Preparar” na home**; comparar builds; fixar herói | 8 abas + links de contexto + 3 builds por lane; nenhum CTA de preparação (`HeroDetail.tsx:33-44,116`) | **redesenhar** |
| 4 | `/hero/:id?tab=builds` | Build observada | “Preparar a partir desta build” (única ponte) | comparar 2 builds; abrir build; preparar em outras superfícies | mesma lista de `/builds?view=hero` e do power; `key={i}`; “janela Nd” sem janela | **manter** (fonte canônica) + **migrar** CTA |
| 5 | `/hero/:id?tab=confrontos` | Par | ler par; trocar herói | levar o par; abrir draft com `pair_key` | mesma leitura de `/confrontos`, sem o par na URL | **migrar** |
| 6 | `/hero/:id?tab=draft` | Herói + leitura de distorção | “Marcar p/ acompanhar” → `/tempo` | pin real com contexto; voltar ao par | CTA não cria estado; `/tempo` recebe só herói/rank/window | **migrar** |
| 7 | `/forca` | Herói (tabela) + Evidência | “Comparar neste contexto” → `/confianca` | comparar 2 heróis; explicar θ̂ | rótulo “comparar” leva a outra leitura, não a uma comparação | **manter** + **migrar** CTA |
| 8 | `/confianca` | Evidência | “Copiar veredito c/ carimbos” → **a própria tela** | copiar de verdade, com rank/janela/herói | CTA de cópia sem clipboard | **migrar** |
| 9 | `/ranks` | Contexto + Evidência | “Fixar par a×b” → `/tempo` | preservar `rankA`/`rankB`; comparar | o par A×B não viaja; `/tempo` não sabe dos dois elos | **migrar** |
| 10 | `/tempo` | Evidência temporal | “Copiar série CSV” → **a própria tela** | exportar CSV real com contexto | CTA de exportação sem arquivo | **migrar** |
| 11 | `/confrontos` | Par | “Levar par p/ o draft” → `/draft?hero=` | levar `pair_key`; ver o par no draft | o CTA perde o objeto; `days` fica para trás | **migrar** |
| 12 | `/draft` | Herói + leitura | “Marcar p/ acompanhar” → `/tempo` | pin/estado real; composição de time | análise por herói; sem time; CTA sem estado | **migrar** |
| 13 | `/blind` | Herói + Evidência | “Declarar candidato + checklist” → **a própria tela** | checklist real; estado; ligação com par | CTA navega para si; ressalva de grupo já declarada (`BlindPanel.tsx:209`) | **migrar** |
| 14 | `/builds?view=system` | Agregado B0–B5 | ler itens/pacotes/triplas; trocar lane/top | explicar o suporte de cada conjunto | não lista build individual; não é nível de preparação (item isolado não vira carga) | **manter** |
| 15 | `/builds?view=hero` | Build observada | ler lift; trocar lane | preparar; abrir build; comparar | duplica a aba Builds; `key={i}`; sem fork | **migrar** |
| 16 | `/builds?view=power` | Build observada + índice | completar 6 itens (efêmero); “ficha” | preparar; comparar; preservar extras | extras morrem no reload; link “ficha” perde rank/janela/lane | **migrar** |
| 17 | `/builds?view=combiner` | Loadout | editar itens/emblema/talentos/feitiço | devolver a edição à URL; preparar | hidrata `?l=`, edita em `useState`, não escreve de volta | **migrar** |
| 18 | `/preparar` | Loadout + Evidência | abrir no combinador; voltar à ficha; builds na rota | editar aqui; compartilhar; levar ao draft; entrar pela nav | rota escondida; sem edição; sem CTA de cópia | **manter** (núcleo) + **migrar** entrada |
| 19 | `/exposicao` | Evidência do lote | “Exportar relatório do lote” → **a própria tela** | exportar de verdade; ligar ao número | CTA de exportação sem arquivo; item duplicado na sidebar | **migrar** |

**Leitura da tabela.** Há **19 superfícies** (13 rotas + 6 abas/visões) e a continuidade aparece em uma só: a aba Builds. Fora dela, o padrão é “ler e voltar” — o que explica J8 parcial em quase tudo. As duplicações não são de conteúdo (o mesmo dado em dois lugares pode ser útil); são de **ação**: a mesma build é listada em 5 lugares, mas só um sabe o que fazer com ela.

---

## 4. Navegação, atrito e hierarquia

### 4.1 O que a sidebar realmente diz

A sidebar tem 3 streams, 8 contextos internos e 3 entradas de “Visão geral” (`Sidebar.tsx:21-48,129-182`). Com o item de exposição repetido no rodapé (`Sidebar.tsx:41-47,256-268`), ela expõe **11 destinos únicos**:

| Grupo | Itens | Objeto que o jogador vê | Evidência |
|---|---|---|---|
| Visão geral | Dashboard, Heróis, Builds | meta, catálogo, composições | `Sidebar.tsx:129-182` |
| Inferência & Força | Força, Confiança, Ranks, Tempo | θ̂, incerteza, heterogeneidade, patch | `Sidebar.tsx:21-31` |
| Inteligência de Draft | Confrontos, Distorção, Blind Pick | par, pressão, robustez | `Sidebar.tsx:32-40` |
| Governança | Exposição | denominador | `Sidebar.tsx:41-47` |
| Rodapé | Fonte / Exposição (duplicata), IDD | lote, inspetor | `Sidebar.tsx:250-278` |

O cabeçalho anuncia “9 Contextos” (`App.tsx:54`). O jogador não vê “9 contextos”; vê **nomes internos** (“Distorção”, “Blind Pick”, “Exposição”) e precisa saber qual deles responde à pergunta dele. `/preparar` não está em nenhum grupo (`router.tsx:57`). `/hero/:id` também não — é contextual, o que é correto —, mas o único caminho para ela é `?hero=` + “Ver herói no dossiê” (`Sidebar.tsx:238-246`) ou um card de lista.

**Diagnóstico:** a navegação é um **mapa de bounded contexts** (o comentário em `Sidebar.tsx:20` assume isso), não um mapa de tarefas. Ela funciona para quem construiu o sistema e falha para quem quer preparar uma partida.

### 4.2 Atrito por job

| Job | Onde quebra | Causa raiz | Evidência | Consequência |
|---|---|---|---|---|
| **J1 · descobrir o meta** | dashboard → ficha → builds | 3 abas locais no dashboard e picker global competindo | `Dashboard.tsx:54,160-174`; `Sidebar.tsx:185-191` | o jogador acha o herói, mas não a próxima ação |
| **J2 · entender a ficha** | home com 8 abas | abas são contextos internos, não perguntas | `HeroDetail.tsx:33-44` | “qual aba leio primeiro?” |
| **J3 · preparar a build** | ficha/builds → `/preparar` | única ponte na aba Builds; rota fora da nav | `BuildsSection.tsx:54-80,322-330`; `router.tsx:57` | a tarefa que fecha a sessão tem 1 entrada |
| **J4 · comparar builds** | 4 visões de build | “build” nomeia 4 coisas; nenhuma comparação lado a lado | `Builds.tsx:14-19`; `queries/builds.ts:20-30` | o jogador compara de cabeça |
| **J5 · composição de time** | nenhuma tela | objeto inexistente; API sem grupo | `BlindPanel.tsx:209`; `ConfrontosPanel.tsx:202` | job sem casa; não se resolve com score |
| **J6 · risco de draft** | confrontos → draft | CTA leva só o herói; par não viaja | `ConfrontosPanel.tsx:149-155` | o draft abre sem o par que motivou a ida |
| **J7 · rastrear o número** | selos e FAQs | evidência transversal sem link de contexto | `Preparar.tsx:201-254`; `Exposure.tsx:22-53` | o número parece opaco fora da Preparação |
| **J8 · retomar** | toda navegação | URL preserva 3 campos; lane/top/days/pair/l se perdem | `App.tsx:18`; `HeroDossier.tsx:74`; `BuildsPowerPanel.tsx:245-247` | F5 perde a composição e o recorte |

### 4.3 Hierarquia e ergonomia (lente Refactoring UI)

Achados como **oportunidade**, com esforço e risco. Não são redesign pronto.

| # | Achado | Evidência | Oportunidade | Esforço | Risco |
|---|---|---|---|---|---|
| H1 | **CTA antes da evidência.** O botão primário aparece antes do dado que ele usa; o jogador é convidado a agir sem ler | `ConfrontosPanel.tsx:149-155`; `DraftPanel.tsx:84-90`; `BlindPanel.tsx:68-74`; `BuildsPanel.tsx:63-69` | mover a ação para depois da leitura (ou fixá-la no rodapé do bloco), mantendo 1 primária por tela | S/M | usuário pode não ver a ação se ela descer demais |
| H2 | **Pilha de chrome.** CtxBar + dossiê + título + picker + CTA + seletor de lane antes do primeiro dado | `DraftPanel.tsx:65-93`; `ConfrontosPanel.tsx:130-157`; `BlindPanel.tsx:47-86` | colapsar dossiê/picker quando o herói já está na URL; manter 3 blocos no máximo | M | perder a sensação de contexto |
| H3 | **Tipografia mínima agressiva.** Rótulos e badges em 9–10 px carregam informação de decisão | `Sidebar.tsx:145-147,222`; `HeroCard.tsx:246-255`; `BuildsSection.tsx:200` | piso de 11 px para rótulo e 12 px para corpo; badges só para estado, não para número | S | perda de densidade em telas grandes |
| H4 | **Ouro semântico sobrecarregado.** Ouro marca CTA, item ativo, KPI, posição e ícone | `Sidebar.tsx:15-16`; `PrimaryAction.tsx:35`; `BuildsSection.tsx:260-262` | reservar ouro para **ação**; números em neutro; estado em cor semântica | M | quebra de identidade visual |
| H5 | **Duas ações primárias concorrentes.** Dashboard tem CTA global + cards + abas; ficha tem abas + links de contexto | `Dashboard.tsx:141-147,160-281`; `HeroDossier.tsx:66-86`; `HeroDetail.tsx:342-380` | uma primária por tela; o resto vira secundária explícita | M | reduzir descoberta de atalhos |

**Regra que este documento impõe:** a etapa 5 (ergonomia) aprova a hierarquia **em grayscale**, antes de cor. H4 só entra depois que H1/H2/H5 estiverem resolvidos.

---

## 5. Proposta de IA: Explorar, Preparar, Analisar

### 5.1 Princípio

Três experiências, **um sistema**. Não são três apps, três logins ou três shells (`ChatGPT.md:1019-1025,1820-1868`). São três perguntas:

| Experiência | Pergunta | Job | Entrada típica | Saída |
|---|---|---|---|---|
| **Explorar** | “O que está forte agora e por quê?” | J1, J2 | abrir o Radar sem herói | herói em foco + ficha |
| **Preparar** | “O que eu levo e com qual risco?” | J3, J4, J5, J6 | build, par ou herói já escolhido | carga endereçável / lista de time |
| **Analisar** | “Por que esse número existe?” | J7 | número selado ou lote | evidência com contexto preservado |

A experiência organiza a jornada; a feature implementa a capacidade. A mesma feature pode aparecer em duas experiências — por exemplo, `BuildsSection` é Exploração na ficha e Preparação quando o jogador clica em “Preparar”.

### 5.2 As 13 rotas alocadas

| # | Rota | Experiência primária | Papel na experiência | Também alcançável em | Evidência |
|---|---|---|---|---|---|
| 1 | `/dashboard` | **Explorar** | panorama e entrada | Preparar (aba Builds) | `router.tsx:47`; `Dashboard.tsx:54` |
| 2 | `/hero` | **Explorar** | catálogo/entrada | — | `router.tsx:48` |
| 3 | `/hero/:id` | **Explorar** | ficha/hub; abas cruzam para Preparar/Analisar | Preparar (`?tab=builds`), Analisar (demais abas) | `router.tsx:59`; `HeroDetail.tsx:33-44` |
| 4 | `/forca` | **Analisar** | tabela de força e θ̂ | Explorar (herói em foco) | `router.tsx:49` |
| 5 | `/confianca` | **Analisar** | trio de incerteza e selos | — | `router.tsx:50` |
| 6 | `/ranks` | **Analisar** | heterogeneidade entre elos | — | `router.tsx:51` |
| 7 | `/tempo` | **Analisar** | série temporal/patch | — | `router.tsx:52` |
| 8 | `/confrontos` | **Preparar** | escolher com risco de par | Analisar (evidência do par) | `router.tsx:53` |
| 9 | `/draft` | **Preparar** | pressão de pick/ban | Analisar (distorção) | `router.tsx:54` |
| 10 | `/blind` | **Preparar** | robustez a counters | Analisar (cauda/evidência) | `router.tsx:55` |
| 11 | `/builds` | **Preparar** | 4 visões: sistema, herói, power, combiner | Analisar (`view=system`) | `router.tsx:56`; `Builds.tsx:14-19` |
| 12 | `/preparar` | **Preparar** | carga endereçável (núcleo) | — | `router.tsx:57` |
| 13 | `/exposicao` | **Analisar** | evidência do lote | — | `router.tsx:58` |

**Regra de alocação:** cada rota tem **uma** experiência primária. A rota não muda de experiência por causa de um `?view=`; o que muda é o bloco interno. Isso evita o problema atual, em que `/builds?view=system` é análise e `/builds?view=combiner` é preparação, mas a sidebar chama tudo de “Builds”.

### 5.3 Sidebar proposta (sem três apps)

```
EXPLORAR
  Dashboard
  Heróis
  Herói em foco (widget contextual, não destino; abre /hero/:id)

PREPARAR
  Preparação            ← /preparar (novo item)
  Builds                ← /builds (4 visões internas)
  Confrontos
  Draft
  Blind Pick

ANALISAR
  Força
  Confiança
  Ranks
  Tempo
  Exposição             ← um único item (remover duplicata)
```

- **Não reduz o número de links** (11 → 12): troca o critério de agrupamento de “bounded context” para “tarefa”. O ganho é saber onde começar, não ter menos itens.
- `/hero/:id` continua contextual: não vira item de nav; é aberta pelo herói em foco ou por card.
- O selo do lote e o IDD continuam no rodapé, como infraestrutura, não como experiência (`Sidebar.tsx:250-278`).
- O item “Fonte / Exposição” duplicado sai; fica só “Exposição” em Analisar (`Sidebar.tsx:41-47,256-268`).

### 5.4 Contrato de URL

A URL é o store do produto. Hoje ela carrega três campos globais e alguns locais; a proposta é declarar o contrato.

| Parâmetro | Objeto | Quem escreve hoje | Quem lê hoje | Decisão |
|---|---|---|---|---|
| `rank` | Contexto | header | quase todas as telas | manter como global |
| `window` | Contexto | header | quase todas | manter como global; **não** aplicar a build sem `build_window` |
| `hero` | Herói | sidebar, pickers, cards | fichas e contextos | manter como foco contextual; path vence na ficha |
| `lane` | Contexto/Build/Loadout | botões de lane; 6 `setItem` | cada tela localmente | **centralizar**; preservar em toda navegação de build |
| `days` | Contexto/Par | confrontos | confrontos/ficha | preservar ao levar par |
| `top` | Contexto/Agregado | power/combiner | power/combiner | preservar entre views |
| `pair_key` | Par | ninguém | exibido, não lido | **adicionar** ao “levar par” |
| `build` (ou `ref`) | Build | ninguém | ninguém | **adicionar** para endereçar a build |
| `l` | Loadout | só `loadoutHref` | `/preparar`, combiner | **escrever de volta** ao editar |
| `team` | Composição de time | ninguém | ninguém | **P2**, dentro de `/preparar` |

**Regra:** nenhum estado de domínio vive só em `useState` ou `localStorage`. `localStorage` pode ser preferência de UI (ex.: última lane), nunca store de composição. Hoje há 6 escritores de `radar:lane` e **zero leitores** (`BuildsTab.tsx:98`; `BuildsSection.tsx:118`; `BuildsPanel.tsx:29`; `BuildsPowerPanel.tsx:273`; `BuildsCombinerPanel.tsx:213`; `BuildsAggregatePanel.tsx:477`).

---

## 6. Matriz “informação → próximo passo”

Cada linha é uma informação que o jogador já vê e o passo que ela deveria autorizar. “Contexto que deve viajar” é o mínimo para o passo não recomeçar a pergunta.

| # | Informação | Onde nasce | Próximo passo atual | Próximo passo que falta | Contexto que deve viajar | Objeto |
|---|---|---|---|---|---|---|
| 1 | Herói com θ̂/tier no dashboard | `HeroCard.tsx:240-281` | “Detalhes” → ficha | “Preparar” → carga | `rank`, `window`, `lane` | Herói |
| 2 | Build observada com lift na ficha | `BuildsSection.tsx:248-330` | “Preparar a partir desta build” | também comparar e abrir build | `hero`, `lane`, `rank`, `window`, ref da build | Build |
| 3 | Build no dashboard (aba Builds) | `BuildsTab.tsx:384-394` | “Ver ficha” | “Preparar” / “comparar” | `rank`, `window`, `lane`, ref da build | Build |
| 4 | Build no power | `BuildsPowerPanel.tsx:289-300` | “ficha” (perde contexto) | “Preparar” / “comparar” | `rank`, `window`, `lane`, `variant_key` | Build |
| 5 | Build na rota plana (`view=hero`) | `BuildsPanel.tsx:175-236` | ler lift | “Preparar” / “abrir build” | `hero`, `rank`, `window`, `lane` | Build |
| 6 | Carga na Preparação | `Preparar.tsx:142-254` | “Abrir no combinador” | editar e voltar; compartilhar | `hero`, `lane`, `rank`, `window`, `l` | Loadout |
| 7 | Composição editada no combinador | `BuildsCombinerPanel.tsx:163-245` | ver índice | gravar `?l=` e voltar à Preparação | `l`, `hero`, `lane`, `rank`, `window` | Loadout |
| 8 | Par counter em `/confrontos` | `ConfrontosPanel.tsx:20-63,149-155` | “Levar par p/ o draft” (só herói) | abrir draft com o par | `hero`, `pair_key`, `rank`, `window`, `days` | Par |
| 9 | Pior par no blind | `BlindPanel.tsx:66-74` | “Declarar candidato + checklist” (si mesmo) | checklist com estado e par | `hero`, `rank`, `window` | Par/Evidência |
| 10 | Pressão de pick/ban no draft | `DraftPanel.tsx:84-90` | “Marcar p/ acompanhar” → `/tempo` | pin real, com data e contexto | `hero`, `rank`, `window` | Herói |
| 11 | Número selado em `/forca` | `ForcaPanel.tsx:81-87` | “Comparar neste contexto” → `/confianca` | “por quê?” com θ̂, B, IC, amostra | `hero`, `rank`, `window` | Evidência |
| 12 | Veredito em `/confianca` | `ConfiancaPanel.tsx:61-67` | “Copiar veredito” (si mesmo) | copiar com carimbos | `hero`, `rank`, `window` | Evidência |
| 13 | Série em `/tempo` | `TempoPanel.tsx:62-68` | “Copiar série CSV” (si mesmo) | baixar CSV real | `hero`, `rank`, `window`, `days` | Evidência |
| 14 | Par A×B em `/ranks` | `RanksPanel.tsx:81-86` | “Fixar par a×b” → `/tempo` | comparar A×B preservando os dois | `rankA`, `rankB`, `hero`, `window` | Contexto/Evidência |
| 15 | Denominador em `/exposicao` | `Exposure.tsx:39-53` | “Exportar relatório” (si mesmo) | exportar relatório real do lote | `rank`, `window`, id do lote | Evidência |
| 16 | Herói em foco na sidebar | `Sidebar.tsx:238-246` | “Ver herói no dossiê” | levar lane/aba e permitir preparar | `hero`, `rank`, `window`, `lane` | Herói |

**Leitura da matriz.** Em 9 das 16 linhas o CTA existe, mas o comportamento trai o rótulo: volta para a própria tela, perde o objeto ou não grava estado. O problema não é falta de ação desenhada; é ação sem consequência.

---

## 7. Top 7 melhorias

Critério de prioridade: **P0** = quebra o job principal ou a invariante de honestidade; **P1** = impede a continuidade entre telas; **P2** = objeto sem casa que exige decisão de produto. Esforço: **S** (1 tela/ajuste local), **M** (2–4 telas + contrato de URL), **L** (novo objeto + fluxo, sem endpoint novo).

### P0

**1. A build observada ganha endereço e “Preparar” em todas as superfícies.**
- **O que:** referência estável (assinatura/variant key) + `?build=`/`?ref=`; ação “Preparar” nas 5 superfícies que listam builds, não só na aba.
- **Aceite observável:** (a) cada build tem endereço único e F5 retorna a ela; (b) 5/5 superfícies exibem a mesma ação; (c) 0 listas de build usam `key={i}`/`key={bi}`; (d) abrir a build e preparar preserva `hero/lane/rank/window`.
- **Evidência:** `queries/builds.ts:20-30`; `BuildsSection.tsx:253,322-330`; `BuildsPanel.tsx:185`; `BuildsTab.tsx:385`; `HeroDetail.tsx:82,116`.
- **Esforço:** M.

**2. O contexto viaja (URL como store).**
- **O que:** `lane`, `top`, `days`, `pair_key`, `build`, `l` entram no contrato de navegação; `localStorage` deixa de ser escrita sem leitura.
- **Aceite observável:** em 5 cenários (dashboard→ficha→builds→preparar; confrontos→draft; blind→checklist→voltar; ranks→tempo com A×B; loadout→combiner→ficha), **0 parâmetros perdidos**; 0 `setItem("radar:lane")` sem `getItem` correspondente; o shell e a carga divergentes só aparecem quando o jogador escolhe.
- **Evidência:** `App.tsx:18`; `HeroDossier.tsx:74`; `ConfrontosPanel.tsx:124,149-155`; `RanksPanel.tsx:81-86`; os 6 `setItem` listados em §5.4.
- **Esforço:** M.

**3. A Preparação vira destino visível e editor de volta.**
- **O que:** `/preparar` na nav; combiner escreve `?l=` a cada edição; a carga deixa de ser somente leitura.
- **Aceite observável:** (a) `/preparar` tem item de navegação; (b) editar 1 item no combiner muda `l` na URL e F5 preserva; (c) edição que diverge da build de origem faz `observedEvidence` retornar `null` (voltar a coincidir pode voltar a `exact`); (d) quando o número é da build, a tela não escreve “janela Nd” sem dizer que a janela é do shell/ordenação.
- **Evidência:** `router.tsx:57`; `Sidebar.tsx:129-182`; `BuildsCombinerPanel.tsx:163-181,221-245`; `loadout.ts:467-476`; `queries/builds.ts:262`.
- **Esforço:** M.

### P1

**4. CTAs que fazem o que dizem.**
- **O que:** eliminar botões que navegam para a própria tela; “copiar” copia, “exportar” exporta, “levar par” leva o par, “fixar” fixa.
- **Aceite observável:** auditoria de `PrimaryAction` com **0** casos em que o `pathname` de destino é a rota atual; “Copiar veredito” escreve no clipboard com `rank/window/hero`; “Copiar série CSV” gera arquivo; “Exportar relatório” gera arquivo; “Levar par” contém `pair_key` e o draft o exibe; “Fixar par a×b” preserva `rankA/rankB`; **0** rótulos “copiar/exportar/fixar” sem efeito correspondente.
- **Evidência:** `ConfiancaPanel.tsx:61-67`; `TempoPanel.tsx:62-68`; `Exposure.tsx:39-45`; `BlindPanel.tsx:68-74`; `ConfrontosPanel.tsx:149-155`; `RanksPanel.tsx:81-86`; `BuildsPanel.tsx:63-69`.
- **Esforço:** S.

**5. A ficha vira hub de decisão, não 8 abas soltas.**
- **O que:** home responde “é forte? contra quem? com o quê?” e oferece **uma** ação primária: Preparar. As abas viram evidência, não labirinto.
- **Aceite observável:** em teste com 5 jogadores, primeiro viewport com 1 CTA primário; 5/5 encontram “Preparar” em ≤10 s; trocar de aba preserva `lane`; a home não repete o mesmo CTA que a aba.
- **Evidência:** `HeroDetail.tsx:33-44,116,342-380`; `HeroDossier.tsx:66-86`.
- **Esforço:** M.

**6. Número → evidência em ≤2 cliques.**
- **O que:** um controle “por quê?” em cada número selado abre a evidência (amostra, shrinkage, referência, qualidade, stale) sem perder a tela.
- **Aceite observável:** 5/5 números rastreados em ≤2 cliques; a sobreposição preserva `hero/rank/window/lane`; 0 navegações para `/exposicao` para explicar um número de herói.
- **Evidência:** `Preparar.tsx:201-254`; `HeroCard.tsx:265`; `ConfrontosPanel.tsx:52-55`; `Exposure.tsx:22-53`.
- **Esforço:** M.

### P2

**7. Composição de time como lista endereçável, sem estatística.**
- **O que:** modo `?team=` dentro de `/preparar`: 5 slots de herói + rota; rótulo “sem sinergia medida”; nenhum win rate, score ou recomendação.
- **Aceite observável:** 5 slots; URL ida-e-volta preserva a lista; 0 números de composição; 0 endpoints novos; rótulo visível em todos os estados; a lista não promete cobertura de funções.
- **Evidência:** ausência de tipo/rota; `BlindPanel.tsx:209`; `ConfrontosPanel.tsx:202`; `router.tsx:46-62` (nenhuma rota de time).
- **Esforço:** L.

**Ranking final:** 1 (P0) → 2 (P0) → 3 (P0) → 4 (P1) → 5 (P1) → 6 (P1) → 7 (P2). O P2 não sobe para P0 por falta de dado, não por falta de dor: a API não fornece grupo e o produto proíbe somar δ.

---

## 8. O que não fazer

1. **Não criar score de composição, sinergia de time ou “força do time”.** A API não tem grupo/fila (`BlindPanel.tsx:209`) e o domínio proíbe somar δ (`ConfrontosPanel.tsx:202`). Seria a mentira mais cara do produto.
2. **Não exibir win rate de composição editada.** `observedEvidence` só existe com match exato (`loadout.ts:467-476`); trocar um item não herda a estatística da origem.
3. **Não criar “build recomendada” com score.** O agregado já nega recomendação (`BuildsAggregatePanel.tsx:765,784`); “Maior lift” é leitura, não comando (`BuildsSection.tsx:278-281`).
4. **Não criar perfis de jogador, login ou três apps.** A premissa é um sistema, várias jornadas (`ChatGPT.md:1019-1025`). Composição de time é lista, não conta.
5. **Não criar uma 14ª rota para time.** Use `?team=` em `/preparar`; as 13 rotas continuam sendo o mapa (`router.tsx:46-62`).
6. **Não transformar os 8 bounded contexts em 8 menus de produto.** Eles são fontes de evidência; a navegação deve ser por tarefa (§5.3).
7. **Não usar `localStorage` como store de domínio.** Hoje há 6 escritores de `radar:lane` e 0 leitores; persistência de composição é URL, não storage.
8. **Não duplicar a lista de builds em mais uma tela.** O problema é ação, não cobertura; 5 superfícies já listam a mesma build.
9. **Não remover selos, ressalvas, `stale` ou FAQs para “limpar” a tela.** A honestidade é a proposta; o que sai é o CTA que não cumpre o que promete.
10. **Não prometer counter pick, probabilidade de vitória ou “counter garantido”.** O próprio blind declara que é proxy de risco (`BlindPanel.tsx:216-220`); δ é descritivo (`ConfrontosPanel.tsx:202`).

---

## Handoff

### Para `ux-designer` (etapa 4 — fluxos)

1. Desenhar **3 fluxos** com o vocabulário deste documento: `J3 preparar` (ficha/build → `/preparar` → combiner → volta), `J6 risco de draft` (confrontos → draft com `pair_key`; blind → checklist → volta) e `J8 retomar` (5 cenários do P0 #2).
2. Regra de beco: todo estado de erro/vazio tem **voltar** e **cancelar**; nenhum CTA leva à própria tela.
3. Não criar tela nova: usar as 13 rotas e os parâmetros de §5.4. Composição de time é `?team=` em `/preparar` (P2).
4. Entregar o fluxo com o **contexto mínimo** anotado em cada seta (`hero/lane/rank/window/l` ou `pair_key`); se a seta não puder carregar, o fluxo está errado.

### Para `ui-designer` + `design-system-guardian` (etapas 5–6)

1. Aplicar H1/H2/H5 antes de cor: **1 CTA primária por tela**, ação depois da evidência, chrome colapsável quando o herói já está na URL.
2. Reservar ouro para ação (H4); números em neutro; piso tipográfico de 11/12 px (H3).
3. Componentes candidatos, com ocorrências: **BuildCard** (5 superfícies: `HeroDetail.tsx:116`, `BuildsSection.tsx:319`, `BuildsPanel.tsx:235`, `BuildsTab.tsx:385`, `BuildsPowerPanel.tsx:289-300`), **EvidenceDrawer** (4 contextos: `Preparar.tsx:201-254`, `HeroCard.tsx:265`, `ConfrontosPanel.tsx:52-55`, `Exposure.tsx:47-53`), **PrepareAction** (hoje 1 ocorrência; alvo 5). Componente só entra com ≥3 ocorrências.
4. Levar ao `design-system-guardian` os átomos fora do DS com `arquivo:linha`: badges de 9 px (`Sidebar.tsx:145-147,222`), KPIs duplicados (`BuildsSection.tsx:38-46`, `Preparar.tsx:71-79`), `LiftBar` local (`BuildsSection.tsx:12-36`).

### Para `domain-modeler` (etapas 3–6, depois)

1. O2 Build e O3 Loadout são objetos distintos; não fundir. A build é observada e imutável; a carga é derivada e endereçável.
2. O5 Par tem `pair_key` canônico (`matchups.ts:10`); o agregado deve tratar o par como unidade, não como dois heróis.
3. O4 Composição de time, se modelada, é **lista de 5 slots** sem agregação estatística; qualquer sinergia/score é L3 e não está autorizada por este documento.
4. O8 AnalysisContext é value object que viaja com o número; não é tela nem singleton global.

### Fora de escopo / L3

- Sinergia de composição medida, win rate de time, tamanho de grupo/fila, recomendação com score.
- Persistência com identidade de usuário, histórico entre dispositivos, login.
- Novo endpoint ou novo dado sensível. Se qualquer item acima for necessário, **escalar com alternativa concreta**, não assumir.

**Fim.** Nenhuma linha de código foi alterada **por esta auditoria**; as mudanças de código presentes no worktree são pré-existentes. Os únicos artefatos produzidos aqui são este documento e os relatórios referenciados.
