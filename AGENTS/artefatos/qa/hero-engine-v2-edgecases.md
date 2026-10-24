# hero-engine V2 — edge cases (finge precisão sem denominador n)

> Fonte normativa: `ENGINE_MLBB_ESPECIFICACAO_TECNICA_V2.md` §§5.2–5.3, 6.1, 8.2, 11.1, 13, 22.
> Código auditado: `packages/proprietary-engine/src/hero/{score-heroes.js, hero-trend.js, trust.js}`,
> `src/utils/{config.js, statistics.js}`, `src/confidence/confidence-trio.js`,
> `src/counters/duration.js`, `src/builds/build-lift.js`, `src/hero/strength-index.js`.
> Convenção: P0 = finge certeza sem `n` / corrompe ranking / perde dado silenciosamente.
> P1 = guarda ausente mas dano contido. P2 = higiene/versionamento.
> Status final: **14 achados (6 P0, 7 P1, 1 P2). Zero P0 sem mitigação escrita.**

---

## P0 — bloqueiam release confirmatório

### EC-001 — taxa em percentual (53) passa na guarda e corrompe o lote inteiro
- **Onde morde:** `src/hero/score-heroes.js:80` — filtro só exige `Number.isFinite(h.win)`; sem checagem de `[0,1]` (spec §5.2 exige rejeitar/quarentenar fora de `[0,1]` após normalização; §5.1 exige detectar `53` vs `0.53`, nunca adivinhar).
- **Input repro:** `scoreBatch([{id:'a',win:53,pick:0.01,ban:0.01}, ...9 heróis normais])` → `mu = median` puxada p/ cima, `tau` explode, todos os `wrAdj/se/B/q` do lote contaminados; nenhum `quality_flag`.
- **Comportamento atual:** aceita silenciosamente; `meta` não registra transformação de unidade.
- **Esperado:** rejeitar/quarentenar linha fora de `[0,1]`, `n_dropped++` com motivo `out_of_range`, `quality_flags: ["rate_out_of_range"]`.
- **Mitigação (aceita, sem código nesta passada):** normalizador único de proporções antes de `scoreBatch` — `>1 && <=100` → quarentena + log (não auto-dividir por 100 em silêncio, §5.1); `>100` ou `<0` → inválido. Cobrir em §22: "Taxas fora do intervalo são rejeitadas/quarentenadas".
- **Severidade:** P0.

### EC-002 — `pick=0`/ausente não divide por zero, mas finge posição: `wrAdj=mu` com tier/índice "válidos"
- **Onde morde:** `src/utils/statistics.js:64-66` (`obsVariance` retorna `Infinity` se `pick<=0`) → `src/utils/statistics.js:57` (`ebShrink` com `s2===Infinity` retorna `{m: mu, B: 0}`) → `src/hero/score-heroes.js:168-173` emite `wrAdj=mu`, `strength_index` numérico e `tier` A/B/C/D normalmente.
- **Input repro:** `scoreBatch(10 heróis, um com pick:0, win:0.9)` → herói sem exposição ganha `wrAdj == mu`, `B=0`, mas `strength_index` ~50 e tier `B` — parece "mediano com dado".
- **Comportamento atual:** sem `uncertainty_status` especial por herói; `confidenceTrio` recebe `se=sqrt(tau2)` finito e retorna `provisional`, não `unavailable`.
- **Esperado (§6.1):** `p_i=0`/ausente → "devolver estado sem estimativa/insuficiente ou política explicitamente versionada"; nunca tier/índice numérico. Mínimo: `wrAdj: null`, `tier: "?"`, `uncertainty_status: "insufficient_exposure"`.
- **Mitigação (aceita):** herói com `pick<=0`/não-finito entra em `heroes` com campos de vista `null` + `data_status: "insufficient_exposure"` (não some do output — §5.3 proíbe converter ausência em silêncio; hoje ele nem chega aqui, ver EC-009). Cobrir em §22: "`pick_rate=0`/ausente não divide por zero nem finge precisão".
- **Severidade:** P0.

