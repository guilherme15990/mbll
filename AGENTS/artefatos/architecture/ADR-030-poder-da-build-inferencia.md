# ADR-030 — Poder da Build decomposto por componente (sem âncora oficial)

- Data: 2026-10-22 · Autor: saas-lead
- Status: **aceito** (decisão de produto: engenharia reversa do número oficial descartada)
- Relaciona: ADR-027 (IFC), ADR-028 (IA final), `builds-aggregate-engine-rules.md`

## 0. Mudança de premissa

A versão anterior deste ADR propunha recuperar `f` por engenharia reversa/sondagem.
Decisão de produto em 2026-10-22: **isso não é viável**. Portanto o objetivo deixa
de ser reproduzir o número da Moonton e passa a ser:

> atribuir um valor a **cada componente** (item, emblema, talento, feitiço) e ao
> **herói**, de modo que o poder de uma build seja a soma desses valores — inclusive
> para combinações que nunca foram observadas, que é o que o combinador precisa.

O número passa a ser **nosso**, com escala declarada. Não é, e nunca será chamado de,
"Poder da Build oficial".

## 1. O que pode ser inferido

Observamos, por build: `win`, `pick`, itens, emblema, talentos, feitiço, e a
referência do contexto (build mais usada / média do herói). Não observamos partidas
nem `P`. Logo:

- **não** dá para separar "poder do item" de "poder do herói" olhando um herói só;
- **dá** para separar quando o mesmo componente aparece em heróis diferentes, porque
  aí o herói vira efeito fixo e o componente é o que se repete;
- componentes 100% colineares (ex.: emblema que só aparece com o mesmo arquétipo de
  item) **não são identificáveis** — recebem prior e incerteza, não um valor cravado.

Assumimos que **o herói influencia** (decisão do usuário). Ele entra como intercepto
separado, nunca somado ao mérito da build: o usuário vê "base do herói" e
"contribuição dos componentes" em linhas distintas.

## 2. Modelo: PEA (Poder Estimado Aditivo)

### 2.1 Escala interna

Trabalhamos em **log-odds**, onde efeitos se somam:

```
η(b | h) = α_h + Σ_i β_item[i∈b] + β_emblema[e] + Σ_t β_talento[t] + β_feitiço[s] + ε
```

- `α_h` = base do herói (absorve força do herói, lane e rank via efeitos fixos);
- `β` = contribuição de cada componente;
- alvo: `logit(win_b) − logit(win_ref_h)` (delta vs build mais usada do próprio
  herói), o que remove o nível do herói da equação;
- peso por contexto: **1 voto por herói** (não por pick), para herói popular não
  dominar a estimativa.

### 2.2 Escala exibida

```
IP(b | h) = 100 + 250 × η(b | h)        // 100 = build de referência
Contribuição(c) = 250 × β_c             // soma das contribuições = IP − 100
```

Linear de propósito: se a escala fosse exponencial, os valores por componente não
somariam. `IP` é índice relativo, não probabilidade. O delta em pp continua sendo
calculado à parte (`logistic(η) − 0.5`).

### 2.3 Prior informativo (o que impede número absurdo)

Com ~150–600 builds observadas e ~250 componentes, MLE puro overfitta. Cada `β`
recebe prior vindo dos atributos:

1. **Vetor de atributos** `x(c)` por componente: atk, mag, hp, def física/mágica,
   pen, crit, crit dmg, atk speed, CDR, lifesteal, spell vamp, move speed.
   - item: parser de `equiptips` (texto numérico);
   - emblema: `emblemattr` já estruturado;
   - talento: parser de `skilldesc` quando numérico; condicional vira flag;
   - feitiço: flag de utilidade (mobilidade, dano, defesa).
2. **Pesos de ouro**: resolver `preço_i ≈ c + Σ w_s·x_is` (NNLS) no catálogo. `w_s`
   é o valor revelado pela economia do jogo.
3. **Prior**: `β_c ~ N(κ·Σ w_s·x_s(c), τ²)`, com `κ` calibrável. Componente sem
   atributo numérico (talento condicional) tem prior 0 e `τ` maior.
