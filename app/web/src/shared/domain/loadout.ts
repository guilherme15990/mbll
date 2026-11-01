import type { CombinerPick } from "./combiner";

/**
 * Loadout endereçável — a composição que o jogador leva (ADR-044).
 *
 * `CombinerPick` já era o objeto de decisão do produto, mas vivia em `useState`:
 * morria no reload, não tinha id e não sabia de onde veio. Aqui ele ganha
 * endereço próprio (URL), proveniência e assinatura — sem virar comando de
 * domínio e sem backend de escrita.
 *
 * Regras que este módulo garante:
 *
 * 1. **Nada de win rate inventado.** `observedEvidence` só devolve evidência
 *    quando a composição coincide com uma build observada (`match.status ===
 *    "exact"`). Composição editada nunca herda a estatística da original.
 * 2. **Campos não comparáveis não viram "igual".** Build sem id de emblema é
 *    `unknown`, não `exact` — o matcher prefere admitir a lacuna.
 * 3. **URL é dado não confiável.** `decodeLoadout` nunca lança: valida, limita
 *    e devolve erro legível.
 *
 * Puro por construção: sem import de runtime, só `import type`.
 */

export const LOADOUT_VERSION = 1;

/** Teto do código na URL (o payload real fica bem abaixo disso). */
export const LOADOUT_CODE_MAX = 2048;

const MAX_ITEMS = 6;
const MAX_TALENTS = 3;
const MAX_LABEL = 24;
const MAX_SPELL = 64;

export type LoadoutProvenance = "observed" | "custom";

export type Loadout = {
  v: typeof LOADOUT_VERSION;
  heroId: number;
  lane: string;
  rank: string;
  window: string;
  pick: CombinerPick;
  provenance: LoadoutProvenance;
  /** Itens que vieram de uma build observada; o resto é composição livre. */
  observedItems: number;
  /** Assinatura da build de origem (null quando a composição é livre). */
  ref: string | null;
};

export type LoadoutResult = { ok: true; loadout: Loadout } | { ok: false; error: string };

export type ObservedBuild = {
  items: { id?: number | null }[];
  emblem?: { id?: number | null } | null;
  talents?: { id?: number | null }[] | null;
  spell?: { name: string | null } | null;
};

export type ObservedBuildWithEvidence = ObservedBuild & {
  win?: number | null;
  pick?: number | null;
  lift_vs_most_used?: number | null;
  lift_vs_mean?: number | null;
  reference_win?: number | null;
};

export type LoadoutMatchStatus = "exact" | "partial" | "none";

export type LoadoutMatch = {
  status: LoadoutMatchStatus;
  build: ObservedBuildWithEvidence | null;
  /** Campos que foram comparados e bateram. */
  compared: string[];
  /** Campos em que a fonte não permite comparação (ex.: emblema sem id). */
  unknown: string[];
  /** Campos explicitamente diferentes. */
  mismatched: string[];
};

export type ObservedEvidence = {
  win: number | null;
  pick: number | null;
  liftVsMostUsed: number | null;
  liftVsMean: number | null;
  referenceWin: number | null;
};

// ── base64url sem dependência (funciona em browser e Node) ───────────────────

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const ALPHABET_INDEX: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (let i = 0; i < ALPHABET.length; i++) map[ALPHABET[i]] = i;
  return map;
})();

function bytesToCode(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const has1 = i + 1 < bytes.length;
    const has2 = i + 2 < bytes.length;
    const b1 = has1 ? bytes[i + 1] : 0;
    const b2 = has2 ? bytes[i + 2] : 0;

    out += ALPHABET[b0 >> 2];
    out += ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)];
    if (!has1) break;
    out += ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)];
    if (!has2) break;
    out += ALPHABET[b2 & 0x3f];
  }
  return out;
}

