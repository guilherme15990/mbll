# hero-engine-v2 — threat review leve (engine estatística pura)

- **Escopo:** `packages/proprietary-engine/src/hero/score-heroes.js`, `src/hero/hero-trend.js`, `src/counters/duration.js`, `src/builds/build-lift.js`, `engine-config.json`. Spec V2 §§5, 16, 21.
- **Contexto:** pacote `@radar/proprietary-engine`, funções puras sem I/O (verificado por grep em `src/`: nenhum `fetch`/`jsonwebtoken`/`sql`/`eval`/`Function(`; única menção a JWT é comentário em `src/personal/playstyle.js:3`, fora do escopo).
- **Fio de exposição verificado:** `apps/api/src/routes.js:166` (`scoreLot` → `scoreBatch`); `rawRows` vem de `fetchRankAll()` (snapshot server-side, `routes.js:224,252`) ou cache fallback (`routes.js:234,239`) — **não** de `req.body` direto. Usuário controla só `rank`/`window` (allowlist `RANKS`/`WINDOWS`, `routes.js:250`). Prior vem de `lastVerifiedPosterior()` (evidência própria), nunca do cliente. `trendOfDated`/`durationCurve`/`buildLift` operam sobre dados upstream já buscados, não sobre input cru do usuário.
- **Data:** 2026-10-11. Revisor: security-reviewer.

## 1) Veredito

**SEM CRITICAL. SEM HIGH.** Zero CRITICAL aberto — critério Done atendido sem mitigação bloqueante.

Justificativa: sem I/O, sem authN/authZ, sem SQL/NoSQL/comando, sem `dangerouslySetInnerHTML`, sem CSRF (nada de mutação), sem secrets, sem uploads neste escopo. Auth (JWT só em `/api/user/*` deprecated, Spec §21), snapshots imutáveis / `payload_hash` / `fetched_at` (§§5, 16) são responsabilidade da camada API/cache, não da engine — engine recebe o lote já materializado e nunca assina nem valida snapshot.

Achados abaixo são todos **LOW** (1× **MEDIUM** integridade, sem explorabilidade remota direta): robustez de parsing, colisão de dedup, eco de campo, DoS algorítmico teórico com input server-side limitado (~130 heróis / 5–30 pontos de trend).

| Checklist | Resultado |
|---|---|
| AuthN/AuthZ | N/A — engine pura, sem token/sessão. Prior validado por `isValidWalkPrior` (`walkforward.js:16-23`), origem server-side |
| IDOR | N/A — sem objeto por ator; `...h` ecoa só a própria linha do lote |
| Injection (SQL/NoSQL/comando) | N/A — nenhuma query/construção de comando |
| XSS | N/A na engine; 1× eco (`refKind`, S10) anotado como defesa-em-profundidade p/ UI |
| CSRF | N/A — sem mutação |
| Secrets | N/A — `engine-config.json` só constantes públicas (versões, quantis, `c_reference`), nenhum segredo |
| Exposição | OK com 2 ressalvas LOW (eco de `id` S03, `quarantined` invisível no fio S07) |
| Uploads | N/A |
| Rate limit / paginação | Borda, não engine: `paginate` server-side (`routes.js:215` `slice`), `dropped_reasons.slice(0,50)` (`score-heroes.js:135`) limita bloat |

## 2) Achados

