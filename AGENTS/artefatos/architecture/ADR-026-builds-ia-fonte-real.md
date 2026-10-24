# ADR-026 — IA de Builds ancorada na forma real da fonte (variantes completas, sem ordem de compra)

- Data: 2026-10-21 · Autor: saas-lead
- Status: **proposta** (L2 — aguarda confirmação de produto)

## Contexto

Discussão de IA: Dashboard (panorama do meta) vs Builds (explorar/comparar) vs Heróis → Builds (especializar).
A premissa em discussão era "a API só devolve os itens core (3), não a build completa de 6".
Essa premissa **não se confirma** no código atual.

## Evidência (fonte, não opinião)

> ⚠️ **Correção empírica (2026-10-21, mesmo dia).** A tabela abaixo descreve a
> *capacidade do parser* (`slice(0,6)`), não a forma do payload. Medi o cache real
> (`apps/api/data/cache.sqlite`, 21,7 h de idade, 10 heróis mythic/gold) e o payload
> tem **3 itens por build e 3 builds por herói+lane+rank** — ver seção "Correção".

| Fato | Arquivo:linha |
|---|---|
| Fan-out por herói pede `size=6` builds na fonte | `apps/api/src/routes.js:257` |
| Cada registro traz `data.build[]` (lista de builds, não uma só) | `apps/api/src/routes.js:834`; `packages/proprietary-engine/src/builds/builds-aggregate.js:377-387` |
| Cada build traz até **6 itens** (`equipid[]` → `eq.slice(0, 6)`) + `build_win_rate` + `build_pick_rate` + emblema + feitiço + talentos | `apps/api/src/routes.js:843-855`; `builds-aggregate.js:294-375` |
| Ordem do array **não** é ordem de compra (invariante publicada) | `builds-aggregate.js:1326` ("Ordem do array não é ordem de compra") |
| Variantes que diferem só na ordem são agrupadas e marcadas (`order_only`) | `builds-aggregate.js:934-987` |
| `pick` é participação catalogada, não cobertura de partidas | `builds-aggregate.js:1321`; `coverage.pick_sum_status` |
| Suporte não tem N de partidas — é `k` contextos / `m` builds / `h` heróis | `builds-aggregate.js:1325` |
| Janela não se aplica a builds — só ordena heróis | `builds-aggregate.js:1241` (`window_applies_to: "hero_order_only"`) |
| "Core" é derivado: trincas (`triples`), pacotes, conjuntos 2–3 itens, núcleo parcial 3–4 de 6 | `builds-aggregate.js:600-681`, `688-...`, `1179-1192` |

## Correção (verificação empírica, 2026-10-21)

Medido no cache real da própria API (`apps/api/data/cache.sqlite`, chaves
`builds:raw:v1:*`, 21,7 h de idade, 10 heróis mythic/gold):

- **3 builds por herói+lane+rank** (10/10 contextos; 30 builds no total).
- **3 itens por build** (29 de 30); apenas 1 build com 4 itens. Nenhuma com 5 ou 6.
- `size=6` é ignorado/limitado pela fonte; `records=1` por herói e sem `data.total`
  → não há sinal de paginação de builds.
- Os `build_pick_rate` das 3 builds somam ~10% (ex.: 4,5% + 3,2% + 2,3%), ou seja: a
  fonte devolve **um top-3 curado**, não a distribuição de builds.
- Exemplo real (herói 94, mythic/gold): itens fixos `3013+3005` nas três builds; o
  terceiro item rotaciona (`3008` / `3012` / `3003`) e o emblema também muda
  (Assassin na 1ª, Marksman nas outras duas).

Consequências: "build completa de 6 slots" **não existe no payload**; "2 últimos itens"
não existe (só há 3 slots); substituição 5/6 é **impossível** (0 pares em 30 builds);
substituição 2/3 existe mas é rara (3 pares, todos em 1 dos 10 heróis).

## Decisão

1. **Builds é explorador de configurações reais**, não de "cores". O objeto principal é a
   **build de 3 itens + emblema + talentos + feitiço** dentro de um contexto
   `herói + lane + rank` (a forma que a fonte entrega).
2. **Comparação é sempre intra-contexto** (variante vs build modal / vs média do herói,
   `delta_wr_pp_*`, `delta_status`). Não existe ranking global de builds entre heróis —
   o que cruza contexto é padrão (`packages`, `sets`, `triples`) com gate de suporte `k/m/h`.
3. **Nunca exibir "ordem de compra"**. Rótulos permitidos: "Núcleo de N itens",
   "Núcleo parcial", "Itens da configuração".
4. **Sem eixo "situacional"**: a fonte não tem build × matchup × composição. A variação
   honesta disponível é *setup* (mesmo core, emblema/talentos/feitiço diferentes) —
   é isso que a área "Análise de setups" mostra.
5. **Cortar "Builds salvas / da comunidade"** do MVP: não existe storage de usuário nem
   endpoint de compartilhamento. Seria escopo novo (L3).
6. **Divisão de função** (evitar competir com o Dashboard):
   - Dashboard: força por rota + 3 itens mais associados + alertas. Consumo rápido.
   - Builds: exploração/comparação por abas — `Explorar` (`top_builds`, `variants`),
     `Itens e pacotes` (`items`, `packages`, `sets`, `triples`), `Runas e feitiços`
     (`emblems`, `rune_pages`, `talents`, `spells`), `Cobertura` (`coverage`, `cells`,
     `discovery_summary`) — todas mapeadas no payload de `/builds/aggregate`.
   - Herói → Builds: `variants` do herói + deltas + matchup (via `/heroes/:id/matchups`).

## Consequências

- Positivo: Builds ganha identidade (laboratório) sem inventar dado; a aba Builds do
  Dashboard (`components/dashboard/BuildsTab.tsx`, itemset por rota) deixa de ser a
  abertura de Builds e vira só o resumo de 3 itens por rota.
- Negativo/limite: sem N de partidas por build, "esta build é melhor" continua proibido;
  a UI fala em diferença descritiva (pp) e sensibilidade de peso.
- Risco assumido: comparação de variantes com `m` baixo (1–2 builds) pode parecer sólida;
  mitigação = `discovery_status`/`support` visíveis na linha, não em tooltip.

## Descartado

- "Nível 2 condicional (só quando houver build completa)": já há build completa hoje.
- Ranking cross-hero de builds por win rate poolado: viola unidade comparável e
  `pick` não validado.
- Aba "comunidade/salvas" no MVP: sem fonte.
