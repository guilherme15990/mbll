# Builds agregada (CTX-BDL) — Regras do motor

Data: 2026-10-21 · Destino: desenvolvimento · Audiência: admin, QA e engenharia
Fonte: `builds-aggregate-brief.md` + `builds-aggregate-qa.md` + revisão de 21/10.

Este documento é a fonte canônica das **fórmulas, limites e contrato** do agregado.
A linguagem da tela fica em `builds-aggregate-ui-copy.md`; o QA não deve usar este
texto como copy.

---

## 1. Escopo

- `/builds` é uma **visão agregada do sistema**. A unidade principal é a
  **combinação de itens**: trinca, pacote recorrente e conjunto por arquétipo.
- Não é a aba de builds do herói nem o dashboard (top-3 por rota). Heróis aparecem
  apenas como lista “quem usa esta combinação”, com link para a ficha.
- População: ranked (Academy). Dados profissionais (MPL) são fase 2, sempre em
  população separada.
- Todo número é **associação descritiva (Camada A)**, nunca causal. Não existe N
  de partidas.

## 2. Limites dos dados

- A API devolve **3 builds por herói + lane**, com **3 a 4 itens finais** cada.
  É um **núcleo parcial (3–4 de 6 slots)**, não a build completa.
- A ordem de `equipid[]` **não é interpretada** (não há ordem de compra).
  Conjuntos são não ordenados.
- `build_pick_rate` é participação (slot share), não soma 1 (Miya gold soma 25,9%)
  e não é validado. Nunca normalizar para 100%.
- Não há número de partidas por build. Suporte é sempre contagem de contextos,
  builds e heróis. Não há intervalo de confiança nem shrinkage.
- Lane é obrigatória na consulta de builds.

## 3. Unidades e notação

- **Contexto `c`** = `(hero_id, lane, rank)`. Herói em 2 lanes = 2 contextos.
  Agregação entre lanes conta contextos, nunca heróis.
- **Build `b`** = um registro de `build[]` com `win_b`, `pick_b`, itens `I_b`
  (sem repetição), emblema, 3 talentos e feitiço.
- **Suporte**: `k` = contextos, `m` = builds, `h` = heróis distintos.
  Todo número exibido leva `k/m/h` ao lado, ou o texto “amostra insuficiente
  (k=…, m=…)”.
- **`PRACTICAL_DELTA_PP = 2`** (pontos percentuais). Cortes vêm de
  `thresholds.js` (popular 5%, raro 2%, emergente 1,5 pp), nunca constantes locais.
- Vocabulário: **`delta_wr_pp`** é diferença de win em pontos percentuais.
  A palavra “lift” fica reservada para razão e **não aparece na UI** para pp.

## 4. Fórmulas

### F1. Referência do contexto

```text
WR_ref(c) = win da build de maior pick em B(c)
fallback  = média simples das win do herói na lane
sem valor finito => contexto excluído (nunca usar 0)
```

### F2. Win do conjunto no contexto

```text
S = conjunto de itens (não ordenado)
W(S,c) = Σ pick_b · win_b / Σ pick_b   para b em B(c) com S ⊆ I_b
Σ pick = 0 => indefinido (não 0)
```

### F3. Diferença observada (`delta_wr_pp_*`)

```text
delta_wr_pp(S,c) = 100 · ( W(S,c) − WR_ref(c) )
delta_wr_pp_median(S) = mediana de delta_wr_pp(S,c) em C(S)   (ponderado por pick)
delta_wr_pp_unweighted_median(S) = o mesmo com pick_b = 1 em F2
```

Cada contexto conta uma vez; a mediana impede que um herói popular domine.
**Proibido** calcular média de win cruzando heróis sem passar pela diferença por
contexto. Win poolado nunca é exibido como “win do item”.

### F4. Sensibilidade ao peso (`weighting_sensitivity`)

O peso por pick é hipótese, então toda combinação publica as duas medianas.

```text
unknown      = uma das duas medianas indefinida
sign_flip    = sinais opostos entre ponderada e não ponderada
large_shift  = |ponderada − não ponderada| ≥ 2 pp, sem inversão de sinal
stable       = demais casos
```

