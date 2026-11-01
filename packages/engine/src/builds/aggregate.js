// @radar/engine · builds/aggregate — agregação estatística de builds (itens, talentos, emblemas) e tags.
// Consolidado (ADR-061): reúne builds/build-tags.js, builds/builds-aggregate.js.
// Barrel público: src/index.js (nenhum nome público muda).

import { CONTRAST_EVIDENCE_RULE, CONTRAST_MIN, CONTRAST_SHRINK_K, contrastEstimates, valueFieldsOf } from "./contrast.js";
import { MIN_LIFT_SIGNAL, POPULAR_PICK_MIN, PRACTICAL_DELTA, RARE_PICK_MAX } from "../core/thresholds.js";
import { scoreRouteItemsets } from "./itemsets.js";

// ── builds/build-tags.js ──
// Tags de build (PRD Build §10, Camada A) — FONTE ÚNICA.
// Movido de app/web/src/shared/domain/buildLabel.ts (semântica idêntica).
// Regra de silêncio: lift inconclusivo (|lift| ≤ 0,02 sem frequência que o
// explique, ou sem suporte) NÃO gera tag. "popular" é fato de frequência
// (pick ≥ 5%), nunca identidade de "a mais usada". Puro, sem I/O.
// O mapa tom→classes CSS (BUILD_TAG_CLASS) é presentacional e fica na web.
// Cortes canônicos em ./thresholds.js (popular/raro/lift — mesmos das tags×quadrantes).



/**
 * @param b {{ pick: number|null, lift_vs_most_used?: number|null }}
 * @returns {{ key: string, label: string, tone: string, title: string }[]}
 */
export function getBuildTags(b) {
  const l = b.lift_vs_most_used;
  const pick = (b && b.pick) ?? 0;
  const liftOk = l != null && Number.isFinite(l);
  const tags = [];
  if (pick >= POPULAR_PICK_MIN) {
    tags.push({
      key: "popular",
      label: "popular",
      tone: "popular",
      title: "Frequente no meta (pick ≥ 5%). Frequência não é vantagem — ver lift.",
    });
  }
  if (pick < RARE_PICK_MAX && liftOk && l > MIN_LIFT_SIGNAL) {
    tags.push({
      key: "emergente",
      label: "emergente",
      tone: "edge",
      title: "Pouco usada com sinal favorável. Acompanhar em snapshots seguintes, sem validar precocemente.",
    });
  } else if (liftOk && l > PRACTICAL_DELTA) {
    tags.push({
      key: "situacional",
      label: "situacional",
      tone: "situ",
      title: "Vantagem observada neste contexto de rota/rank. Não generalizar para qualquer partida.",
    });
  }
  return tags;
}

// ── builds/builds-aggregate.js ──
// Builds agregadas — cálculo puro (sem I/O) da visão de sistema.
// Fronteira: recebe contextos (herói + builds cruas da Academy) e catálogos já
// carregados; devolve o contrato do endpoint /v1/builds/aggregate.
//
// Regras de honestidade (QA builds-aggregate-qa.md, revisão 2026-10-21):
// - unidade = contexto (herói+lane+rank); suporte = k contextos / m builds / h heróis;
// - diferença é `delta_wr_pp` (pontos percentuais), NÃO o lift-razão;
// - pacote só é rankável com suporte mínimo (k>=3, m>=5); coocorrência menor
//   vira `packages_provisional`, nunca “padrão consolidado”;
// - `pattern_scope` separa padrão local (1 herói) de padrão entre heróis (h>=3);
// - peso de pick é hipótese: weighted e unweighted são publicados juntos com
//   `weighting_sensitivity`; |delta| < 2 pp = sem leitura;
// - build da Academy é núcleo parcial de 3–4 de 6 slots; sem N de partidas;
// - ordem do array da fonte não é ordem de compra.




export const AGGREGATE_VERSION = "builds-aggregate-v5";
export const PACKAGE_INSEPARABLE_MIN = 0.8;
export const PACKAGE_MIN_BOTH = 3;
export const PACKAGE_MIN_CONTEXTS = 3;
export const PACKAGE_MIN_BUILDS = 5;
export const ITEM_MIN_CONTEXTS = 3;
export const ITEM_MIN_BUILDS = 5;
export const SET_MIN_HEROES = 2;
export const SET_MIN_BUILDS = 3;
export const SET_MAX_PER_ARCHETYPE = 5;
export const RUNE_MIN_BUILDS = 3;
export const RUNE_MIN_CONTEXTS = 2;
export const EMBLEM_MIN_CONTEXTS = 3;
export const EMBLEM_MIN_BUILDS = 5;
export const ITEMS_MAX_ROWS = 12;
export const EMBLEMS_MAX_ROWS = 12;
export const PACKAGES_MAX_ROWS = 10;
export const RUNES_MAX_ROWS = 10;
export const TALENTS_MAX_PER_TIER = 6;
// Combinador: índice aditivo de efeitos marginais observados. O valor de cada
// componente é o delta em pp contra a build mais usada do herói, encolhido por
// suporte (m/(m+k)). Não é previsão nem win rate da combinação (ADR-030).
export const COMBINER_SHRINK_K = 3;
export const COMBINER_BASE = 100;
export const COMBINER_POINTS_PER_PP = 10;
export const COMBINER_SLOTS = { items: 6, emblems: 1, talents: 3, spells: 1 };
export const VARIANTS_MAX_CORES = 12;
export const PRACTICAL_DELTA_PP = 2;


export const ARCHETYPE_LABELS = {
  physical_attack: "Ataque físico",
  magic_attack: "Ataque mágico",
  physical_defense: "Defesa física",
  magic_defense: "Defesa mágica",
  hybrid_defense: "Defesa híbrida",
  generic_defense: "Defesa (só HP)",
  roam: "Roam",
  jungle: "Jungle",
  movement: "Movimento",
  attack_utility: "Ataque utilitário",
  magic_utility: "Magia utilitária",
  unclassified: "Não classificado",
  mixed: "Misto",
};

