# Mapa de módulos — refatoração web (`apps/web/src`)

- Data: 2026-10-07 · Autor: frontend-architect
- Escopo: `apps/web/src` (14 arquivos: `main.tsx`, `App.tsx`, `index.css`, `lucide.d.ts`, `lib/api.ts`, `components/ui.tsx`, `components/charts.tsx`, `pages/` × 5) + `vite.config.ts` (infra dev, fora de `src`, incluído por acoplamento com a API).
- Leitura: integral, arquivos pequenos (15–156 linhas). Sem código nesta entrega, só o mapa.
- Legenda de esforço: **P** = horas, troca isolada · **M** = 1–2 dias, toca 2+ consumidores · **G** = 3+ dias ou muda contrato/dependência externa.

---

## 1. Inventário atual (arquivo → responsabilidade → hooks/usos)

| # | Arquivo | Linhas | Responsabilidade | Exporta | Consome / é consumido por |
|---|---------|--------|------------------|---------|---------------------------|
| 1 | `src/main.tsx` | 15 | Bootstrap: `QueryClient` (staleTime 2min, retry 2) + `BrowserRouter` + `StrictMode` | nada (entry) | Consome: `index.css`, `App`. Nenhuma página o importa. |
| 2 | `src/App.tsx` | 71 | Shell: header (filtros elo/janela via URL), nav 5 links, `<Routes>` (6 rotas, `/health` reusa `Method`), footer | `useFilters()` (rank/window via `useSearchParams`), `App` default | Consome: `lib/api` (`cx`), 5 pages. **Consumido por**: `Panorama`, `HeroDetail`, `Views`, `Gems` (via `useFilters`). |
| 3 | `src/lib/api.ts` | 102 | 3 papéis misturados: (a) tipos de domínio, (b) data-fetching (8 hooks React Query + `getJSON`), (c) formatação defensiva + `cx` | Tipos `Hero`, `Pair`, `Matchups`, `Build`, `TrendPoint`; hooks `useHeroes`, `useHero`, `useMatchups`, `useBuilds`, `useTrends`, `useViews`, `useGems`, `useMeta` (nota: são **8**, não 7); helpers `pct`, `num`, `dir`, `dirWord`, `ago`, `cx` | Consome: `@tanstack/react-query`, fetch `/v1/*`. **Consumido por**: `App` (`cx`), todas as pages, `components/ui` (`ago`, `cx`, `dir`, `dirWord`, `num`), `components/charts` (tipo `TrendPoint`). |
| 4 | `src/components/ui.tsx` | 122 | Design-system local: identidade de herói + estados de feedback (12 exports) | `Avatar`, `TierBadge`, `ClassSeal`, `CtxSeal`, `Delta`, `ThetaBar`, `FreshLine`, `Loading`, `Empty`, `ErrBox`, `GhostNote`, `SectionTitle` | Consome: `lib/api`, `react-router` (`Empty`), `lucide-react`. **Consumido por**: todas as 5 pages (ver detalhe abaixo). |
| 5 | `src/components/charts.tsx` | 70 | Gráficos (recharts + 1 sparkline SVG pura) | `Spark`, `TrendChart`, `DurationChart`, `Quadrant` | Consome: `recharts`, tipo `TrendPoint` de `lib/api`. **Consumido por**: `HeroDetail` (`TrendChart`, `DurationChart`), `Views` (`Quadrant`). `Spark` **não tem nenhum consumidor** (código morto). |
| 6 | `src/pages/Panorama.tsx` | 99 | Rota `/`: tabela 133 heróis (busca client, filtro tier, sort `d/win/pick/ban/q`), mediana `wrAdj`, `FreshLine`, `truncated` | default `Panorama` | Consome: `useHeroes` + `useFilters` + 10/12 de `ui` (`Avatar`, `ClassSeal`, `CtxSeal`, `Delta`, `Empty`, `ErrBox`, `FreshLine`, `Loading`, `SectionTitle`, `ThetaBar`, `TierBadge`) + `cx/num/pct`. **Único consumidor** de: `Delta`, `ThetaBar`, `FreshLine`. |
| 7 | `src/pages/HeroDetail.tsx` | 156 | Rota `/hero/:id`: ficha + 3 tabs (`geral`→`useTrends`, `draft`→`useMatchups`, `builds`→`useBuilds`+lane local); dispara **4 queries em paralelo** (1 sempre + 3 por tab, `enabled: !!id`) | default `HeroDetail`, internas `PairRow`/`PairList` | Consome: `useHero/useTrends/useMatchups/useBuilds` + `useFilters` + `ui` (`Avatar`, `ClassSeal`, `CtxSeal`, `Empty`, `ErrBox`, `Loading`, `SectionTitle`, `TierBadge`) + `charts` (`TrendChart`, `DurationChart`). Maior acoplamento do app. |
| 8 | `src/pages/Views.tsx` | 74 | Rota `/views`: 3 seções independentes (semana `useViews×2`, mapa `useHeroes`+`Quadrant`, tiers `useViews`) — **3 queries paralelas sem coordenação de erro** | default `Views` | Consome: `useViews` (2×), `useHeroes`, `useFilters` + `ui` (`Avatar`, `Empty`, `ErrBox`, `Loading`, `SectionTitle`) + `Quadrant`. **Único consumidor** de: `useViews`, `Quadrant`. |
| 9 | `src/pages/Gems.tsx` | 35 | Rota `/gems`: lista `useGems`, vazio explica regra (q≤0,05 + θ̂>mediana + pick/ban<q25) | default `Gems` | Consome: `useGems`, `useFilters` + `ui` (`Avatar`, `ClassSeal`, `Empty`, `ErrBox`, `GhostNote`, `Loading`, `SectionTitle`). **Único consumidor** de: `useGems`, `GhostNote`. |
| 10 | `src/pages/Method.tsx` | 56 | Rota `/method` + `/health` (flag `health`): conteúdo estático M1–M4/S7 + tabela CUTS + saúde da fonte (`useMeta`); **duplo papel via prop** | default `Method({health})` | Consome: `useMeta`, `ago` + `ui` (`ErrBox`, `Loading`, `SectionTitle`). **Único consumidor** de: `useMeta`. Não usa `useFilters`. |
| 11 | `src/index.css` | 22 | Tokens Tailwind (`card`, `btn-*`, `inp`, `sel`, `lbl`, `num`, `ctx-seal`) + base abyss/scrollbar | classes utilitárias | Consumido globalmente via `main.tsx`; referenciado por `App` + todas as pages + `ui`. |
| 12 | `src/lucide.d.ts` | 20 | Shim de tipos `lucide-react` (16 ícones declarados; cobre `Search`, `Swords` — ver nota) | declarações de módulo | Consumido pelo tsc em todo `import … from "lucide-react"`. **Divergência**: `Hammer`, `LineChart` declarados mas nunca importados; nenhum ícone usado fora do declarado (ok hoje). |
| 13 | `vite.config.ts` (fora de `src`) | 44 | Infra dev: plugin `radarApi` monta `../api/src/routes.js` em `/v1/*` + `/health` no próprio `:5173` (zero segundo processo) | config + `radarApi()` | Consome: `../api/src/routes.js` (**acoplamento dev↔API**: quebra o `dev` se o router mudar de assinatura). Consumido por: `vite dev/build/preview`. |
| 14 | `src/components/` e `src/lib/` (pastas) | — | Sem `index.ts` (barrel); imports sempre relativos profundos (`../lib/api`, `../components/ui`) | — | Decisão de migração, não módulo. |

