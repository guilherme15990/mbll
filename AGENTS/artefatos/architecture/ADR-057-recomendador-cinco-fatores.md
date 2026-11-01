# ADR-057 — Recomendador de cinco fatores na lane alvo (Draft Management)

**Data:** 2026-10-31 · **Status:** aceito · **Contexto:** evolução do recomendador da tela `/draft` (ADR-053 D5/D6), que passou de 2 fatores (percentil da lane + ajuste de tipo) para cinco variáveis pedidas pelo produto.
**Relação:** substitui a **D5** da ADR-053. Índice, honestidade estrutural, fan-out e “zero endpoint novo” permanecem (ADR-052/053).

## Contexto

A ADR-053 D5 pontuava o candidato com dois fatores. O pedido agora é explícito: a recomendação deve **observar cinco variáveis**:

1. o herói é **counter** de alguém do time inimigo?
2. o herói tem **antisinergia** com alguém do meu time?
3. o herói é **counterado** por algum inimigo (exposto)?
4. o herói está **forte no meta** (o que o sistema já responde)?
5. o herói **ajuda a balancear** o time?

## Decisão

### D1 · Cinco fatores declarados, todos do mesmo recorte
`score = Σ w·bondade / Σ w` **só dos fatores disponíveis** — fator sem par observado sai do denominador (mesma regra do índice). Nunca vira 0, nunca é probabilidade.

| # | Fator | Fonte | Sinal | Peso |
|---|---|---|---|---|
| 1 | **counter** | `countersUp` do herói × `countersDown` do inimigo | positivo para nós | `COUNTER_WEIGHT = 1` |
| 2 | **antisinergia** | `synergiesDown` (nós × aliado) | negativo para nós | `ANTISYNERGY_WEIGHT = 1` |
| 3 | **exposição** | `countersDown` do herói × `countersUp` do inimigo | negativo para nós | `EXPOSURE_WEIGHT = 1` |
| 4 | **meta** | percentil do θ̂ entre os heróis da lane no recorte | 0–1 (rank) | `META_WEIGHT = 1` |
| 5 | **balanceamento** | arquétipo do herói × oposto do dominante inimigo | +1 / 0 / −1 | `BALANCE_WEIGHT = 0,25` |

- **Counter é média por par**, nunca soma entre os cinco inimigos (INV-DMP-003). A **direção vem da lista** (`countersUp`/`countersDown`, `synergiesUp`/`synergiesDown`), nunca do sinal do δ.
- Cada fator de par vira bondade `0,5 + 0,5·tanh(δ_líquido / PAIR_SCALE)` com `PAIR_SCALE = 0,05`. `0,5` é o neutro; acima disso o sinal ajuda. Escala de **exibição**, não calibração de win rate.
- **Meta** é o percentil do θ̂ (rank dentro da lane), a resposta que o sistema já dá — não criamos um segundo número concorrente.
- **Balanceamento** é o ajuste de arquétipo da ADR-053 D5 mantido: contrabalança o dominante inimigo, repete ou é neutro; herói/sem dado ou sem alvo saem do denominador. O peso `0,25` segue **declarado** (um degrau ≈ 25 pontos de bondade).
- **Interpretação do 5º fator (registrado):** “ajuda a balancear o time” foi lido como **contrapeso de arquétipo** (janela de duração), não como sinergia positiva com os aliados. É o que o modelo já sabia medir sem inventar leitura. Se o pedido era sinergia positiva (`synergiesUp`), trocar a fonte é uma mudança de uma linha.

### D2 · A lane alvo manda na lista
O herói de **outra** lane não é candidato (`laneFitOf === false` → fora). O encaixe na lane é o **primeiro** critério de ordem (`laneFitRank`), antes do score: herói da lane sempre acima de quem não tem dado de lane.

- Herói **sem dado de lane** (`lanes` vazio → `laneFit === null`) continua na lista, mas atrás de quem encaixa e com `meta = null` (fora do denominador). Ausência de dado não vira exclusão.
- Motivo: a lane é a lente da recomendação (sem seletor de rota no slot); listar herói de outra lane misturava a leitura. A tela reclamava disso.

### D3 · Ordem
`laneFitRank(enchai) → score desc → fatores observados desc → meta desc → nome`. `laneFitRank(true) = 0`, `laneFitRank(null) = 1`.

### D4 · UI mostra os sinais, não o score
O card do 1º colocado e a lista compacta renderizam **chips só dos fatores observados**: `countera N`, `antisinergia N`, `exposto N`, `meta NN`, `balanceia/repete/neutro`. Sem par observado no recorte, o chip dá lugar a “sem par observado neste recorte”. O `score` continua **nunca exibido**.

### D5 · O que sai
- O fator bruto de força (`strength = θ̂ − μ` com peso de credibilidade) sai do recomendador: a “força no meta” agora é o percentil da lane (fator 4). A força média do time continua no índice (`power.ts`, ADR-052 D2).
- `laneFit` deixa de ser badge no card; passa a ser **portão** da lista.
- `baseline` permanece na assinatura de `pickSuggestions` por compatibilidade com o índice; o recomendador não o usa.

## Consequências

- A lista responde às cinco perguntas do pedido, cada uma rastreável a um par observado ou ao rank de meta; fator sem dado não é penalizado nem premiado.
- Como o score é média dos fatores presentes, um fator positivo abaixo da média corrente baixa o score — comportamento inerente à média (documentado em ADR-053 D5). Fixtures de teste usam meta baixo/ausente para isolar cada fator.
- Custo: zero request novo. Os candidatos da lane já vinham no fan-out (ADR-053 D8); o portão de lane **reduz** o ruído da lista.
- Testes: `test/draft-management.test.mjs` cobre cada um dos cinco fatores + o portão de lane; o guardião estático segue exigindo `BALANCE_WEIGHT = 0.25` e `lanePercentile` no domínio.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Somar os efeitos dos cinco inimigos no counter | Privilegia time cheio e fere a média por par (INV-DMP-003). |
| Probabilidade/expectativa de vitória com os cinco fatores | Proibido pelo produto; sem dado de draft real. |
| Excluir herói sem dado de lane | Confunde ausência de dado com “não joga a lane”; fica atrás, não fora. |
| Contar sinergia positiva como 5º fator | Não foi pedido; o pedido é contrapeso de janela (ver D1, nota de interpretação). |
| Manter o score como 6º fator exibido | O produto lê fatores, não um número composto. |