### EC-003 — `trendOf` ignora `date`: espaçamento uniforme em série irregular + lacunas
- **Onde morde:** `src/hero/hero-trend.js:28-29` — assinatura `points: {{win}[]}`, `.map(p => p.win)`; `theilSenDelta` (:14-22) divide por `(j-i)` de **índice**, não por `(t_j-t_i)`. Spec §11.1 exige `slope = median((y_j-y_i)/(t_j-t_i))` com `t` real e `delta_window = slope × (t_last-t_first)`.
- **Input repro:** `[{win:0.50,date:'2026-10-01'},{win:0.52,date:'2026-10-02'},{win:0.54,date:'2026-10-10'}]` (buraco de 8 dias) → delta computado como se fossem 3 dias seguidos; slope real ~10× menor.
- **Comportamento atual:** testes (`test/hero-trend.test.js`, `hero-contract.test.js`) só passam `{win}`, sem data — o contrato de data nunca é exercido.
- **Esperado:** `trendOf(points: [{date, win}])`, denominador em dias reais, `delta_pp_window`, `n_points`, `window_days` por série (§11.2).
- **Mitigação (aceita):** nova assinatura com `t` em dias + regra de duplicata documentada (ver EC-004); manter `trendOf` legado como shim marcado `deprecated` até migrar callers; versão `theil-sen-date-v2` no output (§19). Cobrir em §22: "usa datas reais em séries irregulares".
- **Severidade:** P0.

### EC-004 — `date` duplicada vira pares fantasma com slope inventado
- **Onde morde:** `src/hero/hero-trend.js:14-22` — sem dedup por data (§5.2: "sem duplicatas inesperadas por chave de série"; §11.1: "remover duplicatas por data com regra documentada").
- **Input repro:** `[{date:'d1',win:0.50},{date:'d1',win:0.60},{date:'d2',win:0.51}]` → par intra-data `(0.60-0.50)/1` entra na mediana como se fosse evolução de 1 dia.
- **Comportamento atual:** duplicata conta como 2 observações independentes (`n` inflado).
- **Esperado:** dedup determinístico (último valor da data? média? — versionar a regra), `n_points` = datas distintas, flag `duplicate_dates_dropped: k`.
- **Mitigação (aceita):** implementar na nova `trendOf` (EC-003): agrupar por `date`, regra `last-wins` versionada + contador. Cobrir em §22: "Data duplicada, lacunas, uma observação e duas observações produzem status correto".
- **Severidade:** P0 (duplicata de ingestão — retry de fetch — é o gatilho mais provável em produção).

### EC-005 — trend só de `win`, só 5 pontos: `pick`/`ban` nunca avaliados; seta 0.5pp sem calibração
- **Onde morde:** `src/hero/hero-trend.js:4-8` (`TREND_N=5`, `TREND_DELTA=0.005`, só `win`) vs §11.2 (win/pick/ban cada um com `direction/delta_pp_window/n_points/robustness/statistical_evidence`) e §22-teste-7 ("pick sobe e win não → 'popularizando', não 'mais forte'").
- **Input repro:** herói com `win` estável e `app_rate` dobrando em 7 dias → engine emite no máximo `dir:"estável"` de win; nenhum sinal `trend_pick` — o caso "popularizando sem evidência de força" (§11.3) é **inexpressível**.
- **Comportamento atual:** `TREND_DELTA=0.005` (0.5pp) decide seta sozinho; `PRACTICAL_DELTA=0.02` (2pp) é o limiar prático canônico — seta "subindo" em ruído <2pp.
- **Esperado:** 3 séries separadas + `direction` só sai de `estável` acima de limiar prático versionado (§11.2); `statistical_evidence: null` sem teste válido.
- **Mitigação (aceita):** Radar do Meta Fase 3 (§23): `trend_wr/pick/ban` independentes, `trend_practical_delta_pp: 0.5` versionado em `engine-config.json` (§24) com nota "ponto de partida, não calibração"; `TREND_DELTA` ≠ `PRACTICAL_DELTA` já documentado no código — manter a placa anti-unificação.
- **Severidade:** P0 (funcionalidade normativa ausente + threshold que autoriza leitura de ruído como direção).

### EC-006 — `q`/`strong`/`weak` exibidos como confirmatórios com nulo nunca validado
- **Onde morde:** `src/hero/score-heroes.js:135-148` (`z=(t-mu)/se`, `pFromZ`, `benjaminiHochberg`) + `src/utils/statistics.js:28-39`. Spec §9: "fazer shrinkage e tratar o estimador encolhido como z padrão não garante p-valores calibrados"; §24: `allow_confirmatory_q_values: false`.
- **Input repro:** qualquer lote de 10+ heróis → `q<=0.05` vira `strong:true` → `classOf` → "Forte"/"Joia" na UI, sem nenhum aviso de `q_experimental`.
- **Comportamento atual:** sem flag `q_validated:false`; `meta` não carrega `null_model_version`/`test_family` (§9 exige os dois + `p_raw`, `fdr_alpha`, critérios de exclusão).
- **Esperado:** até auditoria de `pFromZ`, `q` = "sinal experimental"; selo de evidência via posterior + sensibilidade (§8.2–8.3), não via `q`.
- **Mitigação (aceita):** `meta.q_status: "experimental_unvalidated_null"` + `evidence_level` derivado de `posterior_prob_above_threshold`/`sensitivity_band`; `strong` renomeado internamente p/ `strong_exploratory` ou documentado como tal no contrato de saída (§19). Cobrir em §22-release: "Sem claims confirmatórios quando o denominador não existe".
- **Severidade:** P0.

