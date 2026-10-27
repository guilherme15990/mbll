# Build Management — descoberta e redesenho do topo de `/build`

> **Pergunta:** como transformar a seção “builds do sistema” em um **quadro** onde o jogador monta a composição (itens, emblema, talentos, feitiço) e vê o **índice relativo mudar ao vivo** — sem inventar recomendação, sem endpoint novo e sem quebrar o Núcleo e o Completar?
>
> **Resposta curta:** o quadro é um **objeto novo** (Composição editável) com **um número em foco** (índice + delta), **base observada explícita** e **candidatos com evidência**. A seção `2 · Builds do sistema` vira o quadro; `1 · Núcleo` e `3 · Completar` permanecem. Antes de qualquer pixel, o lift atual precisa ser corrigido: ele é uma fração exibida como se fosse ponto percentual (`BuildManager.tsx:153`).

- **Data:** 2026-10-26
- **Escopo:** topo de `/build` — hero header, lane, builds observadas, composição, índice e sugestões.
- **Método:** OOUX/ORCA + JTBD + Atomic Design + Refactoring UI, triangulados.
- **Entrega:** este relatório. **Nenhuma linha de código foi alterada.**
- **Fora do escopo:** backend, novos endpoints, mudança de contrato do `BuildLoadout`, regra de negócio ou coleta de dado novo (L3).

### Mapa das 9 perguntas

| # | Pergunta | Seção |
|---|---|---|
| 1 | O que já existe e o que falta? | §1 |
| 2 | Por que alguém usaria isso? | §2 |
| 3 | Quais são as coisas, não as telas? | §3 |
| 4 | O que está quebrado hoje, com evidência? | §4 |
| 5 | Qual a nova arquitetura de informação do topo? | §5 |
| 6 | Quais estados, interações e contrato de URL? | §6 |
| 7 | O que se repete e vira componente? | §7 |
| 8 | Onde a interface cria fricção? | §8 |
| 9 | Onde as lentes convergem, o que é MVP e o que fica depois? | §9–§11 |

## 0. Como ler e o que foi verificado

Todo achado abaixo tem lastro em `arquivo:linha`. Quando a evidência é inferência de produto (não de código), está marcada como **hipótese**.

| Fonte lida | O que foi extraído |
|---|---|
| `app/web/src/features/build-manager/BuildManager.tsx` | tela atual, estados, bugs de unidade, limites de edição |
| `app/web/src/shared/domain/buildManager.ts` | núcleo, fork de pick, sugestões, regra de adição |
| `app/web/src/shared/domain/combiner.ts` | `scoreCombination`, `validatePick`, semântica de denominador e evidência |
| `app/web/src/shared/domain/loadout.ts` | `Loadout`, assinatura, encode/decode, `observedEvidence` |
| `app/web/src/shared/api/queries/builds.ts` | contratos `Build`, `AggregateCombiner*`, `AggregateRunePage` |
| `app/web/src/features/builds/*` | painéis que já resolvem partes do problema |
| `app/web/src/features/hero-detail/sections/BuildsSection.tsx` | lift/KPI e fork para preparação |
| `app/web/src/features/loadout/Preparar.tsx` | evidência observada e formato de lift |
| `app/web/src/shared/ui/patterns/BuildLoadout.tsx` | padrão read-only e bug de tier |
| `packages/proprietary-engine/src/builds/build-lift.js` | unidade canônica do lift |
| `AGENTS/artefatos/spec/build-management.md` · `ADR-047` | decisões L2, invariantes e critérios já aceitos |
| `AGENTS/artefatos/spec/experiencias-ooux.md` | convenções de vocabulário, URL e veredito |

**Veredito de abertura:** **reorganizar**, não redesenhar do zero. O problema não é falta de dados; é falta de um objeto editável e de um número em foco.

---

## 1. Inventário de capacidades (o que já existe e o que falta)

### 1.1 O que a tela já tem

| Capacidade | Onde já existe | Estado | O quadro pode usar? |
|---|---|---|---|
| Builds observadas do herói | `useBuilds(hero, rank, lane)` — `BuildManager.tsx:279` | pronto | sim, como base |
| Itens, emblema, talentos e feitiço da build | tipo `Build` — `queries/builds.ts:20-30` | pronto | sim, slots preenchidos |
| Núcleo por presença | `coreItems` — `buildManager.ts:68-105` | pronto | sim, bloco preservado |
| Fork para `CombinerPick` | `pickFromObservedBuild` — `buildManager.ts:108-130` | pronto | sim, base |
| Candidatos de item | `completionSuggestions` — `buildManager.ts:143-193` | pronto | sim, trilha de itens |
| Regra de adição | `addCompletionItem` — `buildManager.ts:200-217` | incompleta | corrigir antes |
| Índice relativo | `scoreCombination` — `combiner.ts:95-143` | pronto | sim, número em foco |
| Validação de slots | `validatePick` — `combiner.ts:78-93` | pronto | sim, mas não é chamada no `/build` |
| Pesos por componente | `useBuildsAggregate(rank, lane, window, 10)` — `BuildManager.tsx:281` | pronto | sim, candidatos e contribuições |
| Emblema descritivo | `combiner.emblems` + `AggregateEmblemStat` | pronto, mas fora do `/build` | sim, com copy de “não soma” |
| Talentos por tier | `combiner.talents` + `Build.talents[].tier` | dados prontos | **falta combinação observada** |
| Feitiços | `combiner.spells` + `Build.spell` | dados prontos | sim, candidato |
| Página de runa | `aggregate.rune_pages` — `queries/builds.ts:135-145` | pronto, lane-wide | depois (não é do herói) |
| URL endereçável | `encodeLoadout`/`decodeLoadout` — `loadout.ts:193-287` | pronto | sim, `?l=` |
| Evidência observada | `observedEvidence` — `loadout.ts:467-476` | pronto | sim, só quando idêntica |
| Comparação de builds | `BuildCard` + `scoreCombination` por linha — `BuildManager.tsx:564` | pronto, mas visualmente diluído | absorver como chips |
| Honestidade do índice | copy em `BuildManager.tsx:651-675` | boa, mas escondida em `<details>` | promover para o painel |

### 1.2 O que não existe

| Lacuna | Consequência hoje | Onde deveria nascer |
|---|---|---|
| **Composição editável** (itens + emblema + talentos + feitiço) | só itens podem ser adicionados; o resto exige `/preparar` ou `/builds?view=combiner` | `features/build-manager/components/BuildBoard.tsx` |
| **Troca/remoção de item da base** | para trocar, é preciso remover o adicionado e adicionar outro; item observado não sai | função pura em `shared/domain/buildManager.ts` |
| **Combinação observada de talentos** | o jogador vê talentos soltos por tier, nunca o conjunto que aparece junto | função pura `observedTalentSets` |
| **Candidatos de emblema/feitiço no `/build`** | dados existem no agregado, mas a tela não os oferece | `CandidateRail` |
| **Persistência da edição** | `added` vive em `useState` (`BuildManager.tsx:310`) e morre no F5 | `?l=` na URL |
| **Status “esta composição ainda é a observada?”** | o `/build` não mostra; o `/preparar` sim | `signatureOfPick` + `observedEvidence` |
| **Escopo do peso** | builds são do herói; pesos são da lane (top-10) | etiqueta de escopo no quadro |
| **Unidade canônica do lift** | fração exibida como pp em 3 telas | helper em `shared/format.ts` |

**Regra de escopo:** o quadro não cria endpoint nem hook novo. Usa `useBuilds`, `useBuildsAggregate`, `scoreCombination` e o codec de loadout. O agregado é **lane-wide**; as builds são **hero-scoped**. Essa diferença é um dos achados centrais (ver §4, S11).

---

## 2. JTBD — por que alguém usaria o quadro

### 2.1 Os 12 jobs

Formato: **quando** [situação], **quero** [motivação], **para** [outcome mensurável].