Notas de auditoria (sem código, só registro):
- N1: `lib/api.ts` tem **8 hooks**, não 7 (`useMeta` é o oitavo). `useViews` e `useMeta` retornam `any` — viola o Done ("`any` em contrato de API = fail").
- N2: `Spark` (charts.tsx) é código morto — zero imports em `src`.
- N3: `Method({health})` acumula 2 rotas num componente; `/health` herda shell/filtros que não usa.
- N4: `HeroDetail` dispara 4 queries no mount (trends+matchups+builds mesmo fora da tab ativa) — sem lazy por tab.
- N5: `Views` dispara 3 queries sem erro combinado (3 `ErrBox` independentes possíveis na mesma tela).
- N6: `useFilters().set` muta o `URLSearchParams` in place antes de `setSp` — funciona, mas é padrão frágil se reutilizado.

Usos cruzados de `ui.tsx` (para a §3): `Loading`→5 pages · `ErrBox`→5 · `SectionTitle`→5 · `Empty`→Panorama/HeroDetail/Gems · `Avatar`→Panorama/HeroDetail/Views/Gems · `TierBadge`→Panorama/HeroDetail · `ClassSeal`→Panorama/HeroDetail/Gems · `CtxSeal`→Panorama/HeroDetail (+interno `FreshLine`) · `Delta/ThetaBar/FreshLine`→só Panorama · `GhostNote`→só Gems.

