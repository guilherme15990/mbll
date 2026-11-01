# Diagnóstico Arquitetural e Auditoria Estrutural (Fases 1 e 2)

- **Projeto:** Radar de Balanceamento MLBB (`radar-mlbb`)
- **Data:** 31 de outubro de 2026 / 01 de novembro de 2026
- **Status da Entrega:** Fases 1 (Descoberta e Mapeamento) e 2 (Diagnóstico Arquitetural) concluídas. Diagnóstico estrutural e levantamento empírico do sistema.
- **Autor/Papel:** Arquiteto de Software Sênior / Engenheiro de Refatoração

---

## 1. Enquadramento Metodológico e Referencial Teórico

A presente análise foi conduzida com base nos seguintes princípios consolidados:

1. **Clean Architecture (Robert C. Martin):** foco na regra de dependência (o fluxo aponta para as regras de negócio puras), na independência de frameworks e na distinção entre *arquitetura lógica* (limites de decisão) e *estrutura física* (diretórios). Rejeita-se a imposição de Use Cases ou Repositories puramente burocráticos quando não há invariantes mutáveis ou persistência relacional transacional complexa a proteger.
2. **Patterns of Enterprise Application Architecture (Martin Fowler):** separação de responsabilidades entre Apresentação, Domínio e Acesso a Dados / Infraestrutura externa. Análise de contratos de leitura analítica vs. mutação de estado.
3. **Software Architecture for Developers (Simon Brown):** aderência entre a arquitetura conceitual e o código real, identificando "arquiteturas que parecem modulares nos diretórios, mas vazam acoplamento nos imports e ciclos de dependência".
4. **Acervo de Decisões do Repositório (ADRs 001 a 058):** respeito às decisões já deliberadas e consolidadas no repositório (ex.: ADR-025 de fronteira única do motor, ADR-033 do monólito modular, ADR-041 da estrutura de pastas-alvo, ADR-045 de providers/logging e ADR-055 de navegação horizontal).

---

## 2. Fase 1 — Descoberta e Mapeamento do Sistema

### 2.1. Inventário Físico e Tecnológico

O repositório é configurado como um **monorepo Node.js** gerido por npm workspaces (`app/*`, `packages/*`), contendo três zonas funcionais bem delimitadas:

```
/
├── packages/
│   ├── contracts/            # DTOs compartilhados do wire (TypeScript puro, sem runtime)
│   └── proprietary-engine/   # Motor estatístico e de inferência (JS puro + index.d.ts, sem I/O)
├── app/
│   ├── api/                  # Backend analítico zero-dep (Node.js nativo HTTP, sqlite opcional)
│   └── web/                  # SPA React 18 + Vite + Tailwind CSS + TanStack Query + Recharts
├── tools/                    # Scripts de engenharia (check-boundaries.mjs, tsc.mjs)
└── AGENTS/artefatos/         # 58 ADRs, especificações OOUX, QA briefs e auditorias prévias
```

### 2.2. Execução da Rede de Testes e Linha de Base (Evidência Empírica)

A execução dos comandos de validação contra o código real revelou o seguinte estado:

| Comando Executado | Resultado Observado | Detalhes / Tempo |
|---|---|---|
| `npm run check:api` | **PASS (exit 0)** | Typecheck do backend via `jsconfig.json` sem erros. |
| `npm run check:web` | **PASS (exit 0)** | Typecheck do frontend via `tsc --noEmit` sem erros. |
| `npm test -w packages/proprietary-engine` | **255 PASS / 0 FAIL (exit 0)** | 52 suítes, 255 testes unitários de domínio puro aprovados (2,1 s). |
| `npm test -w api` | **154 PASS / 0 FAIL (exit 0)** | 36 suítes, 154 testes de rotas, contratos e providers aprovados (8,5 s). |
| `npm test -w web` | **119 PASS / 0 FAIL (exit 0)** | 79 testes unitários via `node:test` + 40 testes de UI via `vitest` aprovados (10,3 s). |
| `npm run build` | **PASS (exit 0)** | Build bem-sucedido de todos os pacotes (`engine` + `api` + `web`). |
| `npm run check:boundaries` | **21 PASS / 2 FAIL (exit 1)** | **Falha identificada**: 1 arquivo excedeu 300 linhas fora da allowlist (`suggestions.ts`: 329 linhas); alerta de manifesto divergente (`bun.lock` presente / `packageManager` em `package.json`). |

