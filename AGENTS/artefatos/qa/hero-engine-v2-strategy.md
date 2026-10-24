# Estratégia de testes — rebuild hero-engine vs ESPECIFICAÇÃO V2

- Data: 2026-10-11 · Autor: qa-strategist
- Escopo: `packages/proprietary-engine` (rebuild) contra `ENGINE_MLBB_ESPECIFICACAO_TECNICA_V2.md` §§21–22 + checklist §26
- Spec normativa: `C:\Users\GUILHERME\Downloads\ENGINE_MLBB_ESPECIFICACAO_TECNICA_V2.md`
- Código sob teste: `packages/proprietary-engine/src/hero/score-heroes.js` (+ `strength-index.js`, `tierOf.js`, `hero-trend.js`, `trust.js`, `forca-sorting.js`, `hero-lists.js`, `hero-profile.js`)
- Testes existentes lidos: `test/hero-contract.test.js` (contrato + monotonias + determinismo), `test/hero-trend.test.js` (Theil–Sen, TREND_N/DELTA), `test/trust.test.js` (confidenceToTrust/trustOf/verdicts), `test/forca-sorting.test.js` (sort/q/B/d-alias/empate-por-id). Suite total: 25 arquivos `test/*.test.js`.
- Nota INV: glob `**/invariants.md` no repo retornou vazio — não há `INV-XXX` de domínio para linkar. Esta estratégia cria `QA-XXX` como chave primária. Quando `domain/invariants.md` existir, adicionar coluna `INV ↔ QA` sem renumerar.

## 0. Gate único (não-negociável)

```powershell
npm run test -w packages/proprietary-engine
# = node --test ./test/*.test.js  (package.json do workspace)
```

- **Verde =** exit 0, 0 falhas, 0 skips silenciosos em todos os 25 arquivos.
- Roda em: **CI por PR + pre-push local**. Nada mergeia vermelho.
- Build gate complementar: `npm run build -w packages/proprietary-engine` (`node --check src/index.js`) deve passar antes dos testes.
- Cobertura feliz ≈ 20% da matriz; resto é erro/borda/regressão (Done §7).

## 1. Estratégia por nível (o que vai onde e por quê)

| Nível | Onde mora | O que prova | Por que neste nível |
|---|---|---|---|
| **Unit puro (node:test, sem I/O)** | `test/hero-contract.test.js`, `test/forca-sorting.test.js`, `test/hero-trend.test.js`, `test/trust.test.js`, novos `test/walkforward-*.test.js`, `test/normalize-guards.test.js` | Funções puras: `scoreBatch/scoreHeroes`, `tierOf`, `strengthIndexByRank`, `trendOf`, `confidenceOf/trustOf`, `sortHeroesByMetric`, BH/`pFromZ` | Engine é pura por design (spec §4.1). Teste determinístico, <1s, sem rede. É aqui que vivem os 14 determinísticos QA-001…QA-014. |
| **Contract (schema × OpenAPI)** | `test/*contract*.test.js` + novo `test/rone-schema-pinning.test.js` | Adapters por endpoint aceitam `days` vs `past-days`, `lane` obrigatório, taxas em `[0,1]`, `data.total` ≠ partidas; falha visível quando schema muda (spec §§3.3–3.4) | Impede fallback silencioso para default de outro endpoint. Roda em CI + nightly contra `openapi.json` pinado (v1.2.3). |
| **Sintético/estatístico (fixtures)** | `test/synthetic-*.test.js` (novo) ou seção dedicada | 10 cenários §22 (nulo, amostra pequena/grande, patch/rank shift, outlier, popularity-only, build bias, survivorship, UGC) | Valida semântica estatística que unit não pega (excesso de `strong`, shrinkage, causalidade indevida). Roda em CI; seeds fixas. |
| **Walk-forward / backtest (temporal)** | `test/walkforward.test.js` + script `validation/walk-forward.js` (a criar) | Regras §21: só dados até `t`, modelo de `t`, janela futura pré-registrada, sem recalibrar threshold na janela de teste | Único nível que detecta vazamento temporal e `c`/threshold overfitado. Roda em CI (fixtures pequenas) + nightly (snapshots reais). |
| **Regressão de UI/paridade** | testes `paridade` já existentes (HeroCard, ForcaPanel, Dashboard, HeroDetails) | `trendOf`, `sortHeroesByMetric`, `trustOf`, `verdictSentence` continuam idênticos ao que a web consome | Quebra de contrato web aparece aqui antes do deploy. Roda em CI. |
| **Manual / exploratório** | checklist §26 executado por humano | Narrativas sem claim absoluto (§20), `quality_flags`, `cohort_key` visível | Não automatizável com valor; roda em release-candidate. |