---

## P1 — guardas ausentes, dano contido mas real

### EC-007 — lote `<MIN_LOT` dá `tier:"?"` mas entrega `strength_index` numérico + `se/B/q` sem aviso
- **Onde morde:** `src/hero/score-heroes.js:170-171` — `tier` respeita `smallSample`, mas `strengthIndexByRank` (que retorna `null` só p/ `n<=1`, `strength-index.js:42-45`) entrega 0–100 com `n=2..9`; `se/B/credible_interval/q` calculados normalmente; `sig` suprimido (correto) mas `q` numérico sugere FDR com 3 hipóteses.
- **Input repro:** `scoreBatch(4 heróis)` → `tier:"?"` ao lado de `strength_index: 66.7`, `q: 0.31` — UI que exibe índice mostra precisão que o tier nega.
- **Esperado (§7.3):** "exiba índice/tier com aviso, ou deixe indisponível conforme contrato"; §22: "lote abaixo do mínimo não atribui tier conclusivo" — estender a índice e `q`.
- **Mitigação (aceita):** `smallSample` → `strength_index: null`, `q: null` + `meta.small_sample:true` já existe; ou `strength_index` + `index_status:"provisional_small_lot"`. Decisão versionada em `tier_version`/`strength_index_version`.
- **Severidade:** P1 (contradição interna visível ao usuário; `strong` já é suprimido, então sem claim falso direto).

### EC-008 — `B>=2/3` vira "alta"→`Robusto` sem nenhum `n`: selo público a partir de peso interno
- **Onde morde:** `src/hero/trust.js:13-22` (`CONF_HIGH=2/3`) + `trustOf` (:52-71) + `confidenceToTrust` (:40-49). O próprio comentário (:12) admite "Interpretação, NÃO calibração empírica" — e §8.2 da spec proíbe conceder "Robusto" só com isso.
- **Input repro:** herói com `pick` alto e `win` extremo → `B=0.9` → `confidenceOf:"alta"` → `trustOf:"Robusto"` ("sinal estável na grade c") — estabilidade **na grade c**, não no mundo.
- **Comportamento atual:** caminho `Robusto` alcançável sem `match_count`, sem walk-forward, sem backtest.
- **Esperado (§8.2):** Robusto = dados adequados + insensibilidade a alternativas + validação temporal; `B` sozinho = diagnóstico interno.
- **Mitigação (aceita):** teto de selo sem `n` real: `trustOf` retorna no máximo `Situacional` quando `sample_size_method != "observed_count"` (contrato §19 já prevê `match_count: null` + `sample_size_method`); `Robusto` exige `evidence_robustness:"estavel-em-c"` + série avaliável (`assess-series.js`).
- **Severidade:** P1 (selo existe na UI do panorama; claim de robustez sem base é o risco central da v2 — "Princípio operacional").

### EC-009 — linha com `null/NaN/string` some do output: `n_dropped` conta, mas herói perde `data_status`
- **Onde morde:** `src/hero/score-heroes.js:80` (filter) + `meta.n_dropped` (:86). Spec §5.3: relatar `data_status: missing/not_returned/stale/invalid` **por herói**; §5.1: sentinelas → `missing`/`invalid`, nunca zero.
- **Input repro:** `scoreBatch([{id:'x',win:null,pick:0.02,ban:0.01}, ...])` → herói `x` ausente do `heroes[]`; consumidor não sabe se é paginação, filtro de rank ou dado inválido.
- **Comportamento atual:** `n_dropped` agregado, sem eco por id.
- **Esperado:** eco `{id, data_status:"invalid"|"missing", wrAdj:null, tier:"?", ...}` preservando `id` (o contrato já prevê eco do input via `...h`).
- **Mitigação (aceita):** segunda passada no `input` filtrado emitindo stubs com `data_status`; `NaN`/`"0.53"`-string/`undefined` → `invalid`. Cobrir em §22: "Nulo/`NaN`/string não vira zero" + "`n=0` retorna lista vazia".
- **Severidade:** P1 (perda de rastreabilidade; vira P0 se UI mapear ausência → "herói fraco").

