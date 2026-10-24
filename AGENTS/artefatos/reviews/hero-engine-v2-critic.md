## Veredito: REPROVADO
Escopo revisado: rebuild da hero engine vs ENGINE_MLBB_ESPECIFICACAO_TECNICA_V2.md (v2.0.0) — 6 arquivos da passada (packages/proprietary-engine: src/hero/score-heroes.js, src/hero/hero-trend.js, src/counters/duration.js, src/builds/build-lift.js, engine-config.json, src/index.js) + sondagem executada (probe-critic.mjs) + leitura de AGENTS/artefatos/domain/hero-engine-v2-audit.md, AGENTS/artefatos/qa/hero-engine-v2-edgecases.md, AGENTS/artefatos/qa/hero-engine-v2-strategy.md. Sem git repo: sem diff, li os arquivos finais + verifiquei comportamento em runtime. Elogio em 1 linha: a passada acertou o essencial estatístico-honesto (quarentena [0,1] com motivo, trend datado 3-séries last-wins, q experimental travado, mu-clamp + near-zero flags, 170 testes verdes).

### CRITICAL (bloqueia)
- [pick=0 finge posição: wrAdj=mu + tier B + status provisional] - herói sem nenhuma exposição recebe `wrAdj == mu`, `strength_index` numérico, `tier` A/B/C/D e `uncertainty_status: provisional` — é EC-002 (P0) ainda aberto; a passada quarentenou `pick` fora de `[0,1]` mas `0 ∈ [0,1]` passa e o fallback `ebShrink → m=mu, B=0` (statistics.js) é emitido sem nenhum flag (sondado: `pick:0, win:0.9 → wrAdj=0.5, tier=B, B=0, status=provisional`) (score-heroes.js:190-194,237-247) -> emitir `wrAdj:null, tier:"?", strength_index:null, uncertainty_status:"insufficient_exposure"` + `data_status` por herói, ou versionar política "fallback declarado" em engine-config.json; cobrir com QA-008 (dono: hero-engine owner · prazo: próxima passada, antes de qualquer release confirmatório)

### HIGH (= MAJOR)
- [engine-config publica thresholds não calibrados como número] - `posterior_probability_strong: 0.95` e `posterior_probability_exploratory: 0.8` como valores, quando audit §6 + strategy R-1 exigem `null` até calibração (spec §8.3: 0.95/0.80 são "ponto de partida", publicar antes de calibrar viola §22-release) (engine-config.json:12-13) -> voltar para `null` com `*_calibration_version: null`, como já feito para `practical_lift_pp`/`rate_proxy_c` (dono: hero-engine owner · prazo: próxima passada)
- [quarentena de duration some na serialização] - `out.quarantined = ...` anexa prop não-índice a um Array: `JSON.stringify` a descarta (sondado: `jsonKeepsQuar=false`) — todo consumidor via API/snapshot/walk-forward perde o motivo (counters/duration.js:29) -> retornar objeto `{curve, quarantined}` (V2) ou carimbar `quality_flags` no chamador; teste §22 "quarentena sobrevive a JSON round-trip" (dono: hero-engine owner · prazo: próxima passada)
- [buildReferences aceita 53 e corrompe a referência] - EC-012 foi fechado em `buildLift` mas o caminho irmão `buildReferences` filtra só `Number.isFinite` (sondado: `[{win:53,...}] → mostUsed.win=53, heroMean=26.75`) — referência "mais usada" com 53 contamina qualquer lift futuro (builds/build-lift.js:19) -> reutilizar o mesmo guard `[0,1]` (quarentena + exclusão) + teste (dono: hero-engine owner · prazo: próxima passada)
- [lote pequeno exibe índice/q numéricos ao lado de tier "?"] - EC-007 aberto: `n=4 → tier:"?"` mas `strength_index:16.7` e `q:0.20` numéricos (sondado) — contradição interna visível ao usuário (score-heroes.js:240-248) -> `smallSample → strength_index:null, q:null` (+ `meta.small_sample` já existe) ou `index_status:"provisional_small_lot"` versionado (dono: hero-engine owner · prazo: próxima passada)
- [selo "Robusto" alcançável só via B≥2/3, sem n] - EC-008 aberto e fora dos 6 arquivos: `trustOf` retorna `Robusto` por `conf==="alta"` (B≥2/3) sem `match_count`, walk-forward ou backtest; o próprio comentário admite "Interpretação, NÃO calibração" (hero/trust.js:64-68) -> teto `Situacional` enquanto `sample_size_method != "observed_count"` (mitigação já aceita no edgecases) (dono: hero-engine owner + UI panorama · prazo: antes do release v2)