### S01 — `JSON.stringify` fallback de dedup pode lançar (DoS não-capturado) — LOW
- **Arquivo:** `src/hero/score-heroes.js:110` — `String(h.id ?? h.hero_id ?? JSON.stringify([h.win, h.pick, h.ban]))`.
- **Exploração (requer chamador passando objeto vivo, não JSON):** `scoreBatch([{ win: 10n, pick: 0.1, ban: 0.1 }])` → `JSON.stringify` lança `TypeError: Do not know how to serialize a BigInt` (não há try/catch) → exceção propaga e derruba `scoreLot` (sem try no caminho `/heroes/:id`, `routes.js:252`). Mesmo vetor com referência circular (`h.win = {}; h.win.self = h.win`). Via JSON HTTP puro o vetor não existe (JSON não tem BigInt/circular), e o fio real alimenta de snapshot server-side — por isso LOW, não HIGH.
- **Colisão funcional (integridade, mesmo root cause):** dois heróis distintos sem `id`/`hero_id` e mesma tripla `(win,pick,ban)` geram a mesma chave → o 2º é descartado como "duplicata" (`n_duplicates_dropped++` sem motivo por linha). Silencioso e indistinguível de dedup real.
- **Correção (L1, sem mudar semântica):**
  ```js
  function dedupKey(h) {
    const id = h.id ?? h.hero_id;
    if (typeof id === "string" || typeof id === "number") return `id:${id}`;
    try {
      const s = JSON.stringify([h.win, h.pick, h.ban]);
      return typeof s === "string" ? `fp:${s}` : "fp:unserializable";
    } catch { return `fp:unserializable:${Math.random()}`; } // nunca lançar, nunca colidir
  }
  ```
  Alternativa mínima: embrulhar só a linha 110 em try/catch e usar chave única no catch. Registrar `reason: "dedup_key_unserializable"` em `dropped_reasons`.

### S02 — `scoreBatch` assume array iterável (TypeError / `n_dropped: NaN`) — LOW
- **Arquivo:** `src/hero/score-heroes.js:100,105,133` — `const input = rawHeroes ?? []; for (const h of input)` + `n_dropped: input.length - n`.
- **Exploração:** `scoreBatch({})` / `scoreBatch("x")` → `for...of` lança (objeto não-iterável) ou itera chars (string); `scoreBatch({ length: undefined })` → `n_dropped: NaN` no `meta` (número inválido no fio). Chamadores atuais sempre passam array (`fetched.rows`, `hit.body`), então só afeta reuso futuro/testes.
- **Correção (L1):** `const input = Array.isArray(rawHeroes) ? rawHeroes : [];` — lote não-array vira `{ heroes: [], meta: { n: 0, ... } }` em vez de exceção.

### S03 — Eco de `id` sem sanitização (bloat / log injection) — LOW
- **Arquivo:** `src/hero/score-heroes.js:107,118,135` — `dropped_reasons.push({ id: h.id ?? null, reason })`, `dropped_reasons.slice(0,50)`.
- **Exploração:** `id` com objeto de 1 MB (`{id: {blob: "A".repeat(1e6)}}`) é ecoado integral ao `meta` → resposta inchada (o `slice(0,50)` limita contagem, não tamanho). `id` string com `\r\n` / ANSI escapes → log injection se `meta` for logado sem sanitizar. `id: "__proto__"` é seguro como chave porque `seen` é `Map` (não plain object) — verificado, sem pollution por esta via.
- **Correção (L1):** sanitizar o eco: só escalares, truncados, ex.:
  ```js
  const safeId = (typeof h.id === "string" || typeof h === "object") && (typeof h.id === "string" || typeof h.id === "number")
    ? String(h.id).slice(0, 64) : null;
  ```

### S04 — `...h` spread e prototype pollution — NÃO-ACHADO (documentado como prova)
- **Arquivo:** `src/hero/score-heroes.js:237-238` (`{ ...h, wrAdj, ... }`).
- **Análise:** object spread usa `CreateDataProperty`, não assignment — `JSON.parse('{"__proto__":{"polluted":1}}')` espalhado cria *own property* `__proto__`, não altera `Object.prototype`. `seen` é `Map`, `byDate` em trend é `Map` — nenhuma escrita em plain object indexado por chave atacante. Campos do motor (`wrAdj/tier/z/q/...`) são atribuídos **depois** do spread, então input malicioso não sobrescreve saída calculada. Eco de campos extras (`...h`) é comportamento documentado no contrato (linha 55), não vazamento — mas UI deve allowlistar campos que renderiza (ver S10).