| # | Job | Outcome mensurável | Atende hoje? |
|---|---|---|---|
| J1 | Quando abro o herói e não sei o que é consenso, quero ver o núcleo por presença, para não começar do zero. | identificar 3 itens centrais em ≤20 s | **atende** (Núcleo) |
| J2 | Quando há 3–4 builds observadas, quero comparar win/pick/lift na mesma referência, para escolher uma base. | escolher a base em ≤30 s, com referência explícita | **parcial** (lift em unidade errada; cards longos) |
| J3 | Quando escolho uma base, quero ver o que ela tem e o que falta, para saber se está completa. | identificar slots vazios em 1 olhada | **parcial** (`BuildLoadout` read-only + contador) |
| J4 | Quando falta item, quero candidatos com lastro e evidência, para preencher sem inventar. | preencher 1 slot em ≤15 s; zero candidato sem contraste | **atende** (Completar), só itens |
| J5 | Quando discordo de um item da base, quero trocá-lo mantendo o resto e ver o efeito, para testar sem perder a composição. | troca em ≤10 s com índice recalculado | **não atende** |
| J6 | Quando vou escolher talentos, quero uma combinação observada por tier, para não montar 3 talentos soltos. | aplicar a combinação completa em 1 clique; ver em quantas builds ela aparece | **não atende** |
| J7 | Quando escolho emblema, quero saber o que ele faz no índice e qual é a base observada, para não confundir com peso. | selecionar emblema entendendo “descritivo · não soma” | **não atende** no `/build` |
| J8 | Quando escolho feitiço, quero ver o que é usado e o que tem peso, para fechar a carga. | escolher feitiço em ≤15 s | **não atende** no `/build` |
| J9 | Quando um componente não tem peso, quero entender por quê, para não tratar ausência como zero. | distinguir `observed`/`estimated`/`descriptive`/`none` em 1 tooltip | **parcial** (rótulos existem, mas o chip muta lift pequeno sem explicar) |
| J10 | Quando a composição fica boa, quero levar ou compartilhar, para usar fora da tela. | abrir `/preparar?l=` com a mesma composição; link copiável | **parcial** (preparar funciona; edição morre no F5) |
| J11 | Quando erro, quero voltar à base observada, para não perder a referência. | reset em 1 clique; base intacta | **não atende** |
| J12 | Quando a composição muda, quero saber se ainda é a build observada, para não herdar winrate indevido. | 0 casos de win/lift observado em composição editada | **parcial** (o codec garante; a tela não mostra) |

**Gate 1:** todo job tem outcome mensurável e tela/fluxo correspondente. J5, J6, J7, J8 e J11 são os que o quadro precisa criar; J1, J4 e J10 já têm casa.

### 2.2 Matriz job × tela

Legenda: **A** = atende · **P** = parcial · **N** = não atende.

| Job | `/build` quadro (novo) | `/build` Núcleo | `/build` Completar | `/builds?view=combiner` | `/builds` agregado | `/preparar` | Ficha do herói |
|---|---|---|---|---|---|---|---|
| J1 | P | **A** | N | N | N | N | P |
| J2 | **A** | N | N | P | P | N | P |
| J3 | **A** | N | P | P | N | P | P |
| J4 | **A** | N | **A** | P | N | N | N |
| J5 | **A** | N | N | P | N | P | N |
| J6 | **A** | N | N | **P** | P | N | N |
| J7 | **A** | N | N | P | **A** | N | N |
| J8 | **A** | N | N | **A** | **A** | N | N |
| J9 | **A** | P | P | **A** | P | P | P |
| J10 | **A** | N | N | P | N | **A** | N |
| J11 | **A** | N | N | P | N | P | N |
| J12 | **A** | N | N | P | N | **A** | N |

**Leitura:** o quadro não substitui o Combinador nem o Agregado; ele **fecha o loop de decisão** que hoje exige 3 telas.

### 2.3 Ranking frequência × dor

Escala 1–5. `score = frequência × dor`.

| Rank | Job | Freq. | Dor | Score | Por quê |
|---|---|---|---|---|---|
| 1 | J5 trocar/remover item | 4 | 5 | **20** | é o gesto central do quadro; hoje não existe |
| 2 | J6 combinação de talentos | 4 | 4 | **16** | 3 escolhas soltas não são uma combinação |
| 2 | J9 entender evidência/escopo | 4 | 4 | **16** | confiança é pré-requisito de uso |
| 4 | J2 comparar base + lift | 5 | 3 | **15** | decide qual build carregar |
| 4 | J12 saber se ainda é observada | 3 | 5 | **15** | risco de herdar winrate indevido |
| 6 | J4 completar item | 4 | 3 | **12** | já existe, mas só item |
| 6 | J7 emblema descritivo | 3 | 4 | **12** | dado existe; sem casa no `/build` |
| 8 | J1 núcleo | 5 | 2 | **10** | já resolvido |
| 9 | J8 feitiço | 3 | 3 | **9** | fecha a carga, menor frequência |
| 9 | J10 levar/compartilhar | 3 | 3 | **9** | consequência, não decisão |
| 9 | J11 voltar à base | 3 | 3 | **9** | recuperação |
| 12 | J3 ver lacunas | 4 | 2 | **8** | o board já mostra slots |

**Ordem de implementação recomendada:** J5 → J6/J9 → J2/J12 → J4/J7 → J8/J10/J11.

### 2.4 Forças (push / pull / hábito / ansiedade)

| Job | Push (dor atual) | Pull (ganho) | Hábito | Ansiedade | Mitigação no quadro |
|---|---|---|---|---|---|
| J5 | planilha/YouTube; remover e adicionar de novo | ver o índice mudar no mesmo clique | copiar build de overlay/site | “esse item é realmente bom?” | peso + adoção + evidência no candidato; delta do índice explicado |
| J6 | 3 talentos escolhidos no olho | combinação que aparece junta nos dados | seguir streamer | “estou inventando?” | “observada em N de M builds”; nada de “melhor” |
| J9 | “sem contraste”, “sem referência” e “diferença irrelevante” se misturam | saber exatamente o que falta | confiar no número | “o índice é winrate?” | legenda fixa + 4 estados + tooltip |
| J2 | lift parece 0,03 pp | comparar na mesma escala | abrir a ficha | “a referência é a certa?” | lift em pp + win da referência + N |
| J12 | não sabe se a edição ainda é a build | status “idêntica” ou “editada” | F5 e link | “vou levar número errado?” | `signatureOfPick` + `observedEvidence`; evidência só quando exata |

---

## 3. OOUX/ORCA — as coisas, não as telas

### 3.1 Vocabulário único (decisão)

| Termo | Significado canônico | Nunca usar para |
|---|---|---|
| **Build observada** | composição que a fonte registrou para herói+lane+rank | composição editável |
| **Composição / carga** | pick editável (`CombinerPick` + proveniência) | build observada |
| **Base** | build observada escolhida como ponto de partida | “build do sistema” genérica |
| **Índice relativo** | `scoreCombination` (100 + 10 × média dos pesos) | winrate, previsão, “Poder da Build” |
| **Peso** | contraste “com × sem” do componente no recorte | contribuição em pontos |
| **Pontos** | `10 × peso ÷ nº de componentes com peso` | peso em pp |
| **Agregado** | estatística lane-wide (top-10/20 heróis) | dado do herói |
| **Candidato** | componente sugerido com evidência | recomendação |
| **Combinação observada** | conjunto exato de talentos que aparece junto em N builds | “melhor combinação” |

### 3.2 Mapa de objetos

| Objeto | Definição em 1 frase | Atributos visíveis | Ações | Estados | Casa | Relacionamentos |
|---|---|---|---|---|---|---|
| **Herói** | O personagem em foco. | nome, avatar, tier, θ̂, win, pick, ban | trocar | carregando / pronto / sem detalhe | header + `?hero=` | 1:N builds |
| **Recorte** | A lente lane+rank+janela que dá sentido a todo número. | lane, rank, janela, top | trocar lane/rank/janela | válido / sem lane / stale | URL + `CtxBar` | 1:N builds; 1:N agregado |
| **Build observada** | Composição que a fonte registrou no recorte. | win, pick, lift, referência, itens, emblema, talentos, feitiço | selecionar base, comparar, abrir detalhes | selecionada / alternativa / sem lift | chips de base + `?build=` | N:1 herói; 1:1 assinatura; 1:N slots |
| **Núcleo** | Itens que mais se repetem nas builds observadas. | id, nome, ícone, builds, share, win mediano, melhor lift | inspecionar, usar como candidato | estável (≥50%) / instável | bloco `1 · Núcleo` (preservado) | N:1 recorte |
| **Composição** | A carga editável que o jogador está montando. | itens, emblema, talentos, feitiço, proveniência, nº observados, ref | adicionar, trocar, remover, resetar, levar, copiar link | observada / editada / incompleta / inválida | **sem casa hoje** → quadro + `?l=` | 1:1 loadout; N:1 base; 1:N slots |
| **Slot** | A posição tipada dentro da composição. | tipo, índice/tier, ocupante, origem | preencher, trocar, esvaziar | vazio / preenchido / inválido / bloqueado | **sem casa hoje** → quadro | N:1 composição |
| **Candidato** | Componente oferecido com evidência e peso. | tipo, id, nome, ícone, evidência, peso, adoção, motivo | aplicar, pré-visualizar | observado / estimado / descritivo / sem contraste / não aplicável | Completar (itens) + trilha | N:1 catálogo; 1:N evidências |
| **Índice** | Número relativo do conjunto, não winrate. | índice, média pp, com peso, observados, estimados, descritivos, total, cobertura | comparar com base, detalhar | nulo / parcial / estável | cards + comparação; **sem casa única** | N:1 composição; 1:N componentes |
| **Componente do índice** | Cada item/emblema/talento/feitiço dentro do cálculo. | rótulo, ícone, valor pp, pontos, evidência, adoção, contextos | explicar | com peso / descritivo / sem contraste | detalhe do índice | N:1 índice; N:1 catálogo |
| **Emblema** | Item descritivo que não varia dentro do herói. | id, nome, ícone, adoção, win mediano, delta | escolher, comparar na lane | descritivo / sem id / poucos dados | agregado + quadro (novo) | 0..1 slot; N:1 catálogo |
| **Talento** | Escolha de tier que compõe a página de runa. | id, nome, ícone, tier, descrição, adoção, peso | escolher por tier | observado / estimado / sem contraste / tier conflitante | agregado + Combinador + quadro (novo) | 0..1 por tier |
| **Feitiço** | Escolha de feitiço de invocador. | nome, ícone, descrição, adoção, peso | escolher | observado / estimado / sem contraste | agregado + Combinador + quadro (novo) | 0..1 slot |
| **Referência** | A build “mais usada” que dá escala ao lift. | win, pick, nome/posição | comparar | disponível / sem referência | cards + chip de lift | 1:1 build |
| **Evidência** | O lastro de um número. | fonte, valor, contextos, builds, heróis, motivo | explicar | observada / estimada / descritiva / sem contraste | chips + `<details>` | N:1 componente |
| **Página de runa** | Conjunto emblema+talentos+feitiço observado na lane. | emblema, talentos, feitiço, adoção, win, delta | inspecionar | lane-wide / poucos dados | agregado | 1:N talentos; **sem casa no quadro (depois)** |

