# Review adversarial — Draft Score (`draft-score-v1`)

**Revisor:** subagente crítico (estatística + correção JS + convenções do repo)
**Data:** 2026-10-30
**Artefatos revisados:**
- `packages/proprietary-engine/src/draft/draft-score.js` (módulo, 337 linhas)
- `packages/proprietary-engine/test/draft-score.test.js` (20 testes)
- `AGENTS/artefatos/architecture/ADR-054-draft-score.md`
- `AGENTS/artefatos/qa/draft-score-qa.md`
- `AGENTS/artefatos/research/draft-score-api-support.md`
- `packages/proprietary-engine/src/index.js` (bloco draft) e `src/index.d.ts` (bloco draft-score)
- `src/utils/statistics.js` (`ebShrink`), `src/utils/config.js` (`C_REFERENCE`, `DELTA_DEFAULT`, `LANES`),
  `src/utils/thresholds.js` (`MIN_SUPPORT_N`), `src/utils/math.js` (`medianNull`)

**Método (comandos executados):**
- `node --test ./packages/proprietary-engine/test/draft-score.test.js` → **20/20 pass, 0 fail**.
- `node tools/check-boundaries.mjs` → **BOUNDARIES OK** (247 nomes declarados, 169 valores).
- Verificação numérica do `ebShrink` + ~35 cenários adversariais via `node` (probes em
  `%TEMP%\opencode\ds-probe*.mjs`). Resultados citados abaixo.

---

## 1. Solidez estatística

**O `ebShrink` retorna o que o ADR §D2 afirma? SIM.** `statistics.js:56-63` calcula
`V = 1/(1/s2 + 1/tau2) = s²τ²/(s²+τ²)` e `m = V·(y/s2 + mu/tau2)`; com `mu=0`,
`m = y·τ²/(τ²+s²)` — exatamente as fórmulas do ADR §D2 (`m_p`, `V_p`). `B = τ²/(τ²+s²)` também confere.

**Exemplo numérico do ADR (verificado com o `ebShrink` real):**

| grandeza | ADR-054 (§D2, L56-59) | medido |
|---|---|---|
| `pick_c=pick_o=0.05` → `n_p` | 250 | 250 |
| `s_p² = 0.25/n` | 0.001 | 0.001 |
| `B = τ²/(τ²+s²)` | 0.286 | **0.28571** |
| `y=+0.03` → efeito `m` | +0.0086 (+0.86 pp) | **+0.00857** |
| `pick=0.01` → `n=10`, `B` | 0.016 | **0.01575** |

→ O exemplo do ADR está **correto**. `τ² = DELTA_DEFAULT² = 0.02² = 4e-4` (`config.js:8`,
`draft-score.js:36`) e `VAR_UNIT = 0.25` é o teto `sup μ(1−μ)` de Bernoulli — consistente
com `obsVariance`/`ebShrink` (que usam `μ(1−μ)/(c·pick)`), **mais conservador**.

**Ressalva estatística (não é bug de código):** a aditividade `mu = base + Σ par` (ADR §D2)
pressupõe que `increase_win_rate` seja um *lift marginal*. O relatório de suporte (V1, L45)
mostra que não é diferença de WR, mas **não descarta** sobreposição entre o WR base do herói
e o efeito do par. A unidade está marcada como hipótese (`DS_UNIT_STATUS`) e o ADR admite
"não calibrado", então é aceitável como assunção declarada — porém a sobreposição base↔par
não está explicitamente listada em "o que NÃO dá para validar" (qa §4), e deveria estar.

---

## 2. Propagação de variância

**CORRETA.** Para a soma amortecida `Σ damping·X_i` de termos independentes,
`Var = damping²·Σ Var(X_i)`. O código faz `synVar += s.var*damping*damping`
(`draft-score.js:195`, `:208`) e `sigmaPp = 100·sqrt(base.var + synVar + matVar)` (`:218`).
O `damping²` está no lugar certo. O ADR §D2 escreve `sigma² = var(base)+Σvar(par)` (L42) e
`D4` (L67-72) explica o `damping` — a fórmula do §D2 omite o `damping²`, mas não há divergência
material (o próprio D4 cobre isso).

