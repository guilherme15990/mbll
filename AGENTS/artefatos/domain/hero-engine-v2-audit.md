# HERO ENGINE — Auditoria V2 (§§5–10) vs implementação atual

**Papel:** domain-modeler · **Data:** 2026-10-11 · **Spec normativa:**
`ENGINE_MLBB_ESPECIFICACAO_TECNICA_V2.md` (v2.0.0, 999 linhas, Rone Arena API pública v1.2.3)
**Alvo:** `@radar/proprietary-engine` (`packages/proprietary-engine/src/`)
**Entradas lidas (obrigatórias, todas verificadas):** spec V2 integral (§§1–26 + contrato §19 +
plano §23 + config §24) · `src/hero/score-heroes.js` (204 linhas) ·
`src/hero/hero-trend.js` · `src/hero/trust.js` · `src/utils/config.js` ·
`src/utils/statistics.js` · `src/confidence/confidence-trio.js`
**Entradas complementares:** `src/hero/tierOf.js` · `src/hero/strength-index.js` ·
`src/hero/hero-profile.js` · `src/hero/hero-lists.js` · `src/hero/forca-sorting.js` ·
`src/utils/math.js` · `src/governance/exposure.js` · `src/walkforward/walkforward.js`
**Escopo desta auditoria:** spec §§5–10 (normalização, Modo A rate-proxy, tiers,
incerteza, BH/FDR, opportunity). Fora de escopo (citado só como gap): §§11–17
(trend completa, pares, duração, builds, lane, jogador, UGC).

> Regra arquitetural central (§Resumo executivo): **não condensar tudo em score opaco**.
> `wr_adj`, tier, confiança, significância, pick/ban e tendência são perguntas distintas
> e podem discordar legitimamente. O código atual já separa as famílias
> (`HERO_CONTRACT`: vista / incerteza / significancia / guarda) — ponto conforme a preservar.

---

## 1) Tabela campo-a-campo — veredito por campo do motor

Legenda: ✅ conforme · ⚠️ parcialmente conforme / guarda incompleta · ❌ divergente
(experimental ou viola requisito normativo). Referências de código são linha-aproximadas.