### 3.3 Relacionamentos e aninhamento

```text
Herói 1 ─── N Build observada          (via recorte)
Recorte 1 ─ N Build observada
Recorte 1 ─ N Agregado (lane-wide)
Build observada 1 ─ 1 Assinatura
Build observada 1 ─ N Slot observado
Composição 1 ─ 1 Loadout (URL ?l=)
Composição 1 ─ N Slot editado
Composição N ─ 1 Build base
Índice 1 ─ N Componente
Componente 1 ─ N Evidência
Candidato N ─ 1 Catálogo
Talento 1 ─ 1 Tier
Página de runa 1 ─ N Talento | 1 Emblema | 1 Feitiço
```

Objetos aninhados: **Slot** dentro de Composição; **Componente** dentro de Índice; **Evidência** dentro de Candidato/Componente; **Tier** dentro de Talento.

### 3.4 Hijacks (nome duplo, objeto sem casa, ação órfã, atributo sem ação)

| # | Hijack | Evidência | Correção |
|---|---|---|---|
| H1 | **“Build” = observada e editável** | tipo `Build` (`queries/builds.ts:20`) vs `Loadout` (`loadout.ts:36`); copy “Levar esta build” (`BuildManager.tsx:682`) | UI: **“build observada”** vs **“sua composição”**; “build” sozinho só para observada |
| H2 | **“Índice” vs “poder”** | campo `power` (`combiner.ts:52`), disclaimers “Poder da Build” (`BuildsPowerPanel.tsx:24`) | UI nunca mostra “poder”; só “índice relativo” |
| H3 | **“Cobertura” não é cobertura estatística** | `coverage = withData/total` (`combiner.ts:138`), exibida como barra (`BuildManager.tsx:241-244`) | renomear para **“componentes com peso”**; separar descritivos |
| H4 | **“Em aberto” é o único rótulo de ausência, mas o chip também muta lift pequeno** | `!liftOk` ou `Math.abs(lift) < 0.02` (`BuildManager.tsx:147-153`) | três estados: **sem referência** · **sem diferença relevante** · **+X pp** |
| H5 | **“Sem contraste” vs “sem dado”** | `evidenceLabel` none→“sem contraste” (`combiner.ts:183-188`); `valueText` idem (`196-207`) | `none` = **sem contraste no recorte**; `null` = **sem dado** |
| H6 | **“Sugestão” pode virar recomendação** | `CompletionSuggestion` (`buildManager.ts:32`), copy “sugestões” (`BuildManager.tsx:575`) | UI: **“candidato”**; nunca “recomendado”/“melhor” |
| H7 | **“Referência” ambígua** | `references?.most_used_win ?? reference_win` (`BuildManager.tsx:156`) | sempre rotular **“mais usada”**; mostrar a outra referência só se existir |
| H8 | **“Build do sistema” sugere geração** | título `2 · Builds do sistema` (`BuildManager.tsx:552-555`) | **“Builds observadas”**; subtítulo “o que a fonte registrou” |
| H9 | **Emblema sem id vira “nada”** | `signatureOfPick` usa `emblemId ?? ""` (`loadout.ts:164-169`) | slot read-only “emblema sem id na fonte”; não selecionável |
| H10 | **Tier null é tratado como tier** | `new Set(tiers)` inclui `null` (`combiner.ts:89-90`) | agrupar “sem tier” separado; no máximo 1 |

**Gate 2:** todo objeto tem casa ou está marcado “sem casa”. Composição, Slot, Índice (casa única) e Página de runa (no quadro) estão marcados. Zero termo duplo sem decisão: H1–H10 têm correção registrada.

---

## 4. Crítica da tela atual — o que está quebrado, com evidência

### 4.1 Achados por severidade

| # | Sev. | Achado | Evidência | Impacto | Correção proposta |
|---|---|---|---|---|---|
| S1 | **Crítico** | `lift_vs_most_used` é fração (0–1), mas o `/build` formata como pp | `build-lift.js:15` (`unit: "fraction_0_1"`); `BuildManager.tsx:153` (`signed(lift, 2, " pp")`) | um lift real de +3,4 pp aparece como **+0,03 pp**; decisão errada por 100× | `pp(lift * 100, 1)`; helper `liftPp` e teste |
| S2 | **Médio** | Lift pequeno (0–2 pp) é mutado para o estilo neutro, mas continua exibindo número; não há rótulo textual “sem diferença relevante” | `BuildManager.tsx:147-153`; convenção de 2 pp em `BuildsAggregatePanel.tsx:27-31` | com a unidade errada (S1), todo lift parece < 2 pp e cai no neutro; usuário não distingue “pequeno” de “ausente” | três estados com rótulo textual (H4) |
| S3 | **Alto** | `addCompletionItem` valida 6 slots e bota só contra `added`, não contra a base | `buildManager.ts:200-217`; chamada em `BuildManager.tsx:401` | chamada direta pode passar de 6 ou duplicar bota; UI esconde sugestões em 6/6, mas não oferece troca | função `applyCandidate` com contexto da composição inteira |
| S4 | **Alto** | Só item é editável; emblema, talento e feitiço não têm slot no `/build` | `added: number[]` (`BuildManager.tsx:310`); `currentPick` só concatena itens (`316-319`); `currentBuildView` copia o resto da base (`330-342`) | o pedido central (quadro de 4 tipos) não é atendido | slots tipados + pickers |
| S5 | **Alto** | `?build=` obsoleto cai silenciosamente na primeira build, mas a URL continua com a assinatura antiga | `BuildManager.tsx:298-307` | F5/link mostra base diferente da URL; comparação inválida | se não achar, avisar e **substituir** o param |
| S6 | **Alto** | Edição não sobrevive a F5 | `useState` (`BuildManager.tsx:310`); reset em `312-314` | perda de trabalho; link não compartilha a composição | `?l=` com `setSp(..., { replace: true })` |
| S7 | **Alto** | Emblema entra em `total`, mas não em `withData`; cobertura cai sem o índice mudar, e o `/build` não explica | `combiner.ts:119-128`; barra em `BuildManager.tsx:241-244` | parece que o índice “quebrou” ao escolher emblema | separar “com peso” de “descritivo”; copy explícita |
| S8 | **Médio** | `BuildLoadout` posiciona talento por índice do array, não por tier | `BuildLoadout.tsx:62-64` e `158-161` | T1/T2/T3 trocados quando falta um tier; não serve para editar | quadro com slots fixos por tier; não alterar o contrato |
| S9 | **Médio** | Sugestões só de item | `completionSuggestions` (`buildManager.ts:143-193`); uso em `BuildManager.tsx:325-328` | talento/emblema/feitiço continuam manuais | `CandidateRail` com 4 abas |
| S10 | **Médio** | Índice por card é recalculado sem memo e usa pick com ids inválidos descartados | `BuildManager.tsx:564`; `pickFromObservedBuild` (`buildManager.ts:108-130`) | custo pequeno, mas pode divergir do loadout exibido | memoizar por assinatura; marcar itens sem id |
| S11 | **Médio** | Escopo invisível: builds do herói × pesos da lane; `top` fixo em 10 no `/build` e 10/20 no `/builds` | `BuildManager.tsx:279-281`; `BuildsAggregatePanel.tsx:468-470` | o jogador compara populações diferentes sem saber | etiqueta “herói”/“lane · top-10”; ler `?top=` |
| S16 | **Médio** | `window` aparece no contexto, mas `useBuilds` não recebe janela; só o agregado recebe | `BuildManager.tsx:259,279,281`; copy em `BuildsAggregatePanel.tsx:594-595` | o jogador acha que as builds são dos últimos 7 dias | rótulo “janela do agregado · builds sem recorte de tempo” |
| S12 | **Médio** | Mesma cor significa observado, lift positivo e build completa | `BuildManager.tsx:149-151`, `209-211`, `579`, `635` | semântica ambígua; cor vira ruído | tokens semânticos separados (§8) |
| S13 | **Baixo** | Assinatura ignora emblema sem id | `loadout.ts:164-169`; `matchLoadout` marca `unknown` em `396-397` | colisão rara de identidade | slot read-only + aviso |
| S14 | **Baixo** | `validatePick` trata todos os talentos sem tier como o mesmo tier | `combiner.ts:89-90` | bloqueia 2 talentos “sem tier” | agrupar “sem tier” à parte |
| S15 | **Baixo** | `IndexBadge` duplicado e classes de evidência repetidas em 4 arquivos | `BuildManager.tsx:50`, `BuildsPowerPanel.tsx:49`; 8 ocorrências da classe esmeralda | drift visual | extrair só com ≥3 ocorrências (§7) |