### EC-010 — `durationCurve` descarta `win 0/1` (dado legítimo some) e aceita `53` (lixo entra)
- **Onde morde:** `src/counters/duration.js:12-19` — `v===0||v===1 → continue` (sem checar `n` do bin), sem validação `[0,1]`; spec §13 só permite descartar com cobertura insuficiente, e §3.4 avisa: "taxa `1` não garante amostra robusta" ≠ "taxa `1` é inválida".
- **Input repro A (perda):** `{min_win_rate6: 0, ..., min_win_rate20: 0.55}` com milhares de partidas no bin `<6` → bin some da curva; `classifyDuration` roda sem ele.
- **Input repro B (corrupção):** `{min_win_rate6_8: 53}` (percentual não normalizado) → `win:53` entra na curva; slope mediano explode; `classifyDuration` → "scaling" espúrio.
- **Esperado:** validar `[0,1]`; `0/1` preservado com `bin_evidence:"unvalidated_n"`; `profile` exige cobertura (§13: `lift_t_pp` só "se estimáveis e comparáveis").
- **Mitigação (aceita):** mesma do EC-001 (normalizador de proporções compartilhado) + `durationCurve` retorna `{label, mid, win, evidence:"proxy_no_n"}`; bins inválidos → quarentena com motivo, nunca `continue` silencioso.
- **Severidade:** P1 (A = viés de seleção silencioso; B = requer upstream em `%`, menos provável após normalizador).

### EC-011 — `classifyDuration([])` ou com 1–2 pontos responde "uniforme" — afirmação com zero dado
- **Onde morde:** `src/counters/duration.js:23-24` — `curve.length<3 → "uniforme"`; spec §13 exige `profile` "só se diferença superar limites práticos e houver cobertura suficiente".
- **Input repro:** `classifyDuration([])` → `"uniforme"`; `classifyDuration([{mid:5,win:0.5}])` → `"uniforme"`.
- **Comportamento atual:** ausência de evidência vira perfil afirmativo (o exato anti-padrão do §5.3: ausência → categoria "normal").
- **Esperado:** `<3` pontos válidos → `"insufficient_data"` (+ `n_bins`).
- **Mitigação (aceita):** trocar default p/ `"insufficient_data"`; callers tratam como `data_status`, não como perfil. Teste §22 correspondente: curva curta → status, não perfil.
- **Severidade:** P1.

### EC-012 — `buildLift` subtrai taxas sem validar unidade nem `n`: `53 - 0.5 = 52.5` vira `lift_raw`
- **Onde morde:** `src/builds/build-lift.js:7-12` — `+(win-refWin).toFixed(4)` sem checagem `[0,1]`; `increase_win_rate` (§3.4: "preservar, ordenar exploratoriamente; NÃO expressar em p.p. antes de validar definição") vira `lift_raw` numérico pronto p/ exibição.
- **Input repro:** `buildLift({win: 53, refWin: 50})` → `{lift_raw: 3, classification_status:"provisional"}` — 3 "p.p." que na verdade são 300pp na escala 0–1... ou 3pp se ambos forem `%`. Indistinguível no output.
- **Comportamento atual:** `causal_status:"nao-avaliado"` correto, mas `lift_raw` sem `unit`/`reference_semantics_validated:false`.
- **Esperado (§14):** `build_key` canônico + `lift_raw` acompanhado de `unit:"fraction_0_1"|"unknown"`, `reference_kind`, `sample_size_available:false`.
- **Mitigação (aceita):** validar `[0,1]` na entrada (reuso do normalizador EC-001); fora disso → `lift_raw:null` + `classification_status:"inconclusive"`; `counter.js` (`COUNTER_MIN_ABS_DELTA=0.015`) só compara deltas com `unit` validada — delta em `%` (ex.: `2.5`) hoje passa 100× acima do limiar e vira "confirmado" espúrio.
- **Severidade:** P1 (camada A é "bruta entregável" por design; o risco é a UI ler `lift_raw` como p.p. validado).

