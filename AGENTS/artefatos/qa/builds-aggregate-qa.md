# Builds agregada — QA de produto, métricas honestas e orçamento de API

Data: 2026-10-20 · Dono: QA (produto + viabilidade) · Status: especificação, sem código de produção
Escopo: página `/builds` **agregada** (visão de sistema), distinta da aba do dashboard e da ficha por herói.
Base consultada: `https://arena.fastapicloud.dev/api` · 14 chamadas, todas 200, sem 429.

---

## 0. Sumário executivo

1. **Pro-player e admin não podem compartilhar a mesma lista.** Pro decide *dentro de um contexto* (herói+lane+rank): qual das 3 builds praticar, qual variante de emblema/talento testar. Admin decide *entre contextos*: qual item/pacote está forte, qual arquétipo domina, qual runa é onipresente. A página precisa de **duas superfícies com unidades diferentes**, não de um ranking único.
2. **O agregado é viável e barato no caminho quente**: top-10 de uma lane = **17 requests frios** (~4,5 s a 4 concorrentes), **0 no quente**. O que mata é burst: lane completa em 5 lanes = **172 requests**, e a rota existente `/heroes/lanes` custa **133 requests** — é o P0 de rate limit, não o agregado.
3. **"Item forte" é, na prática, "pacote forte".** Os 3 itens de uma build da Academy são itens finais (Windtalker, Berserker's Fury, Haas' Claws), mas aparecem **sempre juntos**. Sem detectar colinearidade, o admin nerfa o item errado. A página deve agrupar itens inseparáveis antes de ranquear.
4. **A maior parte do sinal é ruído.** Miya gold tem 3 builds com **os mesmos 3 itens**, diferindo só na ordem; win 56,07% vs 56,51% (**0,44 pp**). Isso está abaixo de `PRACTICAL_DELTA = 0,02`. Qualquer ordenação por lift sem silenciar <2 pp vira alucinação.
5. **Pro não é "6 itens sempre", nem tem id de herói.** No jogo amostrado: 16/20 player-games com 6 itens, 3 com 5, 1 com 4; herói vem só por **nome**; item só com `id`+`image` (string); emblema só com `id`. Ingestão precisa normalizar e nunca dar join fuzzy.

### 0.1 Correções/refinamentos ao brief (verificados agora)

| # | Fato verificado | Impacto |
|---|---|---|
| C1 | Esports: inventário final é **4–6 itens** (16×6, 3×5, 1×4 em 20 player-games), não sempre 6 | Métrica pro normaliza por player-games com ≥4 itens; não imputar slot vazio |
| C2 | Esports: shape é `games[].teams[].players[]`; `hero` = `{name,image}` **sem id**; item = `{id:string,image}` sem nome; emblema = `{id,image}` sem nome | Join por nome (herói) e por id (item/emblema); risco de mismatch |
| C3 | Todos os **19 ids de talento** observados em 20 player-games existem no catálogo de 26 (`811,721,731,511,122,531,821,631,311,112,132,131,321,111,331,711,611,121,521`) | Camada de talentos do pro é 100% decodificável com 1 request de catálogo |
| C4 | `20012` = **Marksman** (`+15% AS, +16 Adaptive Attack, +5% Lifesteal`), colhido de build Miya gold; os outros 6 ids (20001/20003/20005/20006/20007/20008) seguem sem nome | Mapa de emblema é **colhível das builds**, não precisa de endpoint novo; até lá, `#id` |
| C5 | Os 3 itens da build Academy são **itens finais**, não componentes (3005 Windtalker, 3003 Berserker's Fury, 3002 Haas' Claws) | "Conjunto de 3 itens" é um **núcleo parcial válido** (3–4 de 6 slots), não caminho de componentes |
| C6 | Miya gold: 3 builds, mesmos 3 itens, ordens diferentes (3005+3003+3002 vs 3005+3002+3003), mesmo emblema e mesmos talentos | Exemplo canônico de "variante do mesmo core"; exige corte de 2 pp |
| C7 | `equipment/expanded`: 152 itens; **7 sem `equiptips`**; 8 do tipo Attack sem "Physical ATK" explícito; **nenhum Attack com "Magic Power"** | Classificação por arquétipo precisa de fallback por palavras-chave + estado "não classificado" |
| C8 | `heroes/positions` traz 133 heróis com **nome** e lanes (Exp 42, Mid 29, Roam 37, Jungle 36, Gold 21) em **1 request** | Elimina `/heroes/lanes` (133 requests) e não precisa de `/catalog` só para nomes |
| C9 | Esports schedule: `{weeks[].days[].matches[]}`; 72 partidas, **70 com `match_id`** | Ingestão: 1 + 70; 2 partidas ficam sem dados, declaradas |
| C10 | Soma de pick das 3 builds de Miya = **25,9%** | `pick` não soma 1 nem cobre o universo; nunca normalizar para 100% nem chamar de cobertura de partidas |

---

## 0.1 Fonte canônica (2026-10-21)

As fórmulas e o contrato estão em `AGENTS/artefatos/spec/builds-aggregate-engine-rules.md`.
Os textos da tela, a tradução de jargão e os estados vazios estão em
`AGENTS/artefatos/spec/builds-aggregate-ui-copy.md`. O QA abaixo continua como
histórico de produto; em conflito, valem os dois arquivos de spec.

## 0.2 Revisão 2026-10-21 — decisões incorporadas

Status: implementado. O cálculo agregado saiu de `apps/api/src/builds-aggregate.js` e agora vive em
`packages/proprietary-engine/src/builds/builds-aggregate.js`, exportado por `@radar/proprietary-engine`.
A rota usa o motor e o cache foi promovido para `builds:agg:v3:*` para não servir corpos v1/v2 (sem `emblems` e sem força composta).

| # | Decisão | Implementação |
|---|---|---|
| P0-1 | `lift` não é razão; a diferença observada é pontos percentuais | Campos públicos `delta_wr_pp_*` (0–100); `PRACTICAL_DELTA_PP = 2`; `lift` fica reservado semanticamente para razão. O `buildLift.lift_raw` existente não foi reutilizado no contrato agregado. |
| P0-2 | Pacote com suporte minúsculo não é “inseparável consolidado” | Pacote só entra em `packages` com `k>=3` e `m>=5`; coocorrência menor vira `packages_provisional` com `inseparable:false`, `inseparable_observed:true` e `discovery_status:"provisional"`. |
| P1-3 | Peso de pick é hipótese, não verdade | Todo item/pacote/conjunto/runa publica `delta_wr_pp_median` (weighted) e `delta_wr_pp_unweighted_median`; `weighting_sensitivity` ∈ `stable`, `large_shift`, `sign_flip`, `unknown`; contagem em `coverage.weighting_sensitivity_counts`. |
| P1-4 | Combinação de um herói não é padrão global | `pattern_scope` ∈ `cross_hero` (h>=3), `two_heroes` (h==2), `single_hero` (h==1); `discovery_status` ∈ `consolidated`, `emerging`, `local`, `provisional`. A UI rotula “local · 1 herói” separadamente. |
| P1-5 | Resposta parcial em JSON agregado | HTTP `200` com `partial:true` e status por célula; `206` não é mais usado na rota. Teste de rota cobre corpo parcial em cache. |
| P1-6 | Emblema precisa de leitura própria, não só de runa page | `emblems` agrega por `emblemid` com suporte `k>=3`/`m>=5`, `win_median`, `delta_wr_pp_median` e `emblems_insufficient` abaixo do mínimo. A UI ganha a seção 2c · Emblemas. |
| P1-7 | Força da combinação é produto, não winrate | `combination_strength = wrAdj × win_build × win_median_emblema`; índice público = `100 ×` produto. Sem emblema suportado, ambos ficam `null` e a UI mostra “Poucos dados”. |

