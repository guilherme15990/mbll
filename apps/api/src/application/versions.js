// Versão do jogo / patches (cache de 1 h, alimentado pela Arena API).
// Extraído do routes.js sem mudança de comportamento: `versions()` continua
// devolvendo a lista crua e `patchFlag()` o carimbo postPatch/latest do /heroes.
import { arenaGet } from "../arena.js";

let patchCache = { at: 0, versions: [] };

export async function versions() {
  if (Date.now() - patchCache.at < 3600e3 && patchCache.versions.length) return patchCache.versions;
  try {
    const v = await arenaGet(`/api/academy/meta/version?size=5&index=1`);
    patchCache = { at: Date.now(), versions: v?.data?.records ?? v?.data ?? [] };
  } catch { /* mantém */ }
  return patchCache.versions;
}

// Versão do jogo reaproveitando o cache de patches (sem fetch novo).
export function currentGameVersion() {
  try {
    const vd = patchCache.versions?.[0]?.data ?? patchCache.versions?.[0] ?? {};
    return String(vd.version ?? vd.versao ?? vd.tag ?? vd.created_at ?? vd.createdAt ?? "desconhecida");
  } catch { return "desconhecida"; }
}

export function patchFlag(vers) {
  try {
    const dates = (vers ?? []).map((r) => new Date(r?.data?.created_at ?? r?.createdAt ?? r?.date ?? 0).getTime()).filter(Boolean);
    if (!dates.length) return { postPatch: false };
    const latest = Math.max(...dates);
    return { postPatch: Date.now() - latest < 3 * 86400e3, latest: new Date(latest).toISOString() };
  } catch { return { postPatch: false }; }
}
