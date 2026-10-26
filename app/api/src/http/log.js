// Compatibilidade: a camada de logging mudou de casa na ADR-045.
//
// A implementação vive em `providers/logging` (logger + contexto de request).
// Este arquivo mantém o import histórico de `http/server.js` e de qualquer
// consumidor que ainda aponte para `http/log.js`. Não adicione lógica aqui.
export {
  createLogger,
  configureLogging,
  getLogger,
  serializeError,
  LOG_EVENTS,
} from "../providers/logging/index.js";

export { withRequestContext, currentRequestContext } from "../providers/logging/context.js";