Total de testes automatizados em operação: **528 testes com 100% de sucesso funcional**, o que estabelece uma rede de segurança sólida para refatorações estruturais.

### 2.3. Mapa Arquitetural Atual e Direção de Dependências

```
   ┌───────────────────────────────────────────────────────────────┐
   │                        app/web (UI)                           │
   │  ┌───────────┐    ┌────────────────────┐    ┌──────────────┐  │
   │  │  app/     │    │  features/ (12)    │    │  shared/     │  │
   │  │  shell,   │───>│  dashboard, builds,│───>│  api, domain,│  │
   │  │  router,  │    │  draft-management, │    │  ui, format  │  │
   │  │  filters  │    │  hero-detail, etc. │    └──────┬───────┘  │
   │  └───────────┘    └────────────────────┘           │          │
   └───────────────────────────────┬────────────────────┼──────────┘
                                   │                    │
                     JSON via HTTP │                    │
                                   ▼                    │
   ┌──────────────────────────────────────────────────┐ │
   │                  app/api                         │ │
   │  ┌──────────────┐        ┌────────────────────┐  │ │
   │  │ routes/      │───────>│ application/       │  │ │
   │  └──────┬───────┘        └─────────┬──────────┘  │ │
   │         │ (acoplamento direto)     │             │ │
   │         ▼                          ▼             │ │
   │  ┌──────────────┐        ┌────────────────────┐  │ │
   │  │ infra/       │<───────│ providers/arena/   │  │ │
   │  │ cache, db,   │        │ cliente upstream   │  │ │
   │  │ config       │        └────────────────────┘  │ │
   │  └──────────────┘                                │ │
   └───────────────────────────────┬──────────────────┘ │
                                   │                    │
                                   ▼                    ▼
   ┌───────────────────────────────────────────────────────────────┐
   │                 packages/contracts                            │
   │         (DTOs de fio e interfaces compartilhadas)             │
   └───────────────────────────────▲───────────────────────────────┘
                                   │
   ┌───────────────────────────────────────────────────────────────┐
   │                 packages/proprietary-engine                   │
   │  Modelos matemáticos, Shrinkage bayesiano, Scorer de heróis,   │
   │  Classificação de builds, Draft patterns (Puro, zero I/O)     │
   └───────────────────────────────────────────────────────────────┘
```

---

## 3. Fase 2 — Diagnóstico Arquitetural Sistemático

### 3.1. Problemas Estruturais Priorizados por Evidência, Impacto e Risco

#### Problema 1: Concentração Massiva de Responsabilidades em Componentes Centrais (Violação do SRP)
- **Evidência no código:**
  - `app/web/src/features/build-manager/BuildManager.tsx` possui **850 linhas**.
  - `app/web/src/shared/ui/patterns/ItemComposer.tsx` possui **835 linhas**.
  - `app/web/src/shared/domain/buildManager.ts` possui **567 linhas**.
  - `app/web/src/features/hero-detail/HeroDetail.tsx` possui **451 linhas**.
- **Princípio Arquitetural:** *Single Responsibility Principle* (Martin), *High Cohesion* e *Information Hiding*.
- **Consequência prática:** `BuildManager.tsx` acumula simultaneamente: derivação de lanes, sincronização de URL searchParams, combos de runas/emblemas, 4 catálogos de seleção (itens, feitiços, talentos), cálculo de lift e estado de modais. Qualquer manutenção nesse fluxo exige manipular um arquivo monolítico com alta propensão a efeito colateral.
- **Gravidade:** Alta (o principal passivo do frontend).
- **Risco de modificação:** Médio-Alto (mitigado pelos testes de caracterização já existentes em `test/ui/build-manager.test.tsx`).
- **Recomendação:** Decompor `BuildManager` em hooks especializados de derivação (`useBuildDerivations`, `usePickerCatalogs`) e subcomponentes focados de visualização (`DecisionBoard`).

#### Problema 2: Regressão no Gate Arquitetural de Densidade de Arquivos
- **Evidência no código:**
  - `tools/check-boundaries.mjs` falha acusando: `app/web/src/features/draft-management/model/suggestions.ts (329 linhas)`.