function codeToBytes(code: string): Uint8Array | null {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const ch of code) {
    const value = ALPHABET_INDEX[ch];
    if (value === undefined) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

// ── helpers de forma ─────────────────────────────────────────────────────────

const isId = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v > 0 && v < 1e9;

function label(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const clean = v.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!clean) return null;
  return clean.slice(0, max);
}

function idList(v: unknown, max: number): number[] | null {
  if (!Array.isArray(v)) return null;
  if (v.length > max) return null;
  const out: number[] = [];
  for (const raw of v) {
    if (!isId(raw)) return null;
    if (!out.includes(raw)) out.push(raw);
  }
  return out;
}

function optionalId(v: unknown): number | null {
  if (v == null) return null;
  return isId(v) ? v : null;
}

/** Assinatura estável da composição. Ordem não importa: a fonte não traz ordem de compra. */
export function signatureOfPick(pick: CombinerPick): string {
  const items = [...new Set(pick.itemIds)].sort((a, b) => a - b).join("-");
  const talents = [...new Set(pick.talentIds)].sort((a, b) => a - b).join("-");
  const spell = (pick.spellName ?? "").trim().toLowerCase();
  return `${items}|${pick.emblemId ?? ""}|${talents}|${spell}`;
}

/** Itens da composição que não vieram de observação — a parte "inventada" do loadout. */
export function freeCompositionItems(loadout: Loadout): number {
  return Math.max(0, loadout.pick.itemIds.length - loadout.observedItems);
}

// ── encode / decode ──────────────────────────────────────────────────────────

type Payload = {
  v: number;
  h: number;
  l: string;
  r: string;
  w: string;
  i: number[];
  e: number | null;
  t: number[];
  s: string | null;
  p: 0 | 1;
  n: number;
  f: string | null;
};

export function encodeLoadout(loadout: Loadout): string {
  const payload: Payload = {
    v: LOADOUT_VERSION,
    h: loadout.heroId,
    l: loadout.lane,
    r: loadout.rank,
    w: loadout.window,
    i: loadout.pick.itemIds,
    e: loadout.pick.emblemId,
    t: loadout.pick.talentIds,
    s: loadout.pick.spellName,
    p: loadout.provenance === "observed" ? 1 : 0,
    n: loadout.observedItems,
    f: loadout.ref,
  };
  return bytesToCode(new TextEncoder().encode(JSON.stringify(payload)));
}

export function decodeLoadout(code: string | null | undefined): LoadoutResult {
  if (code == null || !code.trim()) {
    return { ok: false, error: "A URL não traz nenhum loadout (código ausente ou vazio)." };
  }
  const trimmed = code.trim().replace(/=+$/, "");
  if (trimmed.length > LOADOUT_CODE_MAX) {
    return { ok: false, error: "Código de loadout maior que o permitido." };
  }

  const bytes = codeToBytes(trimmed);
  if (!bytes) return { ok: false, error: "Código de loadout ilegível (caracteres fora do base64url)." };

  let raw: unknown;
  try {
    // `fatal` recusa bytes que não são UTF-8 em vez de inventar caracteres.
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return { ok: false, error: "Código de loadout corrompido — não foi possível ler o conteúdo." };
  }

  return loadoutFromPayload(raw);
}

