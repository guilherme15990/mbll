# ADR-031 — Peso de componente por contraste dentro do contexto

- **Status:** aceito e implementado em 2026-10-23
- **Substitui (parcialmente):** ADR-030 §8 (estimador "vs build mais usada")
- **Escopo:** `combiner` do agregado de builds (`AGGREGATE_VERSION = builds-aggregate-v5`)

## 1. Problema

A pergunta que originou isto: *"com base nas builds observadas, como determinar o
peso de um equipamento, emblema ou talento para um herói em determinada lane?"*

O recorte publica, por herói+lane+rank, até 3 builds curadas
(`body.top_builds[].builds[]`), cada uma com itens, emblema, talentos, feitiço,
`win`, `pick` e `delta_wr_pp_vs_most_used`.

O estimador do ADR-030 §8 definia

```
value_pp(c) = median(delta_wr_pp_vs_most_used das builds que usam c) × m/(m+3)
```

Isso **não mede o componente**. `delta_wr_pp_vs_most_used` é a diferença entre a
build e a build mais usada do herói; quando `c` está na build mais usada (ou em
todas as builds), o delta é 0 ou vira o efeito médio das *outras* builds. O
sintoma observado: item e emblema presentes em todas as builds do recorte
recebiam exatamente o mesmo delta (−1,3 pp no exemplo medido).

O usuário pediu explicitamente um peso *com base nas builds observadas* e
aprovou a **opção A**: contraste no mesmo contexto + pooling hierárquico, com
emblema descritivo. Um prior de atributos (fora das builds observadas) foi
descartado e removido.

## 2. Definição

Peso = **contraste dentro do contexto** (mesmo herói+lane+rank):

```
Δc(contexto) = win(builds com c) − win(builds sem c)      [pp]
```

- `win` de cada lado é ponderado por `pick` quando existe; sem `pick`, média simples.
- Cada contexto é **1 voto** (herói+lane+rank), independentemente de quantas
  builds ele tenha. Sem essa trava, um herói com 3 builds pesaria 3×.

### 2.1 Troca pareada é qualidade, não outro delta

Duas builds formam uma **troca pareada** quando o loadout é idêntico exceto no
slot do componente:

| tipo | condição |
|---|---|
| item | as duas têm o mesmo núcleo; uma tem `c`, a outra tem exatamente 1 item diferente |
| talento | mesmos itens/emblema/feitiço e mesmos talentos nos outros slots do mesmo tier |
| feitiço | mesmos itens/emblema/talentos |

O contraste publicado continua sendo o de coorte. Numa troca de item o que se
observa é `v(c) − v(x)`, não `v(c)` isolado; como o índice é aditivo, a
normalização é simétrica e os dois lados recebem valores opostos (ver teste
`troca de 1 item no mesmo núcleo vira contraste pareado simétrico`). A troca
pareada entra como **flag de evidência** (`mode: "paired"`, `contrast.paired_contexts`).

### 2.2 Pooling e encolhimento

```
pooled(c) = median(Δc dos contextos com contraste)
value(c)  = pooled(c) × n/(n+K),  K = 3, n = contextos com contraste
```

A mediana impede que um contexto extremo domine. O encolhimento reduz o que tem
pouco contraste, sem nunca virar zero.

### 2.3 Evidência (nunca `0` no lugar de "sem dado")

| `value_pp_source` | quando | campos |
|---|---|---|
| `observed` | contextos com contraste **e** contextos pareados acima do mínimo | `value_pp`, `power` |
| `estimated` | existe contraste, mas abaixo do mínimo | `value_pp_est` (com `~` na UI), `power` |
| `descriptive` | emblema | uso + win, **sem** `value_pp`/`power` |
| `none` | componente nunca variou no recorte | nada |

Mínimos (`CONTRAST_MIN`):

| tipo | contextos com contraste | contextos pareados |
|---|---|---|
| item | 3 | 2 |
| talento | 2 | 2 |
| feitiço | 2 | 2 |
| emblema | ∞ | ∞ |