4. **Fit**: ridge/empirical Bayes em forma fechada, `τ` escolhido por
   leave-one-hero-out. Sem dependência nova.

### 2.4 Interações (só se sustentadas)

Aditividade é a única estrutura que **extrapola** para combinações não observadas.
Portanto:

- pares de item entram como termo extra **apenas** se tiverem suporte mínimo e
  melhorarem o holdout; caso contrário, ficam de fora;
- bônus de conjunto/condição de talento não entram como se fossem stats fixos;
- toda build montada à mão carrega o selo `extrapolada` quando algum componente não
  aparece nos dados daquele herói.

## 3. O que o combinador recebe

Para cada componente: `β`, `IP contribution`, `suporte (contextos/builds/heróis)`,
`incerteza` e `origem` (`observado` | `prior`). Para a build:

1. regras de slot: 6 itens (1 botas, sem duplicata), 1 emblema, 1 talento por tier,
   1 feitiço — o payload atual só cobre **3 itens**; os outros 3 são extrapolação;
2. `IP` + waterfall de contribuições;
3. `Δpp` esperado vs. build de referência do herói;
4. selo de confiança: quantos componentes têm suporte `ok`.

O combinador **não** escolhe por `IP` sozinho: mostra também o desempenho observado
quando a combinação existe nos dados.

## 4. Validação (gates)

| Gate | Critério |
|---|---|
| V1 — parser | ≥ 95% dos itens com atributos numéricos extraídos; relatório dos que falharam |
| V2 — sanidade | item de tanque não fica acima de item de dano no arquétipo errado; nenhum `β` com sinal invertido contra o prior sem suporte |
| V3 — predição | Spearman ≥ 0,3 entre `η` e `delta_wr_pp` em heróis deixados de fora |
| V4 — estabilidade | correlação ≥ 0,8 dos `β` entre duas janelas de tempo no mesmo patch |
| V5 — honestidade | nenhuma superfície chama `IP` de "oficial"; detalhe mostra prior, suporte e fórmula |
| V6 — cobertura | todo componente do catálogo tem valor (prior ou observado), nunca `null` |

Sem V1/V2, não entra na UI. Sem V3, o valor é só prior (não "aprendido").

## 5. Riscos assumidos

- **Colinearidade**: emblema e arquétipo de item andam juntos; parte do efeito vai
  para o prior. Mitigação: reportar incerteza e nunca ranquear componentes isolados
  como "melhores".
- **3 de 6 slots**: 50% da build do jogo não é observada. O combinador extrapola por
  soma, e diz isso.
- **Curadoria**: as 3 builds por herói são top-3 curado, não amostra aleatória.
  Componentes fora do top-3 têm pouco ou nenhum dado.
- **Patch**: `β` e prior são versionados por patch. Nunca misturar séries.
- **Falsa precisão**: `IP` com uma casa e waterfall; sem "melhor build do jogo".

## 6. Fatias de implementação

1. **Extrator**: parser de `equiptips`/`skilldesc` → `x(c)`; NNLS de ouro; testes
   com fixtures do catálogo. (sem UI)
2. **Estimador**: matriz de desenho a partir de `top_builds`; ridge com prior;
   `leave-one-hero-out`; relatório de `β` + incerteza por patch.
3. **Serviço**: `scoreComponents()` e `scoreBuild(loadout)` com regras de slot e
   selo de extrapolação; endpoint interno, sem rota pública nova.
4. **UI**: no combinador, `IP` + waterfall + selo de suporte; `IP` nunca aparece
   sozinho ao lado de win rate na mesma escala.

## 7. Descartado

- Engenharia reversa/sondagem do número oficial (decisão de produto).
- Chamar o índice de "Poder da Build" sem qualificador.
- Dummy por componente sem prior (overfit com 3 builds/herói).
- Multiplicar win rates (`hero × build × emblema`) — ver ADR-027.
- Tratar adoção (%) como utilidade: adoção mede escolha, não força.