### 0.3 Ordem do MVP (UI)

1. **Descobertas**: trincas (`triples`) e pacotes recorrentes, com cobertura, suporte e escopo.
2. **Itens e arquétipos**: ataque físico, ataque mágico, defesa física, defesa mágica + bloco separado de híbridos, utilitários e não classificados.
3. **Desempenho observado e variantes**: `delta_wr_pp` vs referência/modal, silenciando <2 pp, sem afirmar significância.
4. **Emblemas, talentos e feitiços**: camada complementar.
5. **Dados profissionais — fase 2**: B6 (Pro MPL) e B7 (sinergia par-a-par), com `population=pro` ainda retornando 400.

### 0.4 Contrato público adicional

- `triples`, `triples_total`, `discovery_summary`
- `packages` (suportados) e `packages_provisional` (coocorrência observada), `packages_ok`, `packages_provisional_count`
- `sets_summary` com `consolidated` / `emerging` / `local` e `by_scope`
- `metrics` com unidade, limiar prático, semântica de `lift`, hipótese de peso e definição dos rótulos

## 1. Jobs-to-be-done

### 1.1 Pro-player / coach

| Decisão concreta | Pergunta na tela | O que a tela entrega | O que a tela NÃO responde |
|---|---|---|---|
| **Preparar a lane para a próxima série** | "No meu herói e lane, qual das 3 builds catalogadas eu levo para o scrim?" | Builds do herói+lane com win, pick, lift vs referência, núcleo de itens, emblema, 3 talentos, feitiço; diff vs a mais usada | Se a build é ótima; quantas partidas a sustentam; se ganha por causa dos itens |
| **Escolher variante, não núcleo** | "Mesmo núcleo, emblema/talento/ordem diferentes: alguma variante é melhor?" | Agrupamento core → variantes; Δwin/Δpick; silêncio quando |Δ| < 2 pp | Qual variante é "a correta"; ordem de compra |
| **Fazer homework de oponente** | "Quais núcleos de 3 itens os melhores heróis da minha lane compartilham?" | Conjuntos por arquétipo com cobertura (k heróis, m builds) e heróis que usam | Frequência real de compra; matchup específico |
| **Testar uma descoberta** | "Vale testar a variante pouco usada com lift positivo?" | Tag `emergente` (pick < 2% e lift > 1,5 pp), com aviso de amostra | Se é bom; se vai performar no meu time |
| **Sair da tela para a ficha** | "Onde vejo a prova completa desse herói?" | Link contextualizado (herói+rank+lane) para a ficha | — |

**Trabalho emocional/operacional:** o pro precisa de *confiança no rótulo*. Se a tela disser "melhor build" e ele levar para o treino, o custo do erro é alto. O produto deve parecer um **caderno de hipóteses**, não um oráculo.

### 1.2 Admin do jogo (balance / live ops / design)

| Decisão concreta | Pergunta na tela | O que a tela entrega | O que a tela NÃO responde |
|---|---|---|---|
| **Triagem de nerf/buff** | "Qual item ou pacote está associado a win acima do baseline do herói, com adoção relevante?" | Ranking de **pacotes** (itens inseparáveis agrupados) por lift mediano entre contextos, com k contextos e m builds | Quanto nerfar; causalidade; N de partidas |
| **Ler arquétipos** | "Como estão os conjuntos de ataque físico, ataque mágico, defesa física e defesa mágica?" | 4 blocos de conjuntos com composição, cobertura e lift; itens fora dos 4 arquétipos em bucket próprio | Se o conjunto é ótimo; se é viável em outro elo |
| **Detectar onipresença** | "Qual emblema/talento/feitiço domina a lane?" | Adoção por lane + lift; runa page (emblema + 3 talentos) como unidade | Se o domínio é por força ou por hábito |
| **Achar item morto / armadilha** | "O que é construído e não performa? O que não é construído?" | Quadrante adoção × lift; lista de itens com 0 builds no recorte | Se o item é ruim ou situacional |
| **Comparar pro vs ranked** | "Os pros constroem diferente do ranked?" | Aba pro separada: inventário final, presença, eficiência dano/ouro | Se a diferença é causal ou de composição |
| **Priorizar investigação** | "Onde eu olho primeiro?" | Cobertura + gaps explícitos (itens sem catálogo, contextos insuficientes) | Resposta definitiva de balance |

**Trabalho político:** o admin precisa **defender** a decisão. Por isso todo número tem de vir com unidade, suporte e confundidor. Um número sem "k contextos / m builds" é inutilizável numa reunião de balance.

### 1.3 Tensão de design (não resolvida por UI)

| Dimensão | Pro | Admin |
|---|---|---|
| Unidade | herói+lane (contexto) | item/pacote/arquétipo (cross-contexto) |
| Ordenação | dentro do contexto, por lift | por cobertura, depois lift |
| Suporte | 3 builds do herói | k contextos ≥ 3 |
| Erro aceitável | "não sei" é ok | "não sei" é ok, mas precisa de gap visível |
| O que nunca pode | ranquear heróis diferentes como "melhor build" | atribuir a um item o que é do pacote |

**Regra de ouro:** a página tem **duas abas ou duas dobras** (Ranked / Pro) e, dentro de Ranked, **dois níveis**: sistema (item/pacote) e contexto (herói+lane). Nunca misturar no mesmo eixo.

---

## 2. Blueprint da tela

### 2.1 Ordem dos blocos

Ordem: **contexto → sistema → arquétipo → runa/feitiço → variantes → contexto de novo → pro**. Cada bloco estreita o escopo; o usuário nunca precisa voltar ao topo para saber o que está vendo.

