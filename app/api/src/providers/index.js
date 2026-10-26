// Raiz da camada de provedores (ADR-045).
//
// `providers/` é a base da pilha do backend:
//   providers  →  application  →  routes  →  http
//
// - `arena`     cliente + contratos da API EXTERNA (o que a fonte manda);
// - `logging`   logger estruturado + contexto de request (AsyncLocalStorage);
// - `contracts` contrato da API INTERNA (status/body, erro, envelope) + guardas.
//
// Nada aqui importa `application`, `routes` ou `http` — o gate de fronteiras
// falha se importar. É o que permite trocar a fonte sem tocar em regra de negócio.
export * as arena from "./arena/index.js";
export * as logging from "./logging/index.js";
export * from "./contracts.js";