**Risco primeiro (L1/L2):** dinheiro/dados/auditoria = (1) `q` confirmatório indevido, (2) `se`/IC fingindo precisão sem `n`, (3) vazamento walk-forward, (4) mistura de coortes rank/janela/patch. Esses quatro têm QA dedicado e bloqueiam release.

## 2. Matriz QA — 14 determinísticos §22 (+ gaps do rebuild)

Legenda — `Nível: U`=unit, `C`=contract, `S`=sintético, `W`=walk-forward · `Roda: CI`=cada PR, `N`=nightly, `M`=manual ·
`Cobertura atual`: ✅ coberto · ⚠️ parcial · ❌ gap (a implementar no rebuild).

| QA | §22 bullet | Pré-condição | Passos | Resultado observável | Nível / Roda | Cobertura atual |
|---|---|---|---|---|---|---|
| QA-001 | saída invariável à ordem de entrada (incl. empates de IDs) | lote n=132 seed fixa, com 6 clones exatos | 1. `scoreHeroes(rows)` 2× 2. `scoreHeroes(shuffled(rows,99))` 3. comparar por id | `deepEqual` idêntico nas 3 execuções; empate ⇒ mesmo `tier` + mesmo `strength_index` | U / CI | ✅ `hero-contract.test.js` ×4 cenários + ties |
| QA-002 | taxas/ranks fora do intervalo rejeitados | linhas com `win=53`, `win=-0.1`, `pick=2`, rank inválido | passar por normalizador + `scoreBatch` | linhas quarentenadas, `meta.n_dropped` incrementa, nenhuma entra no cálculo de `mu/tau`/BH | U+C / CI | ⚠️ `n_dropped` testado p/ NaN/null; **gap: `53` vs `0.53` e rank fora do enum não testados** |
| QA-003 | nulo/NaN/string não vira zero | lote 20 válidos + `{win:NaN}` + `null` + `{win:"0.5"}` | `scoreBatch` | `heroes.length===20`, `meta.n_dropped===2`, nenhum `wrAdj===0` fantasma | U / CI | ✅ "lote vazio e linhas inválidas" |
| QA-004a | n=0 retorna lista vazia | `[]` / `null` | `scoreHeroes([])`, `scoreHeroes(null)` | `[]`, sem throw | U / CI | ✅ |
| QA-004b | lote < MIN_LOT não atribui tier conclusivo | lote n=8 | `scoreBatch` | `meta.small_sample===true`, todo `tier==="?"`, `strong/weak/isGem===false`, `confidenceOf==="baixa"` | U / CI | ✅ |
| QA-005 | empate ⇒ posto médio consistente | lote com 6 clones + `heroRankPositions` bulk vs individual | ordenar por `wrAdj`, checar `strength_index`/`tier` dos clones | clones com `wrAdj` idêntico (bit-a-bit), `strength_index` idêntico, bulk `===` individual, posições `1..n` sem repetição | U / CI | ✅ contrato (paridade θ̂) + `forca-sorting` empate-por-id |
| QA-006 | percentis extremos ⇒ tiers S/A/B/C/D | lote ordenado conhecido, pct `≥0.92 / 0.75 / 0.25 / 0.08` | `tierOf(pct)` nos 5 limites + `pctFromRank` | S=topo ~8%, A, B central, C, D fundo ~8% conforme tabela §7.2; `tier_version` carimbado | U / CI | ⚠️ monotonias tier-vs-θ̂ testadas; **gap: limites exatos 0.92/0.75/0.25/0.08 sem teste de borda dedicado** |
| QA-007 | proporção 0/1 ⇒ guarda, sem NaN/Inf | linhas `win ∈ {0,1}`, `pick=0.0005` | `scoreBatch` com degenerados | `degenerate===true`, `strong/weak===false`, `wrAdj/se/B/q` finitos | U / CI | ✅ cenário "empates + degenerados" + invariante `degenerate ⇒ ¬significante` |
| QA-008 | pick=0/ausente sem div-zero nem falsa precisão | `pick=0`, `pick=NaN`, `pick` ausente | `scoreBatch` | sem `Infinity/NaN`; saída `sem estimativa/insuficiente` ou política versionada + `uncertainty_status` incerto; nunca `B≈1` fingindo precisão | U / CI | ❌ **gap: `pick=0` hoje é filtrado como inválido, mas política "sem estimativa vs fallback" (§6.1) não tem teste explícito** |
| QA-009 | quebra de game_version atenua/invalida prior | `prior={mu:0.5,tau2:0.0009,n:130,game_version:"2.1.18"}`, `gv="2.1.19"` vs `"2.1.18"` | `scoreBatch` nos dois | mesma versão ⇒ `se` idêntico ao lote; quebrada ⇒ `se` alargado (`V×K`), `meta.version_break===true`, `prior` carimbado; `uncertainty_status/sensitivity_band` do lote nunca mascarados | U / CI | ✅ `meta traz o que saiu do herói` + cenários prior mesma/quebrada |
| QA-010 | Theil–Sen robusto a outlier + datas reais | séries `[0.5×5, 0.9]`, rampa `0.5→0.52`, série irregular com lacuna | `trendOf` com `{date,win}` | outlier extremo ⇒ `dir==="estável"`; rampa ⇒ `"subindo"`; **cálculo usa `(t_j−t_i)` reais, não índice** | U / CI | ⚠️ robustez testada mas **só com espaçamento uniforme; gap V2: datas reais/lacunas** (`hero-trend.js` atual assume equidistância — §2.3 p6) |
| QA-011 | duplicada/lacuna/1 obs/2 obs ⇒ status correto | séries: 1 ponto, 2 pontos `Δ=0.004`, data duplicada, NaN intercalado | `trendOf` | 1 ponto ⇒ `{sem-dado,delta:null,n:1}`; `Δ=0.004 < 0.005` ⇒ estável com `delta≈0.004`; duplicata dedupada por regra documentada; NaN ignorado antes da janela | U / CI | ✅ `hero-trend.test.js` (sem-dado, janela últimos-n, limiar ±0.005) |
| QA-012 | BH ordena p-values, respeita FDR; inválidos fora da família | vetor `pv` conhecido + 1 `NaN` | `benjaminiHochberg(pv)`, `scoreBatch` | `q` monotônico em `p`; `strong ⇒ wrAdj>mu ∧ q≤0.05`, `weak ⇒ wrAdj<mu ∧ q≤0.05`; `strong∧weak` impossível; `NaN` excluído, não `q=0` | U / CI | ✅ invariantes `strong/weak/isGem` + counts; **gap: `pFromZ` pós-shrinkage ainda experimental (§9) — ver QA-020** |
| QA-013 | build/pair sem `n` ⇒ sem IC calibrado | fixture build `{build_win_rate, build_pick_rate}` sem `matches` | pipeline build/pair | `credible_interval_95===null`, `sample_size_method:"not_provided_by_api"`, ordenação exploratória rotulada, nunca "melhor build" confirmatória | C+S / CI | ❌ **gap: contrato build/pair do rebuild ainda não existe (§23 fase 4)** |
| QA-014 | vistas monotônicas em θ̂; significância PODE discordar | lote 132 + herói `win=0.62, pick=0.0004` | `scoreHeroes`, checar `tier/strength_index` vs `wrAdj` e `strong` do outlier | `wrAdj` maior ⇒ tier/index maior; herói pick-minúsculo encolhido (`wrAdj<max`), `strong===false` apesar de `win` bruto alto | U / CI | ✅ "vistas monotônicas" ×5 + "significância PODE discordar" |

