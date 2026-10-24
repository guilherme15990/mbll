# ADR-029 — Talentos com vitória mediana e uso por tier

- Data: 2026-10-22 · Autor: saas-lead
- Status: **aceito** (decisão L2)
- Base: ADR-028, `builds-aggregate-ui-copy.md` (B4) e pedido do usuário em 2026-10-22.

## Contexto

A seção 3 (Emblemas) mostrava `win_median` como "Vitória na rota". Os talentos e
feitiços ficavam em chips dentro da seção 4, com **só** a aparição (%) e a seta de
delta. O motor já calculava `contextMetric().win_median` para talentos e feitiços,
mas não expunha o campo no payload.

Pergunta do usuário: mostrar winrate de emblema **+** talentos, listar a % de uso
dos talentos e decidir se as seções continuam separadas.

## Decisão

### 1. Seções continuam separadas

| Bloco | O que mede | Por que não fundir |
|---|---|---|
| Emblema | 1 slot por build | a vitória mediana do emblema é comparável entre emblemas |
| Talento | 1 por tier, 3 slots por build | a % de uso só é comparável **dentro do mesmo tier** (T1/T2/T3 competem pelo mesmo slot) |
| Feitiço | 1 slot por build | escolha independente de runa; mesma leitura do emblema |

Fundir em uma lista única faria porcentagens de tiers diferentes parecerem
alternativas entre si e sugeriria uma "soma" que não existe. Cada bloco responde a
uma pergunta distinta — regra herdada do ADR-028 ("cada seção responde uma
pergunta").

### 2. Motor expõe `win_median` em talentos e feitiços

`talentRows` e `spellRows` passam a publicar `win_median: metric.win_median`
(mediana por contexto, mesma métrica dos emblemas). Nada de win poolado entre
heróis.

### 3. Teto por tier, não global

`TALENTS_MAX_PER_TIER = 6`. O limite antigo (10 no total, ordenado por adoção)
podia esconder tiers inteiros quando um tier dominava. Agora a ordenação é
`tier asc → adoção desc` e o corte é por tier.

### 4. Tela

- Seção 4 mantém a página de runa como cartão de combinação (agora com "Vitória
  mediana").
- **Talentos**: cartão próprio, agrupado por tier, cada linha com barra + `% das
  builds`, "Vitória mediana" e seta compacta (▲/▼ com tooltip).
- **Feitiços**: cartão próprio, mesma linha de leitura.
- Emblemas seguem na seção 3, inalterados.

## Consequências

- Copy: continua sem "win rate do talento", "melhor talento", "causa" e sem N de
  partidas. O número aparece como "Vitória mediana"; a leitura continua descritiva.
- Payload cresce alguns campos por linha (sem nova rota, sem novo request).
- `AGGREGATE_VERSION` sobe para `builds-aggregate-v4` e a chave de cache para
  `builds:agg:v4:…`: sem isso, um corpo quente antigo seria servido sem
  `win_median` nos talentos e a tela mostraria “—”.
- A % de talento passa a ser lida como fatia do tier; a UI diz isso em texto.
- Dívida assumida: talento sem `tier` no catálogo cai no grupo "Sem tier no
  catálogo" e não é comparável com os demais.
