# Builds — aba Combinações (explorador observado)

Data: 2026-10-21 · Destino: produto e frontend
Base: `builds-aggregate-engine-rules.md` e `builds-aggregate-ui-copy.md`.

## 1. Job do jogador

“Jogo com um herói e quero ver se um emblema, talento ou feitiço diferente já apareceu
em builds parecidas — e como essas builds se saíram em relação ao normal do herói.”

A aba **não prevê** o futuro. Ela **encontra combinações que já existem nos dados** e
mostra o desempenho observado de cada build contra a referência do próprio contexto.

## 2. O que a aba é e não é

- É: um explorador de builds observadas, filtrável por herói, núcleo de itens,
  emblema e talento.
- É: uma forma de ver “quem mais usa esse núcleo com esse emblema” e “como cada build
  se compara com a build mais usada daquele herói”.
- É: uma forma de comparar combinações observadas por um índice de força composto.
- Não é: previsão, recomendação, “melhor build”, ranking entre heróis ou relação causal.
- Não é: win rate poolado de item/emblema. A comparação é sempre dentro do contexto
  (herói + lane + rank), usando a referência do próprio contexto.
- O índice de força **não é winrate da combinação**. É um produto de três forças
  (herói × build × emblema) usado apenas para ordenar o que já foi observado.

## 3. Fonte de dados do MVP

A aba usa `top_builds` e `emblems` da resposta existente de
`GET /v1/builds/aggregate?lane=&rank=&top=&population=ranked`.

Cada item de `top_builds` já traz:

- herói (id, nome, head, tier, `wrAdj`)
- builds daquele herói no recorte
- itens, `core_key`, emblema, talentos, feitiço
- `delta_wr_pp_vs_most_used`
- `hero_strength`, `build_strength`, `emblem_strength`
- `combination_strength`, `combination_strength_index`

`emblems` traz, por emblema:

- `emblem_id`, `name`, `icon`
- `contexts`, `builds`, `hero_coverage`
- `win_median`, `delta_wr_pp_median`
- `support`, `adoption_builds`, `pattern_scope`, `discovery_status`

Isso permite o explorador sem nova rota. O recorte continua sendo o top-10/top-20
da lane, com a mesma política de suporte do agregado.

## 4. Filtros

- **Herói**: todos ou um herói do recorte.
- **Núcleo de itens**: todos ou um `core_key` exato (itens ordenados).
- **Emblema**: todos ou um emblema (`id`; sem nome = `#id`).
- **Talento**: todos ou um talento (`id`; sem nome = `#id`).
- **Ordenar por**: força da combinação (padrão) ou ordem observada.

O botão “Limpar filtros” volta ao estado inicial.

## 5. Força da combinação

```text
força_herói   = wrAdj do herói
força_build   = win da build
força_emblema = win_median do emblema no recorte
índice        = 100 × força_herói × força_build × força_emblema
```

Regras:

- O emblema precisa ter suporte mínimo (`k>=3`, `m>=5`). Sem isso,
  `combination_strength` e `combination_strength_index` são `null`.
- Quando o índice é nulo, a linha mostra “Poucos dados”, nunca um número inventado.
- O índice é heurístico e relativo. Não é probabilidade, não é winrate da combinação e
  não prova causalidade.
- O detalhe “Como isso foi calculado” mostra a fórmula e as três forças.
- A ordenação padrão é por força desc; empate usa o delta observado desc.
  O usuário pode voltar para a “Ordem observada”.

## 6. Resultado

Cada linha é **uma build observada**:

- herói + tier
- ícones dos itens principais
- emblema
- talentos
- feitiço
- força da combinação (índice)
- seta de desempenho contra a build mais usada do mesmo herói
- link “Abrir builds do herói” para `?view=hero&hero=…&lane=…&rank=…&window=…`

Resumo do recorte filtrado:

- X setups observados
- Y heróis
- Z núcleos
- “Poucos dados” quando X < 3

Limite de 40 linhas renderizadas; acima disso, pedir para refinar os filtros.

## 7. Seção de emblemas na visão Sistema

A visão **Sistema** de `/builds` tem uma seção própria **2c · Emblemas**, análoga à
seção de itens:

