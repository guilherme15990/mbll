# Brief — Página Builds agregada (CTX-BDL) · QA / Produto

Data: 2026-10-20
Dono do brief: orquestrador
Destino: QA (análise de produto + viabilidade de API + orçamento de rate limit)

## 1. Pedido do usuário

A página `/builds` já existe no sidebar (BDL, Stream 2), mas hoje é **por herói + lane**.
O usuário quer uma **visão dedicada agregada do sistema** (não a aba do dashboard, que mostra top-3 heróis por rota).

Perguntas a responder antes de codar:

1. O que um **pro-player** quer ver nessa página?
2. O que um **admin do jogo** quer ver? (ex.: qual item está forte? quais conjuntos de itens de ataque físico, ataque mágico, defesa física, defesa mágica?)
3. O que a API permite **sem entrar em rate limit**, com que orçamento de requests e cache?
4. Quais métricas são honestas e quais seriam alucinação (sem N, sem ordem de compra, sem atribuição causal)?

## 2. Estado atual do código (ler)

- `apps/web/src/pages/Builds.tsx` — rota plana, só painel por herói.
- `apps/web/src/pages/panels/BuildsPanel.tsx` — painel por herói + lane; lista plana.
- `apps/web/src/components/dashboard/BuildsTab.tsx` — top-3 por rota; trincas; 3 requests de builds.
- `apps/web/src/pages/hero/sections/BuildsSection.tsx` — ficha por herói.
- `apps/api/src/routes.js` — `/v1/heroes/:id/builds` (lane obrigatória, size=6 fixo).
- `apps/api/src/arena.js` — cliente upstream, concorrência 4, timeout 12s, retry 3, failover só em 503 com `x-alt-host`.
- `apps/api/src/cache.js` — TTL A=2h, B=6h, C=24h + SWR; SQLite.
- `packages/proprietary-engine/src/builds/*` — `build-lift`, `build-tags`, `build-quadrant`, `itemsets`, `builds-ordering`.
- `packages/proprietary-engine/src/utils/thresholds.js` — cortes canônicos (popular 5%, raro 2%, lift 1,5%/2%).
- `AGENTS/artefatos/architecture/ADR-025-fronteira-unica.md` — fronteira única.

## 3. Fatos verificados na API viva (2026-10-20)

Base que respondeu melhor: `https://arena.fastapicloud.dev/api` (o mirror `https://arena.rone.dev/api` passou a devolver **500 HTML** após ~30–40 requests; o cliente atual só faz failover em 503 com header — isso é um risco P0 para agregados).

### 3.1 Builds (Academy)

`GET /api/academy/heroes/{id}/builds?lane=&rank=&size=&index=&lang=`

- Lane obrigatória (`exp|mid|roam|jungle|gold`).
- `size` pagina **registros de herói**, não builds; na prática retorna 1 registro com um array `build[]`.
- Cada build traz:
  - `equipid[]` **em ordem** (3 a 4 itens no sample; não é build completa de 6)
  - `build_pick_rate`, `build_win_rate`
  - `emblem.data`: `emblemid`, `emblemname`, `emblemattr.emblemattr` (texto de atributos), `emblemattr.emblemattrid`, `attriicon`
  - `battleskill.data`: `__data.skillname`, `__data.skillicon`, `__data.skilldesc`, `skillshortdesc`
  - `runeid`, `new_rune_skill[]` (3 ids de talentos)
  - `hero_name`, `real_road`
- **Sempre 3 builds por herói+lane** nos 12 heróis amostrados. Muitas vezes são o mesmo core de itens com ordem/talento/emblema/feitiço diferente.
- Sample Miya (id 1, gold): 3 builds, mesmos 3 itens; pick 11,65% / 3,30% / 10,98%; win 56,07% / 56,51% / 55,42%; talentos variam `[1211,621,132]` vs `[1211,621,1231]`.
- Pick por build **não soma 1** dentro do herói; é participação (slot share) e só uma fração das partidas usa builds catalogadas.

### 3.2 Catálogos

- `GET /api/academy/equipment?size=300` → 184 itens (`equipid`, `equipname`, `equipicon`).
- `GET /api/academy/equipment/expanded?size=200` → 152 itens com `equiptypename` (ex.: Defense, Roam, Attack, Magic), `equiptips` (stats legíveis), `equipskilldesc`.
  - Cobertura: os 75 itens únicos de 6 partidas pro amostradas estão **todos** no expanded.
  - Exemplo Oracle: type Defense; `+850 HP, +20 Def Física, +20 Def Mágica, +10% CDR`.
- `GET /api/academy/spells?size=200` → 12 feitiços com nome, ícone, descrição e short desc.
- `GET /api/academy/emblems?size=200` → 26 **talentos** (`giftid`, `gifttiers` 1–3, `emblemskill.skillname`, `numdescribe`, descrição). Permite decodificar `new_rune_skill[]` / talents do esports.
- **Gap:** não há catálogo documentado dos *emblemas* (sets) 20001/20003/20005/20006/20007/20008/20012; o nome aparece no payload de builds (`emblemname`), mas não há endpoint de set. Mapear por builds ou por dicionário local.
- `GET /api/academy/heroes?lane=X&size=200` → lista de heróis da lane em **1 request por lane** (substitui o fan-out atual de até 133 chamadas em `/heroes/lanes`).
- `GET /api/heroes/positions?size=200` → 133 heróis com `roadsort[]`, `sortid[]` (roles) e relações strong/weak/assist em **1 request**. Contagem por lane: exp 42, roam 37, jungle 36, mid 29, gold 21 (herói pode ter mais de uma lane).

