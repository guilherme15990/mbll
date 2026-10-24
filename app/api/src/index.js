// Ponto de entrada da API (zero-dep). Toda a implementação vive em http/server.js.
// Config inválida derruba o processo aqui, com mensagem clara (fail-fast da F2).
try {
  const { startServer } = await import("./http/server.js");
  startServer();
} catch (e) {
  console.error(`api: falha ao iniciar — ${e?.message ?? e}`);
  process.exit(1);
}