### S05 — `Date.parse` com data malformada — NÃO-ACHADO (filtro correto) + endurecimento opcional LOW
- **Arquivo:** `src/hero/hero-trend.js:43-46,60` — `toDay` retorna `NaN` p/ malformada; linha 60 `if (!Number.isFinite(day) || !Number.isFinite(v)) continue;`.
- **Prova:** `"not-a-date"`, `""`, `undefined`, `"2024-13-40"` → `Date.parse` = `NaN` → `continue` (quarentena silenciosa, contada só via `n_points` menor). Sem `NaN` vazando p/ inclinações.
- **Ressalvas LOW (não bloqueantes):** (a) `Date.parse` em string de 10 MB = CPU desperdiçada — capar `String(p.date).slice(0, 64)` antes de parsear; (b) `p.date` numérico (epoch ms) é reinterpretado como string de data (ex.: `Date.parse("1717977600000")` = NaN → linha descartada em vez de convertida) — correção é de corretude, não segurança: aceitar número finito como `ms/86400000` ou rejeitar explicitamente com motivo; (c) `valueKey` param (`trendSeriesDated(points, {valueKey})`, linha 53/59) — `p[valueKey]` com `valueKey="__proto__"`/`"constructor"` devolve prototype → `Number()` = `NaN` → filtrado, sem exploit; ainda assim allowlistar (`["win","value","win_rate"]`) na borda se um dia vier de query param (hoje é constante interna, `hero-trend.js:104-106`).

### S06 — Complexidade O(m²) sem teto (trend + duration) — LOW
- **Arquivo:** `src/hero/hero-trend.js:71-77` (pares `m(m-1)/2` em `slopes`), `src/counters/duration.js:52-53` (mesmo padrão), `src/hero/score-heroes.js:218-221` (sorts O(n log n)).
- **Exploração:** `trendSeriesDated` com 100k pontos → ~5 bi de slopes → OOM. Fio real: 5–30 pontos por série (`TREND_N=5`), curva de duração fixa em 9 bandas, lote ~130 heróis — inexplorável hoje. Risco só se upstream for comprometido ou função for exposta a input arbitrário.
- **Correção (L1, defesa em profundidade):** teto explícito + erro honesto, ex.: `const MAX_TREND_POINTS = 366; if ((points?.length ?? 0) > MAX_TREND_POINTS) throw/return insufficient_data;` idem `MAX_BATCH = 1000` em `scoreBatch` e `classifyDuration`. Custo zero no caminho normal.

### S07 — `durationCurve`: `out.quarantined` em array some no JSON (quarentena invisível) — MEDIUM (integridade)
- **Arquivo:** `src/counters/duration.js:29` — `out.quarantined = quarantined` anexa propriedade a array.
- **Exploração/prova:** `JSON.stringify([{...}, ...])` **ignora** props extras de array → `quarantined: [{key, reason: "rate_out_of_range"}]` nunca chega ao fio/cache/log. Efeito: taxa `53` é corretamente excluída da curva (linha 20-23, bom), mas a exclusão é **inauditável** — viola o espírito de Spec §5 (quarentena com motivo) e diverge de `scoreBatch`, que expõe `dropped_reasons` no `meta`.
- **Correção (L1, breaking-shaped — coordenar com API):** retornar objeto `{ curve, quarantined }` ou anexar ao `meta` no chamador (`routes.js:384`). Mínimo imediato: `durationCurveV2`-style com `evidence` + logar quarentena server-side até migrar o formato.

### S08 — `durationCurve` aceita strings numéricas; `scoreBatch` rejeita — inconsistência LOW
- **Arquivo:** `src/counters/duration.js:18` (`Number(raw)` aceita `"0.5"`) vs `src/hero/score-heroes.js:41` (`typeof v === "string"` → `rate_missing`).
- **Efeito:** mesma fonte com `win: "0.53"` (string) é quarentenada num módulo e aceita no outro — dificulta auditar unidade `53` vs `0.53` (EC-001). Não é injeção (coerção `Number` não executa código).
- **Correção (L1):** replicar a política estrita do `dropReason` em `durationCurve` (rejeitar strings não-vazias) ou centralizar no normalizador único `normalize/rates.js` já previsto no audit (INV-002).