function isObj(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function finiteUnit(v) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

function round4(v) {
  return Number.isFinite(v) ? +v.toFixed(4) : null;
}

function median(values) {
  const a = (values ?? []).filter((v) => Number.isFinite(v)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function mean(values) {
  const a = (values ?? []).filter((v) => Number.isFinite(v));
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
}

// Saída pública de diferença em PONTOS PERCENTUAIS. Internamente a engine
// trabalha em fração 0–1; a API publica 0–100 para casar com o nome `_pp`.
function toPp(v) {
  return Number.isFinite(v) ? +(v * 100).toFixed(2) : null;
}

const PATTERN_LABELS = {
  cross_hero: "Padrão entre heróis",
  two_heroes: "Padrão em 2 heróis",
  single_hero: "Padrão local (1 herói)",
};

function patternScope(h) {
  if (h >= 3) return "cross_hero";
  if (h === 2) return "two_heroes";
  return "single_hero";
}

function discoveryStatus(support, h) {
  if (support?.status !== "ok") return "provisional";
  if (h >= 3) return "consolidated";
  if (h === 2) return "emerging";
  return "local";
}

function weightingSensitivity(weightedDelta, unweightedDelta) {
  if (!Number.isFinite(weightedDelta) || !Number.isFinite(unweightedDelta)) return "unknown";
  const w = Math.abs(weightedDelta);
  const u = Math.abs(unweightedDelta);
  if (Math.sign(weightedDelta) !== Math.sign(unweightedDelta) && w >= PRACTICAL_DELTA && u >= PRACTICAL_DELTA) {
    return "sign_flip";
  }
  if (Math.abs(weightedDelta - unweightedDelta) >= PRACTICAL_DELTA) return "large_shift";
  return "stable";
}


function normalizeName(v) {
  return typeof v === "string"
    ? v.trim().toLowerCase().replace(/[\u0300-\u036f]/g, "")
    : null;
}

function decodeTips(raw) {
  return String(raw ?? "")
    .replace(/<br\s*\/?>/gi, " · ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unclassified(id, name = null, icon = null, type = null, tips = null, reason = "sem tipo/tips") {
  return {
    id,
    name,
    icon,
    type,
    tips,
    archetype: "unclassified",
    archetype_label: ARCHETYPE_LABELS.unclassified,
    reason,
  };
}

/**
 * Classifica um item do catálogo expanded em um arquétipo. Regra explícita:
 * tipo + palavras-chave dos tips; sem tips = `unclassified` (nunca chuta).
 */
export function classifyEquipmentItem(raw) {
  const d = isObj(raw?.data) ? raw.data : (raw ?? {});
  const id = Number(d.equipid);
  const name = d.equipname ?? null;
  const icon = d.equipicon ?? null;
  const typeRaw = String(d.equiptypename ?? "").trim();
  const type = typeRaw.toLowerCase();
  const tips = decodeTips(d.equiptips);
  const low = tips.toLowerCase();

  if (!Number.isFinite(id)) return null;
  if (!tips) return unclassified(id, name, icon, typeRaw || null, tips, "sem tips");

  const has = (...keys) => keys.some((k) => low.includes(k));

  if (type === "attack") {
    if (has("physical atk", "physical attack", "crit", "attack speed", "lifesteal", "penetration")) {
      return { id, name, icon, type: typeRaw, tips, archetype: "physical_attack", archetype_label: ARCHETYPE_LABELS.physical_attack };
    }
    return { id, name, icon, type: typeRaw, tips, archetype: "attack_utility", archetype_label: ARCHETYPE_LABELS.attack_utility };
  }
  if (type === "magic") {
    if (has("magic power", "magic pen", "magic lifesteal")) {
      return { id, name, icon, type: typeRaw, tips, archetype: "magic_attack", archetype_label: ARCHETYPE_LABELS.magic_attack };
    }
    return { id, name, icon, type: typeRaw, tips, archetype: "magic_utility", archetype_label: ARCHETYPE_LABELS.magic_utility };
  }
  if (type === "defense") {
    const p = has("physical defense");
    const m = has("magic defense");
    if (p && m) return { id, name, icon, type: typeRaw, tips, archetype: "hybrid_defense", archetype_label: ARCHETYPE_LABELS.hybrid_defense };
    if (p) return { id, name, icon, type: typeRaw, tips, archetype: "physical_defense", archetype_label: ARCHETYPE_LABELS.physical_defense };
    if (m) return { id, name, icon, type: typeRaw, tips, archetype: "magic_defense", archetype_label: ARCHETYPE_LABELS.magic_defense };
    return { id, name, icon, type: typeRaw, tips, archetype: "generic_defense", archetype_label: ARCHETYPE_LABELS.generic_defense };
  }
  if (type === "roam") return { id, name, icon, type: typeRaw, tips, archetype: "roam", archetype_label: ARCHETYPE_LABELS.roam };
  if (type === "jungle") return { id, name, icon, type: typeRaw, tips, archetype: "jungle", archetype_label: ARCHETYPE_LABELS.jungle };
  if (type === "movement") return { id, name, icon, type: typeRaw, tips, archetype: "movement", archetype_label: ARCHETYPE_LABELS.movement };

  return unclassified(id, name, icon, typeRaw || null, tips, "tipo sem arquétipo");
}

/** Mapa equipid → item classificado. Aceita records `{data}` ou dados crus. */
export function normalizeEquipmentCatalog(records) {
  const map = {};
  for (const rec of records ?? []) {
    const item = classifyEquipmentItem(rec);
    if (item) map[item.id] = item;
  }
  return map;
}

/** Mapa giftid → talento (nome/tier/descrição). */
export function normalizeEmblemCatalog(records) {
  const map = {};
  for (const rec of records ?? []) {
    const d = isObj(rec?.data) ? rec.data : (rec ?? {});
    const id = Number(d.giftid);
    if (!Number.isFinite(id)) continue;
    const skill = d.emblemskill ?? {};
    map[id] = {
      id,
      name: skill.skillname ?? null,
      tier: Number.isFinite(Number(d.gifttiers)) ? Number(d.gifttiers) : null,
      desc: skill.skilldesc ?? skill.skilldescemblem ?? null,
      num: skill.numdescribe ?? null,
      icon: skill.skillicon ?? null,
    };
  }
  return map;
}

/** Mapa nome normalizado → feitiço. O nome exibido vem de __data quando existir. */
export function normalizeSpellCatalog(records) {
  const map = {};
  for (const rec of records ?? []) {
    const d = isObj(rec?.data) ? rec.data : (rec ?? {});
    const inner = isObj(d.__data) ? d.__data : d;
    const name = inner.skillname ?? d.skillname ?? null;
    if (!name || String(name).startsWith("@")) continue;
    const key = normalizeName(name);
    if (!key) continue;
    map[key] = {
      name,
      icon: inner.skillicon ?? d.skillicon ?? null,
      desc: inner.skilldesc ?? d.skilldesc ?? null,
      short: d.skillshortdesc ?? null,
    };
  }
  return map;
}

function itemOf(id, equipment) {
  return equipment?.[id] ?? {
    id,
    name: null,
    icon: null,
    type: null,
    tips: null,
    archetype: "unclassified",
    archetype_label: ARCHETYPE_LABELS.unclassified,
  };
}

function itemsOf(ids, equipment) {
  return (ids ?? []).map((id) => itemOf(id, equipment));
}

/** Maioria dos arquétipos; empate = `mixed`. */
export function archetypeOfItems(ids, equipment) {
  const counts = {};
  for (const id of ids ?? []) {
    const a = equipment?.[id]?.archetype ?? "unclassified";
    counts[a] = (counts[a] ?? 0) + 1;
  }
  const entries = Object.entries(counts);
  if (!entries.length) return "unclassified";
  const max = Math.max(...entries.map(([, n]) => n));
  const winners = entries.filter(([, n]) => n === max).map(([a]) => a);
  return winners.length === 1 ? winners[0] : "mixed";
}

/** Converte um build cru da Academy no registro interno. */
export function parseBuild(raw, hero, catalogs = {}, context = {}) {
  const b = isObj(raw) ? raw : {};
  const equipment = catalogs.equipment ?? {};
  const emblems = catalogs.emblems ?? {};
  const spells = catalogs.spells ?? {};

  const rawOrder = (Array.isArray(b.equipid) ? b.equipid : [])
    .map((v) => Number(v))
    .filter(Number.isInteger);
  const order = [...new Set(rawOrder)];
  const itemIds = [...order].sort((a, b) => a - b);
  const itemSet = new Set(itemIds);
  const items = order.map((id) => itemOf(id, equipment));

  const win = finiteUnit(b.build_win_rate);
  const pick = finiteUnit(b.build_pick_rate);

  const emblemData = isObj(b.emblem?.data) ? b.emblem.data : {};
  const emblemIdRaw = Number(emblemData.emblemid ?? b.runeid);
  const emblemId = Number.isFinite(emblemIdRaw) ? emblemIdRaw : null;
  const emblemName = emblemData.emblemname ?? emblemData.name ?? null;
  const emblemAttrs = emblemData?.emblemattr?.emblemattr ?? null;
  const emblemIcon = emblemData.attriicon ?? emblemData.emblemicon ?? null;

  const talentIds = (Array.isArray(b.new_rune_skill) ? b.new_rune_skill : Array.isArray(b.rune_skill) ? b.rune_skill : [])
    .map((v) => Number(v))
    .filter(Number.isInteger);
  const talents = talentIds.map((id) => {
    const t = emblems[id];
    return {
      id,
      name: t?.name ?? null,
      tier: t?.tier ?? null,
      desc: t?.desc ?? null,
      icon: t?.icon ?? null,
    };
  });

  const spellData = isObj(b.battleskill?.data) ? b.battleskill.data : {};
  const spellInner = isObj(spellData.__data) ? spellData.__data : {};
  const spellNameRaw = spellData.skillname ?? spellInner.skillname ?? null;
  const spellKey = normalizeName(spellNameRaw);
  const spellCatalog = spellKey ? spells[spellKey] : null;
  const spell = spellNameRaw
    ? {
        name: spellNameRaw,
        icon: spellData.skillicon ?? spellInner.skillicon ?? spellCatalog?.icon ?? null,
        desc: spellData.skilldesc ?? spellInner.skilldesc ?? spellCatalog?.desc ?? null,
        short: spellData.skillshortdesc ?? spellCatalog?.short ?? null,
      }
    : null;

  const coreKey = itemIds.join("+");
  const talentKey = talents.map((t) => t.id).sort((a, b) => a - b).join(">");
  const variantKey = [
    coreKey,
    order.join(">"),
    emblemId ?? "?",
    talentKey,
    spellKey ?? "?",
  ].join("|");

  return {
    hero_id: hero?.id ?? null,
    hero_name: hero?.name ?? null,
    rank: context.rank ?? null,
    lane: context.lane ?? null,
    win,
    pick,
    items,
    item_ids: itemIds,
    item_set: itemSet,
    order,
    core_key: coreKey,
    variant_key: variantKey,
    emblem: emblemId == null && !emblemName
      ? null
      : { id: emblemId, name: emblemName, icon: emblemIcon, attrs: emblemAttrs },
    talents,
    spell,
  };
}

export function parseRawBuilds(rawBuilds, hero, catalogs, context) {
  const rows = [];
  for (const raw of rawBuilds ?? []) {
    const builds = Array.isArray(raw?.build) ? raw.build : [raw];
    for (const b of builds) {
      if (!isObj(b)) continue;
      rows.push(parseBuild(b, hero, catalogs, context));
    }
  }
  return rows;
}

function referencesOf(builds) {
  const valid = (builds ?? []).filter((b) => Number.isFinite(b.win) && Number.isFinite(b.pick));
  if (!valid.length) return { mostUsed: null, heroMean: null };
  const mostUsed = valid.reduce((a, b) => (b.pick > a.pick ? b : a), valid[0]);
  const heroMean = round4(mean(valid.map((b) => b.win)));
  return { mostUsed, heroMean };
}

function weightedWin(builds) {
  const rows = (builds ?? []).filter((b) => Number.isFinite(b.win) && Number.isFinite(b.pick) && b.pick > 0);
  if (!rows.length) return null;
  const denom = rows.reduce((s, b) => s + b.pick, 0);
  if (!(denom > 0)) return null;
  return rows.reduce((s, b) => s + b.pick * b.win, 0) / denom;
}

/**
 * Mede um predicado (item/pacote/conjunto) por contexto: k contextos, m builds,
 * h heróis, delta em pp vs a build mais usada de cada contexto e share positivo.
 *
 * Publica weighted (pick) E unweighted. O pick não é cobertura de partidas
 * validada; a diferença entre os dois é a `weighting_sensitivity`.
 */
function contextMetric(contexts, predicate) {
  const weightedDeltas = [];
  const unweightedDeltas = [];
  const wins = [];
  const heroIds = new Set();
  let contextsWith = 0;
  let m = 0;

  for (const ctx of contexts ?? []) {
    const matching = (ctx.builds ?? []).filter(predicate);
    if (!matching.length) continue;
    contextsWith++;
    m += matching.length;
    if (ctx.hero?.id != null) heroIds.add(ctx.hero.id);

    const w = weightedWin(matching);
    const u = mean(matching.map((b) => b.win).filter(Number.isFinite));
    if (w != null) wins.push(w);

    const refWin = ctx.refs?.mostUsed?.win;
    if (Number.isFinite(refWin)) {
      if (w != null) weightedDeltas.push(w - refWin);
      if (u != null) unweightedDeltas.push(u - refWin);
    }
  }

  const deltaFracMedian = median(weightedDeltas);
  const deltaFracUnweighted = median(unweightedDeltas);
  return {
    k: contextsWith,
    h: heroIds.size,
    m,
    wins,
    delta_frac_median: round4(deltaFracMedian),
    delta_frac_unweighted_median: round4(deltaFracUnweighted),
    win_median: round4(median(wins)),
    share_positive: weightedDeltas.length
      ? round4(weightedDeltas.filter((d) => d > 0).length / weightedDeltas.length)
      : null,
    weighting_sensitivity: weightingSensitivity(deltaFracMedian, deltaFracUnweighted),
  };
}

function supportStatus(k, m, h, minContexts, minBuilds, mode = "and") {
  const ok = mode === "or"
    ? (k >= minContexts || m >= minBuilds)
    : (k >= minContexts && m >= minBuilds);
  return {
    status: ok ? "ok" : "insufficient",
    k,
    m,
    h,
    min: { contexts: minContexts, builds: minBuilds, mode },
    reason: ok ? null : `amostra insuficiente (k=${k}, m=${m})`,
  };
}

function deltaStatus(deltaFrac, support) {
  if (support?.status !== "ok" || !Number.isFinite(deltaFrac)) return "insufficient";
  if (Math.abs(deltaFrac) < PRACTICAL_DELTA) return "no_practical_difference";
  return deltaFrac > 0 ? "positive" : "negative";
}

function withMetricsRow(base, metric, support) {
  const ok = support.status === "ok";
  return {
    ...base,
    contexts: metric.k,
    hero_coverage: metric.h,
    adoption_builds: base.total_builds ? round4(metric.m / base.total_builds) : null,
    builds: metric.m,
    delta_wr_pp_median: ok ? toPp(metric.delta_frac_median) : null,
    delta_wr_pp_unweighted_median: ok ? toPp(metric.delta_frac_unweighted_median) : null,
    win_median: ok ? metric.win_median : null,
    share_positive: ok ? metric.share_positive : null,
    delta_status: deltaStatus(metric.delta_frac_median, support),
    weighting_sensitivity: ok ? metric.weighting_sensitivity : "unknown",
    support,
  };
}

/**
 * Detecta pacotes inseparáveis: P(j|i) ≥ 0,8 e P(i|j) ≥ 0,8, com n_both ≥ 3.
 * Devolve cliques maximais (greedy determinístico) para não agrupar itens que
 * só se ligam por transitividade.
 */
export function detectPackages(contexts, equipment) {
  const builds = (contexts ?? []).flatMap((ctx) => ctx.builds ?? []);
  const totalBuilds = builds.length;
  const itemBuilds = new Map(); // id -> nº builds com o item
  const pairBoth = new Map(); // "i+j" -> nº builds com ambos

  for (const b of builds) {
    const ids = [...(b.item_ids ?? [])].sort((a, c) => a - c);
    for (const id of ids) itemBuilds.set(id, (itemBuilds.get(id) ?? 0) + 1);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}+${ids[j]}`;
        pairBoth.set(key, (pairBoth.get(key) ?? 0) + 1);
      }
    }
  }

  const neighbors = new Map();
  for (const [key, nBoth] of pairBoth) {
    const [i, j] = key.split("+").map(Number);
    const ni = itemBuilds.get(i) ?? 0;
    const nj = itemBuilds.get(j) ?? 0;
    if (nBoth < PACKAGE_MIN_BOTH || !ni || !nj) continue;
    const pji = nBoth / ni;
    const pij = nBoth / nj;
    if (pji >= PACKAGE_INSEPARABLE_MIN && pij >= PACKAGE_INSEPARABLE_MIN) {
      if (!neighbors.has(i)) neighbors.set(i, new Set());
      if (!neighbors.has(j)) neighbors.set(j, new Set());
      neighbors.get(i).add(j);
      neighbors.get(j).add(i);
    }
  }

  const bySize = (a, b) => (itemBuilds.get(b) ?? 0) - (itemBuilds.get(a) ?? 0) || a - b;
  const candidateMap = new Map();

  for (const id of [...itemBuilds.keys()].sort(bySize)) {
    const members = [id];
    const cand = [...(neighbors.get(id) ?? [])].sort(bySize);
    for (const c of cand) {
      if (members.every((m) => neighbors.get(m)?.has(c))) members.push(c);
    }
    if (members.length < 2) continue;
    const ids = [...new Set(members)].sort((a, b) => a - b);
    candidateMap.set(ids.join("+"), ids);
  }

  // Mantém apenas pacotes maximais (um pacote menor contido em outro é redundante).
  const all = [...candidateMap.values()].sort((a, b) => b.length - a.length || a.join("+").localeCompare(b.join("+")));
  const packages = [];
  for (const ids of all) {
    const set = new Set(ids);
    if (packages.some((p) => [...p.item_ids].every((id) => set.has(id)))) continue;
    const metric = contextMetric(contexts, (b) => ids.every((id) => b.item_set?.has(id)));
    const support = supportStatus(metric.k, metric.m, metric.h, PACKAGE_MIN_CONTEXTS, PACKAGE_MIN_BUILDS, "and");
    const archetype = archetypeOfItems(ids, equipment);
    const scope = patternScope(metric.h);
    packages.push(withMetricsRow({
      kind: "package",
      package_id: `pkg:${ids.join("+")}`,
      item_ids: ids,
      package_size: ids.length,
      items: itemsOf(ids, equipment),
      name: `Pacote de ${ids.length} itens`,
      archetype,
      archetype_label: ARCHETYPE_LABELS[archetype] ?? archetype,
      // `inseparable` só é afirmado quando há suporte de ranking; a coocorrência
      // observada continua registrada em `inseparable_observed`.
      inseparable: support.status === "ok",
      inseparable_observed: true,
      pattern_scope: scope,
      pattern_label: PATTERN_LABELS[scope],
      discovery_status: discoveryStatus(support, metric.h),
      cooccurrence: {
        p_both_min: PACKAGE_INSEPARABLE_MIN,
        n_both_min: PACKAGE_MIN_BOTH,
        support_min: { contexts: PACKAGE_MIN_CONTEXTS, builds: PACKAGE_MIN_BUILDS, mode: "and" },
      },
      total_builds: totalBuilds,
    }, metric, support));
  }

  return packages;
}

function combinations(ids, size) {
  const out = [];
  const walk = (start, acc) => {
    if (acc.length === size) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < ids.length; i++) {
      acc.push(ids[i]);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return out;
}

function setsFromContexts(contexts, equipment) {
  const builds = (contexts ?? []).flatMap((ctx) => ctx.builds ?? []);
  const candidates = new Map();

  for (const b of builds) {
    // Botas (Movement) nunca entram nos quatro arquétipos.
    const ids = (b.item_ids ?? []).filter((id) => equipment?.[id]?.archetype !== "movement");
    if (ids.length < 2) continue;
    for (const size of [2, 3]) {
      for (const combo of combinations(ids, size)) {
        const key = combo.join("+");
        if (!candidates.has(key)) candidates.set(key, combo);
      }
    }
  }

  const rows = [];
  for (const ids of candidates.values()) {
    const metric = contextMetric(contexts, (b) => ids.every((id) => b.item_set?.has(id)));
    const support = supportStatus(metric.k, metric.m, metric.h, SET_MIN_HEROES, SET_MIN_BUILDS, "or");
    if (support.status !== "ok") continue;
    const archetype = archetypeOfItems(ids, equipment);
    const scope = patternScope(metric.h);
    rows.push({
      set_key: ids.join("+"),
      item_ids: ids,
      items: itemsOf(ids, equipment),
      size: ids.length,
      archetype,
      archetype_label: ARCHETYPE_LABELS[archetype] ?? archetype,
      k_heroes: metric.k,
      contexts: metric.k,
      hero_coverage: metric.h,
      m_builds: metric.m,
      win_median: metric.win_median,
      delta_wr_pp_median: toPp(metric.delta_frac_median),
      delta_wr_pp_unweighted_median: toPp(metric.delta_frac_unweighted_median),
      share_positive: metric.share_positive,
      delta_status: deltaStatus(metric.delta_frac_median, support),
      weighting_sensitivity: metric.weighting_sensitivity,
      pattern_scope: scope,
      pattern_label: PATTERN_LABELS[scope],
      discovery_status: discoveryStatus(support, metric.h),
      support,
      label: `Núcleo parcial · ${ids.length} de 6 slots`,
    });
  }

  rows.sort((a, b) => {
    if (b.k_heroes !== a.k_heroes) return b.k_heroes - a.k_heroes;
    if (b.m_builds !== a.m_builds) return b.m_builds - a.m_builds;
    const la = a.delta_wr_pp_median ?? -Infinity;
    const lb = b.delta_wr_pp_median ?? -Infinity;
    if (lb !== la) return lb - la;
    return a.set_key.localeCompare(b.set_key);
  });

  const counts = {};
  for (const row of rows) counts[row.archetype] = (counts[row.archetype] ?? 0) + 1;
  const summary = {
    total: rows.length,
    consolidated: rows.filter((r) => r.discovery_status === "consolidated").length,
    emerging: rows.filter((r) => r.discovery_status === "emerging").length,
    local: rows.filter((r) => r.discovery_status === "local").length,
    by_scope: {
      cross_hero: rows.filter((r) => r.pattern_scope === "cross_hero").length,
      two_heroes: rows.filter((r) => r.pattern_scope === "two_heroes").length,
      single_hero: rows.filter((r) => r.pattern_scope === "single_hero").length,
    },
  };

  const limited = [];
  const perArch = {};
  for (const row of rows) {
    const n = perArch[row.archetype] ?? 0;
    if (n >= SET_MAX_PER_ARCHETYPE) continue;
    perArch[row.archetype] = n + 1;
    limited.push(row);
  }

  return { rows: limited, counts, total: rows.length, summary };
}

/**
 * Trincas recorrentes intra-build. Reusa o itemset-score-v1 da engine e apenas
 * traduz o nome histórico `liftMost` (diferença 0–1) para `delta_wr_pp`.
 * `k` = contextos/herois em que a trinca apareceu; `m` = builds.
 */
function triplesFromContexts(contexts, equipment) {
  const itemsetContexts = (contexts ?? [])
    .filter((ctx) => (ctx.builds ?? []).length)
    .map((ctx) => ({
      heroId: ctx.hero?.id ?? null,
      heroName: ctx.hero?.name ?? null,
      rank: null,
      lane: null,
      builds: (ctx.builds ?? []).map((b) => ({
        win: b.win,
        pick: b.pick,
        items: b.items,
      })),
      refMostWin: ctx.refs?.mostUsed?.win ?? null,
      refMeanWin: ctx.refs?.heroMean ?? null,
    }));

  return scoreRouteItemsets(itemsetContexts).map((row) => {
    const scope = patternScope(row.k);
    return {
      item_ids: row.itemIds,
      items: itemsOf(row.itemIds, equipment),
      k_heroes: row.k,
      m_builds: row.m,
      win_min: row.winMin,
      win_max: row.winMax,
      delta_wr_pp_max: toPp(row.maxLiftMost),
      delta_status: deltaStatus(row.maxLiftMost, { status: "ok" }),
      emergent: row.emergent,
      pattern_scope: scope,
      pattern_label: PATTERN_LABELS[scope],
      discovery_status: discoveryStatus({ status: "ok" }, row.k),
      label: `Trinca · ${row.itemIds.length} itens`,
      caveat: "coocorrência intra-build; não é taxa de vitória causal",
    };
  });
}

/**
 * Emblemas isolados, com a mesma lógica de suporte/delta dos itens.
 * A "força" do emblema é o win median por contexto (cada contexto conta 1x),
 * nunca um win poolado entre heróis.
 */
function emblemRowsFromContexts(contexts) {
  const builds = (contexts ?? []).flatMap((ctx) => ctx.builds ?? []);
  const totalBuilds = builds.length;
  const byId = new Map();
  for (const b of builds) {
    if (b.emblem?.id == null) continue;
    if (!byId.has(b.emblem.id)) byId.set(b.emblem.id, b.emblem);
  }

  const rows = [];
  const insufficient = [];
  for (const [id, emblem] of byId) {
    const metric = contextMetric(contexts, (b) => b.emblem?.id === id);
    const support = supportStatus(metric.k, metric.m, metric.h, EMBLEM_MIN_CONTEXTS, EMBLEM_MIN_BUILDS, "and");
    const scope = patternScope(metric.h);
    const row = {
      kind: "emblem",
      emblem_id: id,
      name: emblem.name ?? null,
      icon: emblem.icon ?? null,
      attrs: emblem.attrs ?? null,
      total_builds: totalBuilds,
      pattern_scope: scope,
      pattern_label: PATTERN_LABELS[scope],
      discovery_status: discoveryStatus(support, metric.h),
      ...withMetricsRow({ total_builds: totalBuilds }, metric, support),
    };
    if (support.status === "ok") rows.push(row);
    else insufficient.push({
      emblem_id: id,
      name: row.name,
      icon: row.icon,
      contexts: metric.k,
      builds: metric.m,
      support,
    });
  }

  rows.sort((a, b) => (b.delta_wr_pp_median ?? -Infinity) - (a.delta_wr_pp_median ?? -Infinity) || (b.adoption_builds ?? -Infinity) - (a.adoption_builds ?? -Infinity));
  insufficient.sort((a, b) => b.builds - a.builds || b.contexts - a.contexts);
  return { rows: rows.slice(0, EMBLEMS_MAX_ROWS), insufficient, total: rows.length };
}

function runePageKey(b) {
  const emblem = b.emblem?.id ?? "?";
  const talents = (b.talents ?? []).map((t) => t.id).sort((a, c) => a - c).join(">");
  const spell = normalizeName(b.spell?.name) ?? "?";
  return `${emblem}|${talents}|${spell}`;
}

function runePagesFromContexts(contexts, emblemNameById) {
  const builds = (contexts ?? []).flatMap((ctx) => ctx.builds ?? []);
  const pages = new Map();

  for (const b of builds) {
    if (b.emblem?.id == null && !b.talents?.length && !b.spell?.name) continue;
    const key = runePageKey(b);
    if (!pages.has(key)) pages.set(key, b);
  }

  const rows = [];
  let insufficient = 0;
  for (const [key, rep] of pages) {
    const metric = contextMetric(contexts, (b) => runePageKey(b) === key);
    const support = supportStatus(metric.k, metric.m, metric.h, RUNE_MIN_CONTEXTS, RUNE_MIN_BUILDS, "and");
    if (support.status !== "ok") {
      insufficient++;
      continue;
    }
    const emblemId = rep.emblem?.id ?? null;
    const emblemName = rep.emblem?.name ?? (emblemId != null ? emblemNameById.get(emblemId) ?? null : null);
    const scope = patternScope(metric.h);
    rows.push({
      rune_page_key: key,
      emblem: {
        id: emblemId,
        name: emblemName,
        icon: rep.emblem?.icon ?? null,
        attrs: rep.emblem?.attrs ?? null,
        label: emblemName ?? (emblemId != null ? `#${emblemId}` : "sem emblema"),
      },
      talents: rep.talents ?? [],
      spell: rep.spell ?? null,
      adoption: builds.length ? round4(metric.m / builds.length) : null,
      contexts: metric.k,
      hero_coverage: metric.h,
      builds: metric.m,
      win_median: metric.win_median,
      delta_wr_pp_median: toPp(metric.delta_frac_median),
      delta_wr_pp_unweighted_median: toPp(metric.delta_frac_unweighted_median),
      share_positive: metric.share_positive,
      delta_status: deltaStatus(metric.delta_frac_median, support),
      weighting_sensitivity: metric.weighting_sensitivity,
      pattern_scope: scope,
      pattern_label: PATTERN_LABELS[scope],
      discovery_status: discoveryStatus(support, metric.h),
      support,
    });
  }

  rows.sort((a, b) => {
    const aa = a.adoption ?? -Infinity;
    const ab = b.adoption ?? -Infinity;
    if (ab !== aa) return ab - aa;
    const la = a.delta_wr_pp_median ?? -Infinity;
    const lb = b.delta_wr_pp_median ?? -Infinity;
    if (lb !== la) return lb - la;
    return a.rune_page_key.localeCompare(b.rune_page_key);
  });

  return { rows: rows.slice(0, RUNES_MAX_ROWS), insufficient };
}

