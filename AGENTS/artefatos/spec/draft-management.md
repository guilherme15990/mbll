# Draft Management — spec da tela `/draft`

**Status:** implementado (v1) · **Dono:** produto + web · **ADR:** ADR-052 · **Pesquisa:** `research/draft-statistics.md`

## 1. Job

**J-DMP · Montar e ler o draft dos dois lados.**
Quando a sala de draft começa (ou antes dela), quero registrar os 5 picks de cada lado, dizer quem picka primeiro e ver **o que os sinais observados sustentam** — força média, sinergia observada, exposição a counters, cobertura de rota e pressão de contestação — para escolher o próximo pick e os bans sem inventar win rate de composição.

**Outcome observável:** em ≤2 min o jogador (a) preenche 10 slots, (b) lê qual lado tem vantagem **de índice** e por quais componentes, (c) sai com uma lista ordenada de candidatos ao próximo pick e de alvos de ban, (d) sabe dizer que o número **não é probabilidade**.

**Fora de escopo (v1):** probabilidade de vitória, win rate de composição, soma de δ entre 5 inimigos como se fosse um único jogo, bans com ordem oficial de torneio, persistência por usuário, telemetria.

## 2. Objeto

`Draft` = 5 slots por lado + 3 bans por lado + lado que picka primeiro.

| Campo | Tipo | Regra |
|---|---|---|
| `us[]`, `them[]` | `(heroId, lane)[]` len 5 | ordem = ordem de pick do lado (slot 0 = 1º pick daquele lado) |
| `usBans[]`, `themBans[]` | `heroId[]` len 3 | ordem = ordem de ban do lado |
| `first` | `"us" \| "them"` | lado que faz o pick 1 (e o ban 1) |
| contexto | `rank`, `window` | filtros globais; `rank=all` não abre leitura (proxy exige elo) |

**Ordem usada (MLBB):** bans `F,S,F,S,F,S`; picks `1-2-2-2-2-1` → primeiro lado picka 1, 4, 5, 8, 9; segundo lado picka 2, 3, 6, 7, 10 (dois pares consecutivos + último pick).

**URL como store** (F5 e link compartilhado preservam):

```
/draft?rank=mythic&window=7&first=us&d=12@exp,34@mid,56@roam,,|78@jungle,90@gold,,,&b=1,2,3|4,5,6
```

- `d`: dois lados separados por `|`; slots por `,`; token `heroId@lane`; slot vazio = token vazio.
- `b`: dois lados separados por `|`; 3 ids cada.
- `first`: `us` (default) ou `them`.

## 3. Dados usados (zero endpoint novo)

| Fonte | Uso na tela |
|---|---|
| `GET /v1/heroes?rank&window&size=133` | θ̂ (`wrAdj`), pick, ban, tier, `B`, IC 95%, flags; `meta.mu` como baseline |
| `GET /v1/catalog` | nome/avatar de todo herói, inclusive sem dado no recorte |
| `GET /v1/heroes/lanes?rank` | rota de cada herói (cobertura/flex) |
| `GET /v1/heroes/:id/matchups?rank&days` | pares `countersUp/Down`, `synergiesUp/Down` com δ — 1 request por herói escolhido (máx. 10), via `useQueries` na mesma query key do hook oficial |

## 4. O número: índice de poder (não é probabilidade)

`Λ = média ponderada dos componentes disponíveis`

| Componente | Fórmula | Peso | Suporte |
|---|---|---|---|
| Força | `Σ wᵢ(θ̂ᵢ − μ) / Σ wᵢ`, `wᵢ = clamp(Bᵢ, 0,05; 1)` (0,25 se `smallSample`) | 1,0 | heróis com θ̂ / preenchidos |
| Sinergia | `média do δ dos pares internos observados` (mediana das direções disponíveis; sinal vem da lista: `synergiesUp` = +, `synergiesDown` = −) | 0,5 | pares observados / C(n,2) |
| Confronto | `média de ±|δ|` par a par contra o outro lado (sinal vem da lista: quem countera quem) | 0,5 | pares observados / (n·m) |

- `índice = 50 + 50·tanh(Λ / K)`, **K = 0,05** é escala de exibição (não calibração de win rate).
- `banda = ±50·(seTime/K)`, `seTime = √(Σ seᵢ²)/n`, `seᵢ = (IC95_sup − IC95_inf)/3,92` → banda só da força; rotulada como tal.
- Componente sem par observado = **null**, nunca 0; o índice é recalculado só com os componentes presentes e a tela marca `parcial`.
- δ ausente = par desconhecido (INV-DMP-003). δ abaixo de `MIN_LIFT_SIGNAL` (0,015) continua listado, mas a UI o marca como sutil.
- **Direção nunca vem do sinal do δ** (semântica em validação na fonte): vem da lista (`countersDown` = contra nós; `countersUp` = a nosso favor; `synergiesUp/Down` = +/−). O valor absoluto é a severidade.

**Veredito:** `|Δíndice| < 3` equilíbrio · `3–8` vantagem leve · `8–15` vantagem · `>15` vantagem ampla. Com menos de 3 heróis em qualquer lado, o veredito é `Leitura incompleta`.

## 5. Assistente de pick/ban (leitura, não recomendação)

