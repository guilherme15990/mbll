// Contratos da API EXTERNA (Rone Arena) — o formato que chega, não o que sai.
//
// Por que isto existe: o cliente antigo devolvia `any`. Toda rota adivinhava a
// forma (`raw?.data?.records?.[0]?.data?.build`), e um campo renomeado na fonte
// virava `undefined` silencioso em produção. Aqui a forma observada no código
// real (e nos fixtures de `app/api/test/support/upstream.mjs`) fica declarada em
// um lugar só.
//
// Regras:
// - Campo que a fonte pode omitir é opcional. Nada é inventado como obrigatório.
// - Número que chega como string (`"0.512"`) é tipado `number | string`: a
//   normalização (`Number(...)`) é responsabilidade de quem consome.
// - Estes tipos NÃO são o contrato da API interna. Aquele vive em
//   `providers/contracts.js`.
//
// Este arquivo é só tipo em runtime: `export {}` o mantém módulo para permitir
// `import("./types.js").ArenaPage` via JSDoc.

/**
 * Envelope paginado da fonte. `records[]` é a lista; `total` só aparece em
 * endpoints paginados de verdade (rank, por exemplo).
 *
 * @template T
 * @typedef {Object} ArenaPage
 * @property {{ records?: T[], total?: number }} [data]
 */

/**
 * Envelope que às vezes vem paginado e às vezes como lista direta
 * (`/api/academy/meta/version` faz os dois no código atual).
 *
 * @template T
 * @typedef {Object} ArenaListOrPage
 * @property {{ records?: T[], total?: number } | T[]} [data]
 */

/**
 * @typedef {Object} ArenaImage
 * @property {string | null} [name]
 * @property {string | null} [head]
 * @property {string | null} [smallmap]
 */

// ── GET /api/heroes/rank ────────────────────────────────────────────────────

/**
 * Linha de força do herói. A fonte às vezes aninha em `record.data`, às vezes
 * entrega os campos no próprio record — por isso `ArenaRankStats` é usado nos
 * dois níveis.
 *
 * @typedef {Object} ArenaRankStats
 * @property {number | string | null} [main_heroid]
 * @property {number | string | null} [heroid]
 * @property {number | string | null} [main_hero_win_rate]
 * @property {number | string | null} [main_hero_ban_rate]
 * @property {number | string | null} [main_hero_appearance_rate]
 * @property {number | string | null} [main_hero_pick_rate]
 * @property {{ data?: ArenaImage }} [main_hero]
 */

/** @typedef {ArenaRankStats & { data?: ArenaRankStats }} ArenaRankRecord */

// ── GET /api/heroes ─────────────────────────────────────────────────────────

/**
 * @typedef {Object} ArenaCatalogHero
 * @property {number | string | null} [hero_id]
 * @property {{ data?: ArenaImage }} [hero]
 */

/** @typedef {{ data?: ArenaCatalogHero }} ArenaCatalogHeroRecord */

// ── GET /api/academy/equipment[/expanded] ───────────────────────────────────

/**
 * O item expandido carrega campos de classificação (`type`, `tips`) que o motor
 * interpreta; aqui só os identificadores são declarados. Campos extras são
 * permitidos estruturalmente e consumidos por `normalizeEquipmentCatalog`.
 *
 * @typedef {Object} ArenaEquipmentItem
 * @property {number | string | null} [equipid]
 * @property {string | null} [equipname]
 * @property {string | null} [equipicon]
 * @property {string | null} [type]
 * @property {string | null} [tips]
 */

/** @typedef {{ data?: ArenaEquipmentItem }} ArenaEquipmentRecord */

// ── GET /api/academy/emblems ────────────────────────────────────────────────

/**
 * @typedef {Object} ArenaEmblemSkill
 * @property {string | null} [skillname]
 * @property {string | null} [skilldesc]
 * @property {string | null} [skilldescemblem]
 * @property {string | null} [skillicon]
 * @property {string | number | null} [numdescribe]
 */

/**
 * @typedef {Object} ArenaEmblemItem
 * @property {number | string | null} [giftid]
 * @property {number | string | null} [gifttiers]
 * @property {ArenaEmblemSkill} [emblemskill]
 */