function talentRows(contexts, emblems) {
  const builds = (contexts ?? []).flatMap((ctx) => ctx.builds ?? []);
  const ids = new Set();
  for (const b of builds) for (const t of b.talents ?? []) ids.add(t.id);

  const rows = [];
  for (const id of ids) {
    const metric = contextMetric(contexts, (b) => (b.talents ?? []).some((t) => t.id === id));
    const support = supportStatus(metric.k, metric.m, metric.h, RUNE_MIN_CONTEXTS, RUNE_MIN_BUILDS, "and");
    if (support.status !== "ok") continue;
    const meta = emblems[id];
    const scope = patternScope(metric.h);
    rows.push({
      id,
      name: meta?.name ?? null,
      tier: meta?.tier ?? null,
      desc: meta?.desc ?? null,
      icon: meta?.icon ?? null,
      label: meta?.name ?? `#${id}`,
      adoption: builds.length ? round4(metric.m / builds.length) : null,
      contexts: metric.k,
      hero_coverage: metric.h,
      builds: metric.m,
      win_median: metric.win_median,
      delta_wr_pp_median: toPp(metric.delta_frac_median),
      delta_wr_pp_unweighted_median: toPp(metric.delta_frac_unweighted_median),
      delta_status: deltaStatus(metric.delta_frac_median, support),
      weighting_sensitivity: metric.weighting_sensitivity,
      pattern_scope: scope,
      pattern_label: PATTERN_LABELS[scope],
      discovery_status: discoveryStatus(support, metric.h),
      support,
    });
  }
  // Um talento por tier ocupa o mesmo slot: a adoção só é comparável dentro do
  // tier. Ordena por tier e limita por tier (não um teto global que esconderia
  // tiers com adoção menor).
  rows.sort((a, b) => {
    const ta = a.tier ?? 99;
    const tb = b.tier ?? 99;
    if (ta !== tb) return ta - tb;
    return (b.adoption ?? -Infinity) - (a.adoption ?? -Infinity) || (b.delta_wr_pp_median ?? -Infinity) - (a.delta_wr_pp_median ?? -Infinity);
  });
  const perTier = new Map();
  const limited = [];
  for (const row of rows) {
    const key = row.tier ?? "sem_tier";
    const n = perTier.get(key) ?? 0;
    if (n >= TALENTS_MAX_PER_TIER) continue;
    perTier.set(key, n + 1);
    limited.push(row);
  }
  return limited;
}