### MEDIUM (= MINOR)
- [linhas dropped sem stub por herói] - EC-009 parcial: `dropped_reasons` (cap 50) + `n_dropped` existem, mas o herói some de `heroes[]` sem `{id, data_status, wrAdj:null, tier:"?"}` — consumidor não distingue paginação parcial de dado inválido; `stale/not_returned` (QA-03) sem cobertura (score-heroes.js:104-122,134) -> segunda passada emitindo stubs com `data_status ∈ {missing,invalid}` (stale na ingestão, fora da função pura)
- [durationCurveV2 descarta inválido em silêncio] - `if (!finito || fora) continue` sem contador — o próprio padrão que a passada eliminou em `durationCurve` V1 (counters/duration.js:40) -> quarentena com motivo igual à V1
- [cohort_key é passthrough sem rejeição de mistura] - INV-001 exige rejeitar mistura de coortes; `scoreBatch` só carimba `opts.cohortKey ?? null` (score-heroes.js:154) -> aceitar como contrato de saída, mas documentar que o fatiamento/validação mora na ingestão (`cohort-key.js` Fase 1) + QA-01 dedicado
- [dedup sem id colapsa linhas id-less idênticas] - fallback `JSON.stringify([win,pick,ban])` como chave: dois heróis distintos sem id e mesmas taxas viram "duplicata" (score-heroes.js:110) -> chave fallback com índice da linha ou exigir id canônico a montante (§5.1)
- [n_dropped conta duplicata 2×] - `n_dropped = input.length - n` inclui duplicatas já contadas em `n_duplicates_dropped` (score-heroes.js:133-134) -> `n_dropped = quarantined_count`, duplicatas só em `n_duplicates_dropped`

### LOW
- [trend datado emite direção com 2 pontos] - `trendSeriesDated` com `n_points=2` retorna `rising/falling` com `robustness:low` (sondado: 2 pts → `rising`, slope 10pp/dia) — `statistical_evidence:null` mitiga, mas UI pode ler seta com 2 observações (hero/hero-trend.js:86) -> considerar `n_points<3 → insufficient_data` ou exigir `robustness>=medium` para seta pública
- [legacy trendOf sem marca @deprecated formal] - shim preservado com comentário LEGADO mas sem tag JSDoc `@deprecated` — callers não recebem aviso do linter (hero/hero-trend.js:31, index.js:45)
- [probe-critic.mjs residual no repo] - arquivo de sondagem desta revisão deixado na raiz; remover antes de fechar o loop

## Checagem dos 6 gates
| # | Gate | Status |
|---|---|---|
| 1 | spec sem L3 aberta | REPROVADO — D-L2-003 (audit §5) escala conflito L3 (sensibilidade honesta × UX selo binário) ao saas-lead sem resolução registrada |
| 2 | fluxo missing/invalid/stale | PARCIAL — missing/invalid ok (quarentena + reasons); stale/partial-page sem stub por herói (EC-009 MEDIUM acima) |
| 3 | INV com QA | APROVADO — INV-001…012 ↔ QA-XXX mapeados no audit §3; QA-XXX como chave primária (strategy §7 registra ausência de invariants.md) |
| 4 | P0 zerado | REPROVADO — EC-002 (pick=0) segue P0 aberto; demais P0 (EC-001/003/004/005/006) fechados e sondados ✅ |
| 5 | zero CRITICAL | REPROVADO — 1 CRITICAL aberto (pick=0) |
| 6 | build+testes verdes | APROVADO — `npm run test -w packages/proprietary-engine` = 170 pass / 0 fail; `npm run build` = proprietary-ok |

## Fix loop (para o saas-lead)
1. Dono hero-engine: fechar CRITICAL (pick=0) + 5 HIGHs acima; re-sondar com os mesmos comandos do probe (pick0 → null/?, small → null, JSON round-trip da quarentena, buildReferences com 53, config sem thresholds numéricos).
2. Re-rodar `npm run test -w packages/proprietary-engine` + `npm run build` (gates R-2/R-3) e adicionar testes QA-002/008 (53 + pick=0), tier-edges (QA-006) e round-trip de quarentena.
3. Escalar L3 (gate 1) com decisão escrita antes do release v2; sem ela o teto é "exploratório rotulado".
4. Critério Done desta revisão: veredito explícito ✅ (REPROVADO) + 1 CRITICAL com arquivo:linha + dono + prazo para o fix loop ✅.
