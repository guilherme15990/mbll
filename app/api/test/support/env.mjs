// Hermetismo dos testes da API.
//
// PROBLEMA QUE ISTO RESOLVE: `src/infra/db.js` resolve `SQLITE_FILE` e abre o
// banco no topo do módulo (top-level await). Sem env própria, todo `node --test`
// gravava no banco de dev. O histórico é append-only, então cada execução
// acumulava linhas e a suíte passava a falhar de forma crescente (série de teste
// com >200 coletas escondia o snapshot recém-inserido; ver listSnapshots).
//
// Este módulo DEVE ser o primeiro import do arquivo de teste: em ESM os módulos
// são avaliados em ordem de import, então o env vale antes de `../src/routes.js`
// (e de `../src/infra/db.js`) serem avaliados.
import { unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

const file = join(tmpdir(), `radar-api-test-${process.pid}-${randomUUID()}.sqlite`);

process.env.SQLITE_FILE = file;
// "on" de propósito: o caminho SQLite precisa ser exercitado — foi nele que o
// bug de janela da série apareceu. O fallback em memória não o reproduz.
process.env.SQLITE_CACHE = "on";

export const TEST_SQLITE_FILE = file;

process.on("exit", () => {
  for (const f of [file, `${file}-wal`, `${file}-shm`, `${file}-journal`]) {
    try { unlinkSync(f); } catch { /* já removido */ }
  }
});