function spellRows(contexts) {
  const builds = (contexts ?? []).flatMap((ctx) => ctx.builds ?? []);
  const names = new Map();
  for (const b of builds) {
    const key = normalizeName(b.spell?.name);
    if (!key) continue;
    if (!names.has(key)) names.set(key, b.spell);
  }

  const rows = [];
  for (const [key, spell] of names) {
    const metric = contextMetric(contexts, (b) => normalizeName(b.spell?.name) === key);
    const support = supportStatus(metric.k, metric.m, metric.h, RUNE_MIN_CONTEXTS, RUNE_MIN_BUILDS, "and");
    if (support.status !== "ok") continue;
    const scope = patternScope(metric.h);
    rows.push({
      name: spell?.name ?? null,
      icon: spell?.icon ?? null,
      desc: spell?.desc ?? null,
      adoption: builds.length ? round4(metric.m / builds.length) : null,
      contexts: metric.k,
      hero_coverage: metric.h,
      builds: metric.m,
      win_median: metric.win_median,
      delta_wr_pp_median: toPp(metric.delta_frac_median),
      delta_wr_pp_unweighted_median: toPp(metric.delta_frac_unweighted_median),
      delta_status: deltaStatus(metric.delta_frac_median, support),
      weighting_sensitivity: metric.weighting_sensitivity,
      pattern_scope: scope,
      pattern_label: PATTERN_LABELS[scope],
      discovery_status: discoveryStatus(support, metric.h),
      support,
    });
  }
  rows.sort((a, b) => (b.adoption ?? -Infinity) - (a.adoption ?? -Infinity) || (b.delta_wr_pp_median ?? -Infinity) - (a.delta_wr_pp_median ?? -Infinity));
  return rows.slice(0, 8);
}

