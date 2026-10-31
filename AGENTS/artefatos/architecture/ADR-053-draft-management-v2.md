# ADR-053 — Draft Management v2: layout em seções, recomendador de 2 fatores e leituras de duração

**Data:** 2026-10-29 · **Status:** aceito · **Contexto:** evolução da tela `/draft` (ADR-052) para layout em seções horizontais, força em percentual, matriz 5x5, curva de duração e relação entre arquétipos.
**Substitui:** apenas a decisão de layout de ADR-052 (D1 continua: rota própria `/draft`). O índice, a honestidade e o “zero endpoint novo” permanecem.

## Contexto

A v1 entregou o draft completo e um índice relativo, mas a leitura ficou concentrada num painel lateral: não havia comparação par a par visível, nem evolução por duração, nem uso do `profile` que o motor já publica por par (`classifyDuration`). O pedido agora é operacional: montar o draft à esquerda, ver candidatos à direita **na rota do slot**, comparar os 5×5 e ler o comportamento no tempo.

## Decisão

### D1 · Layout em faixas horizontais
1. **Draft** (esquerda): cada time em faixa horizontal — 5 slots lado a lado e **bans acima** dos picks. **Recomendações** à direita (`sticky`).
2. **Força em percentual** logo abaixo dos dois times (mesma coluna).
3. **Matriz 5×5** em largura cheia; **curva de duração** na faixa seguinte; **mix de arquétipos** depois da curva.
4. Por último, o detalhe do índice. A timeline “Ordem do draft” saiu: a ordem já está no cabeçalho e o estado do draft é visível nos slots.

Motivo: o olho faz draft → recomendação → comparação → tempo, sem rolar para trás. Em telas estreitas as faixas empilham na mesma ordem.

### D2 · “Percentual” é divisão do índice, não probabilidade
`shareᵤ = índiceᵤ / (índiceᵤ + índiceₑ)`, exibido como `62% · 38%` junto dos índices `62,4 · 47,8` (escala 0–100 da ADR-052 D2).

- Só existe com **os dois** índices presentes; com um lado vazio a tela mostra `—` (nunca 100%).
- O rótulo é obrigatório: “divisão do índice somado — não é probabilidade nem previsão”.
- Por que não usar θ̂ médio: o índice já pondera credibilidade, sinergia e confronto; recalcular uma segunda média criaria dois números concorrentes na mesma tela.

### D3 · Curva por duração: sinergia das duplas do time, explicitamente não do time
Fonte única: `Pair.curve` (`{label, mid, win}`) que o fio já entrega por par e da qual o motor deriva `Pair.profile` (`classifyDuration`). É a mesma curva que a tela de confronto mostra para um par. O gráfico é o mesmo de sempre — duas linhas, nós × eles — só o cálculo muda.

- **Dupla** = par de heróis escolhidos do time, 2 a 2 (`i < j`) — 5 heróis → até 10 duplas. A fonte lista só os **5 melhores parceiros** de cada herói (conferido no cache real: `matchups:92 · synergiesUp → ids [112,55,14,34,102]`), então dupla não listada não contribui — nunca é inventada. Filtrar por vizinhança de slot dava série vazia em times reais.
- Cada dupla resolve a curva no livro dos seus dois heróis (`synergiesUp`, com `synergiesDown` como reserva); as duas perspectivas entram com peso igual e a dupla vale **um valor por faixa**.
- Valor da faixa = média das duplas presentes; `n` = duplas com ponto na faixa; a ordem vem do `mid` (minutos). Faixa sem dupla = `null` (buraco na linha, nunca 0).
- Duas séries (nós/inimigo) + referência de 50%; abaixo, o Δ por faixa em pontos percentuais. Quando um lado não tem dupla listada, a legenda diz “sem dupla listada” e explica o motivo, em vez de simplesmente sumir com a linha.
- Rótulo obrigatório: “média das curvas das duplas do time, por faixa de duração — proxy, não win rate do time”.
- **Não** convertemos a curva em índice de poder por faixa: `50 + 50·tanh(...)` exigiria outro `K` calibrado, e não há dado de draft real para calibrar. A curva mostra a taxa como ela é.

Por que duplas e não o confronto: a confrontação já é a matriz 5×5 ao lado. A curva responde outra pergunta — o formato das duplas deste time ao longo da partida — e por isso usa sinergia interna, do mesmo jeito para os dois lados, uma série por time. A tela **não** rotula early/mid/late: mostra a série e deixa a leitura do formato para quem olha.

### D4 · Arquétipo do herói = perfil dominante dos pares (regra do motor)
Usa `dominantProfileOf` de `@radar/proprietary-engine` — a mesma função que o selo da `HeroCard` já usa. É a única leitura honesta disponível: o perfil existe **por par**; o herói herda a maioria com suporte `n/total`.