Pareado conta **por contexto**, não por par: 3 builds do mesmo herói são 1 voto,
não 3. `contrast.pairs` guarda o número bruto de pares (transparência).

### 2.4 Emblema: por que nunca tem peso

A escolha de emblema é **constante dentro do herói** (o papel determina o
emblema). Na amostra real de 13 contextos, o emblema só variou em 2 — e mesmo
nesses casos a variação é confundida com papel/rota. Não existe "build sem o
emblema" no mesmo contexto, então não há contraste que separe o emblema do
herói. Publicar número seria inventar. O emblema aparece com adoção e win
descritivos e `value_reason` explícito.

## 3. Escala exibida

```
power(c) = 100 + 10 × value(c)          // null para emblema e sem contraste
IP(b)    = 100 + 10 × média(value dos componentes com valor)
```

`value_pp` só existe quando `observed`; `value_pp_est` quando `estimated`; o
índice usa `value_pp ?? value_pp_est` e conta os dois separadamente
(`withData`, `observed`, `estimated`). `coverage = withData / total`.

`scale.value_unit = "pp_contrast_shrunk"`; `scale.contrast` publica `shrink_k`,
`min` e `evidence_rule` para a UI explicar sem hardcode.

## 4. Consequências

1. O índice deixa de premiar quem está na build mais usada e passa a medir a
   diferença entre builds que existem no mesmo recorte.
2. Itens com peso `none` são comuns (aparecem em todas as builds do herói).
   A UI diz "sem contraste", não "sem suporte" e nunca mostra 0.
3. Emblema sai do índice por construção. O índice é de itens/talentos/feitiço.
   Isso é intencional: dentro de um herói o emblema não diferencia builds.
4. `estimated` cobre o caso "existe sinal, mas pouco": valor encolhido com `~`,
   somando no índice e contado à parte.
5. `delta_wr_pp_median`/`win_median`/`adoption` continuam no payload como
   **descritivos**; não são mais a fonte de `value_pp`.
6. Cache do agregado: `builds:agg:v5:*` (bump de v4).

## 5. Alternativas descartadas

- **Delta pareado como valor principal**: mede `v(c) − v(x)` e exigiria resolver
  um sistema de comparações pareadas para separar os dois lados; com 3 builds
  por herói o grafo é quase sempre uma aresta. Mantido como evidência.
- **Prior de atributos (`component-power.js`)**: não é "com base nas builds
  observadas", e foi removido por decisão do usuário.
- **Modelo de regressão/ridge**: sem holdout e com 3 builds por herói, não há
  como validar. Continua como pendência do ADR-030 §6.2.
- **Emblema com valor**: não identificável (ver §2.4).

## 6. Validação

- `packages/proprietary-engine/test/component-contrast.test.js` (14 casos):
  identidade dos componentes, troca pareada item/talento/feitiço, coorte sem
  troca limpa, pooling 1 voto/contexto, encolhimento, mediana, evidência,
  emblema descritivo, determinismo.
- `packages/proprietary-engine/test/builds-aggregate.test.js`: contrato do
  agregado (observado com troca pareada, simetria entrada/saída, emblema sem
  valor).
- `apps/web/test/combiner.test.mjs`: emblema fora do índice, `estimated` somando
  com valor encolhido, `sem contraste` não vira zero.
- `npm run test -w packages/proprietary-engine`, `npm run test -w apps-api`,
  `npm run test -w apps-web`, `npm run typecheck -w apps-web`, `npm run build:fast`.

## 7. Pendências

- Amostra maior por contexto (hoje 3 builds) reduziria `estimated` e permitiria
  contrastes com mais de uma troca pareada.
- Se o recorte passar a publicar builds de heróis com emblemas diferentes para o
  mesmo herói (improvável), reavaliar §2.4.
- Interações/sinergia continuam fora (ADR-030 §2.4).
