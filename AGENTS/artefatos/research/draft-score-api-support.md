# Suporte da Rone Arena API ao Draft Score

- **API:** Rone Arena API (não oficial) — spec `openapi.json`, `info.version = "1.1.0"` [SPEC]
- **Host válido:** `https://arena.fastapicloud.dev` [LIVE] — `GET /api/heroes/rank?rank=mythic&days=7&size=5&lang=pt` retornou HTTP 200 com `code:0` [LIVE]
- **Host inválido:** `https://openmlbb.fastapicloud.dev/api/heroes` retornou HTTP 404 [LIVE]
- **Envelope:** `{code, message, data, traceID}`; listas em `data.records` + `data.total` [LIVE]
- **`servers`:** ausente em `openapi.json` — o host precisa ser fixado no cliente [SPEC]
- **Convenção de tags:** `[SPEC]` = `openapi.json` (cita path/campo); `[LIVE]` = requisição real ao host acima; `[INFERÊNCIA]` = dedução nossa.

---

## 1. Resumo executivo — 5 achados mais críticos

1. **`increase_win_rate` tem semântica não documentada e confundível.** Não é `(hero_win_rate − main_hero_win_rate)`, nem `(hero_win_rate − 0.5)`, nem contra baseline global [LIVE]. Em `/heroes/1/counters` (`main_hero_win_rate=0.501404`), `heroid 3` → `increase_win_rate=0.02906` mas `hero_win_rate − main = 0.0108` e `hero_win_rate − 0.5 = 0.0122` [LIVE]. Também ocorre `increase_win_rate` positivo com `hero_win_rate` do par **abaixo** do main (`/compatibility`, `heroid 73`: `increase=+0.0115`, `hero_win_rate=0.4522 < 0.5011`) [LIVE]. **Decisão:** tratar apenas como Δ direcional (sinal), nunca como `WR(par) − baseline`.

2. **Contaminação confirmada no app antigo: `sub_hero` de `/heroes/rank` é counter, não sinergia.** Para o herói 1, `rank.sub_hero` é idêntico (IDs e valores) ao `counters.sub_hero` do mesmo herói: `[3→0.02906, 130→0.024819, 43→0.021557, 80→0.018371, 104→0.018084]` [LIVE]. O app lia isso como compatibilidade; sinergia real só existe em `/compatibility` (que o app nem chamava) [LIVE].

3. **`counters` é perfeitamente antissimétrico.** `counters(1)` lista `3` com `increase=+0.02906`; `counters(3)` lista `1` com `increase=−0.02906` [LIVE]. Isso valida o uso de `increase_win_rate` como Δ direcional em matchups.

4. **Cobertura de pares é fixa em top-5 / bottom-5 e não paginável.** `/counters` e `/compatibility` retornam sempre 5 itens em `sub_hero` e 5 em `sub_hero_last`, mesmo com `size=20` [LIVE]. Ausência = desconhecido, **nunca** zero → o Draft Score terá termos de par ausentes para a maioria de 5v5 [INFERÊNCIA].

5. **Todas as taxas vêm como fração 0–1 e NÃO existe campo de contagem amostral (N).** Ex.: `main_hero_win_rate=0.604563`, `main_hero_ban_rate=0.246956`, `sub_hero[0].increase_win_rate=0.039141` [LIVE]. Nenhum endpoint testado expôs contagem/intervalo; o único agregado é `data.total=133` (nº de heróis) [LIVE]. **Decisão:** usar `pick` (appearance) como proxy de N [INFERÊNCIA].

---

## 2. Tabela de necessidades do Draft Score