### 3.3 Esports (dados pro, por partida)

- `GET /api/esports/id/schedule` → 72 partidas em 9 semanas (70 com `match_id`).
- `GET /api/esports/id/matches/{match_id}` → por game: duração, vencedor, e por jogador: herói, KDA, **6 itens finais**, emblema (id), 3 talentos (ids), ouro, dano causado/sofrido, dano em torre. `item_sequence` veio vazio.
- Amostra de 3 partidas = 6 games, 60 jogador-games, 75 itens únicos.
- Não há feitiço de batalha no esports (“Battle spells are not published by the league site”).
- Itens são **inventário final**, não ordem de compra; não há dano por item.
- Fonte diferente da Academy: população pro, não ranked. Não misturar sem rótulo.

### 3.4 Custo / rate limit observado

- `ARENA_CONC=4`; retries 3 com backoff; timeout 12s.
- Agregado “top N heróis de uma lane” = N requests de builds (1 por herói) + 1 lista da lane + catálogos cacheados.
- Lane completa: exp 42 / roam 37 / jungle 36 / mid 29 / gold 21 requests de builds.
- Esports: 1 schedule + 1 request por partida (70) para uma temporada; cache upstream 5 min, ideal ingestão periódica + cache própria longa.
- O mirror rone.dev devolveu 500 após rajada; fastapicloud seguiu OK. Medir e propor orçamento conservador.

## 4. Restrições de honestidade (não violar)

- Sem N de partidas por build; `pick` é `slot_share` não validado.
- 3 builds por herói (não é o universo completo); 3–4 itens por build (não é build de 6).
- Lift é associação descritiva (Camada A), nunca causal; `lift_adjusted`/`causal_build_lift` são NULL.
- Não ordenar builds de heróis diferentes como “a melhor build do jogo” sem qualificar.
- Não inferir ordem de compra dos itens da Academy (a ordem do array pode ser significado, mas não está documentado); no esports não há ordem.
- UGC (`/academy/heroes/{id}/recommended`) é guia de comunidade, não evidência estatística; se entrar, em aba/seção separada e rotulada.
- `exposure.status = unvalidated` permanece.

## 5. Entregável do QA

Criar `AGENTS/artefatos/qa/builds-aggregate-qa.md` com:

1. **Jobs-to-be-done** separados para pro-player e admin do jogo (o que cada um decide com a tela).
2. **Blueprint da tela**: blocos ordenados, pergunta que cada bloco responde, fonte de dados, estados vazio/erro/loading, o que NÃO entra.
3. **Matriz de capacidade da API**: endpoint, campos usados, cache, custo em requests, cobertura, gaps.
4. **Definições de métrica** (com fórmula, mínimo de suporte, confundidores e rótulo):
   - força de item (presença, win rate, lift vs baseline do herói/lane, eficiência dano/ouro no pro);
   - conjuntos de itens por arquétipo (ataque físico, ataque mágico, defesa física, defesa mágica) usando `equiptypename`/`equiptips`;
   - sinergia de itens (coocorrência no mesmo jogador/build + win rate), com aviso de confundimento;
   - adoção e lift por feitiço/emblema/talentos;
   - quadrantes popularidade × lift e tags existentes;
   - variantes do mesmo core (ordem/talento/emblema) vs core diferente.
5. **Orçamento de rate limit**: frio/quente, top-10/top-20/lane completa, 5 lanes, ingestão pro, cache, concorrência, abort, sem prefetch, failover 5xx. Números explícitos.
6. **Corte recomendado**: MVP agora / fase 2 / nunca (com justificativa).
7. **Plano de teste QA**: invariantes com IDs (INV-BDL-AGG-XXX), cenários de borda (fonte 500, lane sem builds, herói sem lane, build com <3 itens, item sem catálogo, talento sem catálogo, esports com jogo incompleto, sample insuficiente).

Não escrever código de produção. Análise e especificação apenas.

---

## 6. Atualização 2026-10-21 — revisão incorporada

O cálculo agregado foi movido para packages/proprietary-engine/src/builds/builds-aggregate.js e é exportado por @radar/proprietary-engine.
A rota /v1/builds/aggregate usa o motor, cache uilds:agg:v2:* e retorna 200 + partial:true (não 206).

Mudanças de contrato: delta_wr_pp_* (pontos percentuais), packages vs packages_provisional, 	riples, discovery_summary, sets_summary, pattern_scope, discovery_status, weighting_sensitivity e metrics.
Ordem da UI: Descobertas → Itens e arquétipos → Desempenho observado/variantes → Emblemas/talentos/feitiços → Fase 2 (Pro MPL + sinergia par-a-par).
Detalhamento completo na seção 0.2 de uilds-aggregate-qa.md.

---

## 7. Especificação canônica (2026-10-21)

- Fórmulas e contrato: `AGENTS/artefatos/spec/builds-aggregate-engine-rules.md`
- Textos e simplificação para o jogador: `AGENTS/artefatos/spec/builds-aggregate-ui-copy.md`

Em conflito com este brief, valem os dois arquivos de spec.
