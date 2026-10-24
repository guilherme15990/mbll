# Builds agregada (CTX-BDL) — Textos da tela

Data: 2026-10-21 · Destino: produto e frontend · Audiência: jogador
Fonte: `builds-aggregate-engine-rules.md` (fórmulas internas).

O motor continua rigoroso. A tela fala a língua do jogador. Nenhum termo
estatístico precisa aparecer no primeiro olhar.

## 1. Princípio

- **Rigor no código, resultado na tela.**
- O jogador vê o que a combinação significa: “vence mais”, “vence menos”,
  “aparece junto”, “poucos dados”.
- Números como `pp`, `k/m/h`, `weighted`, `unweighted`, `lift` e `Camada A` ficam
  em **“Como isso foi calculado”**, recolhido.
- Não afirmar causa. Não destacar diferença pequena. Avisar quando há poucos
  dados, sem mostrar número.

## 2. Tradução de termos

| Termo interno / QA | O que o jogador vê |
| --- | --- |
| Δ win em pp | Seta ▲ “Vence mais que o normal do herói”. Sem seta quando a diferença é pequena. O número (“+3 pontos”) só no painel de detalhe. |
| `k` heróis · `m` builds · `c` contextos | “Usada por 5 heróis”. O resto some ou vai para “ver detalhes”. |
| Pacote inseparável | “Sempre juntos” ou “Trio fixo”. |
| Núcleo parcial 3–4/6 | “Itens principais”. |
| Escopo `cross_hero` / `local · 1 herói` | “Vários heróis” / “Exclusiva do Johnson” (com link para a ficha dele). |
| Status `emerging` | “Joia escondida” (pouco usada, mas rende bem). |
| Amostra insuficiente (`k=2, m=3`) | “Poucos dados”, sem número. |
| Camada A, não causal | Uma linha no rodapé: “Mostra o que aparece nos dados; não garante que o item é o motivo da vitória.” |
| Sensibilidade ao peso | Não aparece. Combinações instáveis só ficam de fora dos destaques. |
| Participação catalogada 25,9% | Não aparece. |
| Variantes do mesmo núcleo | “Mesma build, outro setup” (emblema, talentos, feitiço), só no detalhe. |
| Win rate do item | “Vence mais que o normal do herói” (nunca “win rate do item”). |
| Top build / melhor build | “Build mais usada”. Nunca “melhor build do jogo”. |
| Força composta (`hero × build × emblem`) | “Força” com um número de índice. Detalhe: “produto das três forças; não é winrate”. |
| `combination_strength_index` nulo | “Poucos dados”, nunca zero. |
| Peso por contraste (ADR-031) | “Peso no recorte”: diferença de vitória entre builds com e sem o componente, no mesmo herói+lane+rank. |
| Evidência `observed` | Selo **observado** (contraste com trocas pareadas suficientes). |
| Evidência `estimated` | Selo **estimado** + valor com `~` (existe sinal, mas pouco contraste). |
| Evidência `descriptive` (emblema) | Selo **descritivo**; mostrar uso e vitória, sem número de peso. |
| Evidência `none` | **“sem contraste”** — o componente nunca variou no recorte. Nunca “0” e nunca “sem suporte” nas abas de poder. |
| Troca pareada | “Troca limpa: mesmas outras peças” (só no detalhe). |

Os quatro arquétipos — ataque físico, ataque mágico, defesa física e defesa
mágica — já são linguagem de jogador e ficam como estão.

## 3. Estrutura da tela

### B0. Faixa de contexto e cobertura

Pergunta: “Sobre o que estou olhando e quanto disso eu vi?”

Mostrar:

- Heróis com dados / heróis da lane
- Builds
- Heróis no top
- Qualidade: “Completa” ou “Parcial”
- Rank, lane, top, idade do dado, selo de desatualizado

Não mostrar: `pick sum`, unidade `slot_share`, exposição, `pp`, catálogo.

### B1. Combinações

Pergunta: “Quais itens aparecem juntos e se repetem entre heróis?”

Abas/segmentos:

- **Trios**
- **Sempre juntos**
- **Poucos dados** (recolhido por padrão)