| Necessidade | Endpoint | Status | Evidência | Plano B |
|---|---|---|---|---|
| WR / pick / ban por rank e janela | `GET /api/heroes/rank?days&rank&sort_field&sort_order&size&index&lang` | **Suportado** | [SPEC] path + params; [LIVE] `main_hero_win_rate`, `main_hero_appearance_rate`, `main_hero_ban_rate`, `main_heroid`. Por janela (herói de maior WR mythic): days 1→0.6065/0.0040/0.2223; 7→0.6046/0.0043/0.2470; 30→0.6011/0.0062/0.3606 [LIVE] | Fixar janela `days=7` como padrão (padrão do app antigo) e rank configurável |
| Sinergia com aliados | `GET /api/heroes/{id}/compatibility?days&rank` | **Parcial** | [SPEC] path; [LIVE] só `sub_hero`/`sub_hero_last`, top-5/bottom-5, `increase_win_rate` não documentado; sem campo de N | Usar `increase_win_rate` como Δ direcional; marcar ausência como desconhecido; cache |
| Matchup contra inimigos | `GET /api/heroes/{id}/counters?days&rank` | **Parcial** | [SPEC] path; [LIVE] antissimétrico (`1`↔`3`, ±0.02906), `sub_hero`=positivo/`sub_hero_last`=negativo; top-5/bottom-5 | Δ direcional; ver V4 para direção |
| Relações editoriais | `GET /api/heroes/{id}/relations`; `GET /api/heroes/positions` | **Parcial** | [SPEC] paths; [LIVE] `relation.{assist,strong,weak}.target_hero_id` (IDs, sem magnitude, contém `0`): hero 1 assist `[6,70,0]`, strong `[3,15,27]`, weak `[52,101,0]` | Usar só como prior/desempate; filtrar `0`; sem força |
| WR por lane | `GET /api/academy/heroes/{id}/win-rate/timeline?lane&rank` | **Parcial** | [SPEC] path (lane obrigatório); [LIVE] `real_road`, `total_win_rate`, `time_win_rate[6]`; lanes não principais ruidosas (hero 17 roam 0.2914) | `lane` obrigatório; ponderar por incerteza; sem N por lane |
| WR por tempo (duração) | `GET /api/heroes/{id}/counters` e `/compatibility` (campos `min_win_rate6..min_win_rate20`); `.../stats` (mesmos campos) | **Parcial** | [SPEC]/[LIVE] faixas `min_win_rate6`, `_6_8`, `_8_10`, `_10_12`, `_12_14`, `_14_16`, `_16_18`, `_18_20`, `_20`; `min_win_rate6` pode ser `0` (ausente ou real 0 — ambíguo) | Tratar `0` como incerto; só para pares presentes no top/bottom-5 |
| Lanes do herói | `GET /api/academy/heroes/{id}/lane`; `GET /api/heroes/positions` (`hero.data.roadsort[]`) | **Suportado** | [SPEC] paths; [LIVE] `road_sort_id="5"`, `road_sort_title="Gold Lane"` (`金币路`); positions traz `sortid`, `smallmap` | Mapear `road_sort_id`→lane; ver V9 |
| Tendência | `GET /api/heroes/{id}/trends?rank&past-days` | **Parcial** | [SPEC] path; [LIVE] `win_rate[]` com `{date, app_rate, ban_rate, win_rate}` (série temporal, sem N) | Usar como sinal de tendência; não como série estatística rigorosa |
| Papéis | `GET /api/academy/roles`; `GET /api/heroes/positions?role&lane` | **Parcial** | [SPEC] paths + params `role`,`lane`; [LIVE] positions filtra por `role`/`lane` (formato do registro de positions) | Cruzar `role`/`lane` com lanes do herói |
| Versão do jogo | `GET /api/academy/meta/version` | **Suportado** | [SPEC] path; [LIVE] `data.records[0].data.game_version = "2.1.18"` | Chave de invalidação de cache |

---

## 3. Checklist V1–V12

- [x] **V1 — Semântica de `increase_win_rate`.** Testado `/heroes/1/counters`, `/compatibility`, `/heroes/rank`. Resultado: **NÃO** é `(hero_win_rate − main_hero_win_rate)` (0.0108 vs 0.02906), nem `(hero_win_rate − 0.5)` (0.0122), nem contra baseline global [LIVE]. Descoberta: `hero_win_rate` dos pares é **exatamente o WR global do herói par** (confirmado em `/heroes/rank`: heroid 3→0.512209, 130→0.53959, 43→0.533345) [LIVE]. Em `/compatibility` há `increase` positivo com `hero_win_rate` abaixo do main (heroid 73: +0.0115 vs 0.4522<0.5011) [LIVE]. Centrado em zero: média simples das 10 linhas do hero 1 ≈ 0.0009; ponderada por pick ≈ 0.0052 [LIVE]. **Decisão:** Δ direcional (sinal), nunca `WR(par) − baseline`.

- [x] **V2 — Simetria.** `counters` é **antissimétrico perfeito**: `counters(1)`→`3` com `+0.02906`; `counters(3)`→`1` com `−0.02906` [LIVE]. Compatibilidade: **não confirmada** — o top-5 do par recíproco raramente contém o outro (B não listou A) [LIVE]. **Decisão:** usar antissimetria de counters como garantia de sinal; compatibilidade fica sem garantia de simetria (cobertura).

