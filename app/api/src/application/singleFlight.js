// Single-flight compartilhado: uma execução por chave, N chamadores.
//
// Antes cada módulo tinha seu próprio mapa (`emblemsInFlight`, `aggInFlight`).
// Esta é a única implementação: quem chama `run(key, fn)` durante uma execução
// recebe a MESMA promise; ao terminar (sucesso ou erro), a chave é liberada para
// a próxima tentativa.
//
// Importante: a promise devolvida propaga o erro para todos os chamadores. A
// limpeza é registrada em um ramo separado para não gerar unhandled rejection.
export function createSingleFlight() {
  const inflight = new Map(); // key -> Promise

  function cleanup(key, promise) {
    if (inflight.get(key) === promise) inflight.delete(key);
  }

  return {
    run(key, fn) {
      const existing = inflight.get(key);
      if (existing) return existing;
      const promise = Promise.resolve().then(fn);
      inflight.set(key, promise);
      promise.then(
        () => cleanup(key, promise),
        () => cleanup(key, promise),
      );
      return promise;
    },
    /** Promise em andamento (ou undefined), sem iniciar nada. */
    peek(key) {
      return inflight.get(key);
    },
    has(key) {
      return inflight.has(key);
    },
    get size() {
      return inflight.size;
    },
  };
}
