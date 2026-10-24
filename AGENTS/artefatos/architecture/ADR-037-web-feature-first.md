# ADR-037 — Web feature-first: `features/` por contexto, `shared/` para reuso e fronteiras verificáveis

- Data: 2026-10-24
- Status: aceita e implementada (F4b da ADR-033)
- Contexto: `apps/web` depois da F4a (`app/filters`, `shared/format`, rotas lazy,
  ErrorBoundary). Sem dependência nova, sem mudança de comportamento.

## Problema

A F4a resolveu ciclo, formatação e bundle, mas manteve a organização por **tipo de
arquivo**: `pages/` (12 rotas + `hero/sections` + `panels/`) e `components/`
(design system + componentes de feature + shell). Consequências:

1. **`pages/` como depósito.** 33 arquivos de naturezas diferentes: rota fina
   (`Blind.tsx`, 835 B), página grande (`Dashboard.tsx`, 19 kB), painel de contexto
   (`BlindPanel.tsx`, 11 kB), seção da ficha (`BuildsSection.tsx`, 13 kB).
2. **`components/` misturava níveis.** `ui.tsx`/`charts.tsx` são design system;
   `BuildsTab.tsx` é tela; `Sidebar.tsx`/`IddModal.tsx` são shell. Nada impedia
   `components/` importar `pages/` ou o contrário.
3. **Acoplamento entre contextos invisível.** `features/blind` importava o tipo
   `HeroPanelProps` de `pages/panels/ForcaPanel.tsx`; qualquer feature podia
   importar qualquer outra sem que nenhum teste reclamasse.
4. **Navegação mental cara.** Para achar o código de `/builds` era preciso olhar
   `pages/Builds.tsx`, `pages/panels/Builds*` (4 arquivos), `components/BuildLoadout`,
   `lib/combiner` e `shared/charts`.

## Decisão

**Organização feature-first com quatro zonas e direção de dependência explícita.**

```
src/
  App.tsx, main.tsx        entrada e rotas (shell)
  app/                     shell e infra de UI
    filters.ts, ErrorBoundary.tsx, Sidebar.tsx, IddModal.tsx
  features/<contexto>/     uma pasta por rota/contexto
    <Contexto>.tsx         página (default export, alvo do lazy)
    <Contexto>Panel.tsx    corpo reutilizado pela ficha, quando existe
    sections/              seções da ficha (só em features/hero)
  shared/                  reuso sem dono de contexto
    format.ts, ui.tsx, charts.tsx, heroPanel.ts, idd.tsx
    HeroPicker.tsx, HeroDossier.tsx, BuildLoadout.tsx, PickVerdict.tsx
    idd/{NeedsRankLane,PrimaryAction,SigmaBanCard}.tsx
  lib/                     dados e lógica pura da web
    api.ts, combiner.ts, buildLabel.ts, itemsets.ts
```

| De → Para | Permitido |
|---|---|
| `App.tsx` → `features/*` | sim (só via `lazy()`) |
| `app/*`, `shared/*`, `lib/*` → `features/*` | **não** |
| `features/a` → `features/b` | **não** (contrato vai para `shared/`) |
| `features/*` → `shared/`, `lib/`, `app/` | sim |
| `shared/*` → `lib/*` | sim (UI usa hooks/tipos de dados) |
| `lib/*` → `shared/format` | sim (formatação é base) |

### Mapa aplicado (33 páginas/painéis + 12 componentes)

| Antes | Depois |
|---|---|
| `pages/{Dashboard,Herois,Forca,Confianca,Ranks,Tempo,Confrontos,Draft,Blind,Builds,Exposicao}.tsx` | `features/<contexto>/<Contexto>.tsx` |
| `pages/hero/HeroDetails.tsx` + `pages/hero/sections/*` | `features/hero/HeroDetails.tsx` + `features/hero/sections/*` |
| `pages/panels/<Ctx>Panel.tsx` | `features/<contexto>/<Ctx>Panel.tsx` |
| `components/dashboard/{BuildsTab,RankingsTab}` + `HeroCard` | `features/dashboard/` |
| `components/{ui,charts,HeroPicker,HeroDossier,BuildLoadout,PickVerdict}` | `shared/` |
| `components/{Sidebar,IddModal}` | `app/` |
| `components/idd/*` | `shared/idd/*` |
| `lib/idd.tsx` | `shared/idd.tsx` |