- [x] **V3 — Cobertura.** Endpoints de par retornam **sempre exatamente 5** em `sub_hero` e 5 em `sub_hero_last`, mesmo com `size=20` [LIVE]. Ausência = desconhecido, **nunca** zero. **Decisão:** modelar termos de par ausentes como incerteza; não penalizar/recompensar por ausência.

- [x] **V4 — Direção em counters.** `sub_hero` = heróis contra os quais o avaliado tem aumento **positivo** (leva vantagem); `sub_hero_last` = aumento **negativo** [LIVE]. Cruzando editoriais do hero 1 (`strong=[3,15,27]`, `weak=[52,101]`): heroid 3 (strong) aparece em `sub_hero` com `+0.02906` (consistente); `52/101` fora do top/bottom-5 (ausentes) [LIVE]. **Decisão:** `sinal(increase)` define vantagem; direção validada.

- [x] **V5 — `rank.sub_hero` vs `compatibility`.** `rank.sub_hero` de um herói é **idêntico** ao `counters.sub_hero` do mesmo herói (hero 1: `rank` = counters top-5) [LIVE]. O app antigo lia `sub_hero`/`sub_hero_last` de `/heroes/rank` como **sinergia** → contaminado com dados de **confronto** [LIVE]. **Decisão:** sinergia só de `/compatibility`; remover leitura de `sub_hero` do rank como compat.

- [x] **V6 — Janela e rank.** Herói de maior WR mythic: days 1→0.6065/0.0040/0.2223; 7→0.6046/0.0043/0.2470; 30→0.6011/0.0062/0.3606 — pick e ban **crescem** com a janela (acumulação), WR estável [LIVE]. Por rank (`days=7`): all 0.6106/0.0053; epic 0.5652/0.0043; mythic 0.6046/0.0043; glory 0.6191/0.0083 [LIVE]. **Decisão:** rank muda o WR materialmente → sempre segmentar por rank; cuidado ao comparar pick/ban entre janelas.

- [x] **V7 — Tamanho amostral.** **Nenhum** campo de contagem/N/intervalo em nenhum endpoint testado [LIVE]. Chaves do registro `/heroes/rank`: `[main_hero, main_hero_appearance_rate, main_hero_ban_rate, main_hero_channel, main_hero_win_rate, main_heroid, sub_hero]` [LIVE]. Só existe `data.total=133` (nº de heróis) [LIVE]. **Decisão:** usar `appearance` (pick) como **proxy de N**; documentar incerteza residual.

- [x] **V8 — Escala.** Todas as taxas vêm como **fração 0–1** (`0.604563`, `0.004303`, `0.246956`, `0.039141`) [LIVE]. A heurística `normalizeRate`/`normalizeImpact` do app antigo (multiplicar por 100 se ≤1) é **desnecessária e frágil** [LIVE]/[INFERÊNCIA]. **Decisão:** remover a heurística; usar frações nativamente.

- [x] **V9 — Lane (`real_road` / `road_sort_id`).** `timeline` **exige `lane`** [SPEC]/[LIVE]. Mapa `real_road` descoberto: exp→1, mid→2, roam→3, jungle→4, gold→5 [LIVE]. `road_sort_id="5"` = Gold Lane (`金币路`) [LIVE]. Cobertura: 7 heróis (1,17,20,60,66,104,130) com 5 lanes × 6 pontos e `total_win_rate` por lane (Miya gold 0.5081, exp 0.4625, mid 0.4352, roam 0.4132, jungle 0.4101) [LIVE]. Lanes fora da principal são extremas/ruidosas (hero 17 roam 0.2914), provável amostra pequena, e **não há campo de N por lane** [LIVE]. **Decisão:** mapear `real_road`↔`road_sort_id`; ponderar lane principal; tratar lanes secundárias com incerteza.

- [x] **V10 — Navegador (CORS, rate limit, latência, payload).** CORS **permitido**: com `Origin: http://localhost:5173` a API devolveu `access-control-allow-origin: http://localhost:5173`, `access-control-allow-credentials: true`, `vary: Origin`; preflight `OPTIONS` = 200 com `allow-methods DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT,QUERY` [LIVE]. Sem `Origin`, o header não aparece [LIVE]. Sem header de rate-limit observado; `server: cloudflare` [LIVE]. **Decisão:** usar direto do navegador é possível, mas `allow-credentials: true` + reflexo de qualquer origem significa que qualquer site pode chamar → manter proxy `/v1` como arquitetura recomendada [LIVE]/[INFERÊNCIA].