| # | Bloco | Pergunta | Fonte | Suporte exibido | Fase |
|---|---|---|---|---|---|
| B0 | **Faixa de contexto e cobertura** (não é card) | "Sobre o que estou olhando e quanto disso eu vi?" | agregado + cache | heróis com builds / heróis da lane; builds; contextos; idade; patch | MVP |
| B1 | **Força de item (por pacote)** | "Quais itens/pacotes estão acima do baseline do próprio contexto?" | builds fan-out + equipment expanded | k contextos, m builds, heróis; selo "pacote inseparável" | MVP |
| B2 | **Conjuntos por arquétipo** | "Como são os núcleos de ataque físico, ataque mágico, defesa física e defesa mágica — e estão ganhando?" | builds + classificação | k heróis, m builds, lift mediano; "núcleo parcial 3–4/6" | MVP |
| B3 | **Emblemas, talentos e feitiços** | "Qual página de runa/feitiço é padrão e qual desvio paga?" | builds + emblems + spells | adoção, lift, n builds/contextos; emblema desconhecido = `#id` | MVP |
| B4 | **Core vs variantes** | "Mesmos itens, setup diferente: muda algo?" | builds (client-side) | variantes do core, Δwin/Δpick, silêncio <2 pp | MVP |
| B5 | **Top builds por lane (ponte)** | "O que eu abro na ficha?" | rank list + builds | X/N com builds; θ̂ do herói; link para ficha | MVP |
| B6 | **Pro MPL — inventário final** | "Como os pros terminam a partida e com que eficiência?" | esports schedule + matches | player-games, partidas, itens 4–6; população `pro` | Fase 2 |
| B7 | **Sinergia par-a-par** | "Quais itens andam juntos além do acaso?" | builds/pro | n_both, n_rest, Δ ajustado; aviso de não identificável | Fase 2 |

**Por que B1 antes de B2:** o admin quer triagem rápida; B1 é a lista mais curta e acionável. B2 explica *por que* B1 está daquele jeito (composição). B3 é a camada de runa, que o pro usa para fechar a decisão. B4 só faz sentido depois de ver o núcleo. B5 fecha com o contexto jogável.

### 2.2 Estados por bloco

| Bloco | Loading | Vazio (motivo específico) | Erro | Stale |
|---|---|---|---|---|
| B0 | skeleton de 1 linha, sem shift | "sem lane selecionada — 0 requests de builds" | "cobertura indisponível; mostrando última coleta" | badge "há Xh" + `stale:true` |
| B1 | 5 linhas skeleton | "nenhum item com k≥3 contextos e m≥5 builds neste recorte" + contagens | banner parcial "3 de 10 heróis falharam"; tabela segue com os 7 | opacity + selo |
| B2 | 4 cards skeleton | por arquétipo: "nenhum conjunto com k≥2 ou m≥3"; nunca card vazio genérico | idem B1, por arquétipo | selo |
| B3 | 3 listas skeleton | "sem runa page com suporte ≥3 builds"; "emblema #20003 sem nome catalogado" | idem | selo |
| B4 | 1 card skeleton | "3 builds = 1 core; sem variantes de núcleo" | "herói sem builds nesta lane" | selo |
| B5 | X/N progressivo | "lane sem builds catalogadas" | célula de erro por herói, não página | selo |
| B6 | "ingestão em andamento / última há Xh" | "ingestão ainda não executada" (não é erro) | "fonte pro indisponível; dados de Xh" | selo + população |
| B7 | lista skeleton | "pares inseparáveis (P(j\|i)≥0,8): sinergia não identificável" | idem | selo |

**Regra de erro:** falha de um herói **nunca** derruba a página. Resposta agregada deve ser `206 partial` com `cells[].status`. Hoje `/v1/heroes/:id/builds` devolve **502** tanto para upstream fora quanto para "sem builds na lane" (`no_builds_for_lane` também 502) — o agregado precisa **separar** `empty` de `error` antes de fan-out.

### 2.3 O que NÃO entra (e por quê)

| Não entra | Motivo |
|---|---|
| "Melhor build do jogo" | Builds de heróis diferentes não são comparáveis; referência é interna ao herói+lane |
| Ranking global de item sem lane/rank | Simpson: item só aparece em heróis de baseline alto |
| "Win rate do item" poolado | Todos os itens do núcleo compartilham o win da build; é win do contexto, não do item |
| Ordem de compra / "primeiro item" | Ordem do array não documentada; `item_sequence` do pro vem vazio |
| Build completa de 6 slots a partir da Academy | Só existem 3–4 itens por build |
| N de partidas / IC por build | Fonte não publica N; `pick` é participação não validada |
| Lift causal / "este item ganha jogos" | Camada A; `lift_adjusted` e `causal_build_lift` são NULL |
| Pro + ranked na mesma média | Populações diferentes (MPL vs ranked); exigem rótulo e separação |
| UGC `/recommended` | Guia de comunidade, não evidência estatística |
| Tier list de feitiço sem lane | Feitiço é escolha de matchup/lane |
| "Counter de item" | Não há dado item × matchup |
| Tendência temporal de build | Não persistimos histórico de builds; cache 24h não é série |
| "Emblema completo" com talentos inventados | Só exibimos set + atributos observados + os 3 talentos que vieram na build |
| Preço/ouro por item, dano por item | Catálogo não tem preço; pro tem ouro total e dano total, não por item |

### 2.4 Copy obrigatória (não opcional)

- `Núcleo parcial · 3 de 6 slots` em todo conjunto vindo da Academy.
- `Associação descritiva (Camada A) · não causal` no cabeçalho de B1/B2/B7.
- `Participação catalogada: 25,9% — não é cobertura de partidas` quando exibir soma de pick.
- `Amostra insuficiente: k=2 contextos, m=3 builds` em vez de número.
- `Pacote inseparável: Windtalker + Berserker's Fury + Haas' Claws` em vez de 3 linhas de item.
- `Pro (MPL ID) · população separada · 20 player-games` na B6.

---

## 3. Matriz de capacidade da API

### 3.1 Endpoints

