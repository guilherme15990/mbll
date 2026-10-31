# ADR-054 — Draft Score: delta esperado de WR com incerteza explícita

**Data:** 2026-10-30 · **Status:** aceito · **Contexto:** auditoria do app legado
(`mlbb_draft_assistant_single_matrix5x5.html`) diagnosticou 12 defeitos no
`scoreCandidatesWithSTEAM`; o pedido é um Draft Score defensável dentro do motor.
**Relaciona-se a:** ADR-052/ADR-053 (tela `/draft`), ADR-025 (fronteira única), relatório
`AGENTS/artefatos/research/draft-score-api-support.md`, módulo
`packages/proprietary-engine/src/draft/draft-score.js`.

## Contexto

O app legado pontuava candidatos com `DScore = 100·H(R, 1−K)` (média harmônica de
retorno e risco), onde retorno/risco eram médias de **percentis** de sinais com
**pesos por dispersão** recalculados a cada pick. A auditoria apontou: pesos sem
significado preditivo, percentil que descarta magnitude, dupla contagem
(`confidence` no retorno e `1−confidence` no risco), pick/ban como força,
`meanPositive` sem cobertura, matchups empíricos nunca buscados, WR global sem lane,
escala sem interpretação, normalização heurística e ausência de validação.

O relatório de suporte fixou o que a fonte **de fato** oferece: taxas em fração 0–1,
**sem N**, cobertura de par **fixa em top-5/bottom-5**, `increase_win_rate` de
semântica **não documentada** (só o sinal/direção é utilizável; em `counters` é
antissimétrico), `rank.sub_hero` **é** o `counters` (não é sinergia), e timeline
por lane disponível.

## Decisão

### D1 · A saída principal é Δ esperado de WR em pp, com limite inferior
`expected_pp = 100·(base + Σ sinergias + Σ confrontos)`, em pontos percentuais.
A ordenação usa `lower_bound = expected_pp − k·sigma_pp` (`k=1`), o limite inferior
de um erro-padrão. O `score` 0–100 **não é probabilidade**: é só o mapa monotônico
do `lower_bound` dentro do lote.

### D2 · Modelo aditivo com shrinkage empírico-Bayes (H1)
Por candidato `c`, lane `l`, aliados `A`, inimigos `E`:

```
base(c,l)  = WR_lane(c,l) − 50%     # laneWin (timeline) se houver; senão WR global
syn(c,a)   = efeito do par com o aliado a      (+ = sinergia)
mat(c,e)   = efeito do par contra o inimigo e  (+ = vantagem de c)
mu(c)      = base + Σ_a syn + Σ_e mat            # efeito esperado (fração)
sigma²(c)  = var(base) + Σ var(par)              # incerteza propagada
DScore(c)  = mu − k·sigma                        # limite inferior
```

**Shrinkage (empirical Bayes).** Modelo `y_p = θ_p + ruído`, `θ_p ~ N(0, τ²)`,
`ruído ~ N(0, s_p²)`. Posterior: `m_p = y_p·τ²/(τ²+s_p²)`,
`V_p = s_p²·τ²/(τ²+s_p²)`. Implementado com a primitiva existente `ebShrink(y, s2, 0, τ²)`
(`utils/statistics.js`). Parâmetros:

- `τ² = DS_PRIOR_VAR = DELTA_DEFAULT² = 0,02² = 4e-4` (efeito típico declarado).
- `s_p² = VAR_UNIT / n_p`, com `VAR_UNIT = 0,25` (teto Bernoulli) e
  `n_p = C_REFERENCE·pick_c·pick_o` (**proxy de N** — a API não expõe contagem; `pick` = `appearance`).
- `s_base² = VAR_UNIT / n_base`, `n_base = C_REFERENCE·pick_c`.

Derivação numérica: `pick_c = pick_o = 0,05` ⇒ `n_p = 1e5·0,0025 = 250` ⇒
`s_p² = 0,001` ⇒ `B = τ²/(τ²+s_p²) = 0,4e-3/1,4e-3 = 0,286`. Um `increase_win_rate`
observado de `+0,03` vira efeito `+0,0086` (**+0,86 pp**). Observação fraca
(`pick = 0,01`) ⇒ `n_p = 10` ⇒ `B = 0,016` ⇒ efeito ≈ 0 (honesto: sem dado, sem sinal).

### D3 · Ausência de par = desconhecido (variância), nunca zero
Par não listado (fora do top-5/bottom-5) entra com **efeito 0** e **variância = τ²**
no `sigma`. Não é "zero de efeito", é "não observado". O mesmo vale para exposição
nula: um par listado mas sem exposição (`pick=0`) tem efeito 0 e **não** conta como
observado na cobertura (`observed` exige exposição > 0). Consequência honesta
(confirmada com dado real): com cobertura top-5/bottom-5, `sigma` domina
(~5 pp) e a ordenação fica ancorada no WR de lane — em vez de fabricar sinal de par.