## 3. Matriz QA — 10 sintéticos §22 (S-01…S-10)

Todos com seed fixa, `Roda: CI`, fonte: fixtures determinísticas (não rede). Cada um tem **comportamento esperado numérico**, não "edge sem oráculo".

| QA | §22 sintético | Pré-condição (fixture) | Passos | Resultado observável (oráculo) |
|---|---|---|---|---|
| QA-015 / S-01 Nulo | 130 heróis mesma performance real (`θ=0.51`, ruído simétrico) | `scoreBatch`, contar `strong` | `counts.strong / n ≤ fdr_alpha + tolerância` (sem excesso de "fortes"); `q` uniforme-ish; nenhum `isGem` promovido a fato |
| QA-016 / S-02 Amostra pequena extrema | herói `win=1.0` com proxy `c×pick` mínimo vs lote `~0.5` | `scoreBatch` | `wrAdj` puxado p/ `mu` (`B` baixo), `strong===false`, `uncertainty_status==="inconclusivo"` / `confidence==="baixa"` |
| QA-017 / S-03 Amostra grande moderada | herói lift `+1.5p.p.` com `B` alto (proxy informativo) | `scoreBatch` | `wrAdj≈win` (encolhimento pequeno), `se` estreito, mas `strong` só se `P(θ>mu+delta_practical)≥threshold`; lift modesto ≠ selo forte automático |
| QA-018 / S-04 Patch shift | prior `game_version:"2.1.18"` aplicado a lote `gv:"2.1.19"` com distribuição deslocada `+3p.p.` | `scoreBatch` com/sem prior | com quebra: `version_break===true`, pull do prior atenuado (`τ²×K`), `wrAdj` segue o lote novo; sem `gv` informado: documentar silencioso + `M` review |
| QA-019 / S-05 Rank shift | mesmos heróis em `mythic` vs `epic` (baselines `mu` distintos) | `scoreBatch` por coorte, comparar `wrAdj` cross-coorte | `cohort_key` distinto; proibido comparar `wrAdj` entre ranks sem ajuste — teste falha se helper de comparação misturar coortes |
| QA-020 / S-06 Trend com outlier | série 6 pts com 1 extremo (`0.9` no fim) + série irregular com lacuna de 4 dias | `trendOf` com datas reais | `dir==="estável"` nas duas; slope calculado por mediana de `(y_j−y_i)/(t_j−t_i)` com `t` em dias; `delta_pp_window = slope×(t_last−t_first)` |
| QA-021 / S-07 Popularity-only | `pick` rampa `+5p.p.` janela, `win` flat | radar cruzado win/pick/ban separados | `trend_pick==="rising"`, `trend_wr==="stable"` ⇒ classe **"Popularizando sem evidência de força"**, nunca "mais forte"/Tier promovido |
| QA-022 / S-08 Build selection bias | build A `win=0.65` amostra concentrada (1 rota/patch) vs build B `win=0.55` ampla | ranking `build_rank_within_hero` | A não rotulada "melhor"; `build_confidence==="inconclusive"` sem `n`; saída exige `build_key=(hero,rank,version,lane,equips,rune,spell)` |
| QA-023 / S-09 Survivorship duração | bins `min_win_rate6…20` com late-game `0.70` sem `n` por bin | curva por faixa + `profile` | texto "padrão reportado pela API por intervalo", nunca "chance de ganhar se passar de 20min"; `profile ∈ {early/mid/late/flat}` só com Δ>limiar prático + cobertura; sem causalidade |
| QA-024 / S-10 UGC | guia com `vote_average=4.9`, `vote_count=3`, `views` alto | pipeline community | `evidence_level` baixo; atenção (`views_24h`/velocidade) separada de voto e de performance competitiva; `hot` tratado como índice externo opaco |