| Endpoint | Campos usados | Cache | Custo | Cobertura observada | Gap / risco |
|---|---|---|---|---|---|
| `GET /academy/heroes/{id}/builds?lane=&rank=&size=6&index=1` | `build[]`: `equipid[]` (3–4), `build_win_rate`, `build_pick_rate`, `emblem.data.{emblemid,emblemname,emblemattr.emblemattr}`, `battleskill.data.{skillname,skillicon}`, `runeid`, `new_rune_skill[3]` | C 24h (`builds:v3:id:rank:lane`) | **1 por herói+lane** | 3 builds/herói em 12 heróis; Miya gold 3×3 itens | Sem N; pick = slot share; ordem não documentada; 502 para "sem builds" |
| `GET /academy/equipment/expanded?size=200&index=1` | `equipid`, `equipname`, `equipicon`, `equiptypename`, `equiptips`, `equipskilldesc` | C 24h | **1** (152 itens) | 152 itens; tipos: Attack 32, Magic 31, Defense 25, Roam 32, Jungle 24, Movement 8 | 7 sem tips; stats em HTML; sem preço; sem tier |
| `GET /academy/emblems?size=200&index=1` | `giftid`, `gifttiers`, `emblemskill.skillname`, `numdescribe` | C 24h | **1** (26) | 26 talentos; cobre 19/19 ids vistos no pro | **Não há catálogo de sets 20001–20012**; nome só via build |
| `GET /academy/spells?size=200&index=1` | nome, ícone, descrição | C 24h | **1** (12) | 12 feitiços | Build traz só nome; join por nome normalizado |
| `GET /heroes/positions?size=200&index=1` | `hero_id`, `hero.data.name`, `roadsort[]`, `sortid[]`, `relation` | C 24h (recomendado) | **1** (133) | Exp 42, Mid 29, Roam 37, Jungle 36, Gold 21 | Herói multi-lane; unidade é contexto, não herói |
| `GET /heroes/rank?days=&rank=&size=50&index=` | `win`, `pick`, `ban` | A 2h | **3 páginas** (~133) | 133 heróis | Necessário para ordenar top-N por θ̂; 3 páginas no mythic |
| `GET /esports/id/schedule` | `weeks[].days[].matches[]`: `match_id`, `start_at`, `team1/2`, `score1/2` | 6h (ingestão) | **1** | 72 partidas, **70 com id** | 2 sem id; sem patch/versão |
| `GET /esports/id/matches/{match_id}` | `games[].duration`, `teams[].winner/kills`, `players[]`: `hero{name,image}`, KDA, `items[4–6]{id,image}`, `emblem{id,image}`, `talents[3]`, `gold`, `damage_dealt/taken`, `tower_damage`, `item_sequence[]` | C 24h (derivado) | **1 por partida** | 1 partida = 2 games / 20 player-games; 51 itens únicos | Herói sem id; item/emblema sem nome; `item_sequence` vazio; sem feitiço; inventário 4–6 |
| `GET /academy/heroes/{id}/recommended` | — | — | — | UGC | **Excluído** do agregado |
| `GET /heroes/lanes` (existente) | mapa hero→lanes | C 24h | **133 requests frios** | 133 heróis | **Proibido no agregado**; usar `positions` |

### 3.2 Contrato proposto do agregado (especificação, não código)

`GET /v1/builds/aggregate?lane=gold&rank=mythic&top=10&population=ranked`

```
context:   { rank, lane, top, population, patch, generated_at, stale, age_ms }
coverage:  { heroes_in_lane, heroes_requested, heroes_with_builds,
             builds, contexts, items_cataloged, items_unclassified }
items:     [ { item_id, name, icon, type, archetype,
               adoption_builds, hero_coverage, contexts,
               lift_median, share_positive, support,
               package_id, inseparable_with[], status } ]
sets:      [ { set_key, item_ids[], archetype, k_heroes, m_builds,
               win_median, lift_median, heroes[], status } ]
rune_pages:[ { emblem_id, emblem_name|null, talent_ids[3], spell_name|null,
               adoption, lift, contexts, support } ]
talents:   [ { giftid, tier, name, adoption, lift, contexts } ]
spells:    [ { spell, adoption, lift, contexts } ]
variants:  [ { core_key, item_ids[], variants:[ { key, order[], emblem, talents, spell,
               pick, win, delta_win, status } ] } ]
cells:     [ { hero_id, status: ok|empty|error|stale, builds, reason } ]
sources:   { builds_hash, catalogs_hash, pro_hash|null }
```

Regras do contrato:
- `support` é sempre `ok|insufficient` + contagens; nunca um número solto.
- `status` por célula; resposta `206` se `cells[].status=error` em qualquer.
- `sources.*_hash` valida o cache derivado contra as fontes (invalidação).
- `population=pro` muda unidade para `player_games` e **não** aceita `lane` como filtro primário (lane do pro não vem no payload).

### 3.3 Gaps que mudam o produto

| Gap | Consequência | Mitigação |
|---|---|---|
| Sem N de partidas por build | Nenhum IC, nenhum "significante" | Suporte em builds/contextos/heróis; rótulo explícito |
| 3 builds por herói, muitas vezes mesmo core | "Universo" é 3, não todas as builds | B4 agrupa variantes; B2 usa cobertura k/m |
| `pick` não valida e soma 25,9% | Não é cobertura de partidas | Exibir soma como "participação catalogada" |
| Sem catálogo de sets de emblema | Nome desconhecido vira `#id` | Colher pares `(emblemid, emblemname)` das builds; dicionário local versionado |
| Itens sem tips (7/152) e Attack sem keyword (8) | Arquétipo indeterminado | `não classificado` + bucket separado; nunca chutar |
| Pro sem id de herói | Join frágil | Match exato por nome; não mapeado = `não mapeado` |
| `item_sequence` vazio | Sem ordem de compra | Nunca inferir ordem |
| 502 confunde vazio e erro | Agregado quebra sem necessidade | Separar `empty`/`error` na camada de agregação |

---

## 4. Definições de métrica

### 4.1 Unidades (declarar antes de qualquer fórmula)

- **Contexto `c` = (hero_id, lane, rank).** Herói em 2 lanes = 2 contextos. Agregação cross-lane conta **contextos**, nunca heróis.
- **Build `b`** = um registro de `build[]` (3–4 itens finais, parcial).
- **Suporte** = `k` contextos, `m` builds, `h` heróis, `pg` player-games. **Nunca** "n partidas".
- **Referência `WR_ref(c)`** = win da build de maior `pick` no contexto (mais usada), finita; fallback: média do herói na lane. Nunca 0.

### 4.2 Força de item

```
W̄(i,c)      = Σ_{b∈B(c), i∈b} pick_b · win_b  /  Σ pick_b        (pick-weighted)
C(i)        = { c : ∃ b ∈ B(c) com i ∈ b }
lift_item(i)= median_{c∈C(i)} [ W̄(i,c) − WR_ref(c) ]
adoption(i) = #builds com i / #builds no recorte
hero_cov(i) = #heróis distintos com i em ≥1 build
pos_share(i)= #{c : lift(i,c) > 0} / |C(i)|
```

- **Mínimo:** `|C(i)| ≥ 3` **e** `#builds_com_i ≥ 5`. Abaixo: `amostra insuficiente (k=…, m=…)`, sem número.
- **Confundidores:** item só em herói de baseline alto (mitigado pelo lift vs ref do próprio contexto); causalidade reversa (time que ganha completa item); posição no build (ordem não validada); patch; mix de lanes; item situacional (defensivo comprado quando atrás).
- **Rótulo:** `Associação no recorte · não é winrate do item · não causal`.
- **Proibido:** média de `win` cruzando heróis sem passar pelo lift por contexto.