### 4.2 O problema estrutural (a causa, não o sintoma)

A tela atual tem **quatro lugares** onde o jogador vê número:

1. `BuildCard`: win, pick, lift, `IndexBadge` por build (`BuildManager.tsx:120-158`).
2. `IndexComparison`: índice base → próximo (`BuildManager.tsx:220-251`).
3. `IndexBadge` no rodapé do card (`BuildManager.tsx:158`).
4. `Completar`: contador de itens e sugestões (`BuildManager.tsx:570-649`).

Nenhum deles é **o número da composição atual**. O jogador vê o índice da build observada, o índice “com adicionados” e o índice de cada alternativa — mas não vê “este é o meu número agora” com a mesma hierarquia do herói. O quadro resolve isso com **um** índice em foco e os demais como contexto.

### 4.3 O que não é problema (para não mexer)

- `coreItems` e o bloco Núcleo funcionam e são honestos (`buildManager.ts:60-105`; `BuildManager.tsx:532-550`).
- `scoreCombination` é consistente; o problema é de **apresentação** e de **denominador explicado**, não de fórmula (`combiner.ts:95-143`).
- `observedEvidence` só devolve dado em `exact` (`loadout.ts:467-476`) — é o invariante que o quadro deve reutilizar, não recriar.
- `completionSuggestions` já exclui `none` e `descriptive` (`buildManager.ts:163-165`) — a trilha de itens deve usar a mesma função.

---

## 5. Arquitetura de informação do quadro

### 5.1 Princípios

1. **Um objeto em foco:** “Sua composição”.
2. **Um número em foco:** índice + delta vs base.
3. **Base é escolha, não seção:** chips de build observada no topo do quadro.
4. **Evidência ao lado de cada candidato**, nunca escondida em `<details>`.
5. **Editar no lugar:** sem round-trip para `/preparar` ou `/builds?view=combiner`.
6. **Escopo sempre visível:** “herói” ou “lane · top-10” em cada bloco.
7. **Reset sempre disponível:** voltar à base em 1 clique.

### 5.2 Onde o quadro entra

O quadro **substitui a seção `2 · Builds do sistema`** (`BuildManager.tsx:552-568`), não a tela inteira.

```text
/build
├─ Hero header + lane                         (preservado)
├─ 1 · Núcleo                                 (preservado, sem mudança)
├─ 2 · QUADRO — sua composição                (novo; substitui “Builds do sistema”)
│   ├─ A. Contexto e base
│   ├─ B. Slots da composição
│   ├─ C. Índice vivo
│   └─ D. Candidatos
├─ 3 · Completar                              (preservado; mesma função, mesmo visual)
└─ 4 · Próximo passo                          (preservado)
```

**Por que não colocar o quadro acima do Núcleo:** o Núcleo é a evidência que justifica a base; movê-lo para baixo quebraria a narrativa “consenso → base → composição”. O pedido é redesenhar “builds do sistema”, que é a seção 2. O quadro entra exatamente ali.

### 5.3 Zonas e wireframe