**Candidatos ao próximo pick** (até 8): pool disponível, ordenado por
1. encaixe na rota do próximo slot (`true` → `sem dado` → `false`);
2. `score = força + 0,5·sinergia + 0,5·confronto` (mesmos componentes, mesma unidade);
3. θ̂, nome.

Cada linha mostra os componentes que a sustentam e a **sobrevivência proxy** até o próximo pick:
`S = (1 − q)^k`, `q = clamp((10·pick + 6·ban)/16, 0; 0,95)`, `k` = ações consumidoras (bans + picks do outro lado) entre agora e o próximo pick nosso. É aproximação de hazard, não probabilidade.

**Alvos de ban** (até 6): heróis disponíveis que aparecem em `countersDown` dos nossos picks, ordenados por (nº de heróis nossos que counteram, pior severidade, contestação `pick+ban`).

## 6. Estados e invariantes

**Estados:** vazio (0 picks) · incompleto (1–9) · completo (10) · elo `all` (pede elo) · carregando · erro de lote (`ErrBox` + retry) · erro de um par (o herói fica sem componente, a tela não quebra).

| ID | Invariante |
|---|---|
| INV-DMP-001 | Nenhum número é chamado de probabilidade, previsão, win rate de composição ou "melhor pick". |
| INV-DMP-002 | Componente sem suporte observado é `null`, nunca 0; o índice declara quais componentes entraram. |
| INV-DMP-003 | Par ausente = desconhecido; não é interpolado, nem tratado como neutro. |
| INV-DMP-004 | Direção do par vem da lista, não do sinal do δ. |
| INV-DMP-005 | Counters não são somados entre 5 inimigos como um único jogo; o componente é **média por par**. |
| INV-DMP-006 | Bans e picks já usados não voltam ao pool de sugestão; herói repetido é rejeitado. |
| INV-DMP-007 | Seleção vive na URL; recorte `rank/window` é global e preservado nos links. |
| INV-DMP-008 | `rank=all` não calcula proxy: a tela pede elo explícito. |
| INV-DMP-009 | Nenhum endpoint, query key ou fetch novo na tela. |

## 7. Copy obrigatória

- Cabeçalho: “Índice relativo de poder — não é probabilidade, não é previsão.” (o índice é relativo: 50 = neutro)
- Rodapé: “Componentes sem par observado ficam em branco. Direção do par vem da lista, não do sinal do δ. Counters não são somados entre os cinco inimigos.”
- Sugestões: “Leituras por sinal observado — não são recomendação.”
- Sobrevivência: “proxy de hazard, não probabilidade”.
- Banda: “banda da força” (a incerteza desenhada vem só do IC de θ̂, não dos pares).

## 8. Implementação e verificação

| Peça | Arquivo |
|---|---|
| Página e store na URL | `app/web/src/features/draft-management/DraftManagement.tsx` |
| Dados (4 hooks oficiais + fan-out) | `app/web/src/features/draft-management/useDraftData.ts` |
| Modelo puro (sem React/rede) | `app/web/src/features/draft-management/model/` (`common`, `state`, `pairs`, `power`, `firstPick`, `suggestions`, `analyze` + barrel) |
| Query de matchups compartilhada | `app/web/src/shared/api/queries/matchups.ts` (`matchupsQuery`) |
| Rota e sidebar | `app/web/src/app/router.tsx`, `app/web/src/app/Sidebar.tsx` (DMP) |

```bash
node --test app/web/test/draft-management.test.mjs      # domínio (61 testes)
node app/web/test/guardian-draft-management.mjs         # guardião estático
npx vitest run app/web/test/ui/draft-management.test.tsx # UI (11 testes)
npm run test -w web && npm run build -w web && npm run check:boundaries
```

## 9. v2 — layout em faixas, recomendador e leituras por par (ADR-053)

**Ordem na tela:** draft + recomendações → força em % → matriz 5×5 (largura cheia) → curva de duração → arquétipos → detalhe do índice. A timeline “Ordem do draft” saiu.

**Curva de duração = média das curvas das duplas de cada time.** O gráfico é uma série de duas linhas (nós × eles); só o cálculo muda. Dupla é qualquer par 2 a 2 entre os heróis escolhidos (5 heróis → até 10), resolvido no livro dos dois heróis (`synergiesUp`, `synergiesDown` como reserva); as duas perspectivas entram com peso igual e cada dupla vale **um valor por faixa**. A faixa mostra a média das duplas presentes, `n` = duplas com ponto na faixa; faixa sem dupla = `null` (buraco, nunca 0). A fonte lista só os 5 melhores parceiros de cada herói: dupla não listada não contribui (nunca é inventada) e o lado sem dupla aparece como “sem dupla listada” na legenda. Rótulo obrigatório: “média das curvas das duplas do time, por faixa de duração — proxy, não win rate do time”. A tela não rotula early/mid/late — mostra a série.

**Recomendador:** `score = percentil do θ̂ na lane + 0,25 × ajuste de tipo` (contrabalança o arquétipo dominante inimigo); o score não é exibido e a lista não é recomendação. `Pick`/`Ban` gravam no próximo slot nosso em aberto (`nextPickIndex`/`nextBanIndex`).