## 4. Plano walk-forward sem vazamento (§21)

Rebuild deve criar `validation/walk-forward.js` + `test/walkforward.test.js` (hoje só existe prior unitário em `score-heroes.js`; backtest histórico não existe).

**Snapshot mínimo (imutável, nunca sobrescrever):** `fetched_at, source_endpoint, query_params, raw JSON, normalised rows, source_api_version, api_version, game_version?, payload_hash, data_quality, model_version, cohort_key=(source_endpoint,rank,requested_window,observed_dates,game_version,match_type,camp_type,lane,region)`.

**Protocolo (5 regras §21, teste falha se qualquer uma quebrar):**

1. **Só passado:** sinal em `t` usa exclusivamente snapshots com `fetched_at ≤ t`. Teste: fixture com 30 dias; gerar sinal `t=15`; assert que payload `t>15` não foi lido (mock de acesso lança se tocar futuro).
2. **Modelo de época:** sinal gerado com `model_version` vigente em `t` (não o atual). Teste: rodar `eb_rate_proxy_v1` vs versão anterior no mesmo snapshot; `meta.model_version` difere e resultado reproduz o histórico.
3. **Janela futura pré-registrada:** `horizonte` (ex.: +7d) fixado antes de ver o futuro. Teste: `walkForward({horizon_days:7})` mede `win_rate` realizada só em `(t, t+7]`; mudar horizonte pós-hoc invalida o run (`hash` de config ≠ registrado ⇒ fail).
4. **Múltiplas datas:** repetir `t ∈ {t1…tk}` (k≥5). Teste: relatório traz distribuição de acerto, não cherry-pick de 1 data.
5. **Sem recalibragem no teste:** `c`, `TREND_DELTA`, thresholds calibrados em janela `train`; reportados em janela `test` disjunta. Teste: calibrar `c` no `test` e comparar — CI falha se `c_test` vazar para o run oficial (guarda por `calibration_version` + hash de intervalo).