```text
┌ A. CONTEXTO E BASE ──────────────────────────────────────────────────────────┐
│ [avatar] Ahri · MID · Mythic · 7d          [fresco há 12 min]  [herói|lane]  │
│ Base observada:  [B1  +3.4 pp · 52.1% · 41% pick]  [B2  +0.8 pp]  [B3  —]   │
│                  [comparar builds ▾]                    [voltar à base]       │
└──────────────────────────────────────────────────────────────────────────────┘
┌ B. SUA COMPOSIÇÃO ───────────────────────────────┬ C. ÍNDICE RELATIVO ───────┐
│ ITENS  4/6                                       │  121.7                  │
│ [1][2][3][4][ ][ ]                               │  ▲ +5.3 vs base          │
│                                                  │  7 de 8 componentes      │
│ TALENTOS  [T1][T2][T3]                           │  com peso · 1 descritivo │
│ EMBLEMA   [E]  descritivo · não soma             │  [detalhar ▾]            │
│ FEITIÇO   [—]                                    │                          │
│ [copiar link]                                    │                          │
└──────────────────────────────────────────────────┴──────────────────────────┘
┌ D. CANDIDATOS ───────────────────────────────────────────────────────────────┐
│ [Itens 8] [Talentos 3] [Emblema 4] [Feitiço 3]                               │
│ ┌────────────────────────────────────┐  ┌────────────────────────────────────┐│
│ │ [icon] Nome do item                │  │ [icon] Nome do item                ││
│ │ +2.1 pp · 64% das builds · observado│ │ ~+1.4 pp · 31% · estimado         ││
│ │ [trocar no slot 3]                 │  │ [adicionar]                        ││
│ └────────────────────────────────────┘  └────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Comportamento por zona

**A. Contexto e base**
- Mostra herói, lane, rank, janela, frescor e **escopo dos pesos** (“lane · top-10”).
- Janela: rotular **“janela do agregado”**; as builds vêm da fonte sem recorte de tempo (S16).
- Chips de base: no máximo 4 visíveis + “ver todas”. Cada chip: posição, win, pick e lift em pp.
- Chip selecionado: `aria-pressed`, borda dourada, fundo `gold/10`.
- “Comparar builds” abre um painel/tabela com `BuildCard` completo (não duplica o índice no chip).
- “Voltar à base” só aparece quando a composição está editada.
- Se `?build=` não existir, aviso visível + substituição do param pela primeira build (S5).

**B. Sua composição**
- Grid de slots com 44–48 px, `button` real, foco visível.
- Itens: 6 slots; vazio mostra “+ item”; preenchido mostra ícone + nome no tooltip.
- Talentos: 3 slots fixos **T1/T2/T3**, preenchidos por tier (não por índice). Talento sem tier vindo da base aparece como chip read-only “sem tier”; a trilha não oferece talento sem tier.
- Emblema: 1 slot; subtítulo **“descritivo · não soma”** sempre visível.
- Feitiço: 1 slot.
- Ações por slot: clique abre o picker; `×` remove (sempre visível no touch, no hover/focus no desktop); `Enter`/`Space` abre; `Delete` remove direto, com “desfazer” via toast (P1).
- Estado “cheio”: candidato de item vira **“trocar no slot N”**, não “adicionar” (S3).
- Nunca usa `BuildLoadout` para editar; ele continua read-only para o preview da base.

**C. Índice vivo**
- Número grande (28–32 px), 1 decimal; sufixo “relativo”.
- Delta vs base com sinal e seta; se base nula, “—”.
- Duas linhas de contagem: **“7 de 9 componentes com peso”** e **“1 descritivo · 1 sem contraste”**.
- Lista de contribuições ordenada por `|points|`; cada linha: rótulo, evidência, valor pp, pontos.
- Rodapé fixo: “índice relativo, não é winrate; adicionar componente muda a média”.
- Se composição == base: bloco **“idêntica à build observada”** com win/pick/lift.
- Se editada: bloco **“composição editada”** + “lift da base: +3.4 pp vs mais usada” (não “lift da sua versão”).
- `aria-live="polite"` anuncia “Índice 121.7, mais 5.3 vs base” após clique (não a cada render).

**D. Candidatos**
- 4 abas: Itens, Talentos, Emblema, Feitiço.
- Todo card: ícone, nome, evidência (chip), peso/valor, adoção, motivo (tooltip), ação.
- Item: `completionSuggestions` (exclui `none`/`descriptive`).
- Talento: primeiro a **combinação observada** (1 clique), depois opções por tier. Só chame de “combinação recorrente” com **≥2 builds**; com 1 build, mostre “observada em 1 build” e não auto-sugira.
- Emblema: primeiro os usados nas builds do herói; depois os da lane com etiqueta “na lane”.
- Feitiço: mesmo padrão.
- Candidato com `none` só aparece no picker completo (com aviso “sem contraste; não move o índice”), nunca na trilha como positivo.
- Ordenação padrão: peso desc → adoção desc → nome. Não há “melhor” no rótulo.
- **Destino do candidato:** clique na trilha preenche o **primeiro slot compatível vazio**; se não houver, o card vira “trocar…” e abre o picker para escolher o slot. Nunca substitui um slot sem o jogador saber qual. Dentro do picker de um slot, o candidato aplica direto naquele slot.

### 5.5 Responsivo

| Breakpoint | Layout |
|---|---|
| ≥ 1280 px | board em 2 colunas (composição 1.6fr / índice 1fr); candidatos em 2–3 colunas; base em linha |
| 768–1279 px | board em 1 coluna; índice logo abaixo dos slots (não lateral); candidatos em 2 colunas |
| < 768 px | tudo em 1 coluna; índice vira **strip sticky** no topo do quadro (não bottom, para não colidir com nav); picker vira bottom sheet; slots 44 px; candidatos 1 coluna |
| < 360 px | nomes truncados com tooltip; nunca scroll horizontal no board |

### 5.6 Regras de slot (contrato de interação)

| Slot | Aceita | Rejeita | Feedback |
|---|---|---|---|
| Item 1–6 | item do catálogo, sem duplicata, no máximo 1 `movement` | 7º item, duplicata, 2ª bota | “Você já tem uma bota nesta composição.” |
| Talento T1/T2/T3 | talento com `tier` igual ao slot | talento de outro tier, 2º no mesmo tier | “Este talento é T2; o slot é T1.” |
| Talento “sem tier” | — (read-only) | selecionar | “Talento sem tier não é editável neste recorte.” |
| Emblema | 1 emblema com id | 2º emblema | substitui |
| Feitiço | 1 feitiço por nome | 2º feitiço | substitui |

**Substituição:** dentro do picker de um slot, clicar em candidato substitui naquele slot. Fora do picker, a trilha preenche o primeiro slot compatível vazio; se não houver, abre o picker para o jogador escolher o slot. Isso evita perda acidental e não exige “slot ativo” global.

### 5.7 O que o quadro **não** faz

- Não cria “build recomendada”, “score de sinergia” ou previsão.
- Não soma emblema no índice.
- Não mostra win/lift observado em composição editada.
- Não sintetiza combinação de talentos por “maior peso” e chama de observada.
- Não altera `BuildLoadout` nem o contrato de 5 telas.
- Não importa `features/builds` dentro de `features/build-manager`.

---

## 6. Estados, URL e lógica pura

### 6.1 Contrato de URL

| Param | Origem | Papel | Quando muda | Limpeza |
|---|---|---|---|---|
| `hero` | shell/rota | herói em foco | troca de herói | limpa `lane`, `build`, `l` |
| `lane` | shell/quadro | recorte | troca de lane | limpa `build`, `l` |
| `rank` | shell | elo | troca de elo | limpa `build`, `l` |
| `window` | shell | janela do agregado | troca | limpa `build`, `l` |
| `top` | shell (novo no `/build`) | profundidade do agregado (10/20) | troca | limpa `build`, `l` |
| `build` | chip de base | assinatura da **base observada** | seleção de base | não limpa `l` por si só; `l` é removido ao selecionar base |
| `l` | edição | `encodeLoadout` da **composição atual** | qualquer edição | removido ao voltar à base |

**Precedência:** se `l` existe e é válido, ele é a composição; `build` continua sendo a base (para comparação). Se `l` é inválido, ignora e usa a base, com aviso. Se `l` é de outro herói/lane/rank/janela, ignora com aviso — nunca mistura recortes.

**Escrita:** toda edição usa `setSp(next, { replace: true })` para não empilhar histórico a cada clique. “Copiar link” monta a URL completa (com `l`) e copia. “Voltar à base” remove `l` com `replace`.

**Por que `replace`:** 8 cliques de item não devem virar 8 entradas no “voltar”. O undo explícito é “Voltar à base” (MVP) e toast “Desfazer” (P1).

### 6.2 Máquina de estados do quadro

| Estado | Gatilho | O que aparece | O que fica desabilitado | Recuperação |
|---|---|---|---|---|
| `no-hero` | sem `?hero` | Empty + HeroPicker | quadro | escolher herói |
| `needs-lane` | herói sem lane | `NeedsLane` | quadro | escolher lane |
| `builds-loading` | query em voo | skeleton do board | slots/candidatos | aguardar |
| `builds-error` | erro de builds | `ErrBox` | quadro | retry |
| `builds-empty` | 0 builds | Empty “nenhuma build observada” | quadro | trocar lane/elo |
| `aggregate-loading` | pesos em voo | base + slots; índice “—” | candidatos | aguardar |
| `aggregate-error` | erro de pesos | base + slots; índice “—” | candidatos | retry / link `/builds` |
| `ready` | base selecionada, sem `l` | composição = base; índice; evidência observada | nada | editar |
| `editing` | `l` válido | composição editada; delta; “lift da base” | evidência observada | voltar à base |
| `invalid` | `applyCandidate` rejeitou | estado anterior + toast | ação inválida | corrigir |
| `full` | 6/6 itens | candidatos “trocar no slot” | “adicionar” | trocar/remover |
| `no-combo` | sem combinação completa | talentos por tier + aviso | botão “usar combinação” | escolher manual |
| `no-emblem-id` | base sem id de emblema | nome read-only + “sem id na fonte” | selecionar | escolher outro |
| `stale-build` | `?build=` não encontrado | base fallback + aviso | — | URL corrigida |
| `invalid-l` | decode falhou | base + aviso | — | URL corrigida |
| `stale` | dados velhos | `FreshLine` | — | recarregar |

### 6.3 Funções puras novas (em `shared/domain/buildManager.ts`)

Nada de React, nada de fetch; só `import type`.

```ts
export type SlotRef =
  | { kind: "item"; index: number }              // 0..5
  | { kind: "emblem" }
  | { kind: "talent"; tier: number | null }
  | { kind: "spell" };

export type ApplyError =
  | "duplicate"
  | "full"
  | "second_boot"
  | "tier_conflict"
  | "unknown_component"
  | "not_applicable";

export type ApplyOutcome =
  | { ok: true; pick: CombinerPick }
  | { ok: false; pick: CombinerPick; reason: ApplyError };

export function applyCandidate(
  pick: CombinerPick,
  target: SlotRef,
  candidate:
    | { kind: "item"; id: number }
    | { kind: "emblem"; id: number }
    | { kind: "talent"; id: number; tier: number }
    | { kind: "spell"; name: string },
  ctx: {
    items: readonly AggregateCombinerItem[];
    talents?: readonly AggregateCombinerTalent[];
    maxItems?: number;                            // default 6
  },
): ApplyOutcome;

export function removeSlot(pick: CombinerPick, target: SlotRef): CombinerPick;

export function sameAsObserved(pick: CombinerPick, observed: CombinerPick): boolean;

export type TalentSlot = { tier: number | null; talentId: number | null };
export function talentSlots(
  pick: CombinerPick,
  talents: readonly AggregateCombinerTalent[],
  observedTalents?: readonly BuildTalent[],
): TalentSlot[];                                  // T1, T2, T3 (+ sem tier)

export type TalentSetSuggestion = {
  key: string;                                    // ids ordenados
  talentIds: number[];
  tiers: { tier: number | null; talentId: number }[];
  builds: number;
  share: number;
  winMedian: number | null;
  complete: boolean;                              // 1 por tier, sem buraco
};

export function observedTalentSets(
  builds: readonly Build[],
  limit?: number,
): TalentSetSuggestion[];

export type EmblemSuggestion = {
  id: number;
  name: string | null;
  icon: string | null;
  builds: number;
  share: number;
  winMedian: number | null;
  source: "hero";
};

export function observedEmblems(
  builds: readonly Build[],
  limit?: number,
): EmblemSuggestion[];

export type SpellSuggestion = {
  name: string;
  icon: string | null;
  builds: number;
  share: number;
  winMedian: number | null;
  source: "hero";
};

