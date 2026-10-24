// Mock determinístico da Rone Arena API para testes de contrato da API interna.
//
// Objetivo: exercitar os 20 endpoints SEM rede e SEM depender da forma real do
// upstream, travando o contrato de saída (`/v1/*`) antes/depois da refatoração.
// Cada handler devolve exatamente o envelope que `app/api/src/routes.js` consome
// hoje — se o consumo mudar, este mock quebra e denuncia a mudança.
//
// Uso:
//   const mock = installUpstreamMock();
//   ... router(...) ...
//   mock.restore();
//   mock.calls  // ["/api/heroes/rank?days=7&rank=mythic&size=50&index=1", ...]

const json = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (h) => (String(h).toLowerCase() === "content-type" ? "application/json" : null) },
  text: async () => JSON.stringify(payload),
  json: async () => payload,
});

// 12 heróis: >= MIN_LOT (10) para o motor não cair em "lote degenerado",
// com picks somando exatamente 1 (checkPickSum ±0.005).
export const HEROES = [
  { id: 1, name: "Alpha", win: 0.56, pick: 0.15, ban: 0.30 },
  { id: 2, name: "Bravo", win: 0.54, pick: 0.13, ban: 0.25 },
  { id: 3, name: "Charlie", win: 0.53, pick: 0.12, ban: 0.20 },
  { id: 4, name: "Delta", win: 0.525, pick: 0.11, ban: 0.18 },
  { id: 5, name: "Echo", win: 0.52, pick: 0.1, ban: 0.15 },
  { id: 6, name: "Foxtrot", win: 0.51, pick: 0.09, ban: 0.12 },
  { id: 7, name: "Golf", win: 0.5, pick: 0.08, ban: 0.1 },
  { id: 8, name: "Hotel", win: 0.49, pick: 0.07, ban: 0.08 },
  { id: 9, name: "India", win: 0.48, pick: 0.06, ban: 0.06 },
  { id: 10, name: "Juliet", win: 0.47, pick: 0.04, ban: 0.05 },
  { id: 11, name: "Kilo", win: 0.46, pick: 0.03, ban: 0.04 },
  { id: 12, name: "Lima", win: 0.44, pick: 0.02, ban: 0.02 },
];

const head = (id) => `https://cdn.example/hero/${id}.png`;
const heroData = (h) => ({
  main_heroid: h.id,
  main_hero_win_rate: h.win,
  main_hero_ban_rate: h.ban,
  main_hero_appearance_rate: h.pick,
  main_hero: { data: { name: h.name, head: head(h.id) } },
});

const DURATION = {
  min_win_rate6: 0.58, min_win_rate6_8: 0.56, min_win_rate8_10: 0.54,
  min_win_rate10_12: 0.52, min_win_rate12_14: 0.51, min_win_rate14_16: 0.5,
  min_win_rate16_18: 0.49, min_win_rate18_20: 0.48, min_win_rate20: 0.46,
};

const subHero = (id, delta, win) => ({
  heroid: id,
  increase_win_rate: delta,
  hero_win_rate: win,
  hero_appearance_rate: 0.08,
  hero: { data: { name: `Hero ${id}`, head: head(id) } },
  ...DURATION,
});

const BUILD = (i) => ({
  build_win_rate: 0.6 - i * 0.01,
  build_pick_rate: 0.3 - i * 0.05,
  equipid: [101 + i, 102 + i, 103 + i, 104 + i, 105 + i, 106 + i],
  emblem: { data: { emblemid: 42, emblemname: "Support", attriicon: "https://cdn.example/emblem/42.png" } },
  new_rune_skill: [7, 9],
  battleskill: { data: { skillname: "Flicker", skillicon: "https://cdn.example/spell/flicker.png" } },
});

const EQUIPMENT = (i) => ({
  equipid: 101 + i,
  equipname: `Item ${101 + i}`,
  equipicon: `https://cdn.example/item/${101 + i}.png`,
  equiptypename: "Attack",
  equiptips: "<div>+40 Physical ATK</div><br/><div>+10% Attack Speed</div>",
});

