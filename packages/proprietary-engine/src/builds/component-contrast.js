// Peso de componente por CONTRASTE dentro do contexto (ADR-031).
//
// O dado publicado por herói+lane+rank é um conjunto pequeno de builds curadas
// (até 3), cada uma com itens, emblema, talentos e feitiço. Comparar "builds que
// têm c" contra a *build mais usada* mede a mistura de builds, não o componente:
// se c está na build mais usada (ou em todas), o delta vira 0 ou o efeito médio
// das outras builds. Foi o que motivou trocar o estimador.
//
// Aqui o peso é um CONTRASTE no mesmo contexto (mesmo herói+lane+rank):
//
//   Δc = win(builds com c) − win(builds sem c)
//
// Quando as builds comparadas só diferem no slot de c (mesmos itens restantes,
// mesmo emblema, mesmos outros tiers, mesmo feitiço), o contraste é uma **troca
// pareada** e vira a evidência mais forte (`mode: "paired"`). Importante: o delta
// publicado continua sendo o contraste de coorte — numa troca de item, o que se
// observa é a diferença entre o item que entrou e o que saiu, e atribuímos
// metade a cada lado (o índice é aditivo, então a normalização é simétrica).
//
// O contraste é calculado por contexto (1 voto por herói+lane+rank), agregado
// pela mediana e encolhido por número de contextos com contraste: n/(n+K).
//
// Emblema é o caso especial: a escolha é constante dentro do herói (o papel
// determina o emblema), então quase nunca existe "sem c" no mesmo contexto.
// Sem contraste não há identificação — o emblema fica **descritivo** (uso e
// vitória das builds que o usam), nunca com peso estimado.
import { PRACTICAL_DELTA } from "../utils/thresholds.js";

export const CONTRAST_SHRINK_K = 3;

/**
 * Mínimos para publicar o valor como `observed` (senão é `estimated`).
 * `contexts` = contextos com contraste; `paired` = contextos com troca pareada.
 * Pareado conta por contexto (e não por par) para não inflar a evidência: 3
 * builds do mesmo herói são 1 voto, não 3.
 */
export const CONTRAST_MIN = {
  item: { contexts: 3, paired: 2 },
  talent: { contexts: 2, paired: 2 },
  spell: { contexts: 2, paired: 2 },
  // Emblema não é identificável por contraste: ver cabeçalho.
  emblem: { contexts: Infinity, paired: Infinity },
};

export const CONTRAST_EVIDENCE_RULE =
  "observed = contextos com contraste e contextos com troca pareada acima do mínimo; estimated = existe contraste mas abaixo do mínimo (valor encolhido); descriptive = emblema (sem contraste dentro do herói); none = componente nunca variou no recorte.";

function normalizeName(raw) {
  return typeof raw === "string"
    ? raw.trim().toLowerCase().replace(/[\u0300-\u036f]/g, "")
    : null;
}

function isFiniteNum(v) {
  return Number.isFinite(v);
}

function mean(xs) {
  const vals = xs.filter(isFiniteNum);
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
}

function median(xs) {
  const vals = xs.filter(isFiniteNum).sort((a, b) => a - b);
  if (!vals.length) return null;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
}

function weightedWin(builds) {
  const rows = (builds ?? []).filter((b) => isFiniteNum(b.win) && isFiniteNum(b.pick) && b.pick > 0);
  if (!rows.length) return mean((builds ?? []).map((b) => b.win));
  const denom = rows.reduce((s, b) => s + b.pick, 0);
  if (!(denom > 0)) return mean(rows.map((b) => b.win));
  return rows.reduce((s, b) => s + b.pick * b.win, 0) / denom;
}

/** Talentos por slot: tier do catálogo quando existe, senão a posição (1..3). */
function talentSlots(build) {
  return (build.talents ?? []).map((t, i) => ({
    slot: Number.isFinite(Number(t?.tier)) ? Number(t.tier) : i + 1,
    id: t?.id ?? null,
  }));
}

function itemIdsOf(build) {
  return new Set(build.item_ids ?? []);
}

function sameItems(a, b) {
  const sa = itemIdsOf(a);
  const sb = itemIdsOf(b);
  return sa.size === sb.size && [...sa].every((id) => sb.has(id));
}