### 4.3 Colinearidade → "pacote" (obrigatório antes de ranquear item)

```
P(j|i) = #builds com i e j / #builds com i
pacote(i,j) se P(j|i) ≥ 0,8 e P(i|j) ≥ 0,8
```

- Se `i` está em pacote, a linha de item exibe **um** registro agregado `package_id`, com `inseparable_with[]`, e **não** entra no ranking individual.
- **Mínimo para separar:** `P(j|i) < 0,8` em ambos os sentidos e `n_only_i ≥ 2` e `n_only_j ≥ 2`.
- **Confundidor:** com builds de 3 itens, todo par do núcleo coocorre por construção. O pacote é a unidade honesta; o item isolado é, na maioria, não identificável.
- **Rótulo:** `Pacote inseparável — 3 itens sempre juntos; não é possível atribuir força a um item isolado`.

### 4.4 Conjuntos por arquétipo

Classificação (por `equiptypename` + `equiptips`, nessa ordem):

| Arquétipo | Regra | Observação |
|---|---|---|
| **Ataque físico** | `Attack` + (`Physical ATK` ∨ `Crit` ∨ `Attack Speed` ∨ `Lifesteal` ∨ `Penetration`) | 32 itens; nenhum Attack tem `Magic Power` |
| **Ataque mágico** | `Magic` + (`Magic Power` ∨ `Magic PEN` ∨ `Magic Lifesteal`) | 31; 8 sem keyword de poder → `magic_utility` |
| **Defesa física** | `Defense` + `Physical Defense` e **sem** `Magic Defense` | 8 (com/sem HP) |
| **Defesa mágica** | `Defense` + `Magic Defense` e **sem** `Physical Defense` | 5 |
| **Defesa híbrida** | `Defense` + ambos | 4 — bucket próprio, não somar em p/m |
| **Defesa genérica** | `Defense` + só HP | 7 — não classificar como p/m |
| **Fora dos 4** | `Roam` (32), `Jungle` (24), `Movement` (8) | Buckets próprios; botas **nunca** entram no arquétipo |
| **Não classificado** | sem `equiptypename` ou tips vazias (7) | Fora das somas; contado em `items_unclassified` |

Conjunto `s`:
```
s = {i,j} ou {i,j,k} não ordenado, dentro da mesma build (dedupe)
k(s) = #heróis com s ; m(s) = #builds com s
W̄(s,c) = win pick-weighted das builds com s no contexto c
lift_set(s) = median_c [ W̄(s,c) − WR_ref(c) ]
archetype(s) = maioria dos arquétipos; empate → "misto"
```

- **Mínimo:** `k(s) ≥ 2` **ou** `m(s) ≥ 3`; win só com ≥2 builds com win finito e ≥1 contexto com referência.
- **Ranking:** `k` desc, `m` desc, `lift` desc; **teto 5 por arquétipo**. Nunca ordenar por win poolado.
- **Confundidores:** conjunto específico de 1 herói (não é "pacote do meta"); núcleo parcial de 3–4 de 6 slots; botas/roam fora; lane misturada; patch.
- **Rótulo:** `Núcleo parcial 3–4/6 · cobertura em k heróis / m builds · associação`.

### 4.5 Sinergia de itens (coocorrência + win)

```
n_both(i,j) = #builds com ambos ; n_rest = #builds com exatamente um
Δ_pair(c)   = W̄(both,c) − W̄(rest,c)
w           = 2·n_both·n_rest / (n_both + n_rest)      (contagem harmônica)
Δ_adj       = Δ_pair · w / (w + K),  K = 1             (mesmo K de build-adjusted)
```

- **Mínimo:** `n_both ≥ 2`, `n_rest ≥ 2`, `≥2 contextos`. Abaixo: `sem contraste`.
- **Confundidores:** par forçado (botas + núcleo); um item é upgrade de outro; ambos "late game"; `P(j|i) ≥ 0,8` ⇒ **não identificável**; n minúsculo; viés de seleção (build é recomendada, não aleatória).
- **Rótulo:** `Coocorrência descritiva · não é sinergia causal`.
- **Decisão de produto:** B7 só na fase 2. Na maioria dos casos a resposta honesta é "inseparável"; a tela deve saber dizer isso.

### 4.6 Adoção e lift por feitiço / emblema / talento

Unidade composta (o "emblema completo" que o pro quer):
```
rune_page = (emblemid, sorted(talent_ids[3]))
```
Quando o conjunto de itens é o mesmo, comparar **variantes dentro do core**:
```
Δ_var(x) = W̄(x | core) − W̄(modal | core)
```
Quando não há variante de core, usar o lift por contexto (4.2).

- **Mínimo ranked:** `≥3 builds` e `≥2 contextos`; **pro:** `≥5 player-games` e `≥3 partidas` (`MIN_SUPPORT_N=5`).
- **Confundidores:** emblema/talentos são escolha conjunta com os itens; talentos de tiers diferentes se restringem; feitiço é matchup; no pro, efeito de time e amostra pequena.
- **Rótulo:** `Adoção + associação · escolha conjunta com o núcleo · não causal`.
- **Emblema desconhecido:** exibir `#20003` + atributos se houver; **nunca** inventar nome. O mapa 20001–20012 é colhido de pares observados.

### 4.7 Quadrantes e tags

| Superfície | Eixo X | Eixo Y | Cortes | Leitura |
|---|---|---|---|---|
| Build | `pick` (slot share) | `lift_vs_most_used` | 5% / 2 pp | Reutilizar `buildQuadrant` |
| Item/pacote | `adoption` (share de builds) | `lift_item` | 5% / 2 pp | **Não** chamar de pick; eixo é frequência de construção |
| Conjunto | `k` (heróis) | `lift_set` | k≥2, 2 pp | Cobertura primeiro |

Tags existentes (`popular`, `emergente`, `situacional`) valem para build. Para item/pacote, usar as mesmas palavras com o rótulo "frequência" e **silêncio** quando `|lift| ≤ 2 pp` (exceto `emergente`: `pick < 2%` e `lift > 1,5 pp`).

### 4.8 Variantes do mesmo core vs core diferente

```
core_key    = sort(unique(item_ids))
variant_key = core_key + emblemid + sort(talent_ids) + spell
variant_share(core) = pick_variant / Σ pick_variants_do_core
Δwin(v)     = win(v) − win(modal do core)
```

- **Mínimo:** core com `≥2` variantes; senão `core único` (não é erro).
- **Silêncio:** `|Δwin| < 0,02` ⇒ `sem diferença prática`, mesmo que a ordem por lift coloque uma acima.
- **Confundidores:** variantes que diferem **só na ordem** (caso Miya); pick minúsculo; o mesmo win arredondado; ordem não validada.
- **Rótulo:** `Variantes do mesmo núcleo · Δ<2 pp = sem leitura`.
- **Proibido:** ranquear variantes de heróis diferentes.

