// Pontuação do lote: delega ao @radar/engine (scoreBatch) e faz o
// arredondamento NA BORDA (mesmos campos/casas do fio anterior). Sem cópia local
// do modelo: a matemática vive no motor.
import { scoreBatch, classOf } from "@radar/engine";
import { RANKS } from "../providers/arena/index.js";
import { WINDOWS, isRank } from "./validation.js";

export function qHeroes(sp) {
  const rank = sp.get("rank") ?? "mythic";
  const window = Number(sp.get("window") ?? 7);
  const sort = sp.get("sort") ?? "d";
  const order = sp.get("order") ?? "desc";
  const size = Math.min(133, Math.max(1, Number(sp.get("size") ?? 50) || 50));
  const index = Math.max(1, Number(sp.get("index") ?? 1) || 1);
  const cls = sp.get("class") ?? undefined;
  if (!isRank(rank)) return { error: "rank_invalid", message: "Invalid rank", ranks: RANKS };
  if (!WINDOWS.has(window)) return { error: "window_invalid", message: "Invalid window", windows: [...WINDOWS] };
  if (!["d", "win", "pick", "ban", "q"].includes(sort)) return { error: "sort_invalid", message: "Invalid sort" };
  if (!["asc", "desc"].includes(order)) return { error: "order_invalid", message: "Invalid order" };
  return { rank, window, sort, order, size, index, class: cls };
}

// ── Motor de heróis: delega ao @radar/engine (scoreBatch). ──
// A cópia local de score() foi DELETADA; o fio é preservado por arredondamento NA BORDA
// (exatamente os mesmos campos/casas de antes: wrAdj 4, z 2, q 4, B 3 — valores do fio idênticos;
// posterior_mean/IC/prob passam crus, como antes).
// DESVIO (a): posterior_mean PERMANECE no topo (CONTRATO manda p/ debug, mas a ConfiancaSection
// EXIBE posterior+trio por exigência do PRD — sem ele a aba quebra).
// DESVIO (b): z PERMANECE no topo (computado de graça p/ q; views/semana/gems ordenam por ele).
// DESVIO (c): d SAIU do motor (era afim crescente de θ̂; sorts passam a wrAdj — ordem idêntica,
// provada em hero.test.js "DESVIO (c)"). class virou classOf() (trust.js) — a UI deriva; o fio não o carrega mais.
export function scoreLot(rawRows, opts = {}) {
  const { heroes, meta } = scoreBatch(rawRows, opts);
  // V2 §5.3/EC-007: nulos do motor (smallSample → q/index null; sem-exposição →
  // wrAdj/z null) atravessam o fio como null — nunca 0, nunca crash (era TypeError).
  /** @type {import("@radar/engine").HeroScore[]} */
  const scored = heroes.map((h) => ({
    ...h,
    wrAdj: h.wrAdj == null ? null : +h.wrAdj.toFixed(4),
    z: h.z == null ? null : +h.z.toFixed(2),
    q: h.q == null ? null : +h.q.toFixed(4),
    B: h.B == null ? null : +h.B.toFixed(3),
  }));
  // meta do lote direto do motor (substitui o lotMeta local — deletado); μ/τ arredondados
  // a 4 casas, mesmos valores do lotMeta antigo. Lote vazio: mu/tau null (honesto; antes 0).
  const wireMeta = {
    ...meta,
    mu: meta.mu == null ? meta.mu : +meta.mu.toFixed(4),
    tau: meta.tau == null ? meta.tau : +meta.tau.toFixed(4),
  };
  return { scored, meta: wireMeta };
}

export function score(rawRows, opts = {}) {
  return scoreLot(rawRows, opts).scored;
}

export function paginate(scored, q) {
  let out = scored;
  // class virou classOf(h) (trust.js) — o fio não carrega mais `class`.
  if (q.class) out = out.filter((h) => classOf(h) === q.class || (q.class === "Joia" && h.isGem));
  // sort=d é alias de wrAdj (d era afim crescente de θ̂ — mesma ordem; critic-017).
  // Views que querem significância ordenam por z explicitamente no próprio código.
  const key = q.sort === "win" || q.sort === "d" ? "wrAdj" : q.sort === "pick" ? "pick" : q.sort === "ban" ? "qBan" : q.sort === "q" ? "q" : "z";
  out = [...out].sort((a, b) => (q.order === "asc" ? a[key] - b[key] : b[key] - a[key]));
  return { data: out.slice((q.index - 1) * q.size, q.index * q.size), total: out.length };
}