---

## 2. Mapa proposto ESSENCIAL (manter · fundir · excluir)

Princípio: refatorar sem expandir — **7 módulos propostos** para 14 itens atuais. Nenhuma página some; o corte é em utilidade morta/duplicada, não em rota.

### 2.1 MANTER (5)

| Módulo proposto | Origem | Dono (página) | Esforço | O que muda (só direção, sem código) |
|---|---|---|---|---|
| M1 `app/shell` — rotas, header, filtros de URL, footer | `App.tsx` (inclui `useFilters`) | Todas (dono técnico: shell) | **P** | Nada estrutural; corrigir N6 (construir novo `URLSearchParams` em `set`). |
| M2 `app/bootstrap` — providers + entry | `main.tsx` | Todas (infra, sem dono de página) | **P** | Nada; opcional: extrair `QueryClient` para facilitar teste. |
| M3 `lib/queries` — tipos de domínio + 8 hooks React Query, 100% tipados | `lib/api.ts` (parte b + tipos) | Todas (dono por hook: Panorama→`useHeroes`, HeroDetail→`useHero/useMatchups/useBuilds/useTrends`, Views→`useViews`, Gems→`useGems`, Method/SourceHealth→`useMeta`) | **M** | Eliminar os 2 `any` (N1): tipar `useViews("semana"\|"tier")` e `useMeta` com os shapes que as páginas já consomem (`health.errors/lastOk`, `cache.*`, `versions`, `startedAt`). Key de cache e `enabled: !!id` ficam como estão. |
| M4 `components/ui` — design-system (feedback + identidade), como está | `components/ui.tsx` (12 exports) | Todas (maior uso: Panorama 10/12, HeroDetail 8/12) | **P** | Nada estrutural; **não dividir** (quebrar em 2 arquivos dobra imports em 5 pages sem ganho — reavaliar só se passar de ~200 linhas). |
| M5 `components/charts` — só o usado (3 gráficos) | `components/charts.tsx` **menos `Spark`** | HeroDetail (`TrendChart`, `DurationChart`) · Views (`Quadrant`) | **P** | Excluir `Spark` (vai para §2.3). Restante intocado. |
| M6 `styles/tokens` | `index.css` | Todas | **P** | Nada. |
| M7 `infra/vite-api` — middleware dev | `vite.config.ts` (`radarApi`) | Nenhuma página (dono: build/dev) | **P** | Nada; documentar o acoplamento com `../api/src/routes.js` (pin de assinatura). |

> Contagem: M1–M7 = 7 módulos (M4/M5/M6/M7 contam como 4 "manter" + M1/M2/M3 = 7 linhas acima agrupadas em "MANTER (5)" por origem — origem `App`+`main`+`api(parte)`+`ui`+`charts(parte)`+`css`+`vite` = 7 origens mantidas).