`sign_flip` e `unknown` **nunca** são destacados como descoberta. A contagem por
classe vai em `coverage.weighting_sensitivity_counts`.

### F5. Suporte e adoção

```text
k(S) = |C(S)|    m(S) = #builds com S    h(S) = #heróis distintos com S
adoção(S) = m(S) / #builds no recorte
participação catalogada (herói+lane) = Σ pick_b
```

“Participação catalogada” é rótulo obrigatório quando a soma de pick aparecer;
não é cobertura de partidas.

### F6. Enumeração de conjuntos

```text
Por build: deduplicar itens, ordenar ids, gerar subconjuntos de tamanho 2 a |I_b|.
Build com 3 itens => 3 pares + 1 trinca.
Build com 4 itens => 6 pares + 4 trincas + 1 quádrupla.
Build com <3 itens => núcleo exibido, sem trinca, sem erro.
```

Itens do tipo `movement` (botas) não entram em arquétipo. Se entram nas trincas
de B1 segue em aberto (seção 10).

### F7. Pacote inseparável

```text
P(j|i) = m(i e j) / m(i)
par inseparável: P(j|i) ≥ 0,8 e P(i|j) ≥ 0,8
pacote de ≥3 itens: todos os pares do conjunto são inseparáveis
```

- Entra em `packages` com **`k ≥ 3` contextos e `m ≥ 5` builds**.
- Coocorrência menor entra em `packages_provisional` com `inseparable:false`,
  `inseparable_observed:true` e `discovery_status:"provisional"`.
- Item que está em pacote **não entra no ranking individual**. A tela mostra um
  registro único com os itens do pacote.
- Separar dois itens exige `P < 0,8` nos dois sentidos e pelo menos 2 builds só
  com cada um.

### F8. Escopo e status

```text
pattern_scope: h ≥ 3 => cross_hero | h = 2 => two_heroes | h = 1 => single_hero
discovery_status (precedência proposta, validar contra o motor):
  provisional  = abaixo do suporte mínimo
  local        = single_hero
  emerging     = adoção < 2% e delta_wr_pp_median > 1,5
  consolidated = cross_hero com suporte mínimo
```

`sets_summary` agrupa por `consolidated` / `emerging` / `local` e por `scope`.

> **Gap atual:** o motor implementa `emerging` como `h == 2` (não por adoção/delta).
> A regra acima é a proposta a validar; ver seção 10.

### F9. Arquétipo do item (`equiptypename` + `equiptips`, nessa ordem)

| Arquétipo | Regra |
| --- | --- |
| Ataque físico | tipo Attack e (Physical ATK, Crit, Attack Speed, Lifesteal ou Penetration) |
| Ataque mágico | tipo Magic e (Magic Power, Magic PEN ou Magic Lifesteal) |
| Defesa física | tipo Defense com Physical Defense e sem Magic Defense |
| Defesa mágica | tipo Defense com Magic Defense e sem Physical Defense |
| Defesa híbrida | Defense com os dois (bucket próprio) |
| Defesa genérica | Defense só com HP (bucket próprio) |
| Utilitário mágico | Magic sem palavra-chave de poder (`magic_utility`) |
| Outros | Roam, Jungle e Movement, cada um em bucket próprio |
| Não classificado | sem tipo ou sem tips (7 itens); fora das somas, contado em `items_unclassified` |

Arquétipo do conjunto = maioria dos arquétipos dos itens; empate = “misto”.
Nunca chutar classificação.

### F10. Variantes do mesmo núcleo

```text
core_key    = ids únicos ordenados
variant_key = core_key + emblemid + talentos ordenados + feitiço
modal       = variante de maior pick no núcleo
Δwin(v)     = 100 · ( win(v) − win(modal) )   em pp
|Δwin| < 2 pp => “sem diferença prática” (sem ordenar)
```

Exige núcleo com pelo menos 2 variantes. Senão: “núcleo único” (não é erro).
Variantes só se comparam dentro do mesmo contexto.
Caso de teste: Miya gold, 3 builds com os mesmos 3 itens, Δ de 0,44 pp silenciado.