- ícone e nome do emblema
- suporte (`k/m/h`) em detalhe
- “Aparece em X% das builds”
- seta de desempenho contra o normal do herói
- escopo (um herói / dois heróis / vários heróis)
- status (padrão recorrente / joia escondida / exclusiva)
- “Poucos dados” para emblemas abaixo do suporte mínimo

A seção não recomenda emblema. Ela apenas descreve o que foi observado.

## 8. Resumo por emblema dentro do explorador

Quando um núcleo é selecionado, mostrar “Emblemas com esse núcleo”.

Agrupamento: `emblema + talentos ordenados + feitiço` (página de runa).

Para cada grupo:

```text
perHero = median(delta_wr_pp_vs_most_used) por herói
delta = median(perHero)
heroes = número de heróis no grupo
builds = número de builds no grupo
```

A mediana por herói evita que um herói com várias builds domine o resultado.

Exibir:

- nome do emblema (ou `#id`)
- “N heróis · M builds”
- seta de desempenho
- “Poucos dados” quando `builds < 3`
- talentos e feitiço da página

Não ordenar por win poolado. Ordem: heróis desc, builds desc, delta desc; teto de 8.

## 9. Regras de honestidade

- A seta usa a referência do contexto: build mais usada do herói.
- Diferença pequena (`|delta| < 2 pp`) não mostra seta nem destaque.
- A força é um índice heurístico; não é winrate, probabilidade nem ranking de heróis.
- O resumo por emblema é descritivo; não é recomendação.
- O texto “Observado, não recomendado” acompanha o resumo.
- Nenhum N de partidas.
- Nenhum win rate poolado entre heróis.
- O filtro por talento não implica que o talento seja a causa da vitória.
- Emblema sem suporte mínimo não recebe força nem seta.

## 10. Copy da aba

- Aba: **Combinações**
- Título: **Monte uma combinação e veja quem usa**
- Subtítulo: “Filtre por herói, núcleo de itens, emblema ou talento. A força é o
  produto herói × build × emblema — um índice, não winrate.”
- Aviso: “Exploração, não recomendação. O sistema mostra o que já apareceu; não prevê
  o futuro nem garante que a combinação causa a vitória.”
- Força: **Força** (número do índice) ou **Poucos dados**.
- Vazio: “Nenhuma combinação com esses filtros” / “Tire um filtro ou escolha outro
  núcleo. Só mostramos o que existe nos dados.”
- Detalhe: “O filtro não prevê nem recomenda: ele só encontra builds que já existem
  nos dados. Não há N de partidas.”

## 11. Critérios de aceite

1. A aba aparece em `/builds` como segunda opção: Sistema → Combinações → Por herói.
2. Filtrar por herói + núcleo + emblema retorna somente builds observadas que casam.
3. Cada linha mostra a seta contra a referência do próprio herói.
4. Cada linha mostra a força quando o emblema tem suporte; “Poucos dados” quando não.
5. A força respeita `100 × wrAdj × win × win_median` e não é chamada de winrate.
6. O resumo por emblema usa mediana por herói; não usa win poolado.
7. “Poucos dados” aparece quando o grupo tem menos de 3 builds.
8. Nenhum texto de “melhor build”, “previsão” ou “causa”.
9. O link para a ficha abre a aba Builds do herói com lane/rank/window preservados.
10. A aba funciona com o payload atual, sem nova chamada de API.
11. A visão Sistema exibe a seção 2c · Emblemas com suporte, adoção e seta.

## 12. Limitações e próximos passos

- O MVP só vê o top-10/top-20 da lane; não cobre a lane inteira.
- Não há similaridade fuzzy de núcleo: o filtro é `core_key` exato.
- Não há modelo preditivo. Para “prever”, seria necessário um modelo com validação,
  população e feature store — fora do escopo.
- A força composta usa três estimativas de naturezas diferentes; serve para exploração,
  não para decisão competitiva.
- Próximo passo possível: job de lane completa, depois similaridade de núcleo
  (ex.: 2 de 3 itens iguais) com suporte e rótulo “parecido”, nunca “igual”.
- Fase 2: população pro separada; não misturar com ranked.