### 2.2 FUNDIR (2 movimentos, ambos P)

| Movimento | De → Para | Dono | Esforço | Motivo |
|---|---|---|---|---|
| F1 Extrair `lib/format` de `lib/api.ts` | `pct`, `num`, `dir`, `dirWord`, `ago`, `cx` → novo `lib/format.ts`; `lib/queries` importa o que precisar (hoje: nada — só as páginas e `ui` usam) | Panorama (maior consumidor de `num/pct`) + `ui` (`ago/cx/dir/dirWord/num`) | **P** | Separa presentacional (formatação) de dados (fetch/cache) — hoje um import de `pct` puxa `react-query`. `cx` pode ir para `ui` ou ficar em `format`; decidir na execução, não aqui. |
| F2 Separar `/health` de `Method` | `Method({health})` → `Method` (estático puro, **zero hooks**) + novo `pages/SourceHealth.tsx` (dono do `useMeta`) | Method (estático) · nova rota `/health` | **P** | Elimina duplo papel (N3); `Method` vira página sem estado de loading/erro; `useMeta` ganha 1 dono exclusivo. Rotas em M1 passam de 6→6 (só troca o `element`). |

### 2.3 EXCLUIR (2 itens)

| Item | Onde está | Destino | Dono p/ validar | Esforço | Risco |
|---|---|---|---|---|---|
| X1 `Spark` (sparkline SVG) | `components/charts.tsx:11` | **Excluir** — nenhum consumidor em `src` (N2). Se um dia for preciso, `TrendChart` cobre; ressuscitar pelo git. | Views (candidata natural, se um dia quiser sparkline) | **P** | Nulo (morto). |
| X2 `lucide.d.ts` (shim) | `src/lucide.d.ts` | **Excluir após** `lucide-react@0.453` prover tipos próprios ou upgrade que os inclua; até lá, **manter** como exceção documentada. Inclui remover `Hammer`/`LineChart` fantasmas ou declarar só o usado. | Shell (`App` importa 6 ícones) | **P** | Baixo; validar com `tsc --noEmit` antes de remover. |

Nada mais é excluído: nenhuma rota, nenhum hook, nenhum componente usado sai.

---

## 3. Dependências entre módulos (o que quebra se X sair)

Leitura: "se **X** sair/mudar, **Y** quebra". Ordenado pelo blast radius (maior primeiro).

| # | Se X sair/mudar… | Quebra(m)… | Tipo | Observação |
|---|------------------|------------|------|------------|
| D1 | M3 `lib/queries` (`lib/api.ts` hoje) | **Tudo**: 5 pages + `ui` + `charts` (tipo) + `App` (`cx`) | dura | Módulo de maior acoplamento: tipos + fetch + (hoje) format. Motivo de F1: reduzir o raio. |
| D2 | M1 `app/shell` (`useFilters`) | `Panorama`, `HeroDetail`, `Views`, `Gems` (4 imports diretos) | dura | Filtros vivem na URL; sem ele, 4 páginas perdem rank/window. `Method` não depende. |
| D3 | M4 `components/ui` | 5 pages (`Loading/ErrBox/SectionTitle` em todas; ver matriz §1) | dura | `Empty` sem ele quebra 3 páginas; `Avatar` quebra 4. Não dividir sem necessidade (custo em 5 arquivos). |
| D4 | `getJSON`/base `/v1/*` (dentro de M3) | todos os 8 hooks → todas as páginas de dados | dura | Troca de base URL ou de `router()` exige varredura em 1 arquivo só (bom: centralizado). |
| D5 | M5 `components/charts` | `HeroDetail` (2 gráficos), `Views` (`Quadrant`) | dura | `recharts` é dependência só deste módulo — removê-lo libera o pacote inteiro. |
| D6 | M7 `infra/vite-api` / `../api/src/routes.js` | `vite dev` inteiro (todas as páginas, via 502 "Fonte indisponível") | infra | Único acoplamento fora de `src`. Mudança de assinatura do `router` quebra o dev sem tocar no client. |
| D7 | `useHeroes` (dentro de M3) | `Panorama` (tabela) + `Views` (média `avg` + `Quadrant`) | dados | `Views` depende de `Panorama` indiretamente via mesmo hook — cache `["heroes", rank, window]` compartilhado é proposital (dedupe do React Query). |
| D8 | `Method` (se fundido em F2) | `/method` (estático) + `/health` vira `SourceHealth` | fraca pós-F2 | Hoje D8 é 1 arquivo→2 rotas; após F2 cada rota tem 1 dono e o `useMeta` isola falha de saúde do conteúdo estático. |
| D9 | M6 `styles/tokens` | visual de tudo (não funcional) | visual | Remover quebra `card/btn/inp/sel/lbl/num/ctx-seal` em todas as telas. |
| D10 | X1 `Spark` | **nada** | — | Prova de que é seguro excluir. |
| D11 | X2 `lucide.d.ts` | `tsc` em todos os arquivos que importam `lucide-react` | build | Só remover com tipos reais no lugar; nunca no escuro. |