Cada cartão:

- Ícones e nomes dos itens
- “Sempre juntos” / “Poucos dados”
- “Vários heróis” / “2 heróis” / “Um herói só”
- “Padrão recorrente” / “Joia escondida” / “Só naquele herói”
- Seta de desempenho
- “Itens principais”

Vazio: “Nenhum trio com dados suficientes neste recorte.”

### B2. Itens e arquétipos

Pergunta: “Como estão os itens de ataque físico, ataque mágico, defesa física e
defesa mágica?”

- Quatro blocos principais.
- Bloco separado: “Híbridos, utilitários e não classificados”.
- Até 5 conjuntos por bloco.
- Cada cartão: itens, “Usada por N heróis”, seta, escopo, status.

Vazio por arquétipo: “Sem itens com dados suficientes.”

### B2b. Emblemas

Pergunta: “Quais emblemas aparecem e como se comparam com o normal do herói?”

- Seção própria **2c · Emblemas**, com a mesma lógica visual dos itens.
- Cada cartão: ícone + nome do emblema, seta de desempenho, “Aparece em X% das
  builds”, escopo e status.
- Suporte (`k/m/h`) fica em detalhe; abaixo do mínimo vira “Poucos dados”.
- Emblema não é recomendação. O texto de honestidade da página continua valendo.

Vazio: “Nenhum emblema com dados suficientes neste recorte.”

### B3. Desempenho observado × frequência

- Dispersão: X = “Frequência de construção”, Y = “Vence mais / vence menos”.
- Faixa cinza para diferenças pequenas, sem rótulo.
- Tooltip simples: “Usada por N heróis” e “Poucos dados” quando for o caso.
- Tabela equivalente para acessibilidade.
- Título: “O que se observa nos dados”. Nunca “melhores”.

> Estado atual: o gráfico ainda não foi implementado; a lista de conjuntos cobre
> o MVP.

### B4. Runas, talentos e feitiços

- Três listas separadas: páginas de runa, talentos e feitiços (ADR-029).
- Cada linha: “Vitória mediana”, “aparece em X% das builds” + seta.
- **Talentos agrupados por tier**: a % de uso só é comparável dentro do tier, porque
  cada build usa 1 talento por tier.
- Abaixo do mínimo: “Poucos dados”.
- Rótulo: “O que costuma acompanhar essas builds. Não é uma recomendação.”

### B5. Fase 2

Não renderizar placeholder. Pro MPL e sinergia par-a-par ficam fora do MVP.

### B6. Builds + poder (`view=power`)

Aba separada do Combinador (ADR-030 §8.2). Lista as builds observadas do recorte
com tudo que elas já têm e deixa completar até 6 itens.

- Cabeçalho do card: herói + tier + `wrAdj`, e os chips do que a build já carrega —
  feitiço, emblema, talentos (com o tier).
- Linha de itens: ícones dos observados, depois os adicionados, depois os slots
  vazios (tracejado + “+”). Contador “X/6 itens · faltam N”.
- Bloco do índice (à direita): “Índice estimado”, número, “N obs · M est de T” e a
  barra de cobertura. Nunca chamar de “poder da build” sem qualificador.
- Bloco observado, separado e abaixo: “Observado: vitória mediana X% · usada em Y%
  das builds”, “vs build mais usada: +N pp” ou “sem diferença relevante”, e a
  referência (“mais usada”). Esse bloco é descritivo: não entra no índice.
- Chips “adicionados: <item>” com remover (`−`). Item extra nunca vira observado.
- Seletor de item: “Só itens observados neste recorte. Uma bota no máximo.”
  Item sem contraste mostra “sem contraste”, nunca zero e nunca “sem suporte”.
- `<details>` “De onde vem o índice (N componentes)” com componente, **selo de
  evidência** (observado / estimado / descritivo / sem contraste), peso e pontos.
  O emblema aparece com “descritivo” e o motivo (“constante dentro do herói”).
- Rodapé fixo: “O índice é relativo, não é previsão, não é probabilidade e não é o
  ‘Poder da Build’ oficial. O peso de cada componente é um contraste com o mesmo
  herói+lane+rank; o emblema fica descritivo e não soma.”