function route(pathname, search, raw) {
  // /api/heroes/rank — lote de heróis por rank/janela (paginado)
  if (pathname === "/api/heroes/rank") {
    const size = Number(search.get("size") ?? 50);
    const index = Number(search.get("index") ?? 1);
    const slice = HEROES.slice((index - 1) * size, index * size);
    return json({ data: { total: HEROES.length, records: slice.map((h) => ({ data: heroData(h) })) } });
  }
  // /api/heroes — catálogo (133 por página)
  if (pathname === "/api/heroes") {
    return json({
      data: {
        total: HEROES.length,
        records: HEROES.map((h) => ({
          data: { hero_id: h.id, hero: { data: { name: h.name, head: head(h.id), smallmap: null } } },
        })),
      },
    });
  }
  // /api/heroes/:id/trends
  let m = /^\/api\/heroes\/(\d+)\/trends$/.exec(pathname);
  if (m) {
    const days = Number(search.get("past-days") ?? 30);
    const win_rate = Array.from({ length: Math.min(days, 30) }, (_, i) => ({
      date: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`,
      win_rate: 0.5 + (i % 5) * 0.001,
      app_rate: 0.1,
      ban_rate: 0.2,
    }));
    return json({ data: { records: [{ data: { win_rate } }] } });
  }
  // /api/heroes/:id/counters e /compatibility
  m = /^\/api\/heroes\/(\d+)\/(counters|compatibility)$/.exec(pathname);
  if (m) {
    const id = Number(m[1]);
    const sub = (base, delta) => subHero(base, delta, 0.5 + delta);
    return json({
      data: {
        records: [{
          data: {
            main_hero: { data: { name: `Hero ${id}`, head: head(id) } },
            sub_hero: [sub((id % 12) + 1, 0.05), sub(((id + 3) % 12) + 1, 0.02), sub(((id + 5) % 12) + 1, -0.01)],
            sub_hero_last: [sub(((id + 6) % 12) + 1, -0.04), sub(((id + 8) % 12) + 1, -0.07)],
          },
        }],
      },
    });
  }
  // /api/heroes/positions
  if (pathname === "/api/heroes/positions") {
    return json({
      data: {
        records: HEROES.map((h) => ({
          data: {
            hero_id: h.id,
            hero: { data: { name: h.name, head: head(h.id), roadsort: [{ data: { road_sort_title: "Mid Lane" } }] } },
          },
        })),
      },
    });
  }
  // /api/academy/heroes/:id/lane
  m = /^\/api\/academy\/heroes\/(\d+)\/lane$/.exec(pathname);
  if (m) {
    return json({
      data: { records: [{ data: { hero: { data: { roadsort: [{ data: { road_sort_title: "Mid Lane" } }] } } } }] },
    });
  }
  // /api/academy/heroes/:id/builds
  m = /^\/api\/academy\/heroes\/(\d+)\/builds$/.exec(pathname);
  if (m) {
    return json({
      data: {
        total: 1,
        records: [{ data: { hero_name: `Hero ${m[1]}`, build: [0, 1, 2].map(BUILD) } }],
      },
    });
  }
  // /api/academy/equipment (catálogo simples) e /expanded (classificado)
  if (pathname === "/api/academy/equipment/expanded") {
    return json({ data: { total: 6, records: [0, 1, 2, 3, 4, 5].map((i) => ({ data: EQUIPMENT(i) })) } });
  }
  if (pathname === "/api/academy/equipment") {
    return json({
      data: { total: 6, records: [0, 1, 2, 3, 4, 5].map((i) => ({ data: EQUIPMENT(i) })) },
    });
  }
  if (pathname === "/api/academy/emblems") {
    return json({
      data: {
        total: 2,
        records: [
          { data: { giftid: 7, gifttiers: 1, emblemskill: { skillname: "Agility", skillicon: "https://cdn.example/t7.png", skilldesc: "movement speed" } } },
          { data: { giftid: 9, gifttiers: 3, emblemskill: { skillname: "Lethal", skillicon: "https://cdn.example/t9.png", skilldesc: "extra damage" } } },
        ],
      },
    });
  }
  if (pathname === "/api/academy/spells") {
    return json({
      data: {
        total: 1,
        records: [{ data: { skillname: "Flicker", skillicon: "https://cdn.example/spell/flicker.png", skilldesc: "blink" } }],
      },
    });
  }
  if (pathname === "/api/academy/meta/version") {
    return json({
      data: { total: 1, records: [{ data: { version: "1.2.3", created_at: new Date().toISOString() } }] },
    });
  }
  throw new Error(`mock: caminho upstream não mapeado -> ${pathname}${raw}`);
}

/**
 * Instala o mock em globalThis.fetch. Devolve `{calls, restore, reset}`.
 * `calls` guarda URL+query de cada requisição (auditoria de fan-out).
 */
export function installUpstreamMock() {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url.pathname + url.search);
    return route(url.pathname, url.searchParams, url.search);
  };
  return {
    calls,
    reset: () => { calls.length = 0; },
    restore: () => { globalThis.fetch = original; },
  };
}