### 4.9 Resumo (métrica → fórmula → mínimo → confundidor → rótulo)

| Métrica | Fórmula | Mínimo | Confundidor principal | Rótulo |
|---|---|---|---|---|
| Força de item | mediana de `W̄(i,c) − WR_ref(c)` | k≥3, m≥5 | colinearidade / baseline do herói | associação, não causal |
| Pacote | `P(j\|i) ≥ 0,8` ambos | n_both≥3 | núcleo sempre junto | inseparável |
| Conjunto | `mediana_c[W̄(s,c)−WR_ref(c)]` | k≥2 ou m≥3 | 1 herói só; parcial 3/6 | núcleo parcial |
| Sinergia | `Δ_pair · w/(w+1)` | n_both≥2, n_rest≥2, c≥2 | par forçado; não identificável | coocorrência |
| Runa page | `Δ_var` ou lift contextual | ≥3 builds, ≥2 ctx; pro ≥5 pg | escolha conjunta; tiers | adoção + associação |
| Quadrante | pick/adoção × lift | 5% / 2 pp | eixo X não é pick no item | frequência × lift |
| Variante | `Δwin` vs modal do core | core ≥2 variantes | ordem; ruído <2 pp | sem leitura se <2 pp |

---

## 5. Orçamento de rate limit

### 5.1 Premissas

- Latência upstream ~0,9 s/request; `ARENA_CONC=4` → ~4,4 req/s de vazão.
- `timeout 12 s`, `retries 3` (pior caso **4 tentativas** por request).
- Cache A=2 h, B=6 h, C=24 h + SWR. Builds e catálogos são C (24 h).
- **Limite real desconhecido.** Observado: fastapicloud respondeu 14/14 sem 429; o mirror rone.dev devolveu 500 HTML após ~30–40 requests em rajada. Tratar **30–40 como cliff operacional**, não como limite contratual.
- Orçamento interativo conservador: **≤30 requests por carga**, **≤1 carga por 10 s por cliente**.

### 5.2 Composição do custo

| Componente | Requests frios | Cache | Observação |
|---|---:|---|---|
| `equipment/expanded` | 1 | C 24 h | 152 itens, nomes, tipos, tips |
| `emblems` | 1 | C 24 h | 26 talentos |
| `spells` | 1 | C 24 h | 12 feitiços |
| `heroes/positions` | 1 | C 24 h | 133 heróis + lanes + nome |
| **Catálogos (subtotal)** | **4** | | compartilhados entre lanes/ranks |
| `heroes/rank` | 3 | A 2 h | 133 heróis em 3 páginas de 50 |
| Builds do top-N | N | C 24 h | 1 por herói+lane |
| Lista `academy/heroes?lane=` | 0–1 | C 24 h | opcional, só cross-check de cobertura |
| Pro: schedule | 1 | B 6 h | 72 partidas |
| Pro: matches | 70 | C 24 h derivado | 1 por partida com `match_id` |

### 5.3 Tabela de orçamento (frio × quente)

| Cenário | Frio (requests) | Tempo @4 conc (~0,9 s) | Quente | Risco |
|---|---:|---:|---:|---|
| **Top-10, 1 lane** | **17** (4 cat. + 3 rank + 10 builds) | **~4,5 s** | **0** (rank pode revalidar: 3) | baixo |
| **Top-20, 1 lane** | **27** (4 + 3 + 20) | **~6,3 s** | **0** (ou 3) | baixo/médio |
| **Lane completa — gold (21)** | **28** (4 + 3 + 21) | **~7,2 s** | 0 | médio |
| **Lane completa — mid (29)** | **36** | **~9,0 s** | 0 | médio |
| **Lane completa — jungle (36)** | **43** | **~9,9 s** | 0 | alto se interativo |
| **Lane completa — roam (37)** | **44** | **~10,8 s** | 0 | alto se interativo |
| **Lane completa — exp (42)** | **49** | **~11,7 s** | 0 | **não interativo** |
| **5 lanes completas** | **172** (4 + 3 + 165) | **~40–45 s** | 0 | **só background/off-peak** |
| **Pro — temporada** | **71** (1 + 70) | **~20–35 s** (respostas grandes) | 0 | ingestão 1×/dia |
| **Revalidação SWR** | = frio, em background | não bloqueia | — | 1 lane por ciclo |

> `165` = soma das lanes (21+29+36+37+42). Herói multi-lane conta 2×, porque a unidade é contexto.
> Se a página usar a lista `academy/heroes?lane=` para cross-check, **+1 por lane** (máx. +5).

### 5.4 Regras operacionais (obrigatórias)

| Regra | Valor | Por quê |
|---|---|---|
| Concorrência | **4**, não aumentar | já é o teto observado seguro |
| Retry interativo | **1** tentativa extra (não 3) | 3 retries × 27 = 108 attempts, estoura o cliff |
| Retry background | 3, com backoff+jitter | ingestão tolera latência |
| Timeout por request | 12 s | padrão atual |
| Deadline da carga | top-10 **8 s**; top-20 **12 s**; lane completa **20 s** (background 60 s) | além disso, `206 partial` |
| Abort | `AbortController` por request + por página; cancelar fan-out ao desmontar/trocar lane | não deixar requests órfãos |
| Prefetch | **zero**: sem lane não selecionada, sem próxima lane, sem pro no load, sem hover em top-20 | rajada silenciosa é o pior caso |
| Failover | **5xx** (500/502/503/504) com host alternativo **allowlist**, **1 hop**, 1 vez por request | rone devolve 500 HTML; o cliente atual só falha em 503 |
| HTML/parse | content-type não-JSON = erro de upstream, não `JSON.parse` | evita retry cego em página de erro |
| Circuit breaker | 5 falhas consecutivas → abre 60 s, serve stale | protege a fonte e a página |
| Teto por carga | **≤30 requests** interativos; lane completa vai para job | mantém abaixo do cliff 30–40 |
| Cache derivado | C 24 h + hash das fontes | evita recomputar e invalida corretamente |
| **`/heroes/lanes`** | **proibido no agregado** | 133 requests frios; usar `positions` (1) |

### 5.5 P0 identificado: `/heroes/lanes` custa 133 requests

`apps/api/src/routes.js` monta o mapa de lanes com `mapConc(ids, ...)` sobre **todos os heróis do rank** (133), 1 request por herói. Cache C 24 h mascara no quente, mas o primeiro load (ou após 24 h) é uma rajada de 133 — exatamente o padrão que derrubou o mirror. **O agregado não pode reutilizar essa rota.** `GET /api/heroes/positions?size=200` entrega os 133 heróis com lanes em **1 request** (verificado) e ainda traz nome. Se a aba do dashboard continuar usando `/heroes/lanes`, ela é o risco P0 independente desta página.