/**
 * Efeito marginal de um componente para o combinador: delta em pp vs a build
 * mais usada de cada herói, encolhido por suporte. `value_pp` é o que soma no
 * índice; `null` quando o suporte não fecha (nunca zero disfarçado).
 */
function componentEffect(contexts, predicate, totalBuilds, minContexts, minBuilds) {
  const metric = contextMetric(contexts, predicate);
  const support = supportStatus(metric.k, metric.m, metric.h, minContexts, minBuilds, "and");
  const delta = toPp(metric.delta_frac_median);
  const shrink = metric.m > 0 ? metric.m / (metric.m + COMBINER_SHRINK_K) : 0;
  const ok = support.status === "ok";
  return {
    contexts: metric.k,
    builds: metric.m,
    hero_coverage: metric.h,
    adoption: totalBuilds ? round4(metric.m / totalBuilds) : null,
    win_median: metric.win_median,
    delta_wr_pp_median: delta,
    value_pp: ok && delta != null ? round4(delta * shrink) : null,
    shrinkage: round4(shrink),
    delta_status: deltaStatus(metric.delta_frac_median, support),
    weighting_sensitivity: metric.weighting_sensitivity,
    pattern_scope: patternScope(metric.h),
    discovery_status: discoveryStatus(support, metric.h),
    support,
  };
}