### F11. Runa page, talentos e feitiços

```text
rune_page = (emblemid, 3 talent_ids ordenados)
adoção    = builds com a página / builds do recorte
delta     = mediana por contexto de 100 · ( W(página,c) − WR_ref(c) )
mínimo    = 3 builds e 2 contextos; abaixo: “amostra insuficiente”
```

Emblema sem nome catalogado = `#id` (sem inventar nome; o mapa é colhido dos pares
id/nome das builds, ex.: 20012 = Marksman). Talento decodificado pelo catálogo de
26. Feitiço por nome normalizado; sem match = `#id`.

### F11b. Emblemas isolados e força da combinação

O emblema é medido como os itens, mas agrupado apenas por `emblemid`:

```text
W(e,c) = Σ pick_b · win_b / Σ pick_b   para builds com emblema e no contexto c
delta_wr_pp(e,c) = 100 · (W(e,c) - WR_ref(c))
delta_wr_pp_median(e) = mediana de delta_wr_pp(e,c) em C(e)
mínimo = 3 contextos e 5 builds; abaixo: "Poucos dados"
```

`win_median(e)` é a mediana de `W(e,c)` (cada contexto conta 1x), nunca um win
poolado entre heróis. O mesmo par weighted/unweighted dos itens é publicado.

Força da combinação observada:

```text
força_herói   = wrAdj do herói
força_build   = win_b
força_emblema = win_median(e) do emblema no recorte
índice        = 100 · força_herói · força_build · força_emblema
```

- Se o emblema não tiver suporte mínimo, `combination_strength` e
  `combination_strength_index` ficam `null` (a UI mostra “Poucos dados”).
- O índice é **heurístico e relativo**, para comparar combinações observadas.
  Não é probabilidade de vitória, não é winrate da combinação, não é ranking de
  heróis e não implica causa.
- A força usa apenas campos já presentes em `top_builds` + `emblems`; não há nova
  rota.

### F12. Quadrante e tags

```text
eixo X = adoção (share de builds) · eixo Y = delta_wr_pp_median
cortes: 5% e ±2 pp
```

Reutilizar `buildQuadrant` e as tags existentes (popular, emergente, situacional,
abaixo da ref). Para combinações o eixo X se chama **frequência de construção**,
nunca “pick”. Regra de silêncio: `|Δ| < 2 pp` => sem tag e sem veredito, exceto
emergente (adoção < 2% e Δ > 1,5 pp).

### F13. Ordenação

```text
h desc, depois m desc, depois delta_wr_pp_median desc
teto de 5 combinações por arquétipo
```

Nunca ordenar por win poolado. Nunca ranquear builds de heróis diferentes.

## 5. Controles da página

- **Rank**: all, epic, legend, mythic, honor, glory.
- **Lane**: exp, mid, roam, jungle, gold.
- **Top**: 10 ou 20 heróis do recorte.
- População fixa em ranked. `population=pro` continua retornando 400 até a fase 2
  (não oferecer na UI).
- Máximo de 1 carga por 10 s por cliente. Trocar o recorte cancela a carga anterior
  (`AbortController`).

## 6. Contrato público

`GET /v1/builds/aggregate?lane=&rank=&top=&population=ranked`

Campos usados pela tela:

- `context`, `coverage` (inclui `weighting_sensitivity_counts`)
- `triples`, `triples_total`, `discovery_summary`
- `packages`, `packages_provisional`, `packages_ok`,
  `packages_provisional_count`
- `sets`, `sets_summary`
- `emblems`, `emblems_insufficient`, `emblems_total`
- `rune_pages`, `talents`, `spells`
- `variants`, `cells`, `metrics`, `partial`, `stale`
- `top_builds[].builds[]`: `hero_strength`, `build_strength`, `emblem_strength`,
  `combination_strength`, `combination_strength_index`

Cache: `builds:agg:v3:*`.

## 7. Orçamento e resiliência

