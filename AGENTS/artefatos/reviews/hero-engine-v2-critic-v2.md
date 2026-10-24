## Veredito: APROVADO COM RESSALVAS
Escopo revisado: 2ª volta sobre REPROVADO em AGENTS/artefatos/reviews/hero-engine-v2-critic.md (1 CRITICAL + 5 HIGH). Fixes desta volta em packages/proprietary-engine (src/hero/score-heroes.js, engine-config.json, src/builds/build-lift.js, src/counters/duration.js, src/hero/trust.js, src/hero/hero-trend.js, test/hero-contract.test.js) + re-sondagem executada em runtime (scoreBatch pick=0/small/dedup, duration Detailed/V2 + JSON round-trip, buildReferences 53, trustOf 3 vias) + leitura dos 7 arquivos alterados. Sem git repo: sem diff, li os arquivos finais + verifiquei comportamento em runtime. Elogio em 1 linha: os 6 pontos foram fechados exatamente como pedido, sem quebrar nenhum dos 170 testes nem o comportamento legado onde ele era contrato (trust sem ssm continua Robusto).

### CRITICAL (bloqueia)
- Nenhum. Zero CRITICAL restante.

### HIGH
- Nenhum. Os 5 HIGHs da v1 foram re-sondados e estão fechados (evidência na checagem dos 6 gates abaixo).

### MEDIUM
- [API ainda consome durationCurve legada: motivo da quarentena indisponível na rota] - `durationCurveDetailed` retorna `{curve, quarantined}` serializável (sondado: `JSON.parse(JSON.stringify(det))` preserva `quarantined:[{key, reason}]` ✅), mas `apps/api/src/routes.js:384` continua chamando `durationCurve(s)` (array nu) — o motivo `rate_out_of_range` existe na lib e morre antes da API; o teste §22 "quarentena sobrevive a JSON round-trip" pedido no fix loop da v1 não foi adicionado (grep em test/ por `quarantined|round-trip` retorna zero) (apps/api/src/routes.js:384, counters/duration.js:12-14) -> migrar a rota para `durationCurveDetailed` (ou carimbar `quality_flags` no `pairRow`) + teste de round-trip dedicado (dono: hero-engine owner + api owner · prazo: próxima passada, antes de qualquer snapshot público de curva)
- [linhas sem exposição ainda alimentam as estatísticas do lote] - o herói `pick=0` sai correto por herói (tudo null + `insufficient_exposure` ✅), mas seu `win` (ex: 0.9 não-observado) continua entrando na mediana/MAD que definem μ/τ e seus p-valores entram no denominador do BH — com mediana robusta o dano é desprezível em lote grande, mas é contaminação conceitual: dado sem exposição não deveria votar no prior do lote (score-heroes.js:171-183,196-220) -> excluir `pick≤0` do cálculo de μ/τ/BH (mantendo o stub nulado na saída) ou registrar decisão escrita de que a contaminação é tolerada (dono: hero-engine owner · prazo: próxima passada)

### LOW
- [probe-v2.mjs residual no repo] - arquivo de sondagem desta revisão deixado na raiz (a v1 já tinha pedido a remoção do `probe-critic.mjs` — esse sumiu ✅, mas o meu sucessor ficou); remover antes de fechar o loop (probe-v2.mjs na raiz) (dono: hero-engine owner · prazo: imediato, junto ao merge desta revisão)
- [trend datado ainda emite direção com 2 pontos] - pré-existente da v1, fora do escopo desta volta e inalterado: `trendSeriesDated` com `n_points=2` retorna `rising/falling` com `robustness:low` + `statistical_evidence:null`; UI pode ler seta com 2 observações (hero/hero-trend.js:68-70,87) -> considerar `n_points<3 → insufficient_data` ou exigir `robustness>=medium` para seta pública (dono: hero-engine owner + UI panorama · prazo: antes do release v2)
- [pick=0 emite B:0 ao lado de tudo-null] - `B:0` ("peso zero do dado") é semanticamente verdadeiro sem exposição e o `uncertainty_status:insufficient_exposure` domina, então é cosmético; registrado só para ninguém "limpar" o B achando que é bug (score-heroes.js:241) -> nenhuma ação; se um dia padronizar, `B:null` com o mesmo status (dono: hero-engine owner · prazo: sem prazo, observação)

