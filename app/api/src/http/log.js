// Log estruturado mínimo (uma linha JSON por evento), zero-dep.
// Níveis: silent < error < info < debug. `sink` injetável para teste.
const PRIORITY = { silent: 0, error: 1, info: 2, debug: 3 };

export function createLogger(level = "info", sink = console) {
  const min = PRIORITY[level] ?? PRIORITY.info;
  const write = (lvl, msg, fields = {}) => {
    if (PRIORITY[lvl] > min) return;
    const line = JSON.stringify({ ts: new Date().toISOString(), level: lvl, msg, ...fields });
    if (lvl === "error" && typeof sink.error === "function") sink.error(line);
    else sink.log(line);
  };
  return {
    level,
    error: (msg, fields) => write("error", msg, fields),
    info: (msg, fields) => write("info", msg, fields),
    debug: (msg, fields) => write("debug", msg, fields),
  };
}
