# QA — Draft Score (draft-score-v1)

Escopo: `packages/proprietary-engine/src/draft/draft-score.js` (ADR-054).
Fonte de dados: Rone Arena API (`https://arena.fastapicloud.dev`).
Testes automatizados: `packages/proprietary-engine/test/draft-score.test.js` (30 casos).

## 1. Testes de sanidade (automatizados, verdes)

| Teste | O que prova | Caso |
|---|---|---|
| Versionamento e unidade | `version` e `unit_status` = hipótese | contrato |
| Sinal do esperado | WR>50% ⇒ `expected_pp>0`; WR<50% ⇒ negativo | monotonicidade de sinal |
| Shrinkage por exposição | `pick` alto ⇒ efeito mais próximo do bruto | `pick=0,1` vs `0,0005` |
| Frações nativas | sem heurística ×100 (`win=0,5` ⇒ `base_pp=0`) | normalização |
| Banido/used saem do lote | `bans`/`allies`/`enemies` removem candidatos | filtragem |
| Direção da sinergia | `synergiesUp` ⇒ +, `synergiesDown` ⇒ − | direção da lista |
| Direção do confronto | `countersUp` ⇒ +, `countersDown` ⇒ − | direção da lista |
| Contestado | observado pelos 2 lados ⇒ efeito 0, conta como observado | anti-duplo-uso |
| Perspectiva do parceiro | sinergia pode vir do livro do aliado | simetria de leitura |
| **Exposição: candidato sem pick** | par observado ainda estimado (fallback declarado) | F1 |
| **Exposição: `pick:0` explícito** | não inventa N nem sinal (`base_pp=0`, `sem-dado`) | F2/F7 |
| Ausência = incerteza | par ausente ⇒ efeito 0 e `sigma` **maior** | cobertura |
| Invariância à ordem | embaralhar aliados/inimigos não muda a saída | determinismo |
| Lane | `laneWin` preferido; fora-da-lane penaliza só o limite | D5 |
| **Parâmetros inválidos** | `priorVar≤0`/`k<0` caem no default; saída finita | F3 |
| **Parâmetros válidos não-default** | `damping` e `k` aplicados; `lower_bound = exp − k·σ − penal.` | F3 |
| **Entradas nulas** | `candidates:null`/`params:null`/`undefined` não quebram | F6 |
| **Dedupe de candidatos** | id repetido vira UMA linha | F8 |
| **Fronteira ↔ penalidade de lane** | fora-de-lane dominado; sem `frontier:true` incoerente | F4 |
| **Fronteira sem empate espúrio** | diferença submilésimo de `mu` ⇒ exatamente 1 frontier | F5 |
| Fronteira/score | melhor limite = 100, pior = 0; dominância `(mu,σ)` efetivo | ordenação |
| Monotonicidade | WR maior ⇒ `expected_pp` maior (ceteris paribus) | consistência |
| Razões em pp | razão de base, de par e de cobertura faltante | explicabilidade |

Rodar: `node --test ./packages/proprietary-engine/test/draft-score.test.js`.

## 2. Verificação de integração com dado real (não automatizada)

Executada manualmente contra a API real (lane `mid`; aliados 20/60/104; inimigos
17/66/130; 5 candidatos; `days=7`, `rank=mythic`). Resultado observado:

- `sigma_pp` ≈ 5 pp para todos (cobertura 0–4 de 6 pares) — **a incerteza domina**.
- `expected_pp` variou de −6,04 pp (Miya, lane WR 43,5%) a +0,36 pp; a ordenação
  acompanhou o WR de lane, como esperado sob cobertura top-5/bottom-5.
- Exemplo com par observado: Irithel, `synergiesDown #60` ⇒ ρ bruto −12,59 pp →
  **efeito −0,22 pp** após shrinkage (exposição proxy 11).

Conclusão: o módulo é estável e **não inventa sinal** onde não há observação. A
limitação de cobertura é da fonte, não do modelo.

## 2b. Draft Score do herói `hero-draft-score-v1` (`/draft-score` + `/v1/heroes/draft-score`)

A ideia do HTML (um número por herói), com a matemática corrigida e composta **no
servidor** (ADR-054 D9/D10). UM número 0–100 por herói =
**min–max da WR no recorte**: o **melhor WR do lote lê 100**, o **pior lê 0**, e o
resto se distribui entre os dois. `pick`/`ban` são exposição e **não entram**.
NUNCA probabilidade.