## Checagem dos 6 gates
| # | Ponto re-sondado | Evidência runtime | Status |
|---|---|---|---|
| 1 | pick=0 (CRITICAL v1) | `pick:0, win:0.9 → wrAdj:null, tier:"?", strength_index:null, q:null, uncertainty:insufficient_exposure, data_status:insufficient_exposure, se/posterior_mean/z:null, strong/weak/isGem/degenerate:false` | FECHADO ✅ |
| 2 | lote pequeno (HIGH EC-007) | `n=4 → tier:"?" + strength_index:null + q:null` em todos, `meta.small_sample:true`, `quality_flags:small_lot_suppress_significance` | FECHADO ✅ |
| 3 | JSON round-trip quarentena (HIGH) | `durationCurveDetailed({…, min_win_rate6_8:53}) → {curve:[1pt], quarantined:[{key, rate_out_of_range}]}` e `JSON.parse(stringify)` idêntico; `durationCurveV2` idem (0 preservado com `proxy_no_n`) | FECHADO na lib ✅ (adoção na API pendente — MEDIUM acima) |
| 4 | buildReferences 53 (HIGH EC-012) | `[{53},{0.5},{0.6}] → mostUsed={win:0.6,pick:0.9}, heroMean=0.55` (53 excluído; antes `mostUsed.win=53, heroMean=26.75`); tudo-inválido → `{null,null}` | FECHADO ✅ |
| 5 | config nulls (HIGH) | `posterior_probability_strong:null, posterior_probability_exploratory:null` (com `rate_proxy_c:null` e `*_calibration_version:null` já nulos) | FECHADO ✅ |
| 6 | trust cap (HIGH EC-008) | sem `sample_size_method` → `Robusto` (legado preservado, teste hero-contract linha 171 verde); `ssm=not_provided_by_api` → `Situacional/teto sem n real`; `ssm=observed_count` → `Robusto` | FECHADO ✅ |

Extras verificados (MEDIUMs v1 ditos corrigidos): dedup fallback com índice — duas linhas id-less idênticas NÃO colapsam (`n=3`); `duplicate_id` como reason; `n_dropped=1` conta só quarentena (dup só em `n_duplicates_dropped=1`); `HERO_CONTRACT` com 18 chaves incl. `data_status` + teto `<=18` no teste; `@deprecated` JSDoc em `trendOf` (hero-trend.js:28-29).

## Checagem dos 6 gates (portfólio, herdados da v1)
| # | Gate | Status |
|---|---|---|
| 1 | spec sem L3 aberta | REPROVADO — D-L2-003 segue sem resolução registrada nesta volta (fora do escopo dos 6 pontos); teto mantido: release só como "exploratório rotulado" |
| 2 | fluxo missing/invalid/stale | PARCIAL — missing/invalid ok + `insufficient_exposure` ✅; stale/partial-page sem stub por herói segue MEDIUM herdado (não era escopo desta volta) |
| 3 | INV com QA | APROVADO — inalterado |
| 4 | P0 zerado | APROVADO — EC-002 fechado e sondado ✅; demais P0 já fechados |
| 5 | zero CRITICAL | APROVADO — zero CRITICAL ✅ |
| 6 | build+testes verdes | APROVADO — `npm run test -w packages/proprietary-engine` = 170 pass / 0 fail; `npm run build` = ok (aviso pré-existente `C_GRADE` não exportado, já tratado com `?? null` no código) |

## Fix loop (para o saas-lead)
1. Dono hero-engine + api owner: 2 MEDIUMs acima (migração da rota para `durationCurveDetailed` + teste §22 round-trip; decisão sobre no-exposure fora de μ/τ/BH) + remover `probe-v2.mjs` da raiz.
2. Gate 1 (D-L2-003/L3) continua aberto: sem decisão escrita, o teto é "exploratório rotulado" — sem ela não há release v2 confirmatório.
3. Critério Done desta revisão: veredito explícito ✅ (APROVADO COM RESSALVAS) + zero CRITICAL ✅ + checagem dos 6 pontos com evidência runtime ✅.