### 5.6 Cache e invalidação

| Chave | TTL | Invalida |
|---|---|---|
| `builds:agg:v1:{rank}:{lane}:{top}:{population}` | C 24 h + SWR | `sources.builds_hash` / `catalogs_hash` |
| `builds:v3:{id}:{rank}:{lane}` (existente) | C 24 h | nova coleta |
| `positions` | C 24 h | patch/rotação |
| `equipment:expanded` | C 24 h | patch |
| `emblems` / `spells` | C 24 h | patch |
| `pro:season` | C 24 h | ingestão diária |
| `rank:{rank}:{days}` | A 2 h | coleta |

**Regra:** o agregado guarda os hashes das builds usadas. Se qualquer build fonte mudar (recache), o hash muda e o agregado é recomputado — nunca servir item stats calculados sobre builds que já não existem.

---

## 6. Corte recomendado

### 6.1 MVP agora (1 lane por vez, top-10/top-20)

| Item | Por quê |
|---|---|
| B0 faixa de contexto/cobertura | Sem isso, todo número é ambiguamente interpretado |
| B1 força de item **com pacotes** | É a pergunta central do admin e a mais barata (client-side sobre builds já buscadas) |
| B2 conjuntos por arquétipo | Responde literalmente ao pedido ("ataque físico, mágico, defesa física, mágica") |
| B3 emblemas/talentos/feitiços + runa page | Payload já traz tudo; catálogo de 26 cobre o pro; 1 request |
| B4 core vs variantes | Custo zero (client-side), e é o que o pro usa para decidir |
| B5 top builds por lane (ponte) | Reaproveita a lógica existente e evita página órfã |
| Endpoint agregado com `cells[].status` + `206 partial` | Sem isso, 1 herói sem build derruba a tela |
| Cache derivado com hash + SWR | Mantém o quente em 0 requests |
| Budget top-10/top-20; lane completa só em job | Fica abaixo do cliff de 30–40 |

**Fora do MVP:** qualquer coisa que exija lane completa no load, pro, sinergia par-a-par, série temporal.

### 6.2 Fase 2

| Item | Por quê | Pré-requisito |
|---|---|---|
| B6 Pro MPL (inventário final, dano/ouro) | Responde "como o pro joga" e dá itens finais de 6 slots | Job de ingestão 71 req/dia; normalizar ids string; join por nome |
| B7 Sinergia par-a-par | Só faz sentido com mais de 3 itens por build ou pro | Aceitar que a maioria será "não identificável" |
| Eficiência dano/ouro no pro | `damage_dealt/gold`, `damage_taken/gold` por player-game | Definir baseline por função/hero; amostra ≥5 |
| Diff patch-a-patch | Exige persistir snapshots de builds | Hoje o cache é 24 h, não série |
| Export CSV para admin | Reunião de balance | Contrato estável |
| Lane completa em background + cache | Cobertura real por lane | Budget e circuit breaker |

### 6.3 Nunca

| Nunca | Motivo |
|---|---|
| Ordem de compra / "first item spike" | Não documentada; `item_sequence` vazio |
| Lift causal / "este item ganha jogos" | Camada A; ajustado/causal NULL |
| N de partidas / IC por build | Fonte não publica |
| Ranking cross-hero de builds | Referências internas ao contexto |
| Pool pro + ranked | Populações distintas |
| UGC `/recommended` no agregado | Guia de comunidade, não evidência |
| Build completa de 6 slots da Academy | Só 3–4 itens |
| Item tier list global sem lane/rank | Simpson |
| "Melhor build do jogo" | Não existe unidade comparável |
| Emblema "completo" inventado | Só set + atributos + talents do payload |

---

## 7. Plano de teste QA

### 7.1 Invariantes

| ID | Invariante | Como verificar |
|---|---|---|
| **INV-BDL-AGG-001** | Unidade de agregação é contexto (herói+lane+rank); herói multi-lane conta 2× e é rotulado | Fixture com herói em 2 lanes; somar contextos |
| **INV-BDL-AGG-002** | Nenhuma lista ordena builds de heróis diferentes | Inspecionar payload: listas cross-hero só de item/set |
| **INV-BDL-AGG-003** | `pick` nunca é normalizado para 100%; soma exibida como "participação catalogada" | Miya gold: soma 0,2593 |
| **INV-BDL-AGG-004** | Nenhum campo `n_partidas` / `n_matches`; suporte = k/m/h/pg | Schema + grep de copy |
| **INV-BDL-AGG-005** | `lift_item`/`lift_set` = mediana de lifts por contexto, nunca pool de wins | Teste com 2 contextos de baselines opostos |
| **INV-BDL-AGG-006** | `|lift| < 0,02` ⇒ sem veredito/ordem silenciosa; exceção `emergente` (pick<2%, lift>1,5 pp) | Fixture Miya 0,44 pp |
| **INV-BDL-AGG-007** | `P(j\|i) ≥ 0,8` ambos ⇒ pacote, sem ranking individual | Fixture Windtalker/Berserker/Haas |
| **INV-BDL-AGG-008** | Conjunto Academy sempre rotulado "núcleo parcial 3–4/6" | Copy snapshot |
| **INV-BDL-AGG-009** | Pro separado (`population=pro`, `n_player_games`); proibido pool com ranked | Payload + teste de média |
| **INV-BDL-AGG-010** | Pro aceita inventário 4–6; <4 exclui player-game com motivo; sem imputação | Fixture 6/5/4/3 itens |
| **INV-BDL-AGG-011** | Emblema/talento desconhecido = `#id`; nenhum nome inventado | Fixture `#20003` |
| **INV-BDL-AGG-012** | Item sem tipo/tips = `não classificado`; fora das somas, contado em gap | 7 itens sem tips |
| **INV-BDL-AGG-013** | Falha de 1 herói = `cells[].status=error`, resposta `206`; nunca 502 global | Mock 500 em 1 de 10 |
| **INV-BDL-AGG-014** | Stale só com `stale:true` + idade; SWR não bloqueia | Cache expirado |
| **INV-BDL-AGG-015** | Agregado valida `sources_hash`; mismatch ⇒ recomputa | Alterar 1 build no cache |
| **INV-BDL-AGG-016** | Fan-out ≤ `topN`; contador de requests exposto em dev; sem prefetch | Instrumentação |
| **INV-BDL-AGG-017** | Join de herói no pro é exato; não mapeado = `não mapeado` | Nome com acento/espaço |
| **INV-BDL-AGG-018** | Join de feitiço por nome normalizado; mismatch = `#id` | Nome divergente |
| **INV-BDL-AGG-019** | Nenhuma palavra causal na copy (`causa`, `ganha`, `melhora`) | Lint de texto |
| **INV-BDL-AGG-020** | Cortes vêm de `thresholds.js` (5% / 2% / 1,5 pp / 2 pp); sem constante local | Teste de import |
| **INV-BDL-AGG-021** | Failover só em 5xx, 1 hop, allowlist; HTML tratado como erro | Mock 500 HTML + 503 |
| **INV-BDL-AGG-022** | `/heroes/lanes` não é chamado pelo agregado | Spy de fetch |
| **INV-BDL-AGG-023** | Emblema usa `contextMetric` por `emblemid`: `k>=3` e `m>=5`; `win_median` é mediana por contexto, nunca win poolado | Fixture com 4 heróis e 16 builds no mesmo emblema |
| **INV-BDL-AGG-024** | `combination_strength_index = 100 × wrAdj × win_build × win_median_emblema`; sem emblema suportado é `null` | Teste de fórmula + emblema com m<5 |