/** @typedef {{ data?: ArenaEmblemItem }} ArenaEmblemRecord */

// ── GET /api/academy/spells ─────────────────────────────────────────────────

/**
 * @typedef {Object} ArenaSpellItem
 * @property {string | null} [skillname]
 * @property {string | null} [skillicon]
 * @property {string | null} [skilldesc]
 * @property {string | null} [skillshortdesc]
 * @property {ArenaSpellItem} [__data]
 */

/** @typedef {{ data?: ArenaSpellItem }} ArenaSpellRecord */

// ── GET /api/heroes/positions e /api/academy/heroes/:id/lane ────────────────

/**
 * @typedef {Object} ArenaRoadSort
 * @property {{ data?: { road_sort_id?: number | null, road_sort_title?: string | null, road_sort_icon?: string | null } }} [data]
 */

/**
 * @typedef {Object} ArenaHeroPosition
 * @property {number | string | null} [hero_id]
 * @property {number | string | null} [heroid]
 * @property {{ data?: ArenaImage & { roadsort?: ArenaRoadSort[] } }} [hero]
 * @property {ArenaRoadSort[]} [roadsort]
 */

/** @typedef {{ data?: ArenaHeroPosition }} ArenaPositionRecord */

/**
 * @typedef {Object} ArenaLaneRecord
 * @property {{ hero?: { data?: ArenaImage & { roadsort?: ArenaRoadSort[] } } }} [data]
 */

// ── GET /api/academy/heroes/:id/builds ──────────────────────────────────────

/**
 * @typedef {Object} ArenaBuildEmblem
 * @property {number | string | null} [emblemid]
 * @property {string | null} [emblemname]
 * @property {string | null} [name]
 * @property {string | null} [attriicon]
 * @property {string | null} [emblemicon]
 */

/**
 * @typedef {Object} ArenaBuildEntry
 * @property {number | string | null} [build_win_rate]
 * @property {number | string | null} [build_pick_rate]
 * @property {Array<number | string>} [equipid]
 * @property {Array<number | string>} [new_rune_skill]
 * @property {Array<number | string>} [rune_skill]
 * @property {number | string | null} [runeid]
 * @property {{ data?: ArenaBuildEmblem }} [emblem]
 * @property {{ data?: { skillname?: string | null, skillicon?: string | null, __data?: { skillname?: string | null, skillicon?: string | null } } }} [battleskill]
 */

/**
 * @typedef {Object} ArenaBuildRecord
 * @property {{ hero_name?: string | null, build?: ArenaBuildEntry[] }} [data]
 */

// ── GET /api/heroes/:id/trends ──────────────────────────────────────────────

/**
 * @typedef {Object} ArenaTrendPoint
 * @property {string} [date]
 * @property {number | string} [win_rate]
 * @property {number | string} [app_rate]
 * @property {number | string} [ban_rate]
 */

/**
 * @typedef {Object} ArenaTrendRecord
 * @property {{ data?: { win_rate?: ArenaTrendPoint[] } }} [data]
 */

// ── GET /api/heroes/:id/counters e /compatibility ───────────────────────────

/**
 * @typedef {Object} ArenaPairRef
 * @property {number | string | null} [heroid]
 * @property {number | string | null} [increase_win_rate]
 * @property {number | string | null} [hero_win_rate]
 * @property {number | string | null} [hero_appearance_rate]
 * @property {{ data?: ArenaImage }} [hero]
 */

/**
 * @typedef {Object} ArenaMatchupData
 * @property {{ data?: ArenaImage }} [main_hero]
 * @property {ArenaPairRef[]} [sub_hero]
 * @property {ArenaPairRef[]} [sub_hero_last]
 */

/** @typedef {{ data?: ArenaMatchupData }} ArenaMatchupRecord */

// ── GET /api/academy/meta/version ───────────────────────────────────────────

/**
 * @typedef {Object} ArenaVersion
 * @property {string | null} [version]
 * @property {string | null} [versao]
 * @property {string | null} [tag]
 * @property {string | null} [created_at]
 * @property {string | null} [createdAt]
 * @property {string | null} [date]
 */

/** @typedef {{ data?: ArenaVersion } & ArenaVersion} ArenaVersionRecord */

export {};