**Dominância em (mu,σ): CORRETA no critério, com dois defeitos de implementação** (ver F4 e F5):
o teste `o.mu>=r.mu && o.sigma<=r.sigma && (estrito em um)` (`:299-300`) é a dominância de Pareto
esperada. Porém (a) opera sobre `mu`/`sigma` **já arredondados** (`:235-236`) e (b) esses valores
**não incluem** a penalidade de lane que entra no `lower_bound`/`score`.

---

## 3. Invariantes de honestidade

- **Ausência de par = desconhecido:** OK. `shrinkEffect` retorna `{effect:0, var:priorVar}`
  quando `!obs.present` (`:132-134`), e `var_pp2 = priorVar` (2 pp de σ) confere (teste L106-122).
- **`score` 0–100 nunca é probabilidade:** OK no módulo (`:20`, `:274-276`; `index.d.ts:327`)
  e **não há consumidor externo** ainda (grep: só engine/testes). `meta.note`, `unit_status`
  e o tipo reforçam. **PASS.**
- **Sem N inventado:** **VIOLADO em dois pontos** (F1, F2). Os proxies `C_REFERENCE·pick·…` são
  declarados e rotulados (`exposure_proxy`), o que é aceitável; mas (a) o `DS_FALLBACK_PICK`
  é inócuo para o candidato e (b) `pick=0` explícito recebe exposição inventada de 2000 no base.
  Além disso um **par observado é silenciosamente zerado** quando o candidato não tem `pick`.

---

## 4. Dupla contagem / vazamento

- `pick` **não** entra como retorno: só alimenta `exposurePick`→`n` (`:181`, `:192`, `:205`). **OK.**
- `ban` **só** remove candidatos (`banSet`, `:165`, `:174`); `hero.ban` nunca é lido. **OK.**
- `bans` só eliminam candidatos; aliados/inimigos (inc. banidos nos dois lados) **não** removem nada
  além do candidato. **OK.**
- **`rank.sub_hero` não é usado** em nenhum ponto (grep limpo). **OK.**
- Dupla contagem residual: um id presente **em `allies` e em `enemies`** é contado em sinergia **e**
  em confronto (`total=2`; probe) — sem guarda. `pick`/`confidence` não geram dupla contagem.
- Ressalva estatística: possível sobreposição base↔par (ver §1).

---

## 5. Bugs de correção (inputs adversariais executados)

Todos os cenários abaixo foram rodados no `node`:

| cenário | resultado |
|---|---|
| `candidates: []` / `input: undefined` | OK, `rows=[]`, sem NaN |
| `win NaN` / `win "abc"` | OK → `expected_pp=0`, `ev=sem-dado` |
| `delta` não-numérico / `null` no book | OK, par tratado conforme |
| `lane` dado e candidato sem `lanes` | OK, `lane_fit=null`, sem penalidade |
| `allies:[null,7]` | OK (null filtrado) |
| `bans:["x",null,2]` | OK (só 2 removido) |
| **`candidates: null`** | **TypeError "candidates is not iterable"** (F6) |
| **`params: null`** | **TypeError "Cannot read properties of null (reading 'k')"** (F6) |
| `pick=NaN` / `pick<0` | OK (cai no fallback do base — ver F2) |
| `pick=5` | OK, sem clamp (entrada inválida) |
| **`params:{priorVar:-1}`** | **`sigma_pp`, `lower_bound`, `sigma` = NaN; `score=null`** (F3) |
| `params:{k:-2}` | `lower_bound > expected_pp` (semântica quebrada) (F3) |
| `params:{damping:2}` | efeito e variância inflados (sem clamp) (F3) |
| `params:{offLanePenaltyPp:-5}` | penalidade negativa eleva o limite (F3) |
| **id duplicado nos candidatos** | **2 linhas idênticas** (sem dedupe) |
| candidato sem `pick` + par observado | `exposure_proxy=0`, `effect_pp=0`, `raw_pp=null`, mas `present=true`/coverage observed=1 (**F1**) |
| **`pick:0` + `win:0.55`** | `base_pp=3.81`, igual a `pick` ausente e a `pick:0.02`; `pick:0.05` dá 4.44 (**F2**, N inventado) |
| `lanes:["gold"]`, `lane:"mid"` (2 candidatos idênticos) | ambos `frontier:true`, `score` 100 vs 0 (**F4**) |
| `win` 0.5500 vs 0.5504 | `mu` arredonda para 0.047 nos dois → ambos `frontier` (**F5**) |