Contextos: `dashboard`, `heroes`, `hero`, `forca`, `confianca`, `ranks`, `tempo`,
`confrontos`, `draft`, `blind`, `builds`, `exposicao` (12).

### Contrato compartilhado em vez de dependência entre features

`HeroPanelProps` vivia em `ForcaPanel` e era importado por 7 painéis de outros
contextos. Foi extraído para `shared/heroPanel.ts`; `ForcaPanel` e os 7 painéis
importam de lá. Nenhuma feature importa outra.

### Migração mecânica, não manual

A mudança de 45 arquivos foi feita por script de uso único: resolve cada import
relativo na árvore **antiga**, calcula o caminho relativo a partir do novo local e
reescreve. 200 especificadores foram ajustados; extensões `.ts/.tsx` adicionadas
pelo resolvedor foram normalizadas de volta (o repo usa extensão omitida), exceto
`lib/combiner.ts → shared/format.ts`, que o type-stripping do Node exige.

### Guardião F4b (9 checks)

`test/guardian-f4b.mjs` (estático) verifica: ausência de `src/pages` e
`src/components`; ≥10 contextos; todas as rotas lazy em `features/`; zero import
entre features; `app`/`shared`/`lib` não importam features; cada contexto tem
página com `export default`; `HeroPanelProps` em `shared` e consumido de lá.
`smoke.mjs` e os guardians de Builds/Confrontos passaram a ler os novos caminhos.

## Alternativas rejeitadas

1. **Manter `pages/` e só mover `components/`.** Não resolve o depósito nem o
   acoplamento entre contextos; seria reorg cosmética.
2. **Um `index.ts` por feature (barrel).** Cria ciclos e impede tree-shaking
   granular; o repo não usa barrels.
3. **Path aliases (`@/features/...`).** Vite precisaria de alias manual (não lê
   `tsconfig.paths` sem plugin) e o esbuild do `build:fast` teria outra configuração;
   mais um lugar para divergir. Imports relativos continuam explícitos.
4. **Colocar hooks de dados dentro de cada feature.** `lib/api.ts` é um cliente
   único com cache keys compartilhadas; fatiar por feature agora duplicaria tipos e
   arriscaria divergência de query key. Fica para quando houver demanda real.
5. **Criar `PageScaffold` para as 8 rotas finas.** Elas repetem `useFilters` +
   `HeroPicker` + `HeroDossier` + `Panel`; extrair reduziria duplicação, mas é
   refatoração de comportamento, não de estrutura. Registrado como próximo passo.

## Consequências

Positivas: achar o código de uma rota é abrir uma pasta; `shared/` tem dono claro;
fronteiras viram teste (guardian), não convenção; `components/` e `pages/`
desaparecem; nenhum import entre features; build e comportamento idênticos.

Negativas / custos:

- Caminhos mais profundos (`../../../shared/ui`) em `features/hero/sections`.
- O diff é grande (45 arquivos movidos) e ruidoso para revisão; mitigado por ser
  mecânico e validado por typecheck/build/testes.
- Pastas de contexto ainda misturam rota e painel; a distinção é por sufixo
  (`X.tsx` = rota, `XPanel.tsx` = corpo).
- `modules-map.md` é um retrato histórico da estrutura antiga e não foi reescrito.
- As rotas finas continuam repetindo o scaffold (candidato a `PageScaffold`).

## Evidência de execução

Ver `F4b-web.md`: typecheck 0; smoke + guardians (F4A, F4B, Builds, Confrontos) OK;
24/24 itemsets+combiner; build com entry 289,76 kB e os mesmos 30 chunks; runtime
smoke com `dbClosed:true`, exit 0; 57 arquivos, 0 sem importador.
