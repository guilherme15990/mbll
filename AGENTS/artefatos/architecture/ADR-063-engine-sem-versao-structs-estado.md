# ADR-063 — `@radar/engine` sem carimbo de versão e com structs de estado

- Data: 2026-11-01 · Autor: saas-lead
- Status: **aceito e executado**
- Relação: continua a limpeza da `@radar/engine` iniciada nas ADR-061 (consolidação
  em 4 buckets) e ADR-062 (poda do contrato). **Não muda comportamento observável**:
  os mesmos valores de saída continuam saindo; o que muda é *como* os nomes de estado
  e as versões aparecem no código. Laudo de origem:
  `AGENTS/artefatos/architecture/engine-legado-2026-11-01.md`.

## Contexto

Dois cheiros restantes no código legado da engine:

1. **Carimbo de versão espalhado.** Constantes `*_VERSION` (`THRESHOLDS_VERSION`,
   `AGGREGATE_VERSION`, `PICK_FAVORABILITY_VERSION`, `TREND_VERSION`, `TIER_VERSION`,
   `C_GRADE_VERSION`, `DS_*`…), campos `version`/`formula`/`tier_version`/
   `model_version` na saída e `index_basis.method` carimbavam a versão do **nosso
   código** dentro do contrato/telemetria. Isso acopla a saída do motor à
   implementação e cria strings que ninguém consome (drift silencioso).
2. **Literais de estado espalhados.** Nomes de estado — `"provisional"`,
   `"unvalidated"`, `"inconclusive"`, `"nao-avaliado"`, `"sem-dado"`, cobertura de
   amostra, direção de tendência, veredito de counter, etc. — apareciam como string
   solta em vários módulos. Renomear/excluir um estado exigia varredura manual e
   arriscava divergência entre módulos.

## Decisão

### D1 — Remover todo carimbo de versão do nosso código (L2)

- Apagadas as constantes `*_VERSION` do motor e as linhas correspondentes do barrel
  (`index.js`) e do contrato (`index.d.ts`), além dos campos derivados
  (`version`, `formula`, `tier_version`, `model_version`).
- `index_basis.method` saiu do contrato → a saída é `index_basis: { n }`.
- Cache do hero-draft-score sem versão: chave `draft-score:${rank}:${days}`
  (antes incluía um carimbo de versão).
- JSDoc de `clusterPlaystyle`/`poolProfile`/`seriesDated`/`laneTimingCurve` deixou de
  anunciar um campo `version` que já não existia no retorno.

**Mantidos (não são versão do nosso código):**

| Nome | Motivo |
|---|---|
| `game_version` / `gameVersion` / `version_break` / `versionBroken` | Dado de **domínio**: patch do jogo. A quebra de `game_version` é justamente a regra de regime. |
| `WF_VERSION_BREAK_VARIANCE_FACTOR` | Configuração/estimador (fator de desconto por quebra de regime). |
| `STRENGTH_MODEL` | Rótulo de configuração do estimador. |
| `LOADOUT_VERSION` (web, `shared/domain/loadout.ts`) | Fora do escopo: é versão de **schema de persistência** do domínio web, não carimbo da engine. |

### D2 — Structs para os estados possíveis

Objeto **congelado** por estado, com nomes canônicos (chave = rótulo, valor = o
literal que já circulava na saída). Duas camadas:

- **Transversais** → `core/states.js` (FONTE ÚNICA dos nomes que aparecem em mais de
  um bucket).
- **Específicos** → co-localizados no módulo dono (evita acoplar `builds` a `matchups`,
  por exemplo).

Os structs são `export` de módulo mas **NÃO entram no barrel** (`index.js`) para não
exigir decl no `index.d.ts` nem ampliar o contrato público (gate `check:boundaries`
exige paridade barrel ↔ d.ts).

**Transversais — `core/states.js` (13):** `ClassificationStatus`, `ExposureStatus`,
`ExposureUnit`, `UnitStatus`, `CausalStatus`, `Coverage`, `EvidenceStatus`,
`UncertaintyStatus`, `DataStatus`, `InferenceStatus`, `QStatus`, `CalibrationStatus`,
`DeltaStatus`.

**Co-localizadas no dono (49):**

| Módulo | Structs |
|---|---|
| `heroes/trends.js` | `TrendDir`, `DatedDirection`, `Robustness`, `MetaTrendVerdict`, `LaneTimingVerdict`, `SegmentMove`, `TrendWord`, `SignalState`, `SeriesAssessmentStatus`, `SnapshotStatus` |
| `matchups/counters.js` | `CounterVerdict`, `EvidenceQuality`, `DurationProfile`, `IntervalStatus`, `PairType`, `PairUnit` |
| `matchups/blind-pick.js` | `SafetyStatus`, `RobustnessStatus`, `SafetyLabel`, `SafetyGuide`, `PickFavorabilityKey`, `PickFavorabilityLabel`, `PickFavorabilityTone` |
| `builds/aggregate.js` | `BuildTagKey`, `BuildTagTone`, `SupportStatus`, `SupportMode`, `AggregateKind`, `PickSumStatus`, `CellStatus`, `PatternScope`, `DiscoveryStatus`, `WeightingSensitivity`, `EquipmentType`, `EquipmentArchetype` |
| `builds/contrast.js` | `BuildQuadrant`, `ComponentKind`, `ContrastEvidence`, `ContrastMode` |
| `builds/lift.js` | `BuildSupport`, `BuildUnit`, `BuildReferenceKind` |
| `heroes/ranking.js` | `Tier` (ordem em `TIER_ORDER`) |
| `heroes/trust.js` | `TrustClass` |
| `heroes/profile.js` | `CalibrationVerdict`, `PlaystyleKey` |
| `heroes/scoring.js` | `HeroContractCategory` (famílias do `HERO_CONTRACT`) |
| `matchups/draft-score.js` | `DsUnitStatus` (`DS_UNIT_STATUS` mantido como alias compat) |
| `builds/itemsets.js` | `ItemsetStatus` |

**Dedupe:** `DeltaStatus` saiu do `aggregate.js` e vive só em `core/states.js`;
`aggregate.js` faz `import { DeltaStatus } … ; export { DeltaStatus };` e `contrast.js`
importa direto de `core/states.js`.

### D3 — Não convertidos (decisão explícita)

- `metrics.value_unit` (`"pp_contrast_shrunk"`) e `metrics.difference_unit`
  (`"percentage_points"`) permanecem **literais**: são rótulos de unidade de um único
  ponto, não um enum de estados reutilizado.
- JSDoc que enumera valores possíveis (ex.: `@returns { verdict: "…" }`) permanece como
  documentação — não é literal de código.

## Consequências

- Motor sem nenhum carimbo de versão do nosso código; só resta `game_version`
  (domínio) e `WF_VERSION_BREAK_VARIANCE_FACTOR` (config).
- Um estado agora tem **um** nome canônico; renomear é trocar o valor no struct dono.
- Contrato público inalterado (`index.d.ts`/barrel seguem em paridade; structs ficam
  fora do barrel). Barrel do motor: **141** export.
- Gates pós-execução: engine **253/253**, api **154/154**, web **40/40**,
  `check:boundaries` **OK**, `check:api`/`check:web` **OK**, `build` **OK**, 0 BOM.

## Pendência (não executada)

- JSDoc que ainda cita constantes históricas removidas (ex.: `C_GRADE_VERSION` em
  `core/config.js`) é mantido como registro; poda cosmética opcional.