**Métricas do backtest (vs baselines simples — "sem mudança", último valor, média móvel):** erro de previsão win_rate (Brier/log-loss quando aplicável), calibração de probabilidades (curva observed-vs-predicted), falsos positivos de `strong`, estabilidade de ranking (Spearman top-k), precisão do radar (emergente/popularizando/escondida). Theil–Sen sozinho não é modelo preditivo — comparar sempre contra os nulos.

**Onde roda:** fixtures pequenas em CI (<5s); snapshots reais em nightly com relatório versionado. QA-025 = "walk-forward sem vazamento ponta-a-ponta" (W / CI+N).

## 5. Critérios de release (todos obrigatórios — §22 + §26)

- [ ] **R-1 Fórmulas/thresholds documentados + versionados:** `model_version:"hero-engine-v2.0.0"`, `strength_model:"eb_rate_proxy_v1"`, `tier_version`, `strength_index_version`, `trend_version:"theil-sen-date-v2"`, `MIN_LOT=10`, `FDR_ALPHA=0.05`, `GEM_QUANTILE=0.25`, `TREND_N=5`, `TREND_DELTA=0.005`, `c` + `c_reference` + `c_grade` + `rate_proxy_calibration_version` carimbados em `meta`. `engine-config.json` (§24) sem `null` silencioso — `null` = decisão pendente explícita.
- [ ] **R-2 Zero falhas contrato + sintéticos:** `npm run test -w packages/proprietary-engine` verde (25 arquivos, QA-001…QA-025 mapeados). Nenhum `test.skip` sem issue linkada.
- [ ] **R-3 Build verde:** `npm run build -w packages/proprietary-engine` passa.
- [ ] **R-4 `q` confirmatório DESLIGADO:** `allow_confirmatory_q_values:false` (§24). `q`/`strong` exibidos só como **sinal experimental/exploratório** até auditoria de `pFromZ` pós-shrinkage (§9) + módulos `obsVariance/pFromZ/BH/confidenceTrio/walkPriorStamp` verificados. UI não usa `strong` como "prova".
- [ ] **R-5 Probabilidades calibradas antes de prometer:** `posterior_prob_above_threshold`, `credible_interval_95`, `se` rotulados `model_based_uncertainty` (proxy, não IC 95% garantido) enquanto `sample_size_method:"not_provided_by_api"`. Sem `n` real: `se/IC/prob ⇒ null + status/reason`, nunca `0`. Modo Beta-Binomial (§6.2) só ativa com `n/k` reais.
- [ ] **R-6 Sem claims confirmatórios sem denominador/semântica:** `increase_win_rate` preservado bruto, nunca em p.p. causais; matriz `A→B` dirigida, não simétrica; duração/rota sem causalidade; UGC atenção≠voto≠performance (§§12–17). Narrativas seguem template conclusão→prova→contexto→limitação (§20).
- [ ] **R-7 Walk-forward vs baseline:** relatório §4 arquivado com config-hash, horizonte pré-registrado e comparação contra "sem mudança"/último-valor/média-móvel. Sem este artefato, release bloqueado.
- [ ] **R-8 Coorte + snapshot + qualidade em todo output:** `cohort_key`, `fetched_at`, `payload_hash`, `quality_flags` (`global_sample_count_missing`, `uncertainty_proxy`, …), `data_status ∈ {ok,missing,not_returned,stale,invalid}`. Ausência nunca vira `0`/Tier D/`50%`/confiança alta.