function combinerFromContexts(contexts, equipment, emblemCatalog) {
  const builds = (contexts ?? []).flatMap((ctx) => ctx.builds ?? []);
  const totalBuilds = builds.length;

  // Peso = contraste dentro do contexto (ADR-031), não "vs build mais usada".
  const contrastStats = contrastEstimates(contexts);
  const statByKindId = new Map();
  for (const s of contrastStats.values()) statByKindId.set(`${s.kind}:${s.id}`, s);

  const itemIds = new Set();
  const emblemById = new Map();
  const talentById = new Map();
  const spellByName = new Map();
  for (const b of builds) {
    for (const id of b.item_ids ?? []) itemIds.add(id);
    if (b.emblem?.id != null && !emblemById.has(b.emblem.id)) emblemById.set(b.emblem.id, b.emblem);
    for (const t of b.talents ?? []) if (!talentById.has(t.id)) talentById.set(t.id, t);
    const key = normalizeName(b.spell?.name);
    if (key && !spellByName.has(key)) spellByName.set(key, b.spell);
  }

  const items = [...itemIds].map((id) => {
    const meta = itemOf(id, equipment);
    return {
      id,
      name: meta.name,
      icon: meta.icon,
      archetype: meta.archetype,
      archetype_label: meta.archetype_label,
      ...componentEffect(contexts, (b) => (b.item_set?.has(id) ?? false), totalBuilds, ITEM_MIN_CONTEXTS, ITEM_MIN_BUILDS),
      ...valueFieldsOf(statByKindId.get(`item:${id}`)),
    };
  }).sort((a, b) => (b.adoption ?? -Infinity) - (a.adoption ?? -Infinity) || (b.value_pp ?? b.value_pp_est ?? -Infinity) - (a.value_pp ?? a.value_pp_est ?? -Infinity));

  const emblems = [...emblemById.entries()].map(([id, emblem]) => {
    const meta = emblemCatalog?.[id] ?? null;
    return {
      emblem_id: id,
      name: emblem.name ?? meta?.name ?? null,
      icon: emblem.icon ?? meta?.icon ?? null,
      attrs: emblem.attrs ?? null,
      ...componentEffect(contexts, (b) => b.emblem?.id === id, totalBuilds, EMBLEM_MIN_CONTEXTS, EMBLEM_MIN_BUILDS),
      // Descritivo por decisão: o emblema não varia dentro do herói, então não
      // existe contraste que separe o emblema do papel. Nunca vira peso.
      value_pp: null,
      value_pp_est: null,
      value_pp_source: "descriptive",
      power: null,
      contrast: valueFieldsOf(statByKindId.get(`emblem:${id}`)).contrast,
      value_reason: "a escolha do emblema é constante dentro do herói — sem contraste para estimar peso",
    };
  }).sort((a, b) => (b.adoption ?? -Infinity) - (a.adoption ?? -Infinity));

  const talents = [...talentById.entries()].map(([id, talent]) => {
    const meta = emblemCatalog?.[id] ?? null;
    return {
      id,
      name: talent.name ?? meta?.name ?? null,
      tier: talent.tier ?? meta?.tier ?? null,
      desc: talent.desc ?? meta?.desc ?? null,
      icon: talent.icon ?? meta?.icon ?? null,
      label: talent.name ?? meta?.name ?? `#${id}`,
      ...componentEffect(contexts, (b) => (b.talents ?? []).some((t) => t.id === id), totalBuilds, RUNE_MIN_CONTEXTS, RUNE_MIN_BUILDS),
      ...valueFieldsOf(statByKindId.get(`talent:${id}`)),
    };
  }).sort((a, b) => {
    const ta = a.tier ?? 99;
    const tb = b.tier ?? 99;
    if (ta !== tb) return ta - tb;
    return (b.adoption ?? -Infinity) - (a.adoption ?? -Infinity);
  });

  const spells = [...spellByName.entries()].map(([key, spell]) => ({
    name: spell?.name ?? null,
    icon: spell?.icon ?? null,
    desc: spell?.desc ?? null,
    ...componentEffect(contexts, (b) => normalizeName(b.spell?.name) === key, totalBuilds, RUNE_MIN_CONTEXTS, RUNE_MIN_BUILDS),
    ...valueFieldsOf(statByKindId.get(`spell:${key}`)),
  })).sort((a, b) => (b.adoption ?? -Infinity) - (a.adoption ?? -Infinity));

  const heroes = (contexts ?? [])
    .filter((ctx) => (ctx.builds ?? []).length)
    .map((ctx) => ({
      id: ctx.hero?.id ?? null,
      name: ctx.hero?.name ?? null,
      head: ctx.hero?.head ?? null,
      tier: ctx.hero?.tier ?? null,
      wrAdj: ctx.hero?.wrAdj ?? null,
      win: ctx.hero?.win ?? null,
      ref_win: ctx.refs?.mostUsed?.win ?? null,
      hero_mean_win: ctx.refs?.heroMean?.win ?? null,
      builds: (ctx.builds ?? []).length,
    }));

  return {
    scale: {
      base: COMBINER_BASE,
      points_per_pp: COMBINER_POINTS_PER_PP,
      shrink_k: COMBINER_SHRINK_K,
      slots: COMBINER_SLOTS,
      value_unit: "pp_contrast_shrunk",
      index_rule: "100 + points_per_pp * média(value_pp observado ou estimado por contraste)",
      contrast: {
        shrink_k: CONTRAST_SHRINK_K,
        min: CONTRAST_MIN,
        evidence_rule: CONTRAST_EVIDENCE_RULE,
      },
    },
    items,
    emblems,
    talents,
    spells,
    heroes,
  };
}

