# Engine --- Estrutura de diretórios

``` text
packages/engine/src/
│
├── core/                              # 1. FUNDAÇÃO MATEMÁTICA E ESTATÍSTICA PURA
│   ├── math.js                        # Médias, medianas, quartis, MAD
│   ├── statistics.js                  # Empirical Bayes (EB Shrinkage), Benjamini-Hochberg, Logit
│   ├── thresholds.js                  # Limiares canônicos de corte (DELTA, CUTS, pisos)
│   └── config.js                      # Configurações de pesos e lanes canônicas
│
├── heroes/                            # 2. INFERÊNCIA E CLASSIFICAÇÃO DE HERÓIS
│   ├── scoring.js                     # (Unifica score-heroes, hero-scorer e baseline-estimator)
│   ├── ranking.js                     # (Unifica lot-ranking, forca-sorting e strength-index)
│   ├── assembler.js                   # Montagem do DTO final do herói e validação de linhas
│   ├── trust.js                       # Políticas de confiança e intervalos (absorve confidence/)
│   ├── trends.js                      # Análise de tendência histórica e walk-forward prior
│   └── profile.js                     # Perfil do herói e do jogador (playstyle, calibração pessoal)
│
├── matchups/                          # 3. CONFRONTOS, COUNTERS E DRAFT
│   ├── counters.js                    # Matriz de pares, taxas de vitória cruzadas e evidências
│   ├── blind-pick.js                  # Segurança de first pick (absorve picks/pick-favorability)
│   ├── draft-score.js                 # Score de composição e sinergia de pares
│   └── draft-patterns.js              # Heurísticas de arquétipos de draft
│
├── builds/                            # 4. ITENS, TALENTOS E EMBLEMAS
│   ├── aggregate.js                   # Agregação estatística de builds
│   ├── lift.js                        # Cálculo de ganho/lift relativo de itens e talentos
│   ├── itemsets.js                    # Core de 3 itens e núcleos de build
│   └── contrast.js                    # Contraste de componentes e quadrantes de força
│
├── index.js                           # Ponto único de export público (Barrel da engine)
└── index.d.ts                         # Contrato estrito TypeScript de todos os métodos
```