Nenhum crash ou NaN ocorre com entrada **bem-formada** (o que a pipeline real fornece: `pick` sempre
presente como appearance). Os defeitos aparecem em entradas de borda e, sobretudo, **contrariam
docs/testes** (F1/F2).

---

## 6. Contrato / convenções

- **`index.d.ts` ↔ runtime:** batem em nomes e tipos literais. `DRAFT_SCORE_VERSION:"draft-score-v1"`
  e `DS_UNIT_STATUS:"pp_hypothesis_strong"` conferem (`draft-score.js:30,49` ↔ `index.d.ts:281,287`);
  os demais são `number`; a interface de resultado espelha os campos emitidos (`damping`, `lane`,
  `unit_status`, `breakdown.terms`, `evidence_status`, `score: number|null`). `check-boundaries.mjs`
  → **BOUNDARIES OK**.
- **`node --test`** → **20 pass / 0 fail**.
- **Pureza:** sem I/O; só imports de `utils/*` e `medianNull` usado. **PASS.**
- **Estilo (comentário/versionamento):** cabeçalho descritivo, `DRAFT_SCORE_VERSION`, bloco de
  parâmetros "declarados" e notas culturais — alinhado ao resto do motor (ex.: `counter.js`). **PASS.**
- **Tamanho de arquivo:** 337 linhas, mas `check-boundaries.mjs:402-405` só varre `app/api/src` e
  `app/web/src`; `packages/proprietary-engine` é isento por desenho (ADR-041). **Sem achado.**

---

## 7. ADR ↔ código (D1–D8)

| Decisão | Status | Evidência |
|---|---|---|
| D1 · expected_pp + lower_bound (k=1), score=rank | **OK** | `:217`, `:234`, `:308` |
| D2 · modelo aditivo + shrinkage EB | **OK** | `:130-138`; verificado (§1) |
| D3 · par ausente = efeito 0 + var τ² | **OK** | `:132-134`; teste L106-122. *Exceção*: par presente com exposição 0 também vira 0/τ² mas conta como observado (F1/F7) |
| D4 · soma com damping | **OK** | `:194-195`, `:207-208`, `:39` |
| D5 · laneWin preferido; penalidade só no limite | **OK (isolado)** | `:180`, `:215`, `:234`; *interage* com D7 → F4 |
| D6 · pick = exposição, ban só remove | **OK** | `:174`, `:181,192,205` |
| D7 · fronteira (mu,σ) + razões | **PARCIAL** | `:297-310`, `:312-333`; dominância sobre valores arredondados (F5) e sem penalidade de lane (F4) |
| D8 · interface pura; "sempre numéricos"; score pode ser null | **PARCIAL** | assinatura OK; "sempre numéricos" falsificado por `priorVar≤0` (F3); "score null (sem dado)" impreciso (F11) |

**Subdeclarado/“implementado mas não documentado”:** `damping²` na variância (menor), arredondamento
na dominância, e o fato de a penalidade de lane não afetar a fronteira. **Superdeclarado:**
"expected_pp/sigma_pp/lower_bound sempre numéricos" (D8, L91) e "score pode ser null (sem dado)".

---

## 8. Cobertura dos 12 defeitos do briefing