/** Componentes presentes numa build, com a chave canônica usada no agregado. */
export function componentsOfBuild(build) {
  const out = [];
  for (const id of build.item_ids ?? []) {
    out.push({ key: `i:${id}`, kind: "item", id, slot: null });
  }
  if (build.emblem?.id != null) {
    out.push({ key: `e:${build.emblem.id}`, kind: "emblem", id: build.emblem.id, slot: null });
  }
  for (const { slot, id } of talentSlots(build)) {
    if (id == null) continue;
    out.push({ key: `t:${slot}:${id}`, kind: "talent", id, slot });
  }
  const spellKey = normalizeName(build.spell?.name);
  if (spellKey) out.push({ key: `s:${spellKey}`, kind: "spell", id: spellKey, slot: null });
  return out;
}

function hasComponent(build, comp) {
  if (comp.kind === "item") return itemIdsOf(build).has(comp.id);
  if (comp.kind === "emblem") return build.emblem?.id === comp.id;
  if (comp.kind === "talent") {
    return talentSlots(build).some((t) => t.slot === comp.slot && t.id === comp.id);
  }
  if (comp.kind === "spell") return normalizeName(build.spell?.name) === comp.id;
  return false;
}

/**
 * Troca pareada: as duas builds só diferem no slot de `comp`.
 * - item: saída = comp, entrada = exatamente 1 outro item (troca de 1 slot);
 * - talento: mesma coisa nos outros slots do mesmo tier;
 * - feitiço: mesmos itens/emblema/talentos.
 */
function cleanSwap(a, b, comp) {
  if ((a.emblem?.id ?? null) !== (b.emblem?.id ?? null)) return false;
  // O feitiço é o próprio componente quando kind === "spell": não exigir igualdade.
  if (comp.kind !== "spell"
    && (normalizeName(a.spell?.name) ?? null) !== (normalizeName(b.spell?.name) ?? null)) return false;

  if (comp.kind === "item") {
    const sa = itemIdsOf(a);
    const sb = itemIdsOf(b);
    if (!sa.has(comp.id) || sb.has(comp.id)) return false;
    if (sa.size !== sb.size) return false;
    const rest = [...sa].filter((id) => id !== comp.id);
    if (!rest.every((id) => sb.has(id))) return false;
    return [...sb].filter((id) => !sa.has(id)).length === 1;
  }

  if (!sameItems(a, b)) return false;

  if (comp.kind === "talent") {
    const ta = new Map(talentSlots(a).map((t) => [t.slot, t.id]));
    const tb = new Map(talentSlots(b).map((t) => [t.slot, t.id]));
    if (ta.get(comp.slot) !== comp.id) return false;
    // Build sem talento no slot não é "troca": é ausência (outra pergunta).
    if (!tb.has(comp.slot)) return false;
    for (const [slot, id] of ta) {
      if (slot === comp.slot) continue;
      if (tb.get(slot) !== id) return false;
    }
    return true;
  }

  return true;
}

/**
 * Contraste por contexto. Devolve Map<key, {kind,id,slot,delta_pp,pairs,paired,
 * mode,win_with,adoption}> — só para componentes com pelo menos 1 build com e
 * 1 build sem no mesmo contexto.
 */
export function contextContrasts(ctx) {
  const builds = (ctx?.builds ?? []).filter((b) => isFiniteNum(b.win));
  const out = new Map();
  if (builds.length < 2) return out;

  const seen = new Map();
  for (const b of builds) {
    for (const comp of componentsOfBuild(b)) {
      if (!seen.has(comp.key)) seen.set(comp.key, { ...comp, with: [] });
      seen.get(comp.key).with.push(b);
    }
  }

  for (const [key, comp] of seen) {
    const withBuilds = comp.with;
    const withoutBuilds = builds.filter((b) => !hasComponent(b, comp));
    if (!withoutBuilds.length || withBuilds.length === builds.length) continue;

    const wWith = weightedWin(withBuilds);
    const wWithout = weightedWin(withoutBuilds);
    if (wWith == null || wWithout == null) continue;

    let cleanPairs = 0;
    for (const wa of withBuilds) {
      for (const wb of withoutBuilds) {
        if (cleanSwap(wa, wb, comp)) cleanPairs++;
      }
    }

    out.set(key, {
      key,
      kind: comp.kind,
      id: comp.id,
      slot: comp.slot,
      delta_pp: round4((wWith - wWithout) * 100),
      pairs: cleanPairs,
      paired: cleanPairs > 0,
      mode: cleanPairs > 0 ? "paired" : "cohort",
      win_with: wWith,
      builds_with: withBuilds.length,
      builds_without: withoutBuilds.length,
    });
  }

  return out;
}