export function observedSpells(
  builds: readonly Build[],
  limit?: number,
): SpellSuggestion[];
```

**Invariantes:**
- `applyCandidate` nunca muta o pick; sempre devolve novo array.
- Trocar um slot ocupado **substitui**, não duplica. `target.index` só pode apontar para um slot existente ou para o próximo livre; índice fora do intervalo é `full`/`not_applicable`.
- Item: 6 no total, sem repetição, 1 bota.
- Talento: 3 no total, 1 por tier; `null` é um “tier” separado e **não é aplicável pela trilha** (só read-only se vier da base).
- Emblema/feitiço: 1 cada; substituição 1:1.
- `observedTalentSets` não inventa combo: só conta conjuntos exatos; `complete` exige **3 talentos, 3 tiers distintos e não nulos**; `recurring` exige **≥2 builds**. `share` usa o total de builds observadas (inclusive builds sem talento). Ordenação: `complete` → `recurring` → `builds` → `winMedian` → `key`.
- `observedEmblems`/`observedSpells` ignoram id/nome ausente; nunca preenchem com 0; `share` usa o total de builds observadas.

**Testes mínimos (novos fixtures em `app/web/test/build-manager.test.mjs`):**
1. `applyCandidate` troca item no meio sem mudar o resto.
2. Rejeita 7º item, duplicata e 2ª bota.
3. Rejeita talento de tier diferente e 2º no mesmo tier.
4. `removeSlot` remove item/emblema/talento/feitiço e preserva o resto.
5. `sameAsObserved` é verdadeiro para a base e falso após qualquer troca.
6. `observedTalentSets` conta 2 de 3 builds com o mesmo conjunto e marca `complete`.
7. Conjunto com 2 talentos do mesmo tier não é `complete`.
8. `observedEmblems` agrupa por id e ignora id nulo.
9. `liftPp(0.034)` → `+3.4 pp`; `liftPp(null)` → `—`.
10. `?l=` round-trip: encode/decode preserva o pick; versão errada falha.

### 6.4 Funções existentes que o quadro deve usar (não recriar)

| Função | Uso no quadro | Cuidado |
|---|---|---|
| `scoreCombination` | índice e contribuições | não somar `power`; não chamar de winrate |
| `validatePick` | validação final antes de aplicar | `null` tier (S14) |
| `completionSuggestions` | aba Itens | já exclui `none`/`descriptive` |
| `pickFromObservedBuild` | base | descarta item sem id |
| `signatureOfPick` | status “idêntica/editada” e `?build=` | emblema sem id (S13) |
| `encodeLoadout`/`decodeLoadout` | `?l=` | limite 2048; decode nunca lança |
| `observedEvidence` | bloco de evidência | só `exact` |
| `loadoutHref` | CTA “levar” | mantém rank/window |

---

## 7. Atomic Design — o que se repete vira o quê

### 7.1 Inventário do topo de `/build` (estado atual + quadro)

| Nível | Hoje | No quadro |
|---|---|---|
| **Átomos** | ícone de item, slot 28 px, chip de evidência, texto de delta, barra de cobertura, label 9–10 px, botão | `ComponentThumb`, `SlotFrame`, `EvidenceChip`, `DeltaText`, `IndexMeter`, `ScopeBadge`, `TierSeal`, `IconButton` |
| **Moléculas** | `ItemSlot`, `TalentSlot`, `NamedSlot`, `SuggestionRow`, `IndexBadge`, `IndexComparison` | `ItemSlot`, `TalentSlot`, `EmblemSlot`, `SpellSlot`, `CandidateCard`, `BaseBuildChip`, `ContributionRow`, `TalentComboCard` |
| **Organismos** | `BuildCard`, `IndexComparison`, `Completar` | `BuildBoard`, `BaseBuildSelector`, `IndexPanel`, `CandidateRail` |
| **Templates** | `BuildManager` page | `DecisionBoardTemplate` (2 colunas) + `BuildLoadout` read-only |
| **Página** | `/build` | `/build` |

### 7.2 Candidatos a componente (contagem de ocorrências)

| Candidato | Ocorrências | Onde | Decisão |
|---|---|---|---|
| **`ComponentThumb`** (ícone + fallback + nome) | **7** | `BuildLoadout.tsx:39-60,62-88,90-123`; `BuildManager.tsx:82-90,194-200`; `BuildsPowerPanel.tsx` (linha de item); `BuildsAggregatePanel.tsx:204-232` | **extrair para `shared/ui/primitives/ComponentThumb.tsx`** |
| **`EvidenceChip`** (4 estados) | **8 classes / 4 arquivos** | `BuildManager.tsx:207-214`; `BuildsPowerPanel.tsx:64-70`; `BuildsCombinerPanel.tsx:108-127`; `BuildsAggregatePanel.tsx:33-69` | **extrair**; `StatusSeal` só tem 2 estados (`StatusSeal.tsx:1-4`) |
| **`DeltaText`** (valor + unidade + status) | **4** | `BuildsAggregatePanel.tsx:33-69`; `BuildManager.tsx:145-154`; `BuildsPowerPanel.tsx:202-213`; `Preparar.tsx:211-215` | **extrair com unidade explícita** (`pp` vs fração) |
| **`IndexBadge`/`IndexMeter`** | **2** idênticos + 2 variações | `BuildManager.tsx:50-63`; `BuildsPowerPanel.tsx:49-62`; `BuildManager.tsx:220-251`; `BuildsCombinerPanel.tsx:38-103` | **não extrair ainda** (2 ocorrências); o quadro usa `IndexPanel` local |
| **`SlotFrame`** (moldura de slot) | **3** | `BuildLoadout.tsx:39-60,62-88,90-123` | **feature-local** no quadro; não mexer no `BuildLoadout` |
| **`BaseBuildChip`** | **1** | novo | local; extrair só na 2ª tela |
| **`CandidateCard`** | **1** | novo | local; extrair só na 2ª tela |
| **`ScopeBadge`** | **3 usos no quadro** | novo | local; DS depois |
| **`TalentComboCard`** | **1** | novo | local |
| **`SectionTitle`/`Empty`/`ErrBox`/`Loading`/`FreshLine`/`GhostNote`** | já DS | `shared/ui` | usar, não recriar |
| **`PrimaryAction`** | 1 por página | `PrimaryAction.tsx:8-64` | o CTA do quadro é `Link` próprio; não duplicar o card |

**Regra:** componente só vira shared com **≥3 ocorrências reais**. `ComponentThumb`, `EvidenceChip` e `DeltaText` passam. `IndexBadge` (2) e os novos (1) não passam; ficam locais até a segunda tela.

### 7.3 Gaps do Design System (para `design-system-guardian`)

| Gap | Evidência | Impacto | Proposta |
|---|---|---|---|
| **G-DS-01** — sem chip de evidência de 4 estados | `StatusSeal.tsx:1-4` (2 estados); `EvidenceQualityBadge.tsx:3-20` (qualidade, não evidência); classes duplicadas em 4 arquivos | cada tela inventa cor/rótulo | `EvidenceChip` com `observed/estimated/descriptive/none` |
| **G-DS-02** — sem delta com unidade | `Delta.tsx:4-8` imprime número cru; `DeltaValue` preso em `BuildsAggregatePanel.tsx:33-69` | erro de unidade (S1) se repete | `DeltaText` com `unit: "pp"` ou `"fraction"` e `liftPp` |
| **G-DS-03** — sem slot interativo | `BuildLoadout.tsx:47,71,109` usa 28–32 px; contrato read-only | board precisa de 44 px e foco | `SlotFrame` feature-local; DS só após 2ª tela |
| **G-DS-04** — sem leitura de índice | `IndexBadge` duplicado (`BuildManager.tsx:50`, `BuildsPowerPanel.tsx:49`) | drift de rótulo/barra | `IndexMeter` shared quando houver 3 usos |
| **G-DS-05** — sem badge de escopo de dado | `ScopeChip` é sobre padrão cross-hero (`BuildsAggregatePanel.tsx:84-101`), não sobre “herói vs lane” | S11 invisível | `ScopeBadge` local; DS depois |
| **G-DS-06** — sem slots de talento por tier | `BuildLoadout.tsx:62-64,158-161` mapeia por índice | T1/T2/T3 errados | helper `talentSlots`; não alterar contrato |
| **G-DS-07** — sem helper canônico de lift | `format.ts:23-30` só tem `signed`; 3 telas formatam diferente (`BuildManager.tsx:153`; `BuildsSection.tsx:21,214,303`; `Preparar.tsx:213`) | 100× de erro | `liftPp` + teste |
| **G-DS-08** — `PrimaryAction` é card, não botão | `PrimaryAction.tsx:8-64` | CTA do board não se encaixa | manter CTA local; não forçar |

---

## 8. Refactoring UI — fricções e oportunidades

### 8.1 Hierarquia

**Achado:** o índice só aparece em 2º plano (badge de 118 px no rodapé do card, `BuildManager.tsx:50-63`) e a comparação fica dentro do bloco “Completar” (`220-251`). O olho cai em 4 títulos de seção antes de saber “qual é o meu número”.

**Oportunidade:** um número 28–32 px no painel C, com delta e uma linha de fórmula. O resto vira contexto. **Esforço P–M · risco baixo.**

### 8.2 Espaçamento

**Achado:** `p-3.5` e `gap-2.5` repetidos em quase todos os cards (`BuildManager.tsx:101,191,537,600,629`); a distância entre seções é a mesma do interior dos cards. Não há ritmo vertical.

**Oportunidade:** escala 8/16/24/32; seções com 32 px, cards com 16 px, chips com 8 px. **Esforço P · risco baixo.**

### 8.3 Tipografia

**Achado:** rótulos em 9–10 px (`BuildManager.tsx:120,125,204,241,624`), evidência em 9 px (`207-214`), corpo em 11 px (`651-656`). Em mobile, 9 px é abaixo do legível.

**Oportunidade:** corpo 12–13 px, rótulos 11 px, número 28–32 px; tabular nos números. **Esforço P · risco baixo.**

### 8.4 Cor (o achado mais importante)

**Achado:** esmeralda significa **observado** (`BuildManager.tsx:209-211`), **lift positivo** (`149-151`), **build completa** (`579`) e **sucesso** (`635`). Dourado significa **índice** (`56`), **seleção** (`130`), **lane ativa** (`483`), **CTA** (`680`) e **ícone de seção** (`681`). A mesma cor carrega 3–4 significados.

**Oportunidade:** tokens semânticos separados:

| Token | Uso | Não usar para |
|---|---|---|
| `--index` (dourado) | número do índice, seleção de base | “positivo” |
| `--observed` (esmeralda) | evidência observada | lift positivo |
| `--estimated` (âmbar) | evidência estimada | alerta genérico |
| `--descriptive` (azul) | emblema/descritivo | “informação” |
| `--positive` / `--negative` | sinal do delta (com ▲/▼) | evidência |
| `--neutral` | sem dado/sem contraste | erro |

**Esforço M · risco médio** (mexe em 4 telas se for global; no board, local primeiro).

### 8.5 Alinhamento e feedback

- `IndexBadge` dentro de `flex-wrap` (`BuildManager.tsx:144-159`) quebra em larguras intermediárias; o número sai do lugar. **Corrigir com grid.**
- Não há feedback de “salvo” na edição; o `?l=` é invisível. **Adicionar “link atualizado”/“editada”**.
- Não há undo; remover item é destrutivo. **Toast “desfazer” (P1)**.
- `SuggestionRow` inteiro é botão (`BuildManager.tsx:188-217`); bom para touch, mas o ícone `+` não é independente. No board, o card tem ação explícita.

### 8.6 Oportunidades ranqueadas

| # | Oportunidade | Esforço | Risco | Impacto |
|---|---|---|---|---|
| R1 | Corrigir unidade do lift + os 3 estados | **P** | baixo | altíssimo (honestidade) |
| R2 | Substituir “em aberto”/“cobertura” por vocabulário único | **P** | baixo | alto |
| R3 | Board com um índice em foco | **G** | médio | altíssimo |
| R4 | Slots + pickers tipados | **G** | médio | altíssimo |
| R5 | Combinação observada de talentos | **M** | baixo | alto |
| R6 | Emblema “descritivo · não soma” | **P** | baixo | alto |
| R7 | `?l=` persistente + reset | **M** | médio | alto |
| R8 | Trilha de candidatos com evidência | **M** | médio | alto |
| R9 | Sticky index no mobile | **M** | baixo | médio |
| R10 | Extrair `ComponentThumb`/`EvidenceChip`/`DeltaText` | **M** | médio | médio (dívida) |

---

## 9. Convergências, ondas e vereditos

### 9.1 Onde as 4 lentes apontam o mesmo problema

| Convergência | OOUX | JTBD | Atomic | Refactoring UI | Consequência |
|---|---|---|---|---|---|
| **C1 — falta o objeto “Composição”** | objeto sem casa | J5/J6/J11 não atendem | `BuildLoadout` read-only | índice sem foco | board é a prioridade |
| **C2 — vocabulário de evidência inconsistente** | H4/H5/H6 | J9 | 8 classes duplicadas | cor semântica ambígua | um `EvidenceChip` + legenda |
| **C3 — escopo invisível** | H1/H8 | J9/J12 | sem badge | hierarquia plana | `ScopeBadge` + copy |
| **C4 — unidade do lift quebrada** | atributo sem unidade | J2 | 3 formatações | número ilegível | helper + teste antes do pixel |
| **C5 — read-only vs editável** | Slot sem casa | J5 | contrato de 6 render sites | touch 28 px | board novo, `BuildLoadout` intacto |
| **C6 — denominador não explicado** | Índice sem casa única | J9/J12 | `IndexBadge` duplicado | “cobertura” enganosa | painel C com fórmula e contagens |

### 9.2 Ondas

| Onda | Conteúdo | Gate |
|---|---|---|
| **0 · Higiene** | `liftPp`; 3 estados do lift; vocabulário; `applyCandidate`; corrigir `?build=` obsoleto; ler `?top=`; labels de escopo | testes puros verdes; zero mudança visual grande |
| **1 · Board MVP** | `BuildBoard`, slots, base chips, índice, reset, `?l=`; bind do Completar | J5/J11/J12 verdes; F5 preserva |
| **2 · Candidatos** | 4 abas; combinação de talentos; emblema/feitiço; pickers | J6/J7/J8 verdes; zero “recomendado” |
| **3 · DS** | `ComponentThumb`, `EvidenceChip`, `DeltaText`; migrar 3 telas | ≥3 ocorrências; sem regressão |
| **4 · Depois** | runa page, cenários lado a lado, share/preset, undo | L2/L3 conforme risco |

### 9.3 Vereditos por tela

| Tela | Veredito | Justificativa |
|---|---|---|
| `/build` topo | **Reorganizar** | quadro substitui a seção 2; Núcleo e Completar ficam |
| `/builds?view=power` | **Manter** | lift já em pp (`BuildsPowerPanel.tsx:95,204-212`); migrar `IndexBadge` depois |
| `/builds?view=combiner` | **Manter** | fonte de `validatePick` e contribuições; link “abrir no combinador” preservado |
| `/builds` agregado | **Manter** | absorver só links/estatísticas de emblema/talento/feitiço; não embutir |
| `/preparar` | **Manter** | recebe `?l=`; corrigir lift em onda 0/3 |
| Ficha do herói (`BuildsSection`) | **Manter** | CTA para o board; corrigir lift em onda 0/3 |
| `BuildLoadout` | **Manter contrato** | 6 pontos de render em 5 telas; bug de tier documentado, não corrigido no MVP |

### 9.4 MVP vs depois

| Prioridade | Entrega | Por quê |
|---|---|---|
| **P0 (MVP)** | Onda 0 + board shell + 4 slots + índice + base chips + reset + `?l=` + talento observado + emblema honesto | atende J5/J6/J9/J2/J12 |
| **P1** | 4 abas completas, busca/filtro, undo, sticky mobile, “copiar link” | completa J7/J8/J10/J11 |
| **P2** | runa page, comparação de 2 cenários, presets, “montar por peso” rotulado | encaixe, não decisão |
| **Fora** | endpoint novo, recomendação com score, previsão, persistência por usuário, sinergia de time, mudar `BuildLoadout` | L3 / escopo |

### 9.5 O que absorver de cada tela (sem import cruzado)

| Tela | Absorver | Não absorver |
|---|---|---|
| `BuildsPowerPanel` | seletor de item por build, chips de extras, detalhe de contribuições | modal complexo, ordenações |
| `BuildsCombinerPanel` | `validatePick`, pickers por tier, hidratação `?l=`, linhas de contribuição | layout de página inteira |
| `BuildsAggregatePanel` | estatísticas de emblema/talento/feitiço, chips de escopo, “sem diferença relevante” | embutir os painéis lane-wide |
| `Preparar` | bloco de evidência observada e `matchLoadout` | fluxo de preparação |
| `BuildsSection` | fórmula do lift e KPI | gráfico/barra |
| `BuildLoadout` | layout de 4 grupos para preview read-only | edição; slots de 28 px |
| `HeroDossier` | header do herói | — |

**Regra de fronteira:** `features/build-manager` não importa de `features/builds`; o que for reutilizável sobe para `shared/ui` ou `shared/domain`. `shared` não importa feature.

---

## 10. Riscos (honestidade e complexidade)

### 10.1 Honestidade

| Risco | Como aparece | Mitigação |
|---|---|---|
| **Índice lido como winrate** | número grande, sem sufixo | “índice relativo” colado ao número; fórmula no painel; disclaimer fora do `<details>` |
| **“Sugestão” vira recomendação** | “sugerimos este item” | “candidato”; “aparece em X% das builds”; nunca “melhor” |
| **Emblema parece somar** | cobertura cai, índice não muda | “descritivo · não soma”; contagens separadas; sem barra única |
| **Evidência observada vaza para edição** | win/lift da base ao lado da composição editada | `sameAsObserved`; se falso, “lift da base”, não “da sua versão” |
| **Escopo lane vs herói** | pesos lane-wide ao lado de builds do herói | `ScopeBadge`; “lane · top-10” no painel e nos candidatos |
| **Unidade do lift** | +0,03 pp em vez de +3,4 pp | `liftPp` + teste; 3 estados |
| **Combinação sintética** | “melhor por tier” vira “observada” | só conjuntos exatos; se sintetizar, rotular “montada por peso (não observada)” |
| **Denominador** | usuário espera soma de pesos | “adicionar muda a média”; mostrar pontos + valor |

### 10.2 Complexidade

| Risco | Sinal | Mitigação |
|---|---|---|
| **4 pickers + validação + URL + mobile** | muito estado em um componente | container fino; board presentacional; lógica pura testada |
| **Duplicação com Completar** | dois estados de `added` | um único `pick`; Completar recebe `onApply` |
| **`BuildLoadout` acoplado** | tentação de editar o pattern | board próprio; pattern intocado |
| **Performance** | `scoreCombination` por render | memo por `signatureOfPick` |
| **Acessibilidade** | slots pequenos, picker sem foco | 44 px, dialog com focus trap, `aria-live` |
| **Escopo do MVP** | querer runa page e cenários no dia 1 | ondas; P0 só J5/J6/J9/J2/J12 |

### 10.3 Copy — antes e depois

| Contexto | Hoje | Proposta |
|---|---|---|
| Lift | `+0.03 pp vs mais usada` (`BuildManager.tsx:153`) | `+3.4 pp vs mais usada` |
| Lift pequeno | número mutado, sem rótulo (`:147-153`) | `+1.8 pp · sem diferença relevante vs mais usada` |
| Lift ausente | `lift em aberto` | `sem referência para lift` |
| Cobertura | `cobertura 75%` (`:241-244`) | `6 de 8 componentes com peso` |
| Emblema | “peso descritivo” | `descritivo · não entra no índice` |
| Índice | “índice” sozinho | `índice relativo` |
| Build | “build do sistema” (`:553`) | `build observada` |
| Janela | `7d` no header, sem qualificador | `7d no agregado · builds sem recorte de tempo` |
| Composição | “build” | `sua composição` |
| Sugestão | “sugestões” (`:575`) | `candidatos` |
| Talento | “melhor combinação” (hipótese) | `combinação observada em 2 de 3 builds` |

---

## 11. Critérios de aceite do quadro

1. Com herói + lane + `combiner`, o quadro mostra composição, índice, delta e contagens.
2. Chips de base mostram win, pick e lift **em pp**; `|liftPp| < 2` → “sem diferença relevante”; `null` → “sem referência”.
3. Selecionar base grava `?build=`, remove `?l=`, zera edição e mostra evidência observada.
4. Editar qualquer slot grava `?l=`, marca “editada”, **esconde** win/pick/lift observados e recalcula o índice no mesmo render.
5. F5 restaura a composição de `?l=`; `l` inválido é ignorado com aviso e a base volta.
6. Regras: 6 itens, sem duplicata, 1 bota, 3 talentos, 1 por tier; tentativa inválida não muda o estado e explica o motivo.
7. Aba Talentos mostra uma combinação observada completa quando existe; “usar esta combinação” preenche T1/T2/T3 em 1 ação; se não existe, diz isso e não sintetiza.
8. Emblema não altera o índice; o painel diz “descritivo · não soma” e separa “com peso” de “descritivo”.
9. Todo candidato mostra evidência, valor (ou “sem contraste”) e adoção; `none` nunca aparece como positivo.
10. “Voltar à base” restaura a base em 1 clique e remove `?l=`.
11. Mobile: slots ≥44 px; picker é dialog com foco, ESC/backdrop e retorno de foco; índice visível sem scroll horizontal.
12. Nenhum endpoint novo; só `useBuilds`/`useBuildsAggregate`; nenhum import feature→feature; `BuildLoadout` intacto; Núcleo intacto; Completar lê o mesmo `pick`.
13. `/preparar?l=` recebe a composição editada com `provenance: "custom"` e `observedItems` da base.
14. Testes puros de `applyCandidate`, `removeSlot`, `sameAsObserved`, `observedTalentSets`, `observedEmblems`, `observedSpells` e `liftPp` passam; typecheck/build verdes.

---

## Handoff

### Para `ux-designer` — fluxos e estados

1. **Fluxo “montar a partir da base”:** abrir `/build` → escolher base → ver composição → trocar 1 item → ver delta → trocar talento → ver delta → resetar. Desenhe o caminho mais curto e o “voltar” em cada passo.
2. **Fluxo “trocar sem perder”:** slot cheio → picker do slot → escolher substituto → confirmação implícita (sem modal) → toast “Item X trocado; desfazer”.
3. **Fluxo “combinação de talentos”:** aba Talentos → card “combinação observada em N builds” → “usar esta combinação” → 3 slots preenchidos → índice atualizado. Se não houver combinação completa, mostre por tier e diga por quê.
4. **Fluxo “emblema”:** aba Emblema → card com “descritivo · não soma” → selecionar → índice **não muda** → contagem “1 descritivo” aparece. O usuário não pode achar que falhou.
5. **Fluxo “compartilhar/levar”:** “copiar link” → URL com `l`; “levar para preparação” → `/preparar?l=`. Link inválido → base + aviso.
6. **Estados:** `no-hero`, `needs-lane`, `builds-loading`, `builds-error`, `builds-empty`, `aggregate-loading`, `aggregate-error`, `ready`, `editing`, `full`, `no-combo`, `no-emblem-id`, `stale-build`, `invalid-l`. Para cada um: o que aparece, o que desabilita, como sai.
7. **Acessibilidade:** ordem de foco, `aria-live` do índice, dialog do picker, remoção por teclado, 44 px.
8. **Não fazer:** não desenhar “recomendado”, não somar emblema, não mostrar winrate da composição editada, não criar tela nova.

### Para `ui-designer` — especificação visual

1. **Zonas A–D** conforme §5.3; no desktop, B/C lado a lado (1.6fr/1fr); no mobile, C vira strip sticky.
2. **Slots:** 48 px desktop / 44 px mobile; moldura 1 px `line`; vazio tracejado; foco 2 px `gold`; ícone 32–36 px; tooltip com nome.
3. **Tipografia:** índice 28–32 px/900; delta 14–16 px/700; corpo 12–13 px; rótulos 11 px; nada abaixo de 11 px no board.
4. **Cores semânticas:** tabela §8.4. Dourado = índice/seleção; esmeralda = observado; âmbar = estimado; azul = descritivo; neutro = sem contraste; positivo/negativo só no delta.
5. **Chips de evidência:** 4 variantes com texto (nunca só cor); `observed` esmeralda, `estimated` âmbar, `descriptive` azul, `none` neutro.
6. **Painel C:** número + delta + duas linhas de contagem + lista de contribuições; fórmula em 1 linha; disclaimer sempre visível.
7. **Candidatos:** card com ícone 36 px, nome 13 px, linha de evidência 11 px, ação 44 px; 2–3 colunas desktop, 1 mobile.
8. **Estados vazios:** usar `Empty`/`GhostNote`; nunca “0” no lugar de “—”; “sem contraste no recorte” ≠ “sem dado”.
9. **Não fazer:** não usar `BuildLoadout` como editor; não usar 28 px; não usar a mesma cor para observado e positivo; não esconder o índice em `<details>`.

### Para `design-system-guardian` — gaps acionáveis

- `ComponentThumb` (7 ocorrências), `EvidenceChip` (8 classes/4 arquivos), `DeltaText` (4 implementações) são os únicos candidatos com lastro para shared.
- `IndexBadge` tem 2 ocorrências: **não** extrair ainda.
- `BuildLoadout` tem 6 pontos de render em 5 telas: **não alterar contrato**; o bug de tier (`62-64,158-161`) fica documentado para onda 3.
- `liftPp` deve nascer em `shared/format.ts` e ser usado por `/build`, `/preparar` e ficha na onda 0/3.
- `ScopeBadge` e `SlotFrame` ficam feature-local até a 2ª tela.

### Para `domain-modeler` — objetos que viram modelo

- **Composição** é o agregado editável; **Slot** é entidade interna tipada; **Build observada** é read-only e não vira agregado mutável.
- Invariantes: 6 itens, 1 bota, 3 talentos, 1 por tier, 1 emblema, 1 feitiço; emblema descritivo; evidência observada só em `exact`.
- **Não criar** objeto “Recomendação”; candidato é oferta com evidência, não comando.

### Para `frontend-architect` — limites

- Board em `features/build-manager/components/`; lógica pura em `shared/domain/buildManager.ts`; nenhum import `features/builds` → `features/build-manager`.
- `BuildManager` continua dono de URL/hooks; o board recebe props e devolve intenções (`onApply`, `onRemove`, `onReset`, `onSelectBase`).
- `?l=` com `setSp(..., { replace: true })`; `?build=` com `replace`; limpar `l` ao trocar recorte.
- Sem endpoint novo; sem mudança em `BuildLoadout`; sem mudança no bloco Núcleo; Completar só muda de fonte de estado.