### D4 · Agregação = soma com amortecimento (difere da matriz 5×5)
A matriz (ADR-053 D7) mostra **média por par, nunca soma**. O Draft Score **soma**
os pares (com `DS_PAIR_DAMPING = 1`) porque cobrir mais pares favoráveis deve
melhorar o candidato — é o oposto do defeito "sinergia forte com 1 de 4 vence
sinergia moderada com os 4". `damping < 1` fica disponível se a sobreposição entre
pares se mostrar material. A diferença é intencional e está documentada aqui.

### D5 · Lane: WR por lane + penalidade fora de lane só no limite
`base` usa `laneWin` (timeline por lane) quando existir, senão o WR global. Se a
lane pedida **não** está nas lanes conhecidas do candidato, aplica-se
`DS_OFFLANE_PENALTY_PP = 3 pp` no `lower_bound` — **nunca** no `expected_pp`
(não inventamos um delta de WR por lane errada).

### D6 · `pick` é exposição (proxy de N), nunca força
`pick` (e `ban`) **não** entram como retorno. `pick` só alimenta o proxy de N do
shrinkage. Remove a dupla contagem e o uso de popularidade como força.

### D7 · Fronteira eficiente em (mu, sigma) e razões legíveis
`frontier`/`dominated` por dominância em `(mu, sigma)`. Cada termo vira razão em pp
("leve vantagem contra X (+0,8 pp)", "N de M pares sem observação (incerteza)").

### D8 · Interface (fronteira pública do motor)
`scoreDraftCandidates(input) → { version, lane, k, priorVar, damping, unit_status, rows, meta }`,
puro, sem I/O. `unit_status = "pp_hypothesis_strong"` (mesma marca do `matchups.js`).
Com parâmetros válidos, `expected_pp`/`sigma_pp`/`lower_bound` são sempre numéricos
finitos; `params` inválidos (`priorVar≤0`, `k<0`, `damping>1`, penalidade<0) caem no
default declarado. `score` é `null` **apenas** quando o lote não tem nenhum limite
finito (um candidato `sem-dado` num lote com dados recebe `score` numérico — é a
posição relativa dele, nunca um julgamento absoluto). `frontier`/`dominated` usam a
média **efetiva** (que inclui a penalidade de lane), consistente com `lower_bound`.

### D9 · Draft Score do herói (UM número 0–100 por herói)

O pedido do usuário: **um número por herói** — a mesma ideia do score do app
antigo, com os cálculos corrigidos — e uma **página de teste do sistema**
(`/draft-score`) que lista os heróis com esse número, nada além disso.

Duas decisões de escopo (L2, registradas):
1. **Escopo** = força do herói **fora de um draft montado** (dentro de um draft já
   existe `/draft`, ADR-052/053): "quão forte este herói é no recorte atual".
2. **Onde calcula** = **no servidor** (rota composta). A web consome **1 request**
   por recorte, sem fan-out no navegador.