- **Custo**: top-10 = 17 requests frios (4 catálogos + 3 rank + 10 builds), 0 no
  quente. Top-20 = 27. Teto de 30 por carga interativa. Concorrência 4.
  Retry interativo 1. Sem prefetch.
- Lane completa (21 a 42 heróis) e as 5 lanes (172 requests) só em job de
  background. **Nunca** chamar `/heroes/lanes` (133 requests); usar
  `/heroes/positions` (1).
- Falha upstream: failover em 5xx para host allowlist, 1 hop. Resposta que não é
  JSON é erro. Circuit breaker abre após 5 falhas seguidas, por 60 s.

## 8. Critérios de aceite

1. Top-10 frio faz no máximo 17 requests e responde em até 8 s. Quente faz 0 upstream.
2. Nenhuma carga interativa passa de 30 requests, e `/heroes/lanes` não aparece no tráfego.
3. Falha de 1 herói devolve 200 com `partial:true`; nunca 502 global.
4. Todo número tem `k/m/h` ao lado ou o rótulo de amostra insuficiente.
5. Windtalker + Berserker's Fury + Haas' Claws aparece como **pacote**, não como três itens ranqueados.
6. Miya gold aparece como 1 núcleo com variantes, e o Δ de 0,44 pp fica silenciado.
7. Emblema 20012 = Marksman; 20003 = `#20003`.
8. Win poolado nunca é exibido; mediana por contexto, sempre.
9. Nenhum campo ou texto de N de partidas e nenhuma palavra proibida.
10. A UI nunca mistura população pro com ranked.
11. Emblema com k≥3 e m≥5 aparece em `emblems` com win mediana e delta em pp;
    abaixo disso fica em `emblems_insufficient` como “Poucos dados”.
12. A força da combinação é `100 × herói × build × emblema`; sem emblema
    suportado, o índice fica nulo e a UI não inventa valor.

## 9. Estado atual vs spec (auditoria)

| Item | Estado em 2026-10-21 | Ação |
| --- | --- | --- |
| Motor fora da API | Feito: `packages/proprietary-engine/src/builds/builds-aggregate.js` | — |
| `delta_wr_pp_*` | Feito | — |
| Pacotes suportados vs provisórios | Feito | — |
| Peso weighted/unweighted + sensibilidade | Feito | — |
| HTTP 200 + `partial:true` | Feito | — |
| Cache v3 | Feito | Invalida payload antigo sem `emblems` |
| Emblemas isolados (F11b) | Feito: `emblems` com suporte/delta/win mediana | — |
| Força da combinação (F11b) | Feito em `top_builds` | Índice heurístico, não winrate |
| `discovery_status` F8 | Implementado como `local h<=1`, `emerging h==2`, `consolidated h>=3` | Validar precedência proposta |
| Enumeração de 4 itens (F6) | Sets atuais usam tamanhos 2 e 3 | Implementar quádruplas se o produto confirmar |
| Scatter B3 / quadrante F12 | Não implementado na tela | Backlog de UI |
| Detalhe da combinação (seção 7 da UI) | Não implementado | Backlog de UI |
| Fase 2 B6/B7 | Não implementado, placeholder removido | Fase 2 |

## 10. Decisões em aberto

1. **Job diário de lane completa no MVP?** Com só top-10 de uma lane,
   combinações com `h ≥ 3` podem ser raras e a tela pode abrir quase vazia.
   Recomendação: job em background (172 requests, 40–45 s) gravando o cache
   derivado, com a página lendo só o cache.
2. **Limiares de `large_shift` (2 pp sugerido) e precedência de
   `discovery_status`**: conferir com `builds-aggregate.js`.
3. **Fronteira do silêncio**: o QA usa `≤ 2 pp` em um trecho e `< 2 pp` em outro.
   Definir um só critério e testar o valor exato `2,00`.
4. **Botas (Movement) nas trincas de B1**: incluir, excluir ou marcar.
5. **Alinhar testes do QA ao contrato novo**: `delta_wr_pp_*` em vez de `lift_*`,
   `200 + partial:true` em vez de 206, chave v3 e unidade em pp.