| # | Defeito | Veredito | Evidência |
|---|---|---|---|
| 1 | Pesos por dispersão | **PASS** | sem pesos dinâmicos; só τ²/k/damping declarados |
| 2 | Percentil descarta magnitude | **PASS** | efeitos em pp (`:184`, `:217`, `term.effect_pp`) |
| 3 | Dupla contagem (confidence) | **PASS** | `confidence` não existe; risco vira `sigma` |
| 4 | pick/ban como força | **PASS** | `:174`, `:181,192,205` |
| 5 | `meanPositive` sem cobertura | **PASS** | soma com cobertura + var do ausente (`:132-134`) |
| 6 | Matchups nunca buscados | **PASS** | `pairMatchup` lê `countersUp/Down` dos dois lados (`:100-109`) — mas NOTE F1 (par zerado sem `pick` do candidato) |
| 7 | WR global sem lane | **PASS** | `laneWin` preferido (`:180`) |
| 8 | Sem composição de time | **PARTIAL** | adiado explicitamente (ADR §Cobertura L104; qa §4) |
| 9 | `bans` ignorado | **PASS** | `banSet` remove (`:165,174`) |
| 10 | Escala sem interpretação | **PASS** | `expected_pp`+`lower_bound`+`score=rank` |
| 11 | `normalizeRate/Impact` | **PASS** | removida; frações 0–1 nativas (teste L39-42) |
| 12 | Sem validação | **PARTIAL** | plano de QA existe, mas validação contra desfecho continua ausente (declarado) |

**Placar:** 9 PASS, 3 PARTIAL (justificados), 0 FAIL — com a ressalva de que #6/#3 são PASS no
nível do módulo mas ficam prejudicados pelos bugs F1/F2 no caminho de dados.

---

## 9. Qualidade dos testes

23 testes? Não — **20 testes**, em 8 suítes; **majoritariamente significativos** (não tautológicos):
sinal do `expected_pp`, shrinkage monotônico, direção pela lista, contestado, cobertura,
invariância de ordem, lane, dominância, monotonicidade, razões. Ainda assim:

**Boa cobertura:** direção de pares, contestado, perspectiva do parceiro, ausência=var, lane só no limite.

**Lacunas relevantes (nenhuma testada):**
- **`pick` ausente do PRÓPRIO candidato** (F1) — o teste `test:97-102` só cobre o *aliado* como id cru;
  o candidato tem `pick:0.05`. É exatamente o caminho que falha.
- **`pick:0`** no base (F2) — nenhum teste distingue 0 de ausente.
- **Parâmetros `k`, `priorVar`, `damping`** (F3): nenhum teste passa `params` — D4 e D8 ficam sem cobertura.
  Não há teste que compare `lower_bound` com `expected_pp − k·sigma_pp − lane_penalty` numericamente
  (o teste de lane só usa desigualdade).
- **`DS_FALLBACK_PICK`** (valor e efeito) — sem teste.
- **`evidence_status` "provisional"** (`observedPairs >= MIN_SUPPORT_N`) — sem teste; só "inconclusive"/"sem-dado".
- **Dominância com arredondamento** (F5) e **fronteira vs score com lane** (F4).
- Invariância à ordem dos **candidatos** (só aliados/inimigos).
- Entradas estruturais nulas (F6).

**Doc drift:** `qa:5` diz "19 casos"; a suíte tem **20** testes.

---

## Achados (severidade · arquivo:linha)

- **F1 · HIGH/P0** — `draft-score.js:119-123` + `:177` + `:192,:205`: `DS_FALLBACK_PICK` é inócuo
  para o `pick` do candidato. `K` normaliza `hero.pick` para `null` (`:177`) e `exposurePick(null)`
  → `Number(null)===0` → retorna `0`. Um par **observado** vira `effect 0` (e `raw_pp:null`), embora
  conte como observado. Contradiz o comentário do próprio `DS_FALLBACK_PICK` (`:43-46`, "parceiro/**candidato**").
  Assimetria confirmada: aliado id-cru recebe fallback (`exposure_proxy=100`, efeito 0.41 pp).
- **F2 · HIGH/P0** — `draft-score.js:181`: `pick:0` (zero explícito) cai no ramo de fallback
  (`pick>0` falso) → `nBase = C_REFERENCE·DS_FALLBACK_PICK = 2000`, **inventando exposição**;
  `base_pp=3.81` igual a `pick` ausente/`0.02`. Contradiz o tratamento dos pares (`pick=0 → n=0`)
  e o `qa:78` ("pick=0 ⇒ par vira desconhecido"). Viola "sem N inventado".