function loadoutFromPayload(raw: unknown): LoadoutResult {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Conteúdo do loadout inválido." };
  const p = raw as Record<string, unknown>;

  if (p.v !== LOADOUT_VERSION) {
    return { ok: false, error: `Versão de loadout não suportada (recebido ${String(p.v)}).` };
  }
  if (!isId(p.h)) return { ok: false, error: "Loadout sem herói válido." };

  const lane = label(p.l, MAX_LABEL);
  const rank = label(p.r, MAX_LABEL);
  const win = label(p.w, MAX_LABEL);
  if (!lane || !rank || !win) return { ok: false, error: "Loadout sem lane, elo ou janela." };

  const items = idList(p.i, MAX_ITEMS);
  if (!items) return { ok: false, error: `Lista de itens inválida (máximo ${MAX_ITEMS}).` };

  const talents = idList(p.t, MAX_TALENTS);
  if (!talents) return { ok: false, error: `Lista de talentos inválida (máximo ${MAX_TALENTS}).` };

  const emblemId = optionalId(p.e);
  if (p.e != null && emblemId == null) return { ok: false, error: "Id de emblema inválido." };

  const spellName = p.s == null ? null : label(p.s, MAX_SPELL);
  if (p.s != null && spellName == null) return { ok: false, error: "Feitiço inválido." };

  const provenance: LoadoutProvenance = p.p === 1 ? "observed" : "custom";
  const observedItems = typeof p.n === "number" && Number.isInteger(p.n) && p.n >= 0 ? Math.min(p.n, items.length) : 0;
  const ref = p.f == null ? null : label(p.f, 128);

  return {
    ok: true,
    loadout: {
      v: LOADOUT_VERSION,
      heroId: p.h,
      lane,
      rank,
      window: win,
      pick: { itemIds: items, emblemId, talentIds: talents, spellName },
      provenance,
      observedItems,
      ref,
    },
  };
}

// ── fork a partir de build observada ─────────────────────────────────────────

export type ForkResult =
  | { ok: true; loadout: Loadout; skipped: string[] }
  | { ok: false; error: string };

export type ForkParams = {
  heroId: number | string;
  lane: string;
  rank: string;
  window: string;
  build: ObservedBuild;
};

/**
 * Materializa uma build observada como loadout endereçável.
 *
 * Não é comando de domínio: nada é gravado. O loadout é uma derivação
 * determinística da build + do contexto, e vive na URL.
 */
export function forkObservedBuild(params: ForkParams): ForkResult {
  const heroId = typeof params.heroId === "number" ? params.heroId : Number.parseInt(params.heroId, 10);
  if (!isId(heroId)) return { ok: false, error: "Fork sem herói válido." };

  const lane = label(params.lane, MAX_LABEL);
  const rank = label(params.rank, MAX_LABEL);
  const win = label(params.window, MAX_LABEL);
  if (!lane || !rank || !win) return { ok: false, error: "Fork sem lane, elo ou janela." };

  const skipped: string[] = [];

  const itemIds: number[] = [];
  for (const item of params.build.items ?? []) {
    if (isId(item?.id)) {
      if (!itemIds.includes(item.id)) itemIds.push(item.id);
    } else {
      skipped.push("item sem id");
    }
  }

  const emblemId = isId(params.build.emblem?.id) ? params.build.emblem!.id! : null;
  if (params.build.emblem && emblemId == null) skipped.push("emblema sem id");

  const talentIds: number[] = [];
  for (const talent of params.build.talents ?? []) {
    if (isId(talent?.id)) {
      if (!talentIds.includes(talent.id)) talentIds.push(talent.id);
    } else {
      skipped.push("talento sem id");
    }
  }

  const spellName = label(params.build.spell?.name, MAX_SPELL);

  if (itemIds.length === 0) {
    return { ok: false, error: "Build sem id de item — não há composição endereçável." };
  }

  const pick: CombinerPick = { itemIds, emblemId, talentIds, spellName };

  return {
    ok: true,
    skipped: [...new Set(skipped)],
    loadout: {
      v: LOADOUT_VERSION,
      heroId,
      lane,
      rank,
      window: win,
      pick,
      provenance: "observed",
      observedItems: itemIds.length,
      ref: signatureOfPick(pick),
    },
  };
}

// ── match contra builds observadas ───────────────────────────────────────────

function sameIdSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...new Set(a)].sort((x, y) => x - y);
  const right = [...new Set(b)].sort((x, y) => x - y);
  return left.every((v, i) => v === right[i]);
}

