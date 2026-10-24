// Estado de saúde do processo (exposto em /meta/status).
// Módulo único: antes `startedAt`/`layerHealth` viviam no topo do routes.js.
const startedAt = Date.now();
const layerHealth = { errors: 0, lastOk: null, lastErr: null };

export function markLayerOk() {
  layerHealth.lastOk = new Date().toISOString();
}

export function markLayerError(e) {
  layerHealth.errors++;
  layerHealth.lastErr = String(e?.message ?? e);
}

export function healthState() {
  return { startedAt, layerHealth };
}

export function startedAtIso() {
  return new Date(startedAt).toISOString();
}

export function layerHealthState() {
  return layerHealth;
}