- **F3 · MEDIUM** — `draft-score.js:158-161` (+ `:136`,`:218`): `params` sem validação.
  `priorVar≤0` ⇒ `ebShrink` devolve `V≤0` ⇒ `sigma_pp/lower_bound/sigma = NaN` e `score=null`
  (contraria D8 "sempre numéricos"). `k<0`, `damping>1`, `offLanePenaltyPp<0` quebram a semântica sem aviso.
- **F4 · MEDIUM** — `draft-score.js:234` vs `:299-300`: `frontier/dominated` ignora a penalidade de lane
  (usa `mu,sigma`) enquanto `score/lower_bound` a inclui. Um candidato pode ser `frontier:true` com
  `score:0`. D5 e D7, isoladamente OK; a combinação é inconsistente e não documentada.
- **F5 · MEDIUM** — `draft-score.js:235-236` vs `:299-300`: dominância sobre `mu/sigma` **arredondados**
  (round3) → empates espúrios de fronteira.
- **F6 · MEDIUM** — `draft-score.js:156`: sem guarda para `candidates:null` (TypeError "not iterable")
  e `params:null` (TypeError "reading 'k'"), apesar de o módulo filtrar `null` em heróis (`asHero`).
  O `d.ts` exige esses campos, então o risco é do chamador não-tipado.
- **F7 · LOW** — `draft-score.js:220,246-247`: `coverage.observed` conta par listado mesmo com
  exposição 0 (efeito 0), podendo empurrar `evidence_status` para "provisional" sem sinal.
- **F8 · LOW** — ids duplicados geram linhas duplicadas (sem dedupe).
- **F9 · LOW** — id em `allies` **e** `enemies` conta em sinergia e confronto (`total=2`) sem guarda.
- **F10 · LOW** — `qa:5` "19 casos" vs 20 reais.
- **F11 · LOW** — `index.d.ts:328` / ADR D8: "score pode ser null (sem dado)"; na prática linhas
  `sem-dado` recebem `score` numérico — `null` só ocorre sem `lower_bound` finito.

---

## Veredito: **APROVADO COM RESSALVAS**

O núcleo está **estatisticamente correto** (shrinkage EB fiel ao ADR, exemplo numérico do ADR
confirmado ao centésimo, propagação de variância com `damping²` correta, dominância de Pareto
bem definida), o módulo é **puro**, o **contrato `index.d.ts`↔runtime bate** (`check-boundaries` OK),
os **20 testes passam** e os **invariantes culturais** (score≠probabilidade; ausência=variância;
sem `rank.sub_hero`) são honrados no caminho bem-formado. Porém há **dois defeitos de contrato de
honestidade** (F1, F2: `DS_FALLBACK_PICK` morto para o candidato; `pick=0` inventa exposição) que
**contradizem os próprios comentários/QA e não são cobertos por teste**, além de validação de
parâmetros ausente e uma inconsistência fronteira↔score. Nada disso quebra a entrada real
(`pick` sempre presente), mas F1/F2 devem ser corrigidos antes de expor o módulo a consumidores.

### P0 (must-fix)
1. **F1** — aplicar `DS_FALLBACK_PICK` ao `pick` ausente do candidato (ex.: `pick == null ? DS_FALLBACK_PICK : pick`,
   simétrico a `exposurePick`), ou deixar explícito que candidato sem `pick` zera o par (e então **não** contá-lo
   como observado em cobertura). Adicionar teste com candidato sem `pick` + par observado.
2. **F2** — separar "ausente" de "zero": se `pick===0`, `nBase=0` (base desconhecido). Não usar fallback
   para zero explícito. Alinhar com o `qa:78`. Adicionar teste `pick:0` vs ausente vs `0.05`.

### P1 (should-fix)
3. **F3** — validar `params` (`priorVar>0`, `k≥0`, `0≤damping≤1`, `offLanePenaltyPp≥0`); garantir
   `expected_pp/sigma_pp/lower_bound` finitos (D8). Teste para `priorVar≤0` e `k`/`damping` não-default.
