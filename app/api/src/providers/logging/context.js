// Contexto de request sem threading (ADR-045).
//
// O log precisa de `requestId`, método e rota em QUALQUER ponto da pilha —
// inclusive dentro do cliente do upstream, que não recebe o request como
// parâmetro. `AsyncLocalStorage` propaga esse contexto sem passar `req` por
// application → provider → rotas.
//
// Regra: o contexto é somente leitura para quem consome. Quem cria é o
// servidor HTTP (`http/server.js`), uma vez por request.
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * @typedef {Object} RequestContext
 * @property {string} requestId
 * @property {string} [method]
 * @property {string} [path]
 * @property {string} [route]
 */

/** @type {AsyncLocalStorage<RequestContext>} */
const storage = new AsyncLocalStorage();

/**
 * Executa `fn` com o contexto de request ativo.
 *
 * @template T
 * @param {RequestContext} ctx
 * @param {() => T} fn
 * @returns {T}
 */
export function withRequestContext(ctx, fn) {
  return storage.run(ctx, fn);
}

/**
 * Contexto do request atual, ou `null` fora de uma requisição
 * (script, job, teste unitário).
 *
 * @returns {RequestContext | null}
 */
export function currentRequestContext() {
  return storage.getStore() ?? null;
}