```text
draft_score = 100 · (WR − WR_min) / (WR_max − WR_min)      # min–max no recorte
```

Testes automatizados (todos verdes em `npm run verify`):

| Comando | O que prova |
|---|---|
| `node --test ./packages/proprietary-engine/test/hero-draft-score.test.js` | 14 casos do motor: contrato/versão, **escala do lote (melhor WR=100, pior=0)**, reescala relativa (WR 50% só lê 50 se for o meio da faixa), monotônico na WR, `pick`/`ban` **não** influenciam, sem WR ⇒ `null` (nunca 0), `win` ausente/''/NaN ⇒ `null`, **lote sem faixa ⇒ 50** (meio da escala, não 100/0), arredonda a 2 casas, dedupe por id, entradas nulas/id não-numérico ignorados, input vazio sem NaN, `meta` expõe âncoras `wr_min`/`wr_max`, eco de `name`/`head` |
| `node --test ./app/api/test/contracts.test.js` (`GET /heroes/draft-score`) | envelope do fio, 1 linha/herói, **topo = maior WR ⇒ 100, fundo = pior WR ⇒ 0**, `draft_score ∈ [0,100]\|null`, WR 50% no meio da faixa (0,44–0,56) ⇒ 50, `meta.wr_min`/`wr_max` (fração), 400 fora de rank/janela |
| `npx vitest run test/ui/draft-score.test.tsx` | caracterização da tela: ordem pelo número, superfície de **UM número** por herói (colunas `#`/Herói/Draft Score, sem colunas derivadas), escala min–max declarada ("maior WR"/"menor WR"), `rank=all` pede elo, falha mostra `ErrBox` + retry, copy declara "não é probabilidade"/"previsão" |
| `node ./test/guardian-draft-management.mjs` (§8) | contrato estático: rota `/draft-score` separada de `/draft`, hook em `shared/api`, DTO de `@radar/contracts` (sem cópia local), zero endpoint literal, sem fan-out no navegador |
| `npm run build -w web` | chunk lazy próprio (`DraftScorePage-*.js`) resolve |

**Custo.** Diferente da rota de utilidade que foi **removida**, esta **não** faz
fan-out: o caso de uso (`application/heroDraftScore.js`) lê **uma** coleta do lote
oficial (`fetchRankAll`, mesmo cache da tela `/heroes`) e reescala. Não há livro de
pares nem ~2 chamadas/herói — o custo é o do lote (−133× menos requests que a versão
anterior). Resultado cacheado na camada C, com a **versão do motor na chave**
(`draft-score:${HERO_DRAFT_SCORE_VERSION}:${rank}:${days}`) — assim bumpar a métrica
invalida as entradas antigas sozinho (ver o achado de cache em §2c).

**Verificação AO VIVO.** Não re-executada após a pivotagem da escala (o valor
depende só da WR agregada do recorte, o mesmo sinal que `/heroes` já expõe):
a checagem pendente está em §2c. As **âncoras** da escala conferem com o `meta`
(`100 = WR_max` · `0 = WR_min`), e a UI imprime essas âncoras no cabeçalho.

**Leitura honesta (limitações registradas):**

1. **Escala relativa ao recorte.** Como é min–max do lote, o número só faz sentido
   *dentro* de um `elo+janela`: o mesmo herói pode ler 100 num recorte e 40 em outro.
   Não comparar entre recortes — está na UI e no `meta.note`.
2. **WR alta lê 100 mesmo se inflada.** O topo do lote (hoje, mythic, a Masha) lê
   **100** por ter a maior WR, **não** por ser "perfeita". Se a WR está inflada
   (herói difícil, escolhido por pro), o número não corrige isso — é o preço da
   normalização no lote, aceito pelo usuário (L3). A correção exigiria WR por lane
   + desconto de confusão por elo, que a fonte não expõe (§6).
3. **Sem spread ⇒ 50.** Lote constante (todos os WR iguais) ou herói único não tem
   faixa para reescalar: a leitura honesta é o meio da escala, não 100/0.