## 6. Gaps do rebuild → backlog de testes (ordem de risco)

1. **P0** `test/normalize-guards.test.js` (QA-002/008): unidade `53`→detecção + `pick=0` política explícita.
2. **P0** `test/walkforward.test.js` + `validation/walk-forward.js` (QA-025, §21): protocolo 5 regras + métricas vs nulos.
3. **P0** `test/synthetic-suite.test.js` (QA-015…QA-024): 10 fixtures com seeds fixas; QA-020 exige `trendOf` com datas reais (muda `hero-trend.js` — hoje equidistante).
4. **P1** `test/rone-schema-pinning.test.js` (contract): `days` vs `past-days`, `lane` obrigatório, `data.total`≠partidas; pin OpenAPI v1.2.3.
5. **P1** `test/tier-edges.test.js` (QA-006): bordas 0.92/0.75/0.25/0.08 + `n=10` vs `n=9`.
6. **P1** `test/build-pair-contract.test.js` (QA-013/022): `build_key` hashável, sem-`n`⇒sem-IC.
7. **P2** Auditoria `pFromZ`/BH confirmatória (QA-012/R-4): bootstrap/permutação ou Binomial/GLM; até lá `q` experimental.

## 7. Done desta estratégia

- [x] 14 determinísticos §22 cobertos (QA-001…QA-014; QA-004 desdobrado em 004a/004b porque o bullet funde dois oráculos).
- [x] 10 sintéticos §22 cobertos (QA-015…QA-024) com oráculo numérico cada.
- [x] Walk-forward sem vazamento definido (QA-025 + protocolo 5 regras + métricas vs baselines).
- [x] Release criteria com `q` desligado + probs calibradas + gate `npm run test -w packages/proprietary-engine`.
- [x] Mapeamento existente→gap honesto (✅/⚠️/❌ por QA); feliz ≈ 20%, resto erro/borda/regressão; todo cenário tem resultado observável.
- [ ] **Escalar (L3, não decidir sozinho):** cortar cobertura de fluxo crítico (R-4/R-5/R-7) para "ganhar tempo".
