# Estatística de draft — inventário e fórmulas propostas

**Pergunta:** o que a engine já calcula, o que a tela `/draft` já usa e quais cálculos novos (proxy/inferência) valem a pena — com fórmula, insumo e limite.

**Regra que atravessa tudo:** nenhum número aqui é probabilidade de vitória. O produto proíbe somar δ entre cinco inimigos como se fosse um único jogo (`AGENTS/artefatos/spec/experiencias-ooux.md` §2.4). O que existe são **índices relativos**, **médias por par** e **proxies de hazard**, sempre com suporte declarado e `null` no lugar de zero.

---

## 1. Inventário: o que já existe

| Camada | Cálculo | Onde | Unidade / limite |
|---|---|---|---|
| Herói | θ̂ (`wrAdj`) com Empirical Bayes + walk-forward | `hero/shrinkage-model.js`, `score-heroes.js` | logit; `null` sem exposição |
| Herói | `B` (credibilidade), `z`, `q`, tier | `hero/lot-ranking.js`, `tierOf.js` | 0–1 / posto |
| Herói | IC 95% + prob. posterior > μ+Δ | `confidence/confidence-trio.js` | logit; condicional ao modelo |
| Herói | índice de força por rank | `hero/strength-index.js` | quantil → 0–100 |
| Par | δ observado + curva de duração + perfil | `counters/duration.js`, rotas `/matchups` | proporção 0–1; extremos só |
| Par | direção declarada vs δ observado | `counters/relations-agreement.js`, `counter.js` | veredito, não score |
| Herói | blind proxy (p10 adverso, pior δ) | `counters/blind-proxy.js` | proxy, nunca probabilidade |
| Herói | favorabilidade blind/first pick | `picks/pick-favorability.js` | veredito (4 rótulos) |
| Herói | resíduo de pick/ban vs força | `counters/distortion.js` | logit; 4 padrões operacionais |
| Meta | tendência, variância temporal, lane timing | `meta/meta-trend.js`, `lane-timing.js` | descritivo |
| Builds | lift de item/pacote + contraste com shrinkage | `builds/*` | pp; suporte mínimo |
| Time | **nada** — não existe score de composição | — | gap declarado |

**O que a tela `/draft` usa hoje:** θ̂ + `B` + IC (força), δ de `synergiesUp/Down` (sinergia), δ de `countersUp/Down` (confronto), `pick`/`ban` (contestação), `/heroes/lanes` (estrutura), `meta.mu` (baseline).

---

## 2. Fórmulas implementadas na tela (v1)

### F1 · Força média com peso de credibilidade
```
Λs = Σ wᵢ (θ̂ᵢ − μ) / Σ wᵢ
wᵢ = clamp(Bᵢ, 0,05; 1)   ·   wᵢ = 0,25 se smallSample
```
**Por quê:** herói com amostra pequena tem θ̂ puxado à média; sem peso, um pico de 3 partidas domina o time.
**Limite:** `B` é credibilidade do modelo, não erro-padrão. A banda usa o IC:
```
seᵢ = (IC_sup − IC_inf)/3,92      seTime = √(Σ seᵢ²)/n
```
**Inferência:** `seTime` cai com √n — com 5 heróis o time "média" é mais estável que cada herói, mas isso **não** é erro de uma partida de time (os 5 jogadores não são independentes).

### F2 · Exposição líquida a counters (média por par)
```
para cada (h nosso, e inimigo):
  h countera e  → +|δ|
  e countera h  → −|δ|
  os dois       → 0 (par contestado)
  nenhum        → fora do denominador
Λm = média das observações
```
**Por quê média e não soma:** somar 25 pares daria um número que cresce com o tamanho do time e não tem significado de partida (INV-DMP-005). A média responde “por confronto, este lado está melhor ou pior”.
**Direção:** vem da lista (`countersUp/Down`), nunca do sinal do δ — a semântica de `increase_win_rate` está em validação (`app/api/src/routes/matchups.js:49`).