- [x] **V11 — Paginação.** `size=500` em `/heroes/rank` retornou **133** registros (`total=133`, dataset inteiro); `index=2` retornou **0** registros [LIVE]. `size` é limitado pelo total; `index>1` vazio nesse endpoint. `data.total` presente [LIVE]. **Decisão:** buscar `size` alto de uma vez (dataset pequeno, 133) e não depender de paginação.

- [x] **V12 — Consistência.** `/heroes/1/stats` vs `/academy/heroes/1/stats` **divergem levemente**: `main_hero_win_rate` 0.500669 vs 0.501119; `appearance` 0.023722 vs 0.023642; `ban` 0.071176 vs 0.070308; e as **listas `sub_hero` são diferentes** (heroes/stats: 20,94,76,39,23; academy/stats: 73,104,20,17,10) [LIVE]. **Decisão:** não misturar as duas famílias; marcar a origem no dado.

---

## 4. Plano de chamadas e estimativa de custo

Premissas: pool de 133 heróis [LIVE]; taxas em fração 0–1 [LIVE]; ausência de par = desconhecido [LIVE].

**A. Carga única de rank (base de WR/pick/ban).**
- `GET /api/heroes/rank?rank={rank}&days=7&size=500&sort_field=win_rate&sort_order=desc&lang=pt`
- Retorna o dataset inteiro (133 registros) em **1 chamada** [LIVE].
- Custo: **1 request / rank** por sessão. Cache por `(rank, days)`.

**B. Carga sob demanda por seleção (durante o draft).**
- Contra inimigos: para cada herói **selecionado por nós**, buscar `GET /api/heroes/{id}/counters?days=7&rank={rank}`.
- Com aliados: para cada herói nosso, buscar `GET /api/heroes/{id}/compatibility?days=7&rank={rank}`.
- Pior caso por pick: **até 5 inimigos** (counters) + **até 5 aliados** (compatibility) = **até 10 requests por pick** [INFERÊNCIA].
- Alternativa mais barata: buscar só pelo herói que acabou de ser escolhido e reusar seus pares (top-5/bottom-5) contra a composição atual → **1–2 requests por pick** [INFERÊNCIA].

**C. Cache e invalidação.**
- Chave de cache: `(heroid, days, rank)` para counters/compatibility; `(rank, days)` para rank; `(heroid, lane, rank)` para timeline.
- Invalidação por `game_version` (`GET /api/academy/meta/version` → hoje `"2.1.18"`) [LIVE]: se mudar, limpar todo o cache.
- `size=500` já entrega o dataset inteiro → sem loops de paginação [LIVE].

**D. Orçamento típico de um draft completo** (5 nossa escolha + 5 inimigos, estratégia "1–2 por pick"): ~**10–20 requests** [INFERÊNCIA]; estratégia agressiva "todos contra todos" (A: 5 counters + B: 5 compatibility por herói): até ~50 requests [INFERÊNCIA].

---

## 5. Limitações

1. **Sem tamanho amostral (N).** Nenhum campo de contagem/intervalo em nenhum endpoint; `data.total` conta heróis (133), não partidas [LIVE]. Mitigação: `appearance` como proxy de N [INFERÊNCIA].
2. **Cobertura de pares fixa em top-5 / bottom-5**, não paginável (mesmo com `size=20`) — a maioria dos pares de um 5v5 estará ausente [LIVE]. Ausência ≠ zero.
3. **Semântica de `increase_win_rate` não documentada.** Não é diferença de WR contra baseline; só o sinal/direção é utilizável [LIVE]. Em `/compatibility` também não é `hero_win_rate − main` [LIVE].
4. **Relações editoriais sem magnitude** e com placeholder `0` na lista (`assist [6,70,0]`) — servir como prior, filtrando `0` [LIVE].
5. **`min_win_rate6` pode ser `0`** (ausente ou real 0, ambíguo) [LIVE].
6. **Duas famílias de stats divergentes** (`/heroes` vs `/academy`) — listas `sub_hero` diferentes e taxas levemente distintas [LIVE]; não misturar sem marcar origem.
7. **Lanes secundárias ruidosas** e sem N por lane (ex.: hero 17 roam 0.2914) [LIVE].
8. **Host não vem de `servers`** (`undefined` no spec) [SPEC]; sem `Origin` não há header CORS [LIVE] — fixar host e manter proxy `/v1`.
