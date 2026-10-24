# ADR-027 — Índice de Força da Configuração (IFC), itens vs ameaça e projeção de builds completas

- Data: 2026-10-21 · Autor: saas-lead
- Status: **proposta** (depende de ADR-026)
- Substitui, se aceito: `combination_strength` / `combination_strength_index`

## Contexto

Pedido de produto:
1. Manter 3 itens core (slots 4–6 são variáveis por partida).
2. Recomendar itens contra ameaças do time inimigo.
3. Criar um "poder da build" ≈ `WR herói × WR build × WR emblema` (proxy do número interno da Moonton).
4. Mostrar WR de emblemas combinados, como já existe para equipamentos.
5. Inferir o poder de builds completas combinando core + variáveis + emblemas.

## O que já existe hoje

- `combination_strength = hero_strength × build_strength × emblem_strength`;
  `combination_strength_index = ×100` (`builds/builds-aggregate.js:1017-1034`),
  exibido como "Força" e usado como ordenação (`BuildsAggregatePanel.tsx:653`, `:869`).
- `emblems` (WR mediana + delta + suporte k≥3 / m≥5) e `rune_pages`
  (emblema + talentos + feitiço) já são calculados (`builds-aggregate.js:731-842`).
- Núcleo + variantes já modelados: `core.label = "Núcleo de N itens"`, `variants[]`,
  `order_only`, `delta_wr_pp_vs_modal` (`:979-992`).

## Crítica do índice atual (por que trocar)

Seja um herói e um emblema fixos. `hero_strength` e `emblem_strength` são **constantes**
para todas as variantes daquele par. Logo:

    ordenar(hero × build × emblem) ≡ ordenar(build)   [dentro do contexto]

Ou seja: a coluna "Força" **não acrescenta informação** na comparação que o usuário
realmente faz (variantes do mesmo herói). Entre heróis diferentes ela ordena
majoritariamente por força do herói, não por qualidade da build — um herói de 56% com
build mediana vence um de 49% com build excelente, e o rótulo diz "Força" (da build).

Além disso: multiplicar três WRs cujo numerador já contém o efeito do herói
**conta o mesmo sinal três vezes**; o resultado (~0,14 × 100) não é probabilidade nem
tem escala interpretável; emblema sem suporte vira `null` e a linha sai da ordenação
(viés de seleção).

## Decisão

### 1. IFC — Índice de Força da Configuração (substitui combination_strength)

Decomposto em lentes separadas, nunca somadas num número só:

```
L_build  = win_build / win_ref_modal           (mesmo herói+lane+rank)
L_setup  = win_emblem / win_mean_hero           (mesmo contexto)
IFC      = 100 × (L_build^0.6 × L_setup^0.4)    → exibir 1 casa, faixa 50–200
```

- Herói **não entra** no IFC. Força do herói é contexto exibido ao lado (`wrAdj`, tier).
- Componentes sempre visíveis na linha (`índice`, `L_build`, `L_setup`), não em tooltip.
- `null` quando falta suporte — e a linha continua listada com "sem suporte", sem sumir.
- Rótulo obrigatório: "índice relativo · não é probabilidade · não é o Poder da Build oficial".

### 2. Itens contra ameaças — curadoria declarada, nunca "derivado"

A fonte **não** tem composição inimiga por partida; `matchups` é agregado por herói e
itens só têm `type` + `tips` textual. Portanto não é possível inferir
"este item ganha contra esta ameaça" a partir da amostra.

Decisão: taxonomia fixa de ameaça (cura sustain, burst físico, burst mágico, CC/controle,
mobilidade, tanque) + mapa curado item→ameaça, versionado por patch, exibido como
**"recomendação editorial (patch X)"** — com link para o `tips` do item como justificativa.
Nunca misturar com números de win rate na mesma superfície.

### 3. Compositor com evidência (substitui "projeção de builds completas")

Correção de premissa (ver ADR-026): o payload traz **3 builds de 3 itens** por
herói+lane+rank, e essas 3 builds somam ~10% de `pick` — é um top-3 curado, não a
distribuição. Portanto não existe "core + 2 variáveis": há **3 builds observadas** e nada
entre elas.

Decisão: a seção **não é removida nem vira calculadora**. Vira *compositor com evidência*.
O usuário monta uma combinação de 3 itens; o resultado tem três estados:

| Estado | Condição | O que a UI mostra |
|---|---|---|
| `observada` | o conjunto exato está entre as 3 builds da fonte | `win`, `pick`, `delta_wr_pp_vs_modal` reais |
| `parcial` | itens com suporte agregado, combinação não listada | passaporte de cada item (`delta_wr_pp_median`, `builds`, `contexts`, `discovery_status`) + selo "não observada para este herói" |
| `sem_suporte` | item sem suporte `ok` | "dados insuficientes" no item; nada agregado |

"Nenhuma build listada usa esta combinação" é **resultado válido**, não erro.

Análises que substituem a projeção (todas sobre dado observado):

1. **Consistência entre as builds listadas** — item presente em 3/3, 2/3 ou 1/3 das builds
   do herói. É a leitura fiel do que a fonte entrega ("fixo" vs "rotativo"), não uma
   estimativa de adoção no meta. Rótulo: "3 de 3 builds listadas".
2. **Substituição observada — 2 itens fixos, 1 rotativo** — pares que compartilham 2 de 3
   e diferem em 1. Viável só no herói e raro: 3 pares em 30 builds (1 contexto em 10).
   Exibir o par com `win`/`pick` de cada lado e `n=1`, nunca como ranking.
   **5 de 6 é impossível** com esta forma de dado.
3. **Mistura por arquétipo** — `archetypeOfItems` já classifica a build; comparar as builds
   listadas por composição (ex.: 2 defesas mágicas vs 1) explica *por que* uma vence melhor
   do que um índice agregado.

O IFC (item 1) só ordena **builds observadas**. Nunca é calculado para combinação
montada à mão. No global, a substituição não aparece: com 3 builds por herói e top-3
curado, uma tabela cross-herói de trocas seria uma tabela de artefatos da curadoria.

## Consequências

- Positivo: o número passa a significar algo (força relativa da configuração), o usuário vê
  de onde vem, e a página não promete o que a fonte não entrega.
- Negativo: perdemos o "número único grande" — IFC é menos chamativo que 16,7.
- Custo: mapa editorial de itens (~40 itens × 6 ameaças) precisa de dono e revisão por patch.
- Risco residual: IFC ainda é composição (não causal); `weighting_sensitivity` continua publicado.

## Descartado

- Manter `hero × build × emblem` renomeado: matematicamente redundante (ver crítica).
- Inferir item→ameaça por coocorrência: exigiria ingest por partida (fase 2).
- Misturar projeção sintética com observado na mesma ordenação.