### F3 · Sinergia simetrizada por mediana
```
par (a,b): valores disponíveis em a.synergiesUp (+), a.synergiesDown (−),
           b.synergiesUp (+), b.synergiesDown (−)  → mediana
Λg = média dos pares observados
```
**Por quê mediana:** as duas direções vêm de amostras diferentes; a mediana resiste a uma direção extrema isolada. Uma observação por par (não duas).
**Limite:** cobertura `extremes-only`; ausência de par não significa “sem sinergia”, significa “não medido”.

### F4 · Disponibilidade até o próximo pick (hazard proxy)
```
q = clamp((10·pick + 6·ban) / 16, 0; 0,95)
S(k) = (1 − q)^k
```
`pick` soma ~1 no lote (`checkPickSum`), então `10·pick` é o nº esperado de slots que o herói ocupa; `6·ban` é o esperado de bans. 16 = 10 picks + 6 bans.
**k** = ações consumidoras entre agora e o próximo pick nosso (bans de qualquer lado + picks do outro lado).
**Limite:** hazard independente por ação; não modela dependência entre bans nem resposta do oponente. **Rótulo obrigatório:** proxy, não probabilidade.

### F5 · Alavanca de resposta (quem picka por último)
```
exposição = |countersDown disponíveis| do 1º pick do lado que picka primeiro
alavanca  = |countersDown disponíveis| dos picks do 1º lado, para o lado do último pick
pior      = max |δ| entre os disponíveis
```
**Por quê:** é o único “efeito de ordem” que os dados sustentam — não a probabilidade de ganhar por pickar primeiro. Responde: “quantas respostas o outro lado ainda tem?”

### F6 · Contestação
```
contested = pick + ban
```
Descritivo. Ordena alvos de ban junto com o dano observado contra o nosso time. Não é “prioridade de ban” calibrada.

---

## 3. Fórmulas propostas para a engine (não implementadas)

Ordenadas por relação valor/custo. Todas reaproveitam dados que a API **já busca**.

### P0 · θ̂ ajustado por exposição esperada (counter-adjusted strength)
**Inferência:** quanto da força de um herói é “força própria” e quanto é “o meta não o countera”.
```
E(h) = Σ_e w_e · δ(e→h)          w_e = pick_e / Σ_{e: δ(e→h)≠∅} pick_e
θ̂_adj(h) = θ̂(h) − λ·E(h)        λ ∈ [0,1] estimado por walk-forward
```
`w_e` é a chance de o counter aparecer **dado que ele existe**. `λ` mede quanto da força observada é explicada pela exposição; com λ=0 volta a θ̂.
**Uso na tela:** mostrar `θ̂` e `θ̂_adj` lado a lado quando houver ≥5 pares; se `θ̂_adj` cair muito, o herói é “forte porque ninguém o countera”.
**Custo:** precisa da matriz de counters de todos os heróis do lote (hoje a API busca 1 herói por request). **Backend:** lote de matchups ou cache materializado da matriz.
**Limite:** δ extremos-only → E(h) é enviesado para os pares que a fonte lista.

### P0 · Flexibilidade por entropia de rota
```
F(h) = −Σ_l p(h,l)·log p(h,l) / log 5
p(h,l) = pick(h | rota l) / Σ_l pick(h | rota l)
```
Hoje a tela usa `|lanes(h)|/5` (cardinalidade) porque `/heroes/lanes` só devolve a lista, não a distribuição. A entropia distingue “joga 5 rotas mal” de “joga 2 rotas muito bem”.
**Custo:** expor `pick` por rota no lote (a fonte já tem contexto de rota por build/hero).
**Uso:** valor de ambiguidade no draft — herói flex esconde a rota do oponente.

### P0 · Curva de poder do time (timing)
```
s(h) = slope da curva de duração do herói (mediana dos pares)
timing(time) = Σ s(h) / n
```
Time com `s < 0` (snowball) quer fechar cedo; `s > 0` (scaling) quer alongar. É a média dos perfis de par que a ficha já calcula (`classifyDuration`), não um modelo novo.
**Limite:** perfil existe por par, nunca por herói isolado (`hero-profile.js`). Sem pares → `null`, não “uniforme”.