function variantsFromContexts(contexts, equipment) {
  const groups = new Map();
  for (const ctx of contexts ?? []) {
    for (const b of ctx.builds ?? []) {
      if (!b.core_key) continue;
      const key = `${ctx.hero?.id ?? "?"}|${b.core_key}`;
      if (!groups.has(key)) groups.set(key, { ctx, coreKey: b.core_key, builds: [] });
      groups.get(key).builds.push(b);
    }
  }

  const rows = [];
  for (const { ctx, coreKey, builds } of groups.values()) {
    if (!builds.length) continue;
    const totalPick = builds.reduce((s, b) => s + (Number.isFinite(b.pick) ? b.pick : 0), 0);
    const modal = builds.reduce((a, b) => ((b.pick ?? -1) > (a.pick ?? -1) ? b : a), builds[0]);
    const setupKeys = new Set(builds.map((b) => [
      b.emblem?.id ?? "?",
      (b.talents ?? []).map((t) => t.id).sort((a, c) => a - c).join(">"),
      normalizeName(b.spell?.name) ?? "?",
    ].join("|")));
    const orderOnly = builds.length > 1 && setupKeys.size === 1;
    const itemIds = coreKey.split("+").map(Number).filter(Number.isInteger);

    const variants = builds.map((b) => {
      const delta = Number.isFinite(b.win) && Number.isFinite(modal.win) ? round4(b.win - modal.win) : null;
      const status = delta == null
        ? "insufficient"
        : Math.abs(delta) < PRACTICAL_DELTA
          ? "no_practical_difference"
          : delta > 0 ? "positive" : "negative";
      return {
        variant_key: b.variant_key,
        order: b.order,
        items_in_order: b.items,
        item_ids: b.item_ids,
        emblem: b.emblem,
        talents: b.talents,
        spell: b.spell,
        win: b.win,
        pick: b.pick,
        variant_share: totalPick > 0 && Number.isFinite(b.pick) ? round4(b.pick / totalPick) : null,
        delta_wr_pp_vs_modal: toPp(delta),
        delta_status: status,
        is_modal: b === modal,
      };
    });

    variants.sort((a, b) => (b.pick ?? -Infinity) - (a.pick ?? -Infinity));
    const totalPickRounded = round4(totalPick);

    rows.push({
      group_key: `${ctx.hero?.id ?? "?"}|${coreKey}`,
      core_key: coreKey,
      hero: {
        id: ctx.hero?.id ?? null,
        name: ctx.hero?.name ?? null,
        head: ctx.hero?.head ?? null,
        tier: ctx.hero?.tier ?? null,
        wrAdj: ctx.hero?.wrAdj ?? null,
      },
      core: {
        item_ids: itemIds,
        items: itemsOf(itemIds, equipment),
        label: `Núcleo de ${itemIds.length} itens`,
      },
      variants,
      variant_count: variants.length,
      order_only: orderOnly,
      total_pick: totalPickRounded,
      pattern_scope: "single_hero",
      pattern_label: PATTERN_LABELS.single_hero,
      discovery_status: "local",
      support: { status: "ok", k: 1, m: builds.length, h: 1, min: { contexts: 1, builds: 1, mode: "and" } },
    });
  }

  rows.sort((a, b) => (b.total_pick ?? -Infinity) - (a.total_pick ?? -Infinity));
  const cores = rows.length;
  return {
    rows: rows.slice(0, VARIANTS_MAX_CORES),
    summary: {
      cores,
      cores_with_variants: rows.filter((r) => r.variant_count > 1).length,
      order_only_cores: rows.filter((r) => r.order_only).length,
    },
  };
}

function topBuildsFromContexts(contexts, equipment, emblemStrengthById = new Map()) {
  return (contexts ?? []).map((ctx) => {
    const refs = ctx.refs ?? { mostUsed: null, heroMean: null };
    const refMost = refs.mostUsed?.win ?? null;
    const refMean = refs.heroMean ?? null;
    const heroStrength = finiteUnit(ctx.hero?.wrAdj);

    const builds = (ctx.builds ?? []).map((b) => {
      const deltaMost = Number.isFinite(b.win) && Number.isFinite(refMost) ? b.win - refMost : null;
      const deltaMean = Number.isFinite(b.win) && Number.isFinite(refMean) ? b.win - refMean : null;
      const buildStrength = b.win;
      const emblemStrength = b.emblem?.id != null ? emblemStrengthById.get(b.emblem.id) ?? null : null;
      const combinationStrength = heroStrength != null && buildStrength != null && emblemStrength != null
        ? heroStrength * buildStrength * emblemStrength
        : null;
      return {
        win: b.win,
        pick: b.pick,
        delta_wr_pp_vs_most_used: toPp(deltaMost),
        delta_wr_pp_vs_mean: toPp(deltaMean),
        reference_win: refMost,
        reference_kind: "mais-usada",
        references: { most_used_win: refMost, hero_mean_win: refMean },
        hero_strength: heroStrength,
        build_strength: buildStrength,
        emblem_strength: emblemStrength,
        combination_strength: combinationStrength == null ? null : round4(combinationStrength),
        combination_strength_index: combinationStrength == null ? null : round4(combinationStrength * 100),
        items: b.items,
        item_ids: b.item_ids,
        order: b.order,
        emblem: b.emblem,
        talents: b.talents,
        spell: b.spell,
        core_key: b.core_key,
        variant_key: b.variant_key,
      };
    });

    return {
      hero: {
        id: ctx.hero?.id ?? null,
        name: ctx.hero?.name ?? null,
        head: ctx.hero?.head ?? null,
        tier: ctx.hero?.tier ?? null,
        wrAdj: ctx.hero?.wrAdj ?? null,
        win: ctx.hero?.win ?? null,
        pick: ctx.hero?.pick ?? null,
        ban: ctx.hero?.ban ?? null,
      },
      cell_status: ctx.status ?? (builds.length ? "ok" : "empty"),
      error: ctx.error ?? null,
      stale: !!ctx.stale,
      age_ms: ctx.ageMs ?? null,
      builds,
    };
  });
}

/**
 * Monta o contrato do agregado. `contexts` já vem na ordem de θ̂ do top-N.
 */