Nada aqui é probabilidade, previsão ou recomendação; o número é a taxa de vitória
**medida** reescalada — associação observada, nunca causal.

## 2c. Verificação AO VIVO (`/v1/heroes/draft-score`) — executada

Contra a fonte real (`ARENA_BASE=https://arena.fastapicloud.dev`), `rank=mythic`,
`window=7`, lote de 133:

```text
GET /v1/heroes/draft-score?rank=mythic&window=7 -> 200
version=hero-draft-score-v1 | n_heroes=133 with_data=133 | wr_min=0.414 wr_max=0.6046

  # | herói       draft_score
  1 | Masha         100      (= wr_max 60,46% ⇒ topo da escala)
  2 | Marcel       86,90
  3 | Argus        82,15
  …
131 | Granger       2,98
132 | Franco        0,99
133 | Fanny         0         (= wr_min 41,40% ⇒ fundo da escala)

linhas com número: 133/133 | nulls: 0 | stale=false
quente: 200 em 297 ms (cache C do lote) | GET ...&rank=xyz -> 400 (validação ok)
```

Confere o contrato do §2b: (a) `meta.wr_min`/`wr_max` batem com o fundo/topo do
lote; (b) o melhor WR lê **100** (Masha) e o pior lê **0** (Fanny); (c)
`with_data = n_heroes = 133` (todo herói do lote tem WR — nenhum “—”); (d) o
caminho quente (297 ms) confirma o cache C do lote.

**Achado de QA (bug de cache, corrigido).** A **primeira** chamada ao vivo devolveu
o corpo **antigo** (`100·WR ancorado em 50`, sem `wr_min`/`wr_max`, Masha = 60,46):
a chave de cache (`draft-score:<rank>:<days>`, TTL C = 24 h) **não** carregava a
versão do motor, então a entrada gravada **antes** da pivotagem foi servida por até
24 h — o servidor estava certo, o cache era velho. **Correção:** a chave passou a
carregar a versão do motor (`draft-score:<HERO_DRAFT_SCORE_VERSION>:<rank>:<days>`,
aplicada também à chave do single-flight), de modo que **bumpar a métrica invalida
as entradas antigas automaticamente**. Re-executado após a correção, o endpoint
devolveu a escala min–max (Masha = 100, Fanny = 0) como acima. A entrada órfã da
versão anterior fica na tabela `cache` (reconstruível) até o TTL expirar, sem afetar
a resposta nova.

## 3. Comparação com o score antigo (método)

O app legado é um HTML isolado (outro projeto, host `openmlbb.fastapicloud.dev`
hoje 404). Para comparar rankings:

1. Portar o cenário (aliados/inimigos/bans/lane) para ambos.
2. Extrair o top-20 de cada ranking.
3. Medir a **sobreposição do top-20** (Jaccard) e comentar os **casos divergentes**:
   espera-se divergência quando (a) o antigo premia pick/ban popular, (b) o antigo
   somava percentis sem magnitude, (c) o novo é dominado pela incerteza de cobertura.
4. Não há como reproduzir o ranking antigo com fidelidade porque dependia de pesos
   por dispersão recalculados no lote — a comparação é qualitativa, não um teste.

## 4. O que NÃO dá para validar sem dados de partida (lista honesta)

- **Calibração do score**: `expected_pp` é uma **hipótese de unidade** (a semântica
  de `increase_win_rate` não é documentada). Sem desfecho real, não se prova que
  "+2 pp" equivalem a +2 pp de WR.
- **Parâmetros**: `τ²`, `s_p²` (via `C_REFERENCE`·`pick`), `damping`, `k` e
  `offLanePenaltyPp` são **declarados, não calibrados**.
- **Probabilidade**: não há previsão de vitória; o `score` 0–100 é rank do lote.
- **Composição de time** (papéis, dano, frontline, tempo): não modelada (fase 2).
- **Causalidade**: `increase_win_rate` é associação observada; nenhum termo é causal.
- **Sobreposição entre pares**: `damping=1` assume independência dos pares; não foi
  medida (não há dado de coocorrência de pares).
- **Sobreposição base↔par**: o modelo aditivo (`base + Σ par`) pressupõe que o efeito
  do par é *marginal* sobre o WR base do herói. Se o `increase_win_rate` já embutir o
  próprio WR do sub-herói (possível, dado que `hero_win_rate` do par = WR GLOBAL do
  sub-herói), parte do termo de par pode sobrepor a base. Não há como separar sem
  partidas — declarado, não corrigido.