function round4(v) {
  return isFiniteNum(v) ? Math.round(v * 1e4) / 1e4 : null;
}

/**
 * Agrega os contrastes de todos os contextos.
 *
 * 1 contexto = 1 voto. Valor = mediana dos deltas × n/(n+K), com n = contextos
 * com contraste. `evidence` classifica o valor; nunca esconde o número quando
 * existe contraste (é `estimated`, não `null`).
 */
export function contrastEstimates(contexts) {
  const stats = new Map();

  for (const ctx of contexts ?? []) {
    const rows = contextContrasts(ctx);
    for (const row of rows.values()) {
      if (!stats.has(row.key)) {
        stats.set(row.key, {
          key: row.key,
          kind: row.kind,
          id: row.id,
          slot: row.slot,
          deltas: [],
          pairs: 0,
          contexts_contrast: 0,
          contexts_paired: 0,
          builds_with: 0,
          modes: new Set(),
        });
      }
      const s = stats.get(row.key);
      s.deltas.push(row.delta_pp);
      s.pairs += row.pairs;
      s.contexts_contrast += 1;
      if (row.paired) s.contexts_paired += 1;
      s.builds_with += row.builds_with;
      s.modes.add(row.mode);
    }
  }

  for (const s of stats.values()) {
    const pooled = median(s.deltas);
    const shrink = s.contexts_contrast > 0
      ? s.contexts_contrast / (s.contexts_contrast + CONTRAST_SHRINK_K)
      : 0;
    const min = CONTRAST_MIN[s.kind] ?? CONTRAST_MIN.item;
    const enough = s.contexts_contrast >= min.contexts
      && s.contexts_paired >= min.paired
      && s.pairs >= min.paired;
    const evidence = s.kind === "emblem"
      ? "descriptive"
      : enough
        ? "observed"
        : "estimated";
    const value = pooled == null ? null : round4(pooled * shrink);
    const practicalPp = PRACTICAL_DELTA * 100;
    const status = value == null
      ? "insufficient"
      : Math.abs(value) < practicalPp ? "no_practical_difference" : value > 0 ? "positive" : "negative";

    s.pooled_pp = round4(pooled);
    s.shrink = round4(shrink);
    s.value = s.kind === "emblem" ? null : value;
    s.evidence = evidence;
    s.status = status;
    s.mode = s.modes.has("paired") ? "paired" : "cohort";
    delete s.modes;
  }

  return stats;
}

/**
 * `value_pp` só recebe valor quando a evidência é `observed`; `value_pp_est`
 * recebe o valor encolhido quando é `estimated`. Emblema nunca recebe valor.
 */
export function valueFieldsOf(stat) {
  const observed = stat?.evidence === "observed" && isFiniteNum(stat.value) ? stat.value : null;
  const estimated = stat?.evidence === "estimated" && isFiniteNum(stat.value) ? stat.value : null;
  const value = observed ?? estimated;
  return {
    value_pp: observed,
    value_pp_est: estimated,
    value_pp_source: stat?.evidence ?? "none",
    power: value == null ? null : round4(100 + 10 * value),
    contrast: stat
      ? {
          contexts: stat.contexts_contrast,
          paired_contexts: stat.contexts_paired,
          pairs: stat.pairs,
          pooled_pp: stat.pooled_pp,
          shrink: stat.shrink,
          mode: stat.mode,
          status: stat.status,
        }
      : {
          contexts: 0,
          paired_contexts: 0,
          pairs: 0,
          pooled_pp: null,
          shrink: 0,
          mode: null,
          status: "insufficient",
        },
  };
}