| Campo | Implementação atual | Esperado na spec (§) | Veredito | Evidência / ação |
|---|---|---|---|---|
| `wrAdj` (θ̂) | `ebShrink(y,s²,μ,τ²)` → `m = V·(y/s²+μ/τ²)`, `V=(1/s²+1/τ²)⁻¹`, `μ=median(y)`, `τ=1.4826·MAD`, piso MAD `1e-6`; com prior WF: pull `m*=(m·τ²eff+μ_prior·V)/(V+τ²eff)` (§16/ADR-023). Puro, determinístico, ordem-invariante | §6.1 passos 1–4 idênticos: `μ=median`, `τ=1.4826·MAD`, `s²=μ(1−μ)/(c·p)`, `V`, `wr_adj`, `se=√V` | ✅ **conforme (mecânica)** · ⚠️ **requisitos envolventes pendentes** | `score-heroes.js:103-107,120-134` + `statistics.js:56-67`. Preservar na Fase 1. Faltam: clamp `μ∈[ε,1−ε]` com flag (§6.1), fallback `τ≈0` versionado (hoje `‖1e-6` ad-hoc), `c` calibrado por coorte, `sample_size_method: rate_proxy` + `model: eb_rate_proxy_v1` no output (§6.1/§19) |
| `se` | `√V`; com prior mesma versão `se` idêntico ao lote, com quebra `√(V·K)`, `K=4`; piso `1e-12`. Trio usa `se_eff=se·√(C_REF/c)` p/ IC/banda | §6.1 `se=√V` + §8.1: só chamar de erro-padrão calibrado se hipóteses validadas; sem `n` real nomear `model_based_uncertainty`, sem alegar cobertura 95% | ⚠️ **parcial — mecânica ok, rótulo diverge** | `score-heroes.js:133,142` + `confidence-trio.js:15`. `se` hoje é exibido como número nu. Ação Fase 1: emitir `uncertainty.se` + `sample_size_method:not_provided_by_api` + flag `uncertainty_proxy` (§19 exemplo usa `"se": null` + `status:inconclusive_proxy_uncalibrated` até calibrar — adotar ou justificar por que manter número + status) |
| `B` | `B=τ²/(τ²+s²)`, peso do dado; `1−B` encolhimento. Comentário documenta cortes como razões de peso, não calibração | §6.1 passo 5 + §8.1: `B` é peso relativo, **não substitui contagem nem intervalo** | ✅ **conforme (fórmula + honestidade do comentário)** | `statistics.js:61`, `score-heroes.js:138`. Preservar. Não usar `B` sozinho como selo "Robusto" (§8.2) — ver `trust.js` abaixo |
| `q` (BH) | `pFromZ(z)` normal bicaudal (A&S 7.1.26) → `benjaminiHochberg(p)` BH step-up correto `q=min(1,p·m/k)` com passada reversa; aplicado ao **lote completo antes de filtrar** | §9: BH só em família por coorte+pergunta, p-valores sob nulo validado, armazenar `p_raw,q_bh,fdr_alpha,test_family,null_model_version`; §9 auditoria pendente: validar se `pFromZ((wr_adj−μ)/se)` após shrinkage + `μ/τ` estimados no mesmo lote é nulo válido | ⚠️ **mecânica BH conforme, semântica ❌ divergente (experimental)** | `statistics.js:14-39`, `score-heroes.js:148`. Até validar o nulo, `q` é **sinal experimental, não prova** (§9). Ação Fase 2: `allow_confirmatory_q_values=false`, não exibir `q` como confirmatório; registrar `test_family=null` + `null_model_version:unvalidated_eb_z_v1` (§19) |
| `strong` / `weak` | `sig = !smallSample && !degenerate && q≤0.05`; `strong=sig && θ̂>μ`, `weak=sig && θ̂<μ` — simétricos, guarda suprime significância sem alterar θ̂ | §9 + §25: `q≤α` + lado vs `μ` + sem guardas; **não equivale a vantagem prática**; precisa `delta_practical` versionado (§8.3) | ⚠️ **parcial — regra conforme, interpretação diverge** | `score-heroes.js:160-162`. `FDR_ALPHA=0.05` ok (§24). Falta: `practical_lift_pp=null` (sem corte publicável), `posterior_prob` como base do selo (§8.3: 0.95 forte / 0.80 exploratório — só após calibração). Não narrar "forte" como fato causal |
| `isGem` | `strong && qPick<0.25 && qBan<0.25` (postos médios, `rankQuantiles`); `⊂ strong` por construção; ordem `Joia antes de Forte` corrigida em `classOf` | §10: `isGem` = boa ideia de produto **mas exige "strong" válido**; recomendado migrar para `opportunity_candidate` com `P(θ>baseline+Δ)≥thr` + low pick/ban + sem falha de coorte/patch + `n` mínimo se houver contagem; saída `opportunity_reason[]`, `evidence_level`, `limitations` | ⚠️ **parcial — mecânica do quartil conforme, evidência diverge** | `score-heroes.js:163`, `trust.js:30-33`. `GEM_QUANTILE=0.25` = `gem_pick/ban_quantile_max:0.25` (§24) ✅. Ação Fase 3: implementar `opportunity_candidate` (§10/§23-F3); manter `isGem` rotulado exploratório enquanto `strong` depender de `q` não validado |
| `tier` | `tierOf(pct)`, `pct=(n−posto)/(n−1)`, cortes 0.92/0.75/0.25/0.08 → S/A/B/C/D; `?` se `pct` inválido ou `n<10` (`MIN_LOT`); `TIER_VERSION=tier-v2`; fonte única de posto com `strength_index` (monotonicidade garantida) | §7.2 tabela idêntica + §7.3: tier = posição relativa, não força/confiança; nunca Tier D sem dados; `n<10` só guarda de produto; salvar `tier_version` + coorte | ✅ **conforme** | `tierOf.js:12-18`, `strength-index.js:1-6`, `score-heroes.js:170`. Preservar. `smallSample` (n linhas <10) ≠ amostra por herói — documentar no output (`data_quality`), nunca fingir que 10 heróis garantem precisão (§2.2) |
| `strength_index` | `100·(n−posto)/(n−1)`, posto médio 1-based desc, empates dividem posto, `n≤1`→null, 1 casa decimal; `STRENGTH_INDEX_VERSION=strength-index-v1` | §7.1 fórmula idêntica; ordinal relativo ao lote, não win probability | ✅ **conforme** | `strength-index.js:42-45`. Preservar byte-identidade (ADR-024). Não usar como força absoluta nem como tier substituto (§18: manter `pick/ban_percentile`, `evidence_level` separados) |
| `trend` (direção) | `trendOf(points,n=5)`: últimos 5 `win` finitos, Theil–Sen mediana-dos-pares ×(m−1) = Δ janela, `TREND_DELTA=0.005` (0.5 p.p.); espaçamento **uniforme assumido**; só `win`; sem data | §11: Theil–Sen com **`t` real** `slope=median((yⱼ−yᵢ)/(tⱼ−tᵢ))`, `Δ=slope·(t_last−t_first)`, `slope` em p.p./dia, séries **separadas** win/pick/ban, `direction rising/stable/falling/insufficient_data` + `delta_pp_window,slope_pp_per_day,n_points,window_days,robustness`, limiar prático versionado | ❌ **divergente (Fase 1 obrigatória)** | `hero-trend.js:14-34`. Placa anti-unificação `TREND_DELTA≠PRACTICAL_DELTA` correta. Ação: reescrever para `(tᵢ,yᵢ)` com `date` ISO da API (`/trends`: `date,win_rate,app_rate,ban_rate`), deduplicar por data, `past-days` vs `days` por endpoint (§3.3), 3 séries + `trend_version:theil-sen-date-v2` (§19) |
| `credible_interval_95` | Normal `θ̂±1.96·se_eff(c)` + `details[]` por `C_GRID` | §8.1: posterior 95%, não IC frequentista automático; sem `n` real = proxy, sem cobertura garantida | ⚠️ **parcial — fórmula plausível p/ Modo A, calibração ausente** | `confidence-trio.js:16-17`. Renomear fonte `model:eb_rate_proxy_v1`; exibir com `status:provisional/inconclusive-sensitivity` (já faz) + nunca `0` quando sem base (usa `null` ✅ §19) |
| `posterior_prob_above_threshold` | `P(θ>med+Δ)=Φ(z)`, `Δ=DELTA_DEFAULT=0.02`, correção P0 EC-V2-01 aplicada (`Φ`, não `1−Φ`) | §8.3: `p_superior=P(θ>baseline+Δ_practical)` com `Δ` versionado por rank/decisão | ⚠️ **parcial — mecânica corrigida, Δ não calibrado** | `confidence-trio.js:18-20`. Ação: `practical_lift_pp=null` até calibrar; manter `delta_threshold` no output (já faz) + `C_GRADE_VERSION=c-grade-v2` |
| `uncertainty_status` / `sensitivity_band` | `crosses ? inconclusive-sensitivity : provisional`; banda `P(θ>μ+0.02)` min–max sobre `C_GRID=[1e4,1e5,1e6,1e7]` + `details[]`; `evidence_robustness: sensivel-a-c/estavel-em-c` | §8.1–8.2: `status` deve expor **porquê** inconclusivo; `sensitivity_band` útil quando `c` é proxy | ✅ **conforme (desenho)** | `confidence-trio.js:21-36`. Preservar. `trustOf` já prioriza banda (`sensitive→Situacional` ✅ §8) |
| `degenerate` | `(win===0‖win===1) && B<1` (≈ sempre verdade → equivale a `win∈{0,1}`); suprime significância, nunca altera θ̂ | §25 + §5.2: validar faixa/unidade **antes**; fora de `[0,1]` quarentenar; taxas `1` em bins/builds não garantem amostra (§3.4) | ⚠️ **parcial — guarda existe, validação a montante falta** | `score-heroes.js:158`. Ação Fase 1: normalizador `[0,1]` estrito (rejeitar `53`, `NaN`, `"53%"`, sentinelas → `missing/invalid`, nunca 0 — INV-002/003); `B<1` redundante — simplificar para `win∈{0,1}` + documentar |
| `smallSample` | `0<n<10` (#linhas finitas no lote) → suprime `strong/weak`, tier `?` | §2.2 + §7.3: `MIN_LOT=10` é #heróis, **não partidas/herói**; guarda operacional, não prova de amostra | ✅ **conforme como guarda** desde que rotulada | `score-heroes.js:26,82`. Ação: expor `data_quality: small_lot_suppress_significance` + nunca confundir com `sample_size` (§19 `match_count:null`) |
| `z` (+ `posterior_mean`, `_debug`) | `z=(θ̂−μ)/se` no topo (desvio b) + `posterior_mean` no topo (desvio a, exigência PRD ConfiancaSection) + `_debug{z,p,wrAdjBatch,seBatch,qPick,qBan}` sob `debug` | Desvios documentados no contrato; `z` é estatística interna do `q` | ✅ **conforme (desvios assumidos e versionados)** | `score-heroes.js:54-58,139,184-189`. Preservar; `z`/`posterior_mean` família **incerteza/significância**, nunca vista |
| `confidence`/`trust` (selos) | `confidenceOf`: B≥2/3 alta, ≥1/3 média, senão baixa (+guardas→baixa); `trustOf`: banda-sensível→Situacional, `alta+estável`→Robusto; `verdictSentence/Short` 3 vias; comentários admitem **interpretação, não calibração** | §8.2: cortes B **podem ficar como diagnóstico interno, nunca sozinhos concedem "Robusto" público**; Robusto exige dados adequados + invariância sob alternativas + evidência vs limiar calibrado + walk-forward ok | ⚠️ **parcial — taxonomia conforme, calibração ausente** | `trust.js:8-15,18-71`. Ação: selo público "Robusto" só via `posterior_prob + banda + qualidade + estabilidade` (§8.2); `B`-tiers permanecem como `evidence_level` interno |

**Resumo executivo da tabela:** mecânica EB (μ/τ/s²/V/m/B), postos médios, tiers,
BH-step-up, Theil–Sen-robusto e envelope `missing→null` estão **fiéis e a preservar**.
Divergências normativas concentram-se em **(a)** normalização/validação `[0,1]`+sentinelas
a montante (§5), **(b)** `c` não calibrado + `se`/IC/`q` exibidos sem rótulo proxy/experimental
(§§6/8/9), **(c)** trend sem datas reais e só-win (§11), **(d)** ausência de
`cohort_key`/`quality_flags`/`model_version`/`sample_size_method`/`opportunity_candidate`
no output (§§3.6/19/10).

---

## 2) Cobertura dos 7 pontos de auditoria (§2.3) — critério Done

| # | Ponto §2.3 | Status após leitura dos módulos "ausentes" | Evidência |
|---|---|---|---|
| 1 | Módulos ausentes no ZIP (`math/statistics/config/confidence-trio/walkforward`) impediam verificar `obsVariance,pFromZ,BH,IC,prob,sensibilidade,prior` | ✅ **resolvido — todos recuperados e auditados** | `statistics.js:64-67` `obsVariance` = `(μ(1−μ))/(c·p)`, `pick≤0‖c≤0→∞`; `pFromZ` normal bicaudal A&S; `BH` step-up correto; `confidence-trio.js:9-37` IC normal + `Φ` corrigido + banda `C_GRID`; `walkforward.js:13-49` `K=4`, validação `{mu,tau2,n,game_version}`, `summarizeWalkPosterior` com `τ_post=max(batch,prior)`, `n` descontado `⌊n/4⌋` em quebra |
| 2 | `C_REFERENCE` vinha de `config.js` ausente; valor efetivo não conferido | ✅ **resolvido — `c=1e5`, grade explícita** | `config.js:5-8`: `C_GRID=[1e4,1e5,1e6,1e7]`, `C_REFERENCE=1e5`, `C_GRADE_VERSION=c-grade-v2`, `DELTA_DEFAULT=0.02`, `LANES=[exp,mid,roam,jungle,gold]`. `C_GRADE` ausente → `meta.c_grade=null` ✅ (não quebra o módulo, `score-heroes.js:22`). Pendente Fase 1–2: versionar `c` por coorte + `rate_proxy_c=null` até calibrar (§24) |
| 3 | `c×pick` só vale como `n` efetivo se calibrado; pick ≠ partidas | ✅ **confirmado como proxy não calibrado — rotular** | `exposure.js:5-12` já declara `pick=slot_share, status:unvalidated` + `checkPickSum≈1±0.005` (INV-101). `hero-lists.js:9-11` fallbacks neutros (0.5/0.007/0.05) são de UI, não do motor ✅ separar. Ação: `sample_size_method:rate_proxy|observed_count`, `se/IC` como `model_based_uncertainty` (§6.1) |
| 4 | `z=(wrAdj−μ)/se→p→BH`: shrinkage + `μ/τ` estimados no mesmo lote não garantem p calibrado | ✅ **confirmado — `q` experimental até validar nulo** | `score-heroes.js:135,148`. Decisão L2 §6: `allow_confirmatory_q_values=false`; `q` fica como exploratório; selo migra para posterior+`Δ` (§8.3/§9-política 6). Teste QA-04 (nulo sintético) exigido antes de reverter |
| 5 | Guarda `degenerate` (`win===0‖1`) exige validar `[0,1]` antes (não `%`, não sentinela) | ⚠️ **parcialmente coberto — guarda existe, normalizador falta** | Filtro atual só remove não-finitos (`score-heroes.js:80`), aceita `53` ou `-0.2` silenciosamente. Ação P0: normalizador único §§5.1–5.2 (INV-002/003) + `data_status:missing/not_returned/stale/invalid` (§5.3) |
| 6 | Theil–Sen só-`win`, remove inválidos, espaçamento uniforme; API tem `date` → usar tempo real | ❌ **aberto — reescrever na Fase 1** | `hero-trend.js:28-34` vs §11.1. Ação P0: `(tᵢ,yᵢ)` com `date` ISO, 3 séries, `window_days/slope_pp_per_day/robustness`, `trend_version:theil-sen-date-v2` |
| 7 | Thresholds de tendência/confiança/tiers como parâmetros versionados; nome técnico ≠ evidência | ✅ **parcialmente coberto — versionamento existe, calibração não** | Versionados: `TIER_VERSION`, `STRENGTH_INDEX_VERSION`, `C_GRADE_VERSION`, `FDR_ALPHA`, `GEM_QUANTILE`, `TREND_DELTA`, `K=4` ✅. Não calibrados: `c`, `Δ_practical`, `P≥0.95/0.80`, cortes B, `TREND_DELTA` universal (§8.3/§11.2). Ação: `engine-config.json` com `null` onde falta calibração (§24) — ver §7 |

---

## 3) Invariantes de domínio (INV-XXX) — onde imposta + como testada

Modelo (questionário domain-modeler, resumo): **ator** = pipeline de ingestão +
`scoreBatch(rawHeroes,{c,prior,gameVersion})` por coorte; **Entity** = `HeroSnapshot`
(identidade `hero_id` canônico string — mesmo herói com taxas novas continua o mesmo objeto);
**Value Objects** = `CohortKey`, `Rate[0,1]`, `StrengthEstimate(θ̂,se,B)`, `Tier`, `TrendSignal`,
`ExposureShare` (imutáveis, validação no construtor, sem setters públicos);
**agregado** = `CohortBatch(rank×window×patch×lane×source)` — 1 transação = 1 lote
(`μ,τ,BH,tiers` calculados uma vez por lote, nunca por herói isolado); consistência
transacional intra-lote, eventual entre snapshots (walk-forward prior); **eventos**:
`HeroFlaggedStrong/Weak`, `OpportunityCandidateProposed`, `UncertaintyInconclusive`,
`VersionBreakDiscounted`. Sem `status:string` aberto — `uncertainty_status ∈
{provisional, inconclusive-sensitivity, unavailable}` + `data_status ∈
{ok,missing,not_returned,stale,invalid}`.

| ID | Invariante (antes ∧ depois) | Onde imposta | Teste QA |
|---|---|---|---|
| INV-001 | **Coorte compatível:** `wr_adj/tier/q` só comparados dentro do mesmo `cohort_key=(source_endpoint,rank,requested_window,observed_dates,game_version,match_type,camp_type,lane,region)`; misturar `/heroes`×`/academy` ou ranks distintos é rejeitado | `cohort-key.js` (novo, Fase 1) + `scoreBatch` recebe lote já fatiado; `meta.cohort_key` obrigatório | QA-01: lote mythic-7d + legend-7d → 2 outputs distintos, nunca 1 ranking misto (§3.6/§6.4) |
| INV-002 | **Unidade `[0,1]`:** toda taxa (`win/pick/ban/app/build/increase_*` bruto preservado) é fração finita em `[0,1]` após normalização explícita; `53`/`"53%"`/`NaN`/`null`/sentinela → `missing/invalid`, nunca 0/50%/Tier D/confiança alta | normalizador `normalize/rates.js` (novo) a montante de `scoreBatch`; `scoreBatch` quarentena `¬finito ∨ ∉[0,1]` + `meta.n_dropped` | QA-02: `{win:53}`, `{win:null}`, `{win:"0.53"}` → dropped + `quality_flags:[rate_out_of_range\|rate_missing]` (§§5.1–5.3) |
| INV-003 | **Missing ≠ zero:** herói ausente (paginação/exposição parcial/rank filtrado/stale) → `data_status ∈ {missing,not_returned,stale,invalid}`, sem `wrAdj/tier/se/q` inventados | ingestão (`snapshots.js`: paginação `index/size‖last_cursor` completa) + normalizador | QA-03: resposta parcial (página 1/3) → sem tier para ausentes + flag `partial_page` (§5.3) |
| INV-004 | **Agregado = lote:** `μ,τ,q,BH,tiers,strength_index,qPick/qBan` calculados **uma vez por lote** (`O(n log n)`), aplicados por herói; BH no lote completo antes de filtrar/ordenar; reordenar/filtrar a tela nunca recalcula `q`/tier | `score-heroes.js:146-151` (já implementado ✅ preservar) | QA-04: permutar entrada → output idêntico (incl. empates `compareById`); BH em subset de tela proibido (§9.3–9.5, §22) |
| INV-005 | **`pᵢ>0` para variância finita:** `pick≤0‖ausente → s²=∞ → fallback `m=μ,B=0,se=√τ²` + estado `insufficient_exposure`, nunca divisão por zero nem precisão fingida | `statistics.js:64-67` (`obsVariance→Infinity`) + `ebShrink:57-58` ✅ + novo `status` explícito (hoje silencioso → P1 explicitar) | QA-05: `{pick:0}` → `B=0`, `wrAdj=μ`, flag `no_exposure_proxy` (§6.1, §22) |
| INV-006 | **Estabilidade numérica:** `μ` clampado a `[ε,1−ε]` com flag; `τ≈0 → fallback documentado + flag `near_zero_between_hero_variance`; nenhum `NaN/±Inf` vaza (`win∈{0,1}` → guarda, não exceção) | `scoreBatch` (clamp a adicionar) + `ebShrink` guards ✅ | QA-06: lote com todos `win=0.5` → `τ→0` → fallback + flag, sem `NaN` (§6.1, §22) |
| INV-007 | **`q` experimental:** enquanto `null_model_version=unvalidated`, `q/strong/weak/isGem` são **exploratórios**; `allow_confirmatory_q_values=false` bloqueia narrativa confirmatória; output carrega `p_raw,q_bh,fdr_alpha,test_family,null_model_version` | `engine-config.json` + camada narrativa (`explanations.js`) | QA-07: teste nulo sintético (todos `θ` iguais) → taxa de `strong` ≤ FDR nominal ou `q` segue suprimido (§9/§22-teste 1) |
| INV-008 | **Tier relativo versionado:** `tier` deriva **só** do posto de θ̂ (`pct=(n−posto)/(n−1)`, cortes 8/17/50/17/8, `tier-v2`); `n<10→"?"`; Tier D nunca atribuído sem dados; `strength_index` monotônico com tier | `tierOf.js` + `strength-index.js` (fonte única `averageRanks` ✅) | QA-08: empates → posto médio; `n=1→strength_index=null,tier="?"`; filtro só-tanks muda tier mas não θ̂ (§7.3/§22) |
| INV-009 | **Trend com tempo real:** Theil–Sen sobre `(tᵢ,yᵢ)` com `t=date` real, 3 séries independentes (win/pick/ban), `direction∈{rising,stable,falling,insufficient_data}` + `delta_pp_window,slope_pp_per_day,n_points,window_days,robustness`; `n<2→insufficient_data`, duplicata de data dedupada por regra documentada | `signals/trend.js` (reescrita de `hero-trend.js`, Fase 1) `trend_version:theil-sen-date-v2` | QA-09: outlier isolado não vira a seta; série com lacuna ≠ espaçamento uniforme; 1 ponto → `insufficient_data` (§11/§22) |
| INV-010 | **Oportunidade com evidência:** `opportunity_candidate ⟺ (P(θ>base+Δ)≥thr ∨ exploratório rotulado) ∧ pick<p25 ∧ ban<p25 ∧ sem falha de dados/coorte/patch-quebrado ∧ n mínimo se houver contagem`**; saída `opportunity_reason[],evidence_level,limitations`; nunca "subestimado" como fato sem persistência temporal | `signals/opportunity.js` (novo, Fase 3; `isGem` atual = precursor exploratório) | QA-10: `pick↑+win→` classifica `popularizando_sem_força`, não `opportunity` (§10/§22-teste 7) |
| INV-011 | **Snapshot imutável + walk-forward sem vazamento:** cada execução grava `{fetched_at,endpoint,query,raw,payload_hash,api_version,game_version,model_version,data_quality}`; previsão em `t` usa só dados ≤`t` + modelo vigente em `t`; quebra de `game_version` → prior `τ²×4`, `n→⌊n/4⌋` (≥1), `se` alarga, nunca zera silenciosamente | `snapshots.js` + `walkforward.js:37-49` ✅ (`K=4`, `summarizeWalkPosterior`) | QA-11: `game_version` muda → `version_break:true`, `se` alarga, backtest vs baselines (último-valor/média-móvel/sem-mudança) (§21/§22) |
| INV-012 | **Proporção guardada, pick somável:** `Σ pick_rate ≈1±0.005` por snapshot (`checkPickSum`); violação → flag de coorte, não correção silenciosa; `increase_win_rate` preservado bruto até semântica validada | `governance/exposure.js:9-12` ✅ + ingestão | QA-12: snapshot com `Σ pick=0.62` → `quality_flags:[exposure_sum_off]`; `increase_win_rate` nunca expresso em p.p. antes de validação (§3.4/§12) |

Sem setters públicos nas entidades; `Tier/UncertaintyStatus/Direction` como uniões
fechadas (nunca `status:string` livre) — Done do domain-modeler.

---

## 4) Gaps P0/P1/P2 → migração Fase 1–2 (§23)

### Fase 1 — consolidar a base (P0 = bloqueia release v2, P1 = exigido na fase)

| Pri | Gap | Referência | Ação concreta |
|---|---|---|---|
| P0 | Normalizador `[0,1]` + sentinelas + `missing≠0` ausente a montante (`53` passa hoje) | §5.1–5.3, INV-002/003, QA-02/03 | Novo `normalize/rates.js` + `data_status`; `scoreBatch` rejeita `∉[0,1]`; testes §22 |
| P0 | Trend sem datas reais, só-win, espaçamento uniforme | §11.1, INV-009, QA-09 | Reescrever `signals/trend.js` com `(date,win/app/ban)`, adaptador `past-days×days` + `lane` obrigatório onde exigido (§3.3); `TREND_DELTA=0.005` vira `trend_practical_delta_pp:0.5` versionado |
| P0 | Sem `cohort_key`/`model_version`/`quality_flags`/`sample_size_method` no output | §§3.6/4/19/26, INV-001/011 | `output/hero-contract.js` conforme exemplo §19 (`match_count:null`, `sample_size_method:not_provided_by_api`, `flags:[global_sample_count_missing,uncertainty_proxy]`, `versions:{hero-engine-v2.0.0,theil-sen-date-v2,api 1.2.3}`) |
| P0 | `μ` sem clamp `[ε,1−ε]`, `τ≈0` com piso ad-hoc `1e-6` não versionado | §6.1, INV-006, QA-06 | Clamp + flag + fallback documentado (`near_zero_between_hero_variance`) |
| P1 | `pick=0` cai em fallback silencioso (`m=μ`) sem `status` | §6.1, INV-005, QA-05 | Emitir `insufficient_exposure` explícito |
| P1 | `c` fixo `1e5` sem calibração por coorte/versão, sem `rate_proxy_calibration_version` | §6.1, INV-007 | `rate_proxy_c:null` + grade `C_GRID` preservada p/ banda; calibrar com snapshots (Fase 2) |
| P1 | `increase_win_rate`/bins/builds sem validação semântica (risco de narrar p.p. falso) | §§3.4/12–14, INV-012 | Preservar bruto + `semantics_unvalidated`; sem lift causal |
| P1 | `hero-lists.js` fallbacks (0.5/0.007/0.05) e cortes BlindPanel (0.51/0.01) misturáveis com motor | §18, INV-008 | Isolar como `defaults_ui_v1` documentados produto, nunca evidência |

### Fase 2 — confiança e significância (P0 = bloqueia claims confirmatórios)

| Pri | Gap | Referência | Ação concreta |
|---|---|---|---|
| P0 | `q/strong/weak/isGem` exibíveis como confirmatórios com nulo não validado | §9, INV-007, QA-07 | `allow_confirmatory_q_values:false`; narrativa só exploratória; posterior+`Δ` como base do selo (§8.3) |
| P0 | `se`/IC/`prob` sem rótulo proxy; risco de "95% garantido" | §§6.1/8.1, §19 | `model_based_uncertainty` + `status:inconclusive_proxy_uncalibrated` até calibrar; nunca `0` sem base (já `null` ✅) |
| P1 | Selo "Robusto" alcançável só via `B≥2/3` (diagnóstico interno) | §8.2 | Regra pública = dados + invariância-em-`C_GRID` + `P≥thr` calibrado + walk-forward; `B`-tiers viram `evidence_level` interno |
| P1 | `Δ_practical` hard-coded `0.02` + `P≥0.95/0.80` como sugestão não calibrada | §8.3, §24 | `practical_lift_pp:null` (+ `posterior_probability_strong/exploratory` como placeholders não publicáveis até backtest) |
| P2 | Baseline `μ=median` com circularidade (observação = referência); LOO/hierarquia ideal ausente | §6.2 | Backlog: `leave-one-hero-out` ou Beta-Binomial quando houver `n,k` (Modo B); documentar limitação |
| P2 | `sensitivity_band` só em `c`; prior-WF sem banda própria | §8.1 | Estender banda a `K∈{1,4}` + `prior↔flat`; teste QA-11 |

Fases 3–5 (§23) fora de escopo desta auditoria — precursor registrado: `opportunity_candidate`,
radar 3-séries, builds/pares com `increase_win_rate` bruto, jogador isolado (`wc/tc`, deprecated),
UGC atenção×voto×performance.

---

## 5) Decisão L2 registrada (domain-modeler, autonomia L2)

**D-L2-001 — Modo de força: A (rate-proxy) como único modo ativo; B (Binomial/Beta) como
contrato futuro.**
Motivo: o contrato público v1.2.3 não expõe `n/k` por herói/build/par/bin de forma
consistente (`data.total` = #registros, não partidas; `/user/matches` = jogador autenticado
deprecated — §§3.1–3.2). Ativar Modo B sem denominador seria inferência sem base (risco
estatístico maior da v2). `wr_adj` permanece `eb_rate_proxy_v1`; todo output carrega
`"model":"eb_rate_proxy_v1"` + `"sample_size_method":"rate_proxy|not_provided_by_api"`.
Reversão para Binomial exige `n,wins` validados (`wins≤n`) + `kappa/mu_0` hierárquicos por
coorte (§6.2) — gatilho documentado, não automático.

**D-L2-002 — `c` versionado, não calibrado: `C_REFERENCE=1e5` preservado como âncora
mecânica; `rate_proxy_c=null` até calibração walk-forward por coorte.**
Motivo L2 (preferir VO imutável + estado inválido irrepresentável): inventar `c` para
"parecer certo" violaria §6.1. `C_GRID=[1e4…1e7]` + `C_GRADE_VERSION=c-grade-v2` preservados
para a banda de sensibilidade; calibração futura gera nova versão + changelog (§24).

**D-L2-003 — `allow_confirmatory_q_values=false` (trava normativa).**
Motivo: `pFromZ((wr_adj−μ)/se)` pós-shrinkage com `μ/τ` intra-lote não tem nulo validado
(§9-auditoria pendente). BH está mecanicamente correto, mas FDR sem p válido não é evidência.
`q/strong/weak/isGem` operam em modo exploratório; selo público migra para
`posterior_prob + sensitivity_band + data_quality + estabilidade` (§§8–9). Reversão exige
QA-07 (nulo sintético) + calibração de `P≥thr` + backtest §21. Conflito L3 (duas invariantes
em tensão: sensibilidade honesta × UX que pede selo binário) **não** decidido aqui —
escalado ao `saas-lead` via este registro.

**D-L2-004 — Trend reescrita é P0 Fase 1 (`theil-sen-date-v2`), não ajuste de threshold.**
`TREND_DELTA=0.005` mantido como `trend_practical_delta_pp:0.5` versionado; a correção é
dimensional (tempo real + 3 séries), não numérica.

---

## 6) `engine-config.json` proposto (§24 — `null` = falta calibração, não zero)

```json
{
  "model_version": "hero-engine-v2.0.0",
  "strength_model": "eb_rate_proxy_v1",
  "sample_size_method": "rate_proxy",
  "minimum_hero_rows_for_relative_tiers": 10,
  "fdr_alpha": 0.05,
  "gem_pick_quantile_max": 0.25,
  "gem_ban_quantile_max": 0.25,
  "trend_points_min": 5,
  "trend_practical_delta_pp": 0.5,
  "trend_version": "theil-sen-date-v2",
  "practical_lift_pp": null,
  "posterior_probability_strong": null,
  "posterior_probability_exploratory": null,
  "rate_proxy_c": null,
  "rate_proxy_c_reference_anchor": 100000,
  "rate_proxy_c_grid": [10000, 100000, 1000000, 10000000],
  "rate_proxy_calibration_version": null,
  "c_grade_version": "c-grade-v2",
  "tier_version": "tier-v2",
  "strength_index_version": "strength-index-v1",
  "null_model_version": "unvalidated_eb_z_v1",
  "allow_confirmatory_q_values": false,
  "source_api_version": "1.2.3"
}
```

Notas: `posterior_probability_*=null` (spec sugere 0.95/0.80 **só como ponto de partida**,
§8.3 — publicar antes de calibrar violaria §22-release); `practical_lift_pp=null`;
`rate_proxy_c=null` com âncora `1e5` separada para não confundir mecânica com calibração;
`trend_points_min:5` = `TREND_N` atual (win-only legado — migrar para `n_points` por série +
`window_days` em §11.2 na implementação).

---

## 7) Done checklist (domain-modeler)

- [x] 9 campos auditados campo-a-campo (wrAdj, se, B, q, strong/weak, isGem, tier,
      strength_index, trend) + extras (IC, prob, banda, status, degenerate, smallSample,
      z, selos) — §1
- [x] 7/7 pontos §2.3 cobertos com status + evidência arquivo:linha — §2
- [x] 12 invariantes INV-001…INV-012 com onde-imposta + QA-XXX — §3; sem setters; sem
      `status:string` livre (uniões fechadas)
- [x] Gaps P0/P1/P2 mapeados nas Fases 1–2 do §23 — §4
- [x] Decisões L2 (Modo A, c versionado, `allow_confirmatory_q_values=false`) registradas — §5
- [x] `engine-config.json` com `null`s onde falta calibração — §6
- Próximo passo (fora deste artefato): implementar Fase 1 (`normalize/rates.js`,
  `cohort-key.js`, `signals/trend.js`, `output/hero-contract.js`) e abrir QA-01…QA-12
  como casos de teste antes de qualquer narrativa confirmatória.