- **Simetria da sinergia**: confirmada para `counters` (antissimétrico); **não**
  confirmada para `compatibility` (cobertura top-5 impede o teste do par recíproco).
- **`score` nulo**: `score = null` só ocorre quando o lote não tem nenhum
  `lower_bound` finito; um candidato `sem-dado` em um lote com outros dados recebe
  `score` numérico (é a posição relativa dele, não um julgamento absoluto).

## 5. Riscos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Baixa cobertura (top-5/bottom-5) ⇒ score ~WR de lane | Alta | Médio | Documentado; terminus honesto até a fonte expor pares/IC |
| `increase_win_rate` com unidade desconhecida | Alta | Médio | Marca `pp_hypothesis_strong`; nunca chamar de probabilidade |
| Sem N ⇒ proxy de exposição via `pick` mal calibrado | Alta | Médio | Todo parâmetro declarado; recalibrável ao surgir N/IC |
| `pick` = 0 para heróis raros ⇒ base vira "desconhecido" | Média | Baixo | Comportamento intencional: `pick:0` explícito ⇒ `nBase=0` ⇒ `base_pp=0` e `sem-dado` (sem exposição, sem sinal) |
| `pick` ausente (id cru) ⇒ fallback declarado | Baixa | Baixo | `DS_FALLBACK_PICK=0,02` (≈ `RARE_PICK_MAX`) evita descartar par observado; declarado, recalibrável |
| Mistura de famílias `/heroes` vs `/academy` | Baixa | Médio | O chamador fixa a origem; o motor só consome o livro normalizado |
| Regressão na web ao adotar o score | Baixa | Baixo | Motor é aditivo; a tela `/draft` não foi alterada |
| **Escala min–max é relativa ao recorte** ⇒ número não comparável entre elo+janela | Alta | Médio | Declarado na UI ("não compare entre recortes") e no `meta.note`; o `meta` expõe as âncoras `wr_min`/`wr_max` para interpretar o número no contexto |
| **Topo do lote lê 100 por ter a maior WR** (não por ser "perfeito"; WR inflada não é corrigida) | Alta | Baixo | Comportamento **intencional** e aceito pelo usuário (L3, ADR-054 §D9); correção exigiria WR por lane + desconto de confusão por elo (fonte não expõe, §6) |
| **Lote sem spread** (todos os WR iguais / herói único) ⇒ 50 mascarando ausência de faixa | Baixa | Baixo | Escolha registrada: 50 = "não há spread para ranquear", não 0/100 espúrio; `meta.wr_min == wr_max` deixa o caso visível ao chamador |
| `HeroDraftScoreResponse.stale` no cache C (cache é do lote, não do resultado reescalado) | Baixa | Baixo | Campo do fio; `ageMs`/`collectedAgoMs` carregam a idade real da coleta do lote |

## 6. Decisões em aberto

- **De-confundir a WR antes do min–max (a maior em aberto).** Hoje a escala é min–max
  da WR **agregada**: um herói difícil/popular pode liderar por WR inflada. A correção
  pediria WR por lane (agregada por exposição) e/ou desconto de confusão por elo — a
  fonte atual não expõe nem uma nem outra. Enquanto isso, o número é honestamente
  relativo e rotulado como tal (§2b, achado 2).
- **Custo/cache do `/v1/heroes/draft-score`.** Uma coleta do lote por `rank+janela`
  (mesmo cache da tela `/heroes`), cacheada na camada C. Opcional: job que aquece o
  cache por recorte antes da primeira visita (não bloqueia a entrega atual).
- Método de calibração de `τ²`/`damping` quando houver desfecho (empirical Bayes
  por método dos momentos entre heróis, conforme briefing §6).
- Substituir o proxy de N por contagem real se a fonte passar a expor N/IC.
- Ligar a WR **por lane** (`timeline`/`real_road`) na base — hoje o motor **prefere**
  `laneWin` se o chamador fornecer, mas a API ainda não envia (defeito #7 do legado).
- Definir a fase 2 de composição (papéis/dano/tempo) com fonte dedicada.