### S09 — `buildReferences` sem validação [0,1] (diverge de `buildLift`) — LOW
- **Arquivo:** `src/builds/build-lift.js:19` — `filter((b) => Number.isFinite(b?.win) && Number.isFinite(b?.pick))`, sem checar faixa; `buildLift` (linhas 12-14) rejeita `∉[0,1]`.
- **Exploração:** `buildReferences([{win: 53, pick: 0.5}])` → `heroMean` contaminada (≈53) → `refMean` alimenta `buildLift({refWin: 53})` que então retorna `null/inconclusive` (linhas 12-14 salvam o fio final) — ou seja, o dano é degradar referência para `null`, não fabricar lift espúrio. Por isso LOW.
- **Correção (L1, 1 linha):** `Number.isFinite(b?.win) && b.win >= 0 && b.win <= 1 && Number.isFinite(b?.pick) && b.pick >= 0 && b.pick <= 1`.

### S10 — `buildLift.refKind` ecoado sem allowlist (XSS refletido se UI interpolar em HTML) — LOW
- **Arquivo:** `src/builds/build-lift.js:7-15` — `reference_kind: refKind` ecoa string arbitrária do chamador em todos os retornos.
- **Exploração:** requer UI insegura (`innerHTML` com `reference_kind`), engine sozinha não executa HTML. Chamadores atuais passam literais (`routes.js:464-465` `"mais-usada"`/`"media-do-heroi"`). Ainda assim, eco irrestrito é vetor clássico.
- **Correção (L1):** allowlist: `const RK = ["mais-usada","media-do-heroi","comparavel"]; refKind = RK.includes(refKind) ? refKind : "desconhecida";`

## 3) Recomendações (fora do gate, ordenadas por custo-benefício)

1. **Teto de lote + série (S02/S06):** `MAX_BATCH=1000` em `scoreBatch`, `MAX_TREND_POINTS=366` em `trendSeriesDated`, `MAX_CURVE=32` em `classifyDuration` — erro honesto (`insufficient_data` / `status: 413` na borda), nunca truncar em silêncio. Cobre DoS futuro se engine for exposta a input direto.
2. **Sanitização de `id` (S03):** helper único `safeId()` (escalar + `slice(0,64)`) usado em `dropped_reasons` e logs; nunca ecoar objeto cru no `meta`.
3. **Chave de dedup à prova de throw (S01):** try/catch + prefixo `id:`/`fp:` + fallback único; considerar `duplicate_reasons` por linha (hoje duplicata só incrementa contador, sem rastro — dificulta forense de snapshot duplicado).
4. **Transporte de quarentena (S07):** migrar `durationCurve` para `{ curve, quarantined }`; até lá, log server-side da quarentena em `routes.js:384`.
5. **Paridade de validação (S08/S09):** centralizar `[0,1]` + rejeição de string no normalizador `normalize/rates.js` (INV-002) e chamar de `scoreBatch`, `durationCurve*`, `buildReferences` — elimina as três divergências de uma vez.
6. **Allowlists de eco (S05c/S10):** `valueKey ∈ {win,value,win_rate,pick,ban}`, `refKind ∈ {mais-usada,media-do-heroi,comparavel}`; `gameVersion`/`cohortKey` já tratados como opacos (`String()` + carimbo), manter assim.
7. **Sem ação em auth/snapshot (fora do escopo engine):** `payload_hash`/`fetched_at`/imutabilidade de snapshot e JWT (`/api/user/*`) permanecem na camada API — nenhum achado aqui os reabre; reavaliar se a engine um dia receber input direto do cliente (aí S01/S06 sobem para HIGH e rate-limit/autenticação entram no gate).

## Done

- [x] Escopo revisado declarado (5 arquivos + fio `routes.js` + `walkforward.js` p/ validar prior).
- [x] Zero CRITICAL aberto; nenhum HIGH. 1× MEDIUM (S07, integridade/auditabilidade, sem RCE/exfiltração) + 8× LOW + 2× não-achados com prova (S04, S05-filtro).
- [x] Nenhum fix aplicado nesta passada (threat review leve, sem mudança de comportamento) — correções L1 acima estão escritas e prontas para virar patch; nenhuma é bloqueante para expor rota/dado, pois o fio atual alimenta a engine só de snapshot server-side validado.