### 7.2 Cenários de borda

| # | Cenário | Setup | Esperado | Invariantes |
|---|---|---|---|---|
| E1 | Fonte devolve 500 HTML | Mock 500 `text/html` em 1 herói | Célula `error`, página 206, sem retry cego; failover 1 hop se allowlist | 013, 021 |
| E2 | Lane sem builds | Todos os heróis da lane com `no_builds_for_lane` | `empty` (não `error`); B1/B2 com "sem suporte"; B5 com motivo | 013 |
| E3 | Herói sem lane | `positions` sem `roadsort` | Herói não aparece em lane; aparece em "sem lane" com motivo; nunca lane errada | 001 |
| E4 | Build com <3 itens | Build com 1–2 itens | Núcleo exibido; sem trinca; `sem suporte` para conjunto; sem erro | 008 |
| E5 | Item sem catálogo | `equipid` fora de 152 | `#id` + "não catalogado"; continua no conjunto; contado em gap | 012 |
| E6 | Talento sem catálogo | `giftid` fora dos 26 | `#id`; runa page ainda exibida; gap | 011 |
| E7 | Emblema sem nome | `20003` sem par observado | `#20003` + atributos se houver | 011 |
| E8 | Pro jogo incompleto | 1 time, 3 players, 2 games | Ingestão marca `partial`; player-games válidos contam; sem crash | 009, 010 |
| E9 | Pro inventário 4 itens | Player com 4 | Aceito, normalizado por pg; sem imputar 2 slots | 010 |
| E10 | Pro herói não mapeado | Nome fora do catálogo | `não mapeado`; não entra em agregado por herói | 017 |
| E11 | Sample insuficiente | 2 builds, 1 contexto | `amostra insuficiente (k=1, m=2)`; sem número | 004, 005 |
| E12 | Mesmo core, ordem diferente | Miya gold | 1 core, 2–3 variantes; Δ0,44 pp = `sem diferença prática` | 006, 008 |
| E13 | Item duplicado na build | `equipid` repetido | Dedupe antes de conjunto; sem trinca falsa | 008 |
| E14 | Item em 2 lanes | Herói multi-lane | 2 contextos; não somar como 1 herói | 001 |
| E15 | Cache expirado | TTL vencido | SWR serve stale + revalida; `stale:true` | 014 |
| E16 | 2 partidas sem `match_id` | Schedule 72/70 | Ingestão reporta 70/72; não inventa id | 009 |
| E17 | Mudança de patch | `equipment`/`emblems` mudam | Hash muda; agregado recomputa; patch exibido | 015 |
| E18 | Rajada de lane completa | 42 heróis | Job em background; circuit breaker; nunca no load | 016, 022 |
| E19 | Emblema abaixo do suporte | Emblema em 1 contexto / 4 builds | Fica em `emblems_insufficient`; UI mostra “Poucos dados”; sem força | 023, 024 |
| E20 | Força com emblema suportado | 4 heróis, 16 builds, emblema 20012 | Índice finito; produto das três forças; nunca chamado de winrate | 024 |

### 7.3 Critérios de aceite

1. Top-10 frio ≤ **17 requests** e ≤ **8 s**; quente **0** upstream.
2. Nenhuma carga interativa > **30 requests**; lane completa nunca no load.
3. Nenhum 502 global por falha de 1 herói; sempre `200` com `partial:true`.
4. Todo número na tela tem `k/m/h/pg` ao lado ou o rótulo `Poucos dados`.
5. Nenhuma string causal ou "melhor build do jogo".
6. `Miya gold` renderiza **1 core + variantes**, com Δ0,44 pp silenciado.
7. `Windtalker/Berserker/Haas` renderiza como **pacote**, não 3 itens ranqueados.
8. Emblema `20012` = Marksman; `20003` = `#20003`.
9. Pro e ranked nunca na mesma média; `population` visível.
10. `/heroes/lanes` ausente do tráfego do agregado.
11. Seção 2c · Emblemas mostra suporte, adoção, seta e “Poucos dados” quando for o caso.
12. Aba Combinações mostra a força como índice e explica que é `100 × herói × build × emblema`, não winrate.

---

## Anexo — Log de verificação (14 chamadas, fastapicloud)

| # | Chamada | Confirmou |
|---|---|---|
| 1 | `academy/heroes?lane=gold&size=200` | 21 heróis; só `head/hero/hero_id`; sem flag de build |
| 2 | `academy/equipment/expanded?size=200` | 152 itens; tipos 32/31/25/32/24/8 |
| 3 | `academy/emblems?size=200` | 26 talentos |
| 4 | `equipment/expanded` (reuso p/ tips) | nenhum Attack com Magic Power; defesa separável por tips |
| 5 | `academy/heroes/1/builds?lane=gold` | 3 builds × 3 itens; 3005/3003/3002 |
| 6 | `esports/id/schedule` | shape `{weeks[].days[].matches[]}` |
| 7 | `schedule` (flatten) | 72 partidas, 70 com `match_id` |
| 8 | `esports/id/matches/{id}` | `{match_id, games[]}`; 2 games |
| 9 | `matches/{id}` (teams) | `teams[].players[]`; 5 players/time |
| 10 | `matches/{id}` (players) | item 4–6 (16×6, 3×5, 1×4); herói por nome; item/emblema só id |
| 11 | `emblems` + `builds` | 19/19 talentos do pro no catálogo; Miya `20012` = Marksman |
| 12 | `equipment/expanded` (lookup) | 3002/3003/3005 são itens finais; 7 sem tips |
| 13 | `heroes/positions?size=200` | 133 heróis; lanes 42/29/37/36/21; nome incluso |
| 14 | (contagem) | 14 requests totais, 0 erros, 0 429 |

**Limite de conclusão:** não foi possível determinar o rate limit contratual. A recomendação usa o cliff observado (30–40 em rajada no mirror) como envelope conservador, não como garantia.