Filtros: herói do recorte, ordenar por índice/observado/herói, “só 6 itens”.
Ordenar por índice é rotulado como índice, nunca como “melhores builds”.

## 4. Painel de detalhe da combinação

Quando implementado, mostra:

- **Heróis que usam**: chips com nome, lane, nº de builds e seta. Cada chip leva
  à aba Builds da ficha, com herói + lane + rank pré-selecionados.
- **Mesma build, outro setup**: variantes de emblema/talentos/feitiço.
- **Runa e feitiço mais associados**.
- **Como isso foi calculado**: `k/m/h`, `pp`, sensibilidade ao peso, referência e a
  fórmula `100 × força do herói × força da build × força do emblema` (índice
  heurístico, não winrate).

Heróis nunca são ranqueados entre si nem com “melhor build”.

## 5. Estados e erros

- **Loading**: skeletons por bloco, sem deslocamento de layout. Em B0, uma linha.
- **Parcial**: “Alguns heróis não carregaram (X de N). O restante da página
  continua válido.” HTTP é 200 com `partial:true`, mas isso não aparece na tela.
- **Vazio ≠ erro**: lane sem builds é “Sem builds deste herói nesta lane.”
- **Stale**: “há Xh” + opacidade reduzida; nunca esconder a idade.
- **Circuit breaker aberto**: servir stale com banner.
- **Item/talento/emblema fora do catálogo**: `#id` + “não catalogado”; a
  combinação continua exibida.

## 6. Copy obrigatória

- “Itens principais” em todo conjunto da Academy.
- “Mostra o que aparece nos dados; não garante que o item é o motivo da vitória.”
- “Sempre juntos” em vez de três linhas de item.
- “Poucos dados” no lugar de qualquer número abaixo do mínimo.
- “Vence mais que o normal do herói” / “Vence menos que o normal do herói”.
- “Build mais usada”, nunca “melhor build”.
- Nas abas de poder: “sem contraste” (componente que nunca variou), “estimado”
  (valor com `~`) e “descritivo” (emblema) — no lugar de “sem suporte”.

## 7. Copy proibida

Lint de texto deve barrar:

- “causa”, “ganha”, “melhora”
- “melhor build do jogo”
- “win rate do item”
- “lift” para pontos percentuais
- “n partidas”
- “pp” no primeiro olhar
- “k=”, “m=”, “h=” no primeiro olhar
- “amostra insuficiente” no primeiro olhar (usar “Poucos dados”)
- “poder oficial”, “Poder da Build” sem “estimado/observado”
- “score da build”, “nota da build”, “tier da build”

## 8. O que já foi ajustado na UI

- Setas de desempenho no lugar de `Δ WR em pp`.
- “Sempre juntos”, “Itens principais”, “Vários heróis”, “Um herói só”.
- “Padrão recorrente”, “Joia escondida”, “Poucos dados”.
- “Usada por N heróis” no lugar de `k/m/h`.
- Detalhes técnicos em “Como isso foi calculado”.
- Remoção do card de fase 2.
- Rodapé simples de honestidade.
- Seção **2c · Emblemas** com suporte, adoção, seta, escopo e status.
- Aba **Combinações** com força composta e detalhe da fórmula.
- Aba **Combinador** (`view=combiner`): pick livre + índice estimado (ADR-030).
- Aba **Builds + poder** (`view=power`): builds observadas completas em 6 itens,
  índice à direita e observado em bloco separado (ADR-030 §8.2).
- Peso por **contraste dentro do contexto** (ADR-031): selos observado/estimado/
  descritivo/sem contraste; emblema descritivo; `~` em valor estimado.

## 9. O que ainda falta

- Abas “Trios / Sempre juntos / Poucos dados” (hoje é uma lista contínua).
- A aba **Combinações** já existe como explorador observado; regras em
  `builds-combinations-tab.md`.
- Scatter B3 e tabela acessível.
- Painel de detalhe por combinação com heróis e link para a ficha.
- Substituir “Exclusiva de um herói” por “Exclusiva do Johnson” quando houver um
  único herói identificável.
- Lint de texto para as palavras proibidas.