4. **F4** — decidir e documentar: a penalidade de lane entra na fronteira (mu,σ) **ou** `frontier`
   passa a considerar `lower_bound`. Não deixar `frontier:true` com `score:0`.
5. **F5** — calcular `dominated/frontier` sobre `mu/sigma` **não arredondados**.
6. **F6** — guardar `candidates:null`/`params:null` (ex.: `candidates = input.candidates ?? []`,
   `params = input.params ?? {}`) para consistência com a tolerância a `null` já existente.

### P2 (nice-to-have)
7. **F7** — só contar par como "observado" quando houver efeito estimável (exposição > 0).
8. **F8/F9** — dedupe de ids de candidatos e guarda para id em `allies`∩`enemies`.
9. **F10** — corrigir "19 casos" → 20 em `qa:5`.
10. **F11** — ajustar a doc: `score` pode ser `null` apenas quando não há `lower_bound` finito.

---

## Fechamento (pós-correção) — 2026-10-30

Reescrita do módulo endereçando os achados; suíte ampliada de 20 → **30 testes**
(`node --test` → 30/30; suíte completa do motor → **241/241**; `check-boundaries` → OK;
`check:api`/`check:web` → OK; e2e com dado real → inalterado).

| Achado | Status | Correção aplicada |
|---|---|---|
| **F1** (P0) | **FECHADO** | `exposurePick` aplicado ao `pick` do próprio candidato (base e pares); candidato sem `pick` usa `DS_FALLBACK_PICK` e o par observado é estimado. Teste: "candidato SEM pick ainda estima par observado". |
| **F2** (P0) | **FECHADO** | `pick:0` explícito ⇒ `nBase = C_REFERENCE·0 = 0` ⇒ `base_pp=0` (nunca fallback para zero explícito). `exposurePick` só usa fallback para `null`/`undefined`/`NaN`. Testes: "pick:0 explícito NÃO inventa exposição", "ausente difere de zero e de alto". |
| **F3** (P1) | **FECHADO** | `numParam(v, def, min, max)` valida `k∈[0,100]`, `priorVar∈[1e-12,1e3]`, `damping∈[0,100]`, penalidade≥0; inválido ⇒ default. Saída sempre finita. Testes de `priorVar:-1`/`k:-2` e de `damping`/`k` não-default. |
| **F4** (P1) | **FECHADO** | Dominância sobre a média **efetiva** `__muEff = (expected_pp − lanePenalty)/100`, consistente com `lower_bound`. Teste garante `frontier:true` nunca com `lower_bound` menor que um dominador. |
| **F5** (P1) | **FECHADO** | Arredondamento movido para o **fim** (após a fronteira); `dominated`/`frontier` usam valores não-arredondados. Teste: diferença submilésimo de `mu` ⇒ exatamente 1 frontier. |
| **F6** (P1) | **FECHADO** | `const src = input ?? {}` + `src.candidates ?? []` + `src.params ?? {}` + `src.allies/enemies/bans ?? []`. Testes com `candidates:null`, `params:null`, `undefined`. |
| **F7** (P2) | **FECHADO** | `shrinkEffect` só marca `observed` quando há **exposição > 0**; par listado sem exposição vira efeito 0 e não conta na cobertura. |
| **F8** (P2) | **FECHADO** | `seen` deduplica ids de candidatos (uma linha por id). |
| **F9** (P2) | **ABERTO (LOW)** | Id em `allies`∩`enemies` ainda conta em sinergia e confronto; entrada inválida (um herói não é aliado e inimigo ao mesmo tempo), sem impacto no fluxo real. Documentado. |
| **F10** (P2) | **FECHADO** | `qa:5` → "30 casos". |
| **F11** (P2) | **FECHADO** | ADR §D8 e QA §4 ajustados: `score = null` só quando nenhum `lower_bound` é finito. |

Ressalva estatística de §1 (sobreposição base↔par) foi adicionada a `qa §4`.

### Veredito atualizado: **APROVADO** (0 P0, 0 P1 abertos; 1 P2 residual documentado — F9)