- **Princípio Arquitetural:** *Continuous Architecture Verification* e integridade de limites.
- **Consequência prática:** O critério de aceite nº 1 da ADR-041 estabeleceu o teto de 300 linhas por arquivo fora do motor de cálculo. O novo subsistema de draft adicionou um modelo que ultrapassa essa barreira sem refatoração prévia, quebrando o gate de CI (`check:boundaries`).
- **Gravidade:** Média (bloqueia o gate do CI).
- **Risco de modificação:** Baixo (lógica algorítmica de sugestão, testada via `draft-management.test.mjs`).
- **Recomendação:** Fatiar `suggestions.ts` separando as rotinas puras de ranking de sugestões e cálculo de pontuação dos tipos auxiliares e constantes de ordenação.

#### Problema 3: Falta de Injeção de Dependências no Composition Root da API
- **Evidência no código:**
  - Em `app/api/src/application/rankLot.js:14`, `app/api/src/application/buildsAggregate.js:11` e `app/api/src/routes/builds.js:12`, os módulos importam diretamente `infra/cacheStore.js`, `infra/db.js` e `providers/arena/index.js`.
- **Princípio Arquitetural:** *Dependency Inversion Principle* (Martin) e separação entre *Mecanismos de Entrega/Infraestrutura e Aplicação* (Fowler).
- **Consequência prática:** A ADR-033 previa que `routes ↛ infra` e `application ↛ infra` (módulos deveriam receber serviços do composition root). Como isso não foi finalizado (registrado como desvio da F5), os casos de uso dependem de instâncias globais de infraestrutura, dificultando testes unitários sem mocks de módulo de baixo nível.
- **Gravidade:** Média.
- **Risco de modificação:** Médio.
- **Recomendação:** Implementar injeção explícita de dependências nas funções de fábrica de casos de uso na API, permitindo receber o gateway de upstream e o store de cache por parâmetro.

#### Problema 4: Handler HTTP Acumulando Mapeamento e Orquestração Pesada
- **Evidência no código:**
  - `app/api/src/routes/builds.js:50-115`: o handler do endpoint orquestra 3 chamadas concorrentes ao upstream Arena, mapeia payloads brutos com 66 linhas de transformação e chama o motor estatístico.
- **Princípio Arquitetural:** *Separation of Concerns* (Fowler: Presentation/Gateway vs. Application).
- **Consequência prática:** A rota deixa de ser um mero adaptador HTTP (validação de entrada e serialização de saída) e se torna um orquestrador com regras de transformação acopladas ao protocolo HTTP.
- **Gravidade:** Baixa-Média.
- **Risco de modificação:** Baixo.
- **Recomendação:** Mover a lógica de orquestração e normalização para `application/buildsAggregate.js`, mantendo `routes/builds.js` estritamente focado em tratar status codes e parâmetros de requisição.

#### Problema 5: Divergência de Governança de Manifestos de Pacote
- **Evidência no código:**
  - `check-boundaries.mjs` aponta: `package.json: packageManager ausente ou não-npm` e presença esporádica de `bun.lock`.
- **Princípio Arquitetural:** Reprodutibilidade de Build e Integridade Operacional.
- **Consequência prática:** Pode induzir desenvolvedores a utilizar gerenciadores alternativos, gerando lockfiles incompatíveis com o CI.
- **Gravidade:** Baixa.
- **Recomendação:** Declarar `"packageManager": "npm@10.8.2"` no `package.json` raiz e garantir o cumprimento da regra pelo gate.

---

## 4. Avaliação de Coesão, Acoplamento e Modularidade

### 4.1. Coesão
- **Domínio (`packages/proprietary-engine`):** **Altíssima.** Cada módulo matemático tem finalidade clara (ex.: `shrinkage-model.js`, `score-heroes.js`, `draft-patterns.js`), são puros, sem efeitos colaterais e com 100% de cobertura nos contratos.
- **Contratos (`packages/contracts`):** **Altíssima.** Apenas tipos e DTOs de transmissão, sem runtime, sem dependências.
- **Backend (`app/api`):** **Média-Alta.** A separação entre `application`, `routes`, `providers` e `infra` é compreensível, mas diluída pela falta de injeção formal e pelo acúmulo de transformações em `routes/builds.js`.
- **Frontend (`app/web`):** **Média-Baixa em pontos críticos.** A organização em `features/` foi um grande avanço, mas a coesão interna decai severamente em `features/build-manager` e `shared/ui/patterns`, onde arquivos de 800+ linhas concentram rendering, orquestração de formulários e lógica de cálculo.