function comparePickToBuild(pick: CombinerPick, build: ObservedBuildWithEvidence) {
  const compared: string[] = [];
  const unknown: string[] = [];
  const mismatched: string[] = [];

  // Itens — quantidade primeiro: build de 3 itens nunca "bate" com loadout de 6.
  const buildItems = (build.items ?? []).map((i) => i?.id ?? null);
  if (buildItems.length !== pick.itemIds.length) {
    mismatched.push("itens");
  } else if (buildItems.some((id) => !isId(id))) {
    unknown.push("itens");
  } else if (sameIdSet(buildItems as number[], pick.itemIds)) {
    compared.push("itens");
  } else {
    mismatched.push("itens");
  }

  // Emblema — o payload por herói às vezes só traz nome.
  const buildEmblem = build.emblem?.id ?? null;
  if (pick.emblemId == null && build.emblem == null) {
    compared.push("emblema");
  } else if (!isId(pick.emblemId) || !isId(buildEmblem)) {
    unknown.push("emblema");
  } else if (pick.emblemId === buildEmblem) {
    compared.push("emblema");
  } else {
    mismatched.push("emblema");
  }

  // Talentos — mesma regra: quantidade e conjunto.
  const buildTalents = (build.talents ?? []).map((t) => t?.id ?? null);
  if (buildTalents.length !== pick.talentIds.length) {
    mismatched.push("talentos");
  } else if (buildTalents.some((id) => !isId(id))) {
    unknown.push("talentos");
  } else if (sameIdSet(buildTalents as number[], pick.talentIds)) {
    compared.push("talentos");
  } else {
    mismatched.push("talentos");
  }

  // Feitiço — comparado por nome normalizado.
  const pickSpell = (pick.spellName ?? "").trim().toLowerCase();
  const buildSpell = (build.spell?.name ?? "").trim().toLowerCase();
  if (!pickSpell && !buildSpell) compared.push("feitiço");
  else if (!pickSpell || !buildSpell) mismatched.push("feitiço");
  else if (pickSpell === buildSpell) compared.push("feitiço");
  else mismatched.push("feitiço");

  return { compared, unknown, mismatched };
}

/**
 * Procura a build observada de que este loadout é cópia fiel.
 *
 * `exact` = todos os campos comparáveis batem e nenhum ficou em aberto.
 * `partial` = bate no que dá para comparar, mas a fonte não traz algum id.
 * `none` = alguma build difere explicitamente ou não há base de comparação.
 */
export function matchLoadout(
  loadout: Loadout,
  builds: readonly ObservedBuildWithEvidence[] | null | undefined,
): LoadoutMatch {
  let partial: LoadoutMatch | null = null;
  // Sem match exato, ainda vale dizer *por que* não bateu: a tela mostra o campo divergente.
  let closest: LoadoutMatch | null = null;

  for (const build of builds ?? []) {
    const cmp = comparePickToBuild(loadout.pick, build);

    if (cmp.mismatched.length === 0 && cmp.unknown.length === 0) {
      return { status: "exact", build, ...cmp };
    }

    if (cmp.mismatched.length === 0) {
      if (!partial || cmp.compared.length > partial.compared.length) {
        partial = { status: "partial", build, ...cmp };
      }
    } else if (!closest || cmp.mismatched.length < closest.mismatched.length) {
      closest = { status: "none", build, ...cmp };
    }
  }

  return partial ?? closest ?? { status: "none", build: null, compared: [], unknown: [], mismatched: [] };
}

/**
 * Evidência observada — **só** quando existe build idêntica.
 *
 * Este é o invariante de honestidade do produto: trocar um item não pode
 * continuar exibindo o win rate da build original.
 */
export function observedEvidence(match: LoadoutMatch): ObservedEvidence | null {
  if (match.status !== "exact" || !match.build) return null;
  return {
    win: match.build.win ?? null,
    pick: match.build.pick ?? null,
    liftVsMostUsed: match.build.lift_vs_most_used ?? null,
    liftVsMean: match.build.lift_vs_mean ?? null,
    referenceWin: match.build.reference_win ?? null,
  };
}