export function buildAggregate(input) {
  const {
    lane,
    rank,
    window = 7,
    top = 10,
    population = "ranked",
    contexts = [],
    equipment = {},
    emblems = {},
    spells = {},
    coverage = {},
    sources = {},
    generatedAt = new Date().toISOString(),
  } = input ?? {};

  const parsedContexts = contexts.map((ctx) => {
    const hero = ctx.hero ?? {};
    const builds = parseRawBuilds(ctx.rawBuilds, hero, { equipment, emblems, spells }, { rank, lane });
    const refs = referencesOf(builds);
    return {
      hero,
      builds,
      refs,
      status: ctx.status ?? (builds.length ? "ok" : "empty"),
      error: ctx.error ?? null,
      stale: !!ctx.stale,
      ageMs: ctx.ageMs ?? null,
    };
  });

  const cells = parsedContexts.map((ctx) => ({
    hero_id: ctx.hero?.id ?? null,
    hero_name: ctx.hero?.name ?? null,
    status: ctx.status === "error"
      ? "error"
      : ctx.stale
        ? "stale"
        : ctx.builds.length
          ? "ok"
          : "empty",
    builds: ctx.builds.length,
    reason: ctx.error ?? (ctx.builds.length ? null : "sem builds catalogadas nesta lane"),
    stale: !!ctx.stale,
    age_ms: ctx.ageMs ?? null,
  }));

  const allBuilds = parsedContexts.flatMap((ctx) => ctx.builds);
  const totalBuilds = allBuilds.length;
  const pickSum = round4(allBuilds.reduce((s, b) => s + (Number.isFinite(b.pick) ? b.pick : 0), 0));

  const packagesRaw = detectPackages(parsedContexts, equipment);
  const packagesSupported = packagesRaw.filter((p) => p.support.status === "ok");
  const packagesProvisional = packagesRaw.filter((p) => p.support.status !== "ok");
  // Itens de QUALQUER pacote observado não são ranqueados sozinhos — inclusive
  // os provisórios, pois a coocorrência já foi observada.
  const packageIds = new Set(packagesRaw.flatMap((p) => p.item_ids));

  // Itens fora de pacote: força individual (ou amostra insuficiente, sem número).
  const itemIds = new Set();
  for (const b of allBuilds) for (const id of b.item_ids ?? []) itemIds.add(id);

  const itemRows = [];
  const insufficientItems = [];
  for (const id of itemIds) {
    if (packageIds.has(id)) continue;
    const metric = contextMetric(parsedContexts, (b) => b.item_set?.has(id));
    const support = supportStatus(metric.k, metric.m, metric.h, ITEM_MIN_CONTEXTS, ITEM_MIN_BUILDS, "and");
    const item = itemOf(id, equipment);
    const scope = patternScope(metric.h);
    const row = {
      kind: "item",
      item_id: id,
      name: item.name,
      icon: item.icon,
      type: item.type,
      tips: item.tips,
      archetype: item.archetype,
      archetype_label: item.archetype_label ?? ARCHETYPE_LABELS[item.archetype] ?? item.archetype,
      total_builds: totalBuilds,
      pattern_scope: scope,
      pattern_label: PATTERN_LABELS[scope],
      discovery_status: discoveryStatus(support, metric.h),
      ...withMetricsRow({ total_builds: totalBuilds }, metric, support),
    };
    if (support.status === "ok") itemRows.push(row);
    else insufficientItems.push({
      item_id: id,
      name: item.name,
      icon: item.icon,
      archetype: item.archetype,
      archetype_label: row.archetype_label,
      contexts: metric.k,
      builds: metric.m,
      support,
    });
  }

  itemRows.sort((a, b) => (b.delta_wr_pp_median ?? -Infinity) - (a.delta_wr_pp_median ?? -Infinity) || (b.adoption_builds ?? -Infinity) - (a.adoption_builds ?? -Infinity));
  insufficientItems.sort((a, b) => b.builds - a.builds || b.contexts - a.contexts);

  const discoveryRank = { consolidated: 0, emerging: 1, local: 2, provisional: 3 };
  packagesSupported.sort((a, b) => {
    const da = discoveryRank[a.discovery_status] ?? 9;
    const db = discoveryRank[b.discovery_status] ?? 9;
    if (da !== db) return da - db;
    return (b.delta_wr_pp_median ?? -Infinity) - (a.delta_wr_pp_median ?? -Infinity) || (b.adoption_builds ?? -Infinity) - (a.adoption_builds ?? -Infinity);
  });
  packagesProvisional.sort((a, b) => b.builds - a.builds || b.contexts - a.contexts);

  const sets = setsFromContexts(parsedContexts, equipment);

  const emblemNameById = new Map();
  for (const b of allBuilds) {
    if (b.emblem?.id != null && b.emblem.name) emblemNameById.set(b.emblem.id, b.emblem.name);
  }
  const runePages = runePagesFromContexts(parsedContexts, emblemNameById);
  const emblemsOut = emblemRowsFromContexts(parsedContexts);
  const emblemStrengthById = new Map(emblemsOut.rows.map((row) => [row.emblem_id, row.win_median]));
  const talents = talentRows(parsedContexts, emblems);
  const spellRowsOut = spellRows(parsedContexts);
  const combiner = combinerFromContexts(parsedContexts, equipment, emblems);
  const variants = variantsFromContexts(parsedContexts, equipment);
  const topBuilds = topBuildsFromContexts(parsedContexts, equipment, emblemStrengthById);
  const triples = triplesFromContexts(parsedContexts, equipment);

  const countByStatus = (rows) => ({
    total: rows.length,
    consolidated: rows.filter((r) => r.discovery_status === "consolidated").length,
    emerging: rows.filter((r) => r.discovery_status === "emerging").length,
    local: rows.filter((r) => r.discovery_status === "local").length,
    provisional: rows.filter((r) => r.discovery_status === "provisional").length,
  });
  const discoverySummary = {
    triples: countByStatus(triples),
    packages: {
      ...countByStatus(packagesRaw),
      supported: packagesSupported.length,
      provisional: packagesProvisional.length,
    },
    sets: sets.summary,
  };

  const sensitivityRows = [
    ...itemRows,
    ...packagesSupported,
    ...sets.rows,
    ...emblemsOut.rows,
    ...runePages.rows,
    ...talents,
    ...spellRowsOut,
  ];
  const weightingSensitivityCounts = { stable: 0, large_shift: 0, sign_flip: 0, unknown: 0 };
  for (const row of sensitivityRows) {
    const key = row.weighting_sensitivity ?? "unknown";
    weightingSensitivityCounts[key] = (weightingSensitivityCounts[key] ?? 0) + 1;
  }

  const itemsCataloged = Object.keys(equipment ?? {}).length;
  const itemsUnclassified = Object.values(equipment ?? {}).filter((i) => i?.archetype === "unclassified").length;
  const partial = cells.some((c) => c.status === "error");

  return {
    version: AGGREGATE_VERSION,
    context: {
      rank,
      lane,
      window,
      top,
      population,
      generated_at: generatedAt,
      stale: false,
      age_ms: 0,
      window_applies_to: "hero_order_only",
      build_window: null,
    },
    coverage: {
      ...coverage,
      heroes_in_lane: coverage.heroes_in_lane ?? null,
      heroes_with_rank: coverage.heroes_with_rank ?? null,
      heroes_requested: coverage.heroes_requested ?? parsedContexts.length,
      heroes_with_builds: parsedContexts.filter((c) => c.builds.length).length,
      builds: totalBuilds,
      contexts: parsedContexts.filter((c) => c.builds.length).length,
      items_cataloged: coverage.items_cataloged ?? itemsCataloged,
      items_unclassified: coverage.items_unclassified ?? itemsUnclassified,
      pick_sum: pickSum,
      pick_sum_per_hero: round4(pickSum / Math.max(1, parsedContexts.filter((c) => c.builds.length).length)),
      pick_sum_status: "cataloged_participation_not_coverage",
      weighting_sensitivity_counts: weightingSensitivityCounts,
      cells_error: cells.filter((c) => c.status === "error").length,
      cells_empty: cells.filter((c) => c.status === "empty").length,
      partial,
      unit: "slot_share",
      exposure_status: "unvalidated",
    },
    packages: packagesSupported.slice(0, PACKAGES_MAX_ROWS),
    packages_provisional: packagesProvisional.slice(0, PACKAGES_MAX_ROWS),
    packages_total: packagesRaw.length,
    packages_ok: packagesSupported.length,
    packages_provisional_count: packagesProvisional.length,
    triples,
    triples_total: triples.length,
    items: itemRows.slice(0, ITEMS_MAX_ROWS),
    items_total: itemRows.length,
    items_insufficient: insufficientItems.slice(0, 5),
    items_insufficient_count: insufficientItems.length,
    sets: sets.rows,
    sets_total: sets.total,
    sets_counts: sets.counts,
    sets_summary: sets.summary,
    discovery_summary: discoverySummary,
    emblems: emblemsOut.rows,
    emblems_insufficient: emblemsOut.insufficient,
    emblems_total: emblemsOut.total,
    rune_pages: runePages.rows,
    rune_pages_insufficient: runePages.insufficient,
    talents,
    spells: spellRowsOut,
    combiner,
    variants: variants.rows,
    variant_summary: variants.summary,
    top_builds: topBuilds,
    cells,
    sources,
    metrics: {
      difference_unit: "percentage_points",
      difference_field: "delta_wr_pp",
      practical_delta_pp: PRACTICAL_DELTA_PP,
      lift_semantics: "reserved_for_ratio_metric_only",
      pick_weighting: "hypothesis_not_validated",
      support: {
        item: { contexts: ITEM_MIN_CONTEXTS, builds: ITEM_MIN_BUILDS, mode: "and" },
        emblem: { contexts: EMBLEM_MIN_CONTEXTS, builds: EMBLEM_MIN_BUILDS, mode: "and" },
        package: { contexts: PACKAGE_MIN_CONTEXTS, builds: PACKAGE_MIN_BUILDS, mode: "and" },
        set: { contexts: SET_MIN_HEROES, builds: SET_MIN_BUILDS, mode: "or" },
      },
      pattern_scope: {
        cross_hero: "h >= 3",
        two_heroes: "h == 2",
        single_hero: "h == 1",
      },
      discovery_status: {
        consolidated: "support ok && h >= 3",
        emerging: "support ok && h == 2",
        local: "support ok && h <= 1",
        provisional: "support not ok",
      },
      http_partial: "200_with_partial_true",
    },
    honesty: [
      "delta_wr_pp = diferença em pontos percentuais vs referência do contexto; não é lift-razão",
      "Associação descritiva (Camada A) · não causal",
      "Núcleo parcial 3–4 de 6 slots",
      "pick = participação catalogada · não é cobertura de partidas",
      "peso de pick é hipótese: weighted e unweighted publicados com sensitivity",
      "pacote provisório não é padrão consolidado",
      "padrão local (1 herói) é separado de padrão entre heróis (h>=3)",
      "Suporte = k contextos / m builds / h heróis · sem N de partidas",
      "Ordem do array não é ordem de compra",
      "Pro e ranked são populações separadas (pro não entra neste MVP)",
    ],
    note: "Builds agregadas por contexto (herói+lane+rank). Descobertas começam por trincas/pacotes; delta_wr_pp é diferença em pontos percentuais, não lift-razão. Pacotes sem suporte mínimo ficam provisórios e padrões de um herói são locais.",
    partial,
  };
}