- Sem par com perfil → `null` (“sem dado”), nunca “uniforme”.
- O modelo puro da feature passa a poder importar o motor (como `shared/domain` já faz); o guardião verifica que nenhum outro import externo entra.
- `insufficient_data` (menos de 3 pontos na curva do par) é tratado como ausência, não como categoria.

### D5 · Recomendador de 2 fatores na rota do slot
`score = percentilMetaLane·1,0 + ajusteTipo·0,25`, ordenado antes por encaixe de rota (`true` → sem dado → `false`).

| Fator | Fórmula | Escala |
|---|---|---|
| Meta da lane | posição do θ̂ do herói entre os heróis **daquela lane** no recorte (percentil 0–1) | rank, não probabilidade |
| Ajuste de tipo | `+1` se o arquétipo é o que **contrabalança** o dominante inimigo; `−1` se repete a janela inimiga; `0` se neutro/sem dado | adimensional |

- **Contrabalança** = oposto do dominante inimigo: inimigo `snowball` → preferir `scaling`; inimigo `scaling` → preferir `snowball`; `uniforme`/sem dado → sem alvo.
- O peso `0,25` é **declarado** e não calibrado: um degrau de tipo vale ~25 pontos de percentil. Fica aqui e em `model/suggestions.ts`.
- A lane alvo vem de `?lane=` (persistida na URL); sem o parâmetro, segue a lane do próximo slot nosso, depois `exp`.
- O card mostra os dois fatores por extenso (“meta da lane: 87º percentil”, “tipo: scaling — contrabalança snowball”). Componentes observados (força/sinergia/confronto) continuam no `title`, como diagnóstico.

### D6 · Card maior para o 1º colocado, pick/ban em todos
O primeiro candidato ocupa um card destacado (avatar maior, dois botões visíveis); os demais vão em lista compacta. **Todo** candidato tem `Pick` e `Ban`:

- `Pick` grava no próximo slot nosso em aberto (`nextPickIndex(state, lane)`); sem slot → desabilitado.
- `Ban` grava no próximo slot de ban nosso em aberto (`nextBanIndex`); sem slot → desabilitado.
- Herói já usado não aparece; as ações passam pelas mesmas guardas do `setPick`/`setBan` (INV-DMP-006).

Cada time também destaca o **maior e o menor θ̂** entre os picks (selo “mais forte”/“mais fraco” + resumo no cabeçalho). É rank do recorte, não win rate.

### D7 · Matriz 5×5 por par, direção da lista
Célula `(nosso i, inimigo j)`: `+` se `countersUp[i]` contém `j` (ou `countersDown[j]` contém `i`); `−` no espelho; os dois lados = **contestado** (célula neutra, contada); nenhum = **desconhecido** (`·`).

- Nunca somamos a linha: a matriz mostra pares, e o resumo por linha é **quantos** pares favorecem, não “vantagem total”.
- |δ| é severidade exibida no `title`; a direção nunca vem do sinal.

### D8 · Fan-out de pares agora inclui os candidatos da lane
ADR-052 D4 limitava o fan-out a ≤10 (os heróis escolhidos). Para pontuar arquétipo é preciso o livro dos candidatos.

- Teto: **8 candidatos** da lane (top θ̂, fora do draft) + **10 escolhidos** = **≤18 requests**, deduplicados e na mesma query key (`staleTime` 10 min).
- Os candidatos são recalculados quando muda a lane, o draft ou o recorte — nunca varre o pool (133).

## Consequências

- A tela responde “quem pickar agora” com dois critérios explícitos e “como isso evolui” com a taxa observada, sem inventar win rate de composição.
- O percentual e a curva são as duas leituras com maior risco de má interpretação: por isso carregam rótulo próprio no componente, não só no rodapé.
- Quando a fonte expuser perfil de herói (não só por par) ou IC por par, D3/D4 podem ser promovidos de proxy para medida — o modelo isola as duas funções.
- Custo: até 8 requests adicionais por lane visitada, amortizados pelo cache de 10 min.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Percentual como probabilidade de vitória | Proibido pelo produto; sem dado de draft real. |
| Curva → índice com novo `K` | Calibração inventada; a taxa observada já é interpretável. |
| Arquétipo por tabela fixa de heróis | Manutenção manual e sem fonte; o motor já deriva perfil de par. |
| Sugerir só por θ̂ | Ignora o pedido de contrabalançar a composição inimiga. |
| Varrer os 133 livros para pontuar arquétipo | Estoura rate limit (ADR-052, alternativa descartada). |