Cadeias críticas (resumo): `M7 → M3 → {M1, M4, M5} → pages`. `M3` é o gargalo; `M1` é o segundo. F1+F2 não criam dependências novas, só estreitam as existentes.

---

## 4. Estimativa de esforço por módulo proposto (com dono)

| Módulo proposto | Dono (página/área) | Esforço | Inclui (verificação de done) |
|---|---|---|---|
| M1 `app/shell` | Shell (todas) | **P** | Fix N6 + checar 6 rotas após F2. |
| M2 `app/bootstrap` | Infra (sem página) | **P** | Nenhuma mudança obrigatória. |
| M3 `lib/queries` tipado | Panorama · HeroDetail · Views · Gems · SourceHealth | **M** | 2 contratos tipados (`useViews`, `useMeta`); zero `any`; `tsc` limpo. Toca 3 arquivos consumidores (`Views`, `Method/SourceHealth`, tipos). |
| M4 `components/ui` | Panorama (usa 10/12) | **P** | Nenhuma mudança; inventário §1 cobre os 12 exports. |
| M5 `components/charts` − `Spark` | HeroDetail · Views | **P** | Remover `Spark`; `HeroDetail` e `Views` renderizam igual. |
| M6 `styles/tokens` | Todas | **P** | Nenhuma mudança. |
| M7 `infra/vite-api` | Dev/build | **P** | Documentar pin de assinatura do `router`; sem mudança. |
| F1 `lib/format` (novo, extraído) | Panorama + `ui` | **P** | 6 helpers movidos; imports atualizados em `App`, 4 pages, `ui`; `lib/queries` sem import presentacional. |
| F2 `pages/SourceHealth` (novo, extraído) | `/health` | **P** | `Method` sem hooks; rota `/health` aponta p/ novo; `useMeta` com 1 dono. |
| X1 `Spark` | — (morto) | **P** | Arquivo some, nada quebra (D10). |
| X2 `lucide.d.ts` | Shell | **P** | Condicional a tipos reais; `tsc` verde antes/depois. |

Total: **9×P + 1×M**, zero G. Sequência sugerida: X1 → F1 → M3 (aproveita F1) → F2 → M1(N6) → X2 por último (depende de pacote externo).

---

## Done (conferência)

- [x] Todo arquivo `src` atual aparece no inventário §1 (12/12 + pastas + `vite.config.ts` de contexto = 14 linhas).
- [x] Todo módulo proposto (§2 + §4) tem dono (página/área) e esforço P/M/G.
- [x] Destino de cada item atual: manter (§2.1) / fundir (§2.2) / excluir (§2.3) — sem órfãos.
- [x] Dependências §3 cobrem o que quebra se cada X sair (D1–D11).