### 4.2. Acoplamento
- **Acoplamento entre Features:** **Praticamente Nulo (Excelente).** O gate `check-boundaries.mjs` impede com rigor imports cruzados entre `features/`. O isolamento entre módulos de negócio no frontend é respeitado.
- **Acoplamento entre Camadas:** O acoplamento `features -> shared` é bem gerido através de `shared/ui/primitives` (átomos puros), `shared/domain` (lógica sem React) e `shared/api` (queries).
- **Acoplamento Acidental:** O único acoplamento acidental evidente é o vínculo direto de arquivos da pasta `application/` com arquivos de `infra/` no backend, prescindindo do composition root.

---

## 5. Análise Comparativa das Alternativas Arquiteturais

| Critério de Avaliação | Alternativa A: Package by Layer | Alternativa B: Package by Feature Puro | Alternativa C: Clean Architecture / DDD Tático Canônico | Alternativa D: Monólito Modular Híbrido com Bounded Contexts (Recomendada) |
|---|---|---|---|---|
| **Coesão de Negócio** | Baixa (código de uma feature disperso em 5 camadas) | Alta nas telas, frágil em regras transversais | Média (muita burocracia diluindo o domínio) | **Altíssima (regras agrupadas por contexto de negócio)** |
| **Acoplamento Real** | Alto (camadas genéricas acumulam dependências) | Baixo entre telas, risco de duplicação em shared | Baixo formalmente, alto em complexidade de adaptadores | **Controlado e auditado por scripts de fronteira** |
| **Localidade de Mudança** | Baixa (uma nova tela exige tocar em 4 pastas) | Média-Alta | Baixa (exige tocar Controller, UseCase, Repo, Entity) | **Altíssima (mudança restrita à feature e seus patterns)** |
| **Testabilidade** | Média | Média | Alta (com excesso de mocks) | **Excelente (motor e domínio puros testados sem mocks)** |
| **Custo de Migração** | Elevado (involução) | Médio | Extremo (desproporcional ao propósito) | **Baixo/Incremental (apenas decomposição do passivo)** |
| **Proporcionalidade** | Inadequada | Insuficiente | Desproporcional (não há modelo mutável nem persistência complexa) | **Perfeita para leitura e inferência analítica** |

### Justificativa da Alternativa Escolhida:
Recomenda-se a **Alternativa D (Monólito Modular Híbrido)**, em total continuidade e conformidade com a **ADR-033**, **ADR-037** e **ADR-041**:
1. **Frontend:** Organização *Feature-First* (`features/<bounded-context>`), suportada por uma camada `shared/` rigorosamente segregada (`api`, `domain`, `ui/primitives`, `ui/patterns`).
2. **Backend:** Camadas limpas (`routes` -> `application` -> `engine`), com portas nos clientes externos (`providers/arena`) e infraestrutura desacoplada por injeção no composition root.
3. **Domínio:** Isolado em pacote independente (`packages/proprietary-engine`), 100% puro, sem dependência de UI ou banco.

---

## 6. Informações Faltantes para Execução Segura

Antes de iniciar as modificações de código (Fase 5), é necessário esclarecer:
1. **Priorização de Fatiamento no Frontend:** Devemos priorizar o fatiamento de `BuildManager.tsx` (850 linhas) e `ItemComposer.tsx` (835 linhas), ou a resolução imediata do gate em `draft-management/model/suggestions.ts` (329 linhas)?
2. **Evolução da API:** A API continuará operando estritamente em modo de leitura analítica sobre upstream externo, ou há previsão de persistência transacional de usuários/sessões que justifique aprofundar a injeção de dependência na camada `application`?

---

## 7. Próximos Passos Propostos (Para Fase 4 e Fase 5)

Após a aprovação deste diagnóstico, a execução será estruturada em fases incrementais de baixo risco:

- **Etapa 1 (Adequação aos Gates):** Fatiar `draft-management/model/suggestions.ts` (reduzir para < 300 linhas) e declarar `"packageManager": "npm@10.8.2"` em `package.json`, reestabelecendo **100% PASS** em `npm run check:boundaries`.
- **Etapa 2 (Decomposição de BuildManager):** Extrair hooks especializados (`useBuildDerivations`, `usePickerCatalogs`) preservando os testes de caracterização de `test/ui/build-manager.test.tsx`.
- **Etapa 3 (Decomposição de ItemComposer & HeroDetail):** Fatiar subcomponentes e helpers puros de montagem de itens e renderização de abas.
- **Etapa 4 (Harmonização da API):** Mover a normalização de dados de `routes/builds.js` para `application/buildsAggregate.js`.