## 8. Addendum — o que foi implementado (v1 da UI, 2026-10-22)

> **Substituído em 2026-10-23 (v5).** O estimador abaixo ("vs build mais usada")
> mede a mistura de builds, não o componente — item e emblema presentes em todas
> as builds recebiam o mesmo delta. O estimador em produção agora é o **contraste
> dentro do contexto** descrito no **ADR-031**. Este addendum fica como histórico;
> `delta_wr_pp_median`, `win_median` e `adoption` continuam no payload como
> descritivos.

O §2 descreve o alvo (PEA com prior de atributos e fit ridge). O §6 fatiou isso em
4 etapas e **só a etapa observada foi entregue**. O que está no ar hoje (histórico v1):

```
value_pp(c) = delta_wr_pp_median(c) × m/(m + 3)     // encolhimento por suporte
IP(b)       = 100 + 10 × média(value_pp dos componentes de b com dado)
```

- `delta_wr_pp_median(c)`: mediana, entre os heróis do recorte, da diferença de
  vitória da build que usa `c` contra a build **mais usada do próprio herói**
  (`body.top_builds[].builds[].delta_wr_pp_vs_most_used`). Isso já remove o nível
  do herói, como o §2.1 pedia — o herói é contexto, nunca parcela somada.
- `m` = contextos que sustentam `c`; `k = 3` (`COMBINER_SHRINK_K`). Com `m = 3`,
  o valor entra pela metade; com `m = 30`, por 91%. Evita que um item visto em 2
  contextos lidere a lista.
- **Sem suporte → `value_pp = null`**, nunca `0`. `0` afirmaria "não muda nada",
  que é uma conclusão que não temos. Consequência: `null` reduz a **cobertura**
  (`com dados / total`), não o índice.- Escala `100 + 10 × média`: 1 pp de efeito marginal = 10 pontos. A média (não a
  soma) mantém o índice comparável entre builds com números diferentes de
  componentes. 100 = efeito marginal zero, não "build perfeita".
- **Não há prior de atributo nem ridge nesta versão** (faltam §6.1 e §6.2). Logo o
  índice só existe para componentes observados; nada é extrapolado por atributo.
  O §2.4 (interações) continua fora: sem sinergia medida, o índice é aditivo puro.

### 8.1 Regras de honestidade aplicadas na UI (v5)

- rótulo sempre "índice estimado"; nunca "oficial";
- "não é previsão", "não é win rate da combinação", "não é causal", "sem N de partidas";
- desempenho observado (`vitória mediana`, `usada em X%`, `vs build mais usada`) fica
  em bloco separado do índice e **nunca** é somado a ele (é descritivo, não peso);
- selos de evidência: `observado`, `estimado` (valor com `~`), `descritivo`
  (emblema) e `sem contraste` — nunca `0` no lugar de "sem dado";
- itens fora do recorte podem ser escolhidos, mas entram como `#id` sem valor.

### 8.2 Duas superfícies (mesmo motor, perguntas diferentes)

| Aba | `view` | Pergunta | Entrada |
|---|---|---|---|
| **Combinador** | `combiner` | "e se eu montasse X?" | pick livre de itens/emblema/talentos/feitiço |
| **Builds + poder** | `power` | "como ficam as builds que existem, completas em 6?" | builds observadas + itens extras do recorte |

Na aba `power` os slots livres são **`6 − itens observados`** (dinâmico, hoje 3),
não um número fixo "2": o recorte publica 3 itens por build e o teto do jogo é 6.
Os extras entram marcados como adicionados, respeitam 1 bota e o mesmo teto de 6.
O índice da build completa usa exatamente `scoreCombination()` do combinador —
uma fórmula, duas telas.

## 9. Pendências herdadas

- §6.1 extrator de atributos + NNLS de ouro (habilita prior e cobertura total, V6).
- §6.2 estimador ridge por patch (habilita V3/V4 e valor para componente não visto).
- §2.4 interações só com holdout melhorando — sem isso, seguir aditivo.