### P1 · Elasticidade de pick/ban vs força
```
β = Cov(Δresíduo_pick, Δθ̂) / Var(Δθ̂)   sobre snapshots
```
Responde “o meta reage a força?” e “quanto tempo leva?”. Alimenta o padrão *Stale Draft Pressure* (hoje `ativo: false` fixo em `draft-patterns.js:43`) com um teste em vez de uma regra morta.
**Custo:** usa `/snapshots` + `/snapshots/:n/diff` que já existem.
**Limite:** patch quebra a série; precisa de detecção de versão (já existe `versions()`).

### P1 · Valor de ban com cobertura (set cover guloso)
```
BV(e) = Σ_{h∈nosso} 1[e∈countersDown(h)] · |δ(e,h)| · contested(e)
```
É o que a tela já ordena. O passo seguinte é **cobertura**: escolher 3–5 bans que maximizem a redução de exposição do time, com restrição de não repetir herói já banido/pickado:
```
max Σ_h exposição_coberta(h)   s.a. |bans| ≤ 5
```
Guloso por ganho marginal. **Limite:** ganho marginal é proxy, não win rate; não modela o ban do outro lado.

### P1 · Ordenação por limite inferior de confiança (LCB)
```
rank(h) = (θ̂(h) − μ) − z·se(h)      z = 1,0
```
Em vez de ordenar pelo ponto, ordena pelo que o time “pode defender”. Evita apostar em pico de amostra pequena. Pode ser um toggle na lista de candidatos (“ordem conservadora”).
**Custo:** zero — `IC95` já está no fio.

### P1 · Redundância de composição (sobreposição de rotas)
```
overlap(A,B) = |lanes(A) ∩ lanes(B)| / min(|lanes(A)|, |lanes(B)|)
redundância = média dos pares
```
Sinaliza “dois heróis que só jogam mid”. Distinto de cobertura: cobertura olha buracos; redundância olha excesso. Ambos descritivos, sem peso no índice.

### P2 · Mix de dano por arquétipo de item (data gap)
A API não expõe classe/dano do herói. Proxy possível: arquétipos dos itens da build modal (`/heroes/:id/builds` → `aggregate` já classifica `attack/magic/defense/movement`).
```
mix(h) = Σ_itens arquétipo(item) / nº itens
```
**Limite:** build é escolha do jogador, não atributo do herói; usar só quando a build modal tiver suporte (≥N builds). Sem isso, não exibir.

### P2 · Monte Carlo de draft
Simular N drafts com uma política de pick (ex.: softmax sobre θ̂ + counters) para estimar distribuição de “poder final”. **Por que não agora:** exige política de pick calibrada e transformaria proxy em pseudo-probabilidade. É L3 (produto + dados de draft real).

### P2 · Qualidade de evidência como peso do δ
Hoje o δ entra com peso 1 e um selo de qualidade. Peso possível:
```
w_δ = 1 se coverage=full e n≥10 · 0,6 se extremes-only · 0,3 se n<5
```
Reduz o efeito de pares frágeis no componente de confronto. Precisa que `evidence_quality` viaje no par (já viaja) e de um consenso de pesos (L2).

---

## 4. O que falta de dado (bloqueia fórmulas)

| Dado | Bloqueia | Onde resolver |
|---|---|---|
| Matriz completa de counters (133×133) | θ̂_adj, Monte Carlo | lote de matchups / cache materializado |
| Pick por rota por herói | flex por entropia | agregado por lane |
| Classe/dano do herói | mix de dano real | catálogo da fonte ou mapa curado |
| Draft real (picks/bans por partida) | elasticidade, valor de ban calibrado, win rate de composição | nova coleta (L3) |
| Ordem oficial de bans por torneio | simulação fiel | regra de torneio (não é dado estatístico) |

## 5. Decisões de honestidade

1. **Nada de win rate de composição.** O índice é relativo (50 = neutro) e declara componentes/suporte.
2. **Média por par, não soma.** Counters não são independentes nem equivalentes a uma partida de 5×5.
3. **Ausência ≠ neutro.** `null` mantém o componente fora do índice e a tela mostra o que faltou.
4. **Direção vem da lista.** O sinal do δ não é confiável na fonte atual.
5. **Sobrevivência é hazard proxy.** Sem promessa de calibração.
6. **Sugestão não é recomendação.** Ordem por sinais observados, com motivo e suporte visíveis.
