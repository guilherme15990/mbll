# Paridade classes de herói × ENGINE V2 — 2026-10-11 (rev. 3: poda grade-C/confiança)

Fonte normativa: `ENGINE_MLBB_ESPECIFICACAO_TECNICA_V2.md` (v2.0.0) + emenda de projeto v3 abaixo.
Gates: engine **169/169** + `proprietary-ok`; api **25/25** + `api-ok`; web smoke+11+guardian + `tsc` + dist ok.

## Emenda v3 (decisão do dono, registra desvio da V2)

Sondagem em 132 heróis: `trustOf` 132/132 Situacional, `uncertainty_status` 132/132
`provisional`, `confidenceOf` 0 alta — grade C, tiers de B, ramos Robusto e teto proxy
nunca disparavam no regime proxy. Podados (contrato `hero-engine-v2.1.0`):
grade C (`C_GRID`/`C_GRADE_VERSION`, `sensitivity_band`, Zona Yve), tiers
alta/media/baixa (`CONF_HIGH`/`CONF_LOW`, `confidenceOf`), selo Robusto e teto morto,
`verdict(h, robust)` → `verdict(h)`. Resta o que diferencia: escasso
(`B<0.25`/smallSample/degenerate) → Inconclusivo, senão Situacional.
Retorno ao Modo B (contagens reais) exigirá reintroduzir selo calibrado — nova versão.

## Onde mora cada classe (`packages/proprietary-engine/src/hero/`, sem subpasta)

| Classe | Arquivo | Spec | Status |
|---|---|---|---|
| `HeroScorer` (+ `HeroRowValidator`, `MadBaselineEstimator`, `WalkForwardPrior`, `EmpiricalBayesShrinkage`, `SignificanceTester`, `LotRanking`, `HeroResultAssembler`, `BatchMetaBuilder`) | `src/hero/*.js` | §§5–6, 9, 19, 24 | ✅ fit só com expostos; quarentena [0,1]; `q` experimental; `meta` + `sample_size_method` por herói (ativa o teto do trust na UI) |
| `HeroTier` (cortes injetáveis, `tier-v2`) | `src/hero/tierOf.js` | §7.2–7.3 | ✅ relativo ao lote; `?` sem dado |
| `StrengthIndex` (postos médios, nulos sem posição) | `src/hero/strength-index.js` | §7.1 + §5.3 | ✅ ordinal 0–100; null nunca vira posição |
| `HeroTrendAnalyzer` (limiares por métrica) | `src/hero/hero-trend.js` | §11 | ✅ Theil–Sen datado, 3 séries, `robustness`=cobertura, `statistical_evidence: null`; HeroCard usa `trendOfDated` |
| `HeroTrustPolicy` (teto único proxy) | `src/hero/trust.js` | §8.2 | ✅ `trustOf` ≡ `confidenceToTrust` sob proxy |
| `HeroProfile` | `src/hero/hero-profile.js` | §13 (disciplina) | ✅ sem pares → null; desempate fixo |
| `HeroLists` (+ `*Detailed` com proveniência) | `src/hero/hero-lists.js` | §18 + §10 | ✅ força/pick/ban separados; fallbacks marcados; BuildsTab usa `Detailed` (`validated` acende "rota não filtrada") |
| `HeroSorting` (inválidos por último) | `src/hero/forca-sorting.js` | §7 | ✅ política única nas 2 vias de posição |

Compat: cada módulo mantém os shims funcionais (mesmos nomes/retornos) — apps, web e testes não mudam; `index.d.ts` declara os novos membros.

## Correções de conformidade aplicadas (rev. 2)

- HIGH: `getSafetyClassification` capa "Blind Pick Seguro"→Situacional sob proxy (compat: só quando `exposure_status` declarado; `blindProxy` sempre declara).
- `rankDifference`: `"classified"` → `"provisional_model_based"` + `uncertainty_method`; `rank-profile` aceita ambos + caveat no motive; RanksPanel/RanksSection aceitam ambos no selo.
- `interpretProbBand`: `calibration_status: "uncalibrated_model_based"`; ConfiancaSection/Panel exibem o caveat.
- `getDraftPatterns`: `evidence_status` por padrão; DraftSection/Panel exibem "candidato experimental" quando ativo.
- `adjustedLiftByAttr`/`buildReferences`/`buildLift`: guard `[0,1]` único (V2 §5.2).
- `evidenceQuality`: `"robusto"` → `"consistente"`; `EvidenceQualityBadge` mapeia sem selo "Robusto".
- `compareCounterRelation`: `unit: "fraction_0_1_assumed"`; `calibrateOwnVsGlobal`: `method: "normal_band_n_observed"`.
- API `scoreLot`: arredondamento null-safe (nulos atravessam o fio).
- ConfiancaSection/Panel: "Robusto na grade" → "Estável na grade c (proxy)" (o selo real é o TrustSeal).

## Dívida normativa restante (não é gate)

- `c=1e5` âncora não calibrada + `q` experimental — rotulados (`rate_proxy_c: null`, `allow_confirmatory_q_values: false`). Calibração exige snapshots históricos (§6.1/§23-F2).
- `tau2_moment` é diagnóstico (não troca o estimador MAD).
- `cohort_enforced: false` — mistura de coortes se valida na ingestão (`cohorts/cohort-key.js`, Fase 1).
- ICs numéricos (`confidence-trio`, `rank-difference`, `temporal-delta`) com status em vez de `null` — decisão L2 registrada.