### EC-013 — herói duplicado no input vota 2× em `mu/tau`/BH e aparece 2× no ranking
- **Onde morde:** `src/hero/score-heroes.js:67-101` — sem dedup/normalização de id (spec §5.1: "normalizar IDs para string canônica na camada de chave").
- **Input repro:** mesmo herói 3× em lote de 12 → mediana/MAD deslocados, família BH com 2 hipóteses fantasmas, `strength_index` duplicado.
- **Comportamento atual:** `n` conta linhas, não heróis distintos.
- **Esperado:** dedup por id canônico (último vence? primeiro? — versionar) + `meta.n_duplicates_dropped`.
- **Mitigação (aceita):** dedup na ingestão/normalização (§23-Fase 1: "normalizador único de proporções e IDs"); teste §22: "invariável à ordem de entrada (incluindo empates de IDs)".
- **Severidade:** P1 (gatilho: paginação sobreposta `index/size` sem cursor estável).

---

## P2 — higiene

### EC-014 — `tau≈0` (lote homogêneo) usa fallback `1e-6` sem flag `near_zero_between_hero_variance`
- **Onde morde:** `src/hero/score-heroes.js:105` (`mad(...) || 1e-6`); spec §6.1 exige "fallback documentado + marcar `near_zero_between_hero_variance`".
- **Input repro:** 10 heróis todos `win:0.5` → `tau=1.48e-6`, `s_i²` domina, `B≈0` p/ todos, `se` microscópico, `z` gigante p/ qualquer micro-diferença de float → `q` pode marcar `strong` num lote idêntico.
- **Comportamento atual:** `meta.tau` numérico, sem flag; `pFromZ(z)` com `z~1e6` → `p=0` → BH `q=0`.
- **Esperado:** `meta.quality_flags: ["near_zero_between_hero_variance"]` + supressão de `strong/weak` (lote sem dispersão não tem "forte").
- **Mitigação (aceita):** flag + `sig=false` quando `tau < tau_floor_versioned`. Cobrir em §22-teste-1 (nulo: mesma performance → zero "fortes").
- **Severidade:** P2 (lote perfeitamente homogêneo é raro; mas é exatamente o teste nulo do §22).

---

## Verificações que PASSARAM (não são achados)

- `n=0` → `{heroes: [], meta}` (:101) ✓ (§22).
- `pick<0`/`c<=0`/`NaN` → `obsVariance=Infinity`, sem `NaN`/div-zero (:64-66) ✓ (parcial — ver EC-002 p/ o resto).
- `s2<=0`/`tau2<=0` → fallback `{m:mu,B:0}` sem `NaN` (:57-58) ✓.
- `strength_index`/`pct` com `n<=1` → `null`, não número (:27-45 `strength-index.js`) ✓.
- `tierOf(NaN)` → `"?"`, não `"D"` ✓.
- `confidenceTrio` com `se<=0`/não-finito → `uncertainty_status:"unavailable"`, tudo `null` ✓ (não retorna `0` — conforme §19).
- `trustOf(null)` → `Inconclusivo`, sem TypeError ✓.
- `checkPickSum` existe (`exposure.js:9-13`) mas **não é chamado** por `scoreBatch` — registrado como débito (fio morto), não EC separado.
- `C_GRADE` ausente em `config.js` (só `C_REFERENCE=1e5`, `C_GRID`, `DELTA_DEFAULT=0.02`) é absorvido via `?? null` (:22 `score-heroes.js`) — sem crash; `c=1e5` **não calibrado** permanece como premissa explícita da `sensitivity_band` (grade 1e4–1e7), não como achado novo.

## Done (§22 — cobertura mínima de 10)

| # §22 | Coberto por |
|---|---|
| ordem-invariância / empates | EC-013 (+ `averageRanks` já com posto médio ✓) |
| taxas fora do intervalo | EC-001, EC-010, EC-012 |
| nulo/NaN/string ≠ zero | EC-009 |
| `n=0`; lote mínimo sem tier conclusivo | EC-007 (verificado `n=0` ✓) |
| proporção 0/1 sem NaN/infinito | EC-010, EC-011, EC-014 |
| `pick=0` sem div-zero nem precisão fingida | EC-002 |
| version-break do prior | verificado comportamento existente (não re-auditado nesta passada) |
| Theil–Sen robusto + datas reais | EC-003, EC-005 |
| duplicata/lacuna/1–2 obs. | EC-004, EC-011 |
| BH/FDR; p inválido fora da família | EC-006 |
| build/par sem `n` sem IC calibrado | EC-012 |

**Critério Done:** 6 P0 todos com mitigação escrita acima (normalizador único de proporções+IDs; `trendOf` com datas reais; 3 séries win/pick/ban; `q` experimental + selo por posterior; sem estimativa p/ `pick=0`). Nenhum P0 requer "verificar" — cada um termina em comportamento concreto + teste §22 correspondente.