**Decisão do usuário (L3, 2026-10-30) — a escala.** O número é **0–100 com
min–max no lote**: o **melhor WR do recorte lê 100**, o **pior lê 0**, e o resto
se distribui entre os dois. Isso substitui o desenho anterior ("ancorado em 50 =
herói médio", com o teste "a Masha não pode estar no topo"). O usuário escolheu
explicitamente a normalização no lote, ciente da consequência de que o herói de
maior WR (hoje a Masha, no mythic) passa a ler **100**.

### D10 · Métrica `hero-draft-score-v1` (Draft Score do herói)

`scoreHeroDraftScore({ heroes }) → { version, rows, meta }`, puro, sem I/O. Por
herói:

```
draft_score = 100 · (WR − WR_min) / (WR_max − WR_min)      # min–max no recorte
```

- **Sem constante declarada nem peso inventado.** Os únicos parâmetros são o
  mínimo e o máximo **observados** no lote (a escala é a do próprio recorte) — não
  há `k`, `λ`, média harmônica de percentis nem listas fixas (o defeito central do
  HTML). `win` entra em fração 0–1; a saída é `100·…` (0–100).
- **`pick`/`ban` NÃO entram**: são exposição (quanto o herói é jogado/banido),
  nunca força. Usar popularidade como força foi o erro do HTML.
- **Escala relativa**: o número depende de elo+janela — **não comparar entre
  recortes**. Expor isso na UI e no `meta.note` é parte do contrato.
- **Casos degenerados**: herói sem WR no recorte ⇒ `draft_score: null`
  (sem-dado, nunca 0 silencioso); lote sem faixa (todos os WR iguais, ou herói
  único) ⇒ `50` (meio da escala: "não há spread para ranquear").
- **`meta`** expõe as âncoras da escala (`wr_min`, `wr_max`, em fração) para a UI
  rotular "100 = X% · 0 = Y%".

Correções explícitas sobre o HTML (`scoreCandidatesWithSTEAM`): (1) **sem** pesos
por dispersão do lote; (2) **sem** percentil de WR+pick+ban — a escala é min–max de
um único sinal medido; (3) **sem** dupla contagem de confiança; (4) `pick`/`ban`
**nunca** são força; (5) escala com limites **interpretáveis** (topo = melhor WR do
recorte, fundo = pior), não um mix sem unidade.

**Superfície (API):** `GET /v1/heroes/draft-score?rank=&window=` (contrato em
`@radar/contracts`: `HeroDraftScoreResponse`). O caso de uso
(`application/heroDraftScore.js`) compõe o lote oficial (`fetchRankAll`) e cacheia
o resultado na camada C com a **versão do motor na chave**
(`draft-score:${HERO_DRAFT_SCORE_VERSION}:${rank}:${days}`, o mesmo para o
single-flight). **Sem** livro de pares: não há fan-out de ~133×2 requests; o custo
é uma coleta do lote (mesmo cache da tela `/heroes`).

> **Por que a versão na chave (correção pós-pivotagem).** A chave original
> (`draft-score:${rank}:${days}`, TTL C = 24 h) serviu por ~24 h o corpo **antigo**
> à primeira chamada ao vivo após a troca de escala (QA §2c) — o servidor estava
> correto, o cache era velho. Com a versão na chave, **bumpar a métrica invalida as
> entradas antigas automaticamente**, então uma mudança de fórmula nunca mais
> precisa de limpeza manual de cache / reinício limpo.

**Superfície (web):** `shared/api/queries/draftScore.ts` (`useHeroDraftScore`) →
página `/draft-score` (`DraftScorePage` + `DraftScoreTable`), rota separada de
`/draft`, chunk lazy próprio, entrada na sidebar em "Inteligência de Draft". A
tabela mostra **uma coluna**: `#`, herói e o número.

**Limitação registrada.** Como a escala é min–max do lote, um herói de WR alto lê
100 mesmo quando a WR está **inflada** (difícil, escolhido por pro). A versão que
removeria essa inflação usaria WR por lane (agregada por exposição) e desconto de
confusão por elo — a fonte atual não expõe nem uma nem outra (§6).

## Cobertura dos 12 defeitos

| # | Defeito legado | Como o Draft Score resolve |
|---|---|---|
| 1 | Pesos por dispersão | Sem pesos dinâmicos; só `τ²`,`k`,`damping` declarados |
| 2 | Percentil descarta magnitude | Efeitos em pp (magnitude preservada) |
| 3 | Dupla contagem | `confidence` sai do retorno; vira `sigma` |
| 4 | Pick/ban como força | `pick` só como exposição (proxy de N) |
| 5 | `meanPositive` sem cobertura | Soma com cobertura; par ausente = variância |
| 6 | Matchups nunca buscados | Usa `compatibility`/`counters` (δ do par) |
| 7 | WR global | `laneWin` (timeline) preferido |
| 8 | Sem composição de time | Adiado (fase 2) — hook explícito, sem inventar |
| 9 | `bans` ignorado | Banido sai do lote |
| 10 | Escala sem interpretação | `expected_pp` + `lower_bound` + `score` só como rank |
| 11 | `normalizeRate/Impact` heurística | Removida; frações 0–1 nativas |
| 12 | Sem validação | Plano em `AGENTS/artefatos/qa/draft-score-qa.md` |

## Alternativas comparadas

| Hipótese | Suporte da API | Interpretabilidade | Estabilidade | Custo | Veredito |
|---|---|---|---|---|---|
| **H1 aditivo com shrinkage + limite** | Alta (usa δ do par + lane + prior) | Alta (pp por termo) | Alta (sem pesos por lote) | Baixo (cache) | **Escolhida** |
| H2 percentis com pesos fixos | Média | Média (rank, não pp) | Média | Baixo | Linha de base; mantém o defeito #2 |
| H3 Bradley-Terry/Elo por par | Baixa (sem N; cobertura top-5) | Baixa | Baixa (overfit) | Alto | Descartada |

## Consequências

- O motor ganha um score **explicável e com incerteza**, alinhado à cultura
  ("ausência = desconhecido", "nunca probabilidade", "declarado ≠ calibrado").
- `s_p²`, `τ²`, `damping` e `offLanePenaltyPp` são **declarados, não calibrados** —
  exigem dados de partida para calibração (fora do escopo).
- Com a cobertura atual (top-5/bottom-5), a **incerteza domina**; o score é
  conservador por construção. Quando a fonte expuser N/IC por par, os `s_p²` podem
  ser substituídos sem mudar a assinatura.
- Não altera a tela `/draft` (ADR-052/053): a leitura nova vive em rota própria
  de teste (`/draft-score`, D9), cujo modelo TS importa o motor — como já faz com
  `dominantProfileOf`.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Manter média harmônica de percentis | Percentil descarta magnitude; sem interpretação em pp |
| Somar os 5 inimigos sem amortecimento nem incerteza | Sobrepeso; viola a leitura honesta de cobertura |
| Tratar `increase_win_rate` como pp validado | Semântica não documentada; unidade é hipótese |
| Usar `rank.sub_hero` como sinergia | É counter (contaminação confirmada no relatório [LIVE]) |
| Inventar composição de time (papéis/dano) | Sem fonte por composição; adiado |
