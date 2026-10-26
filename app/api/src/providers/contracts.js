// Contratos da API INTERNA (o que o Radar devolve em /v1), não da fonte.
//
// Duas camadas diferentes, de propósito:
// - `providers/arena/types.js` descreve o que a Arena MANDA.
// - este arquivo descreve o que o Radar PROMETE.
//
// O contrato do fio é pequeno e estável: `{ status, body }` em toda rota,
// `{ error, message }` no erro e `{ data, total?, stale?, ageMs? }` no envelope
// de leitura. DTOs de domínio (herói, build, agregado) continuam no motor/web
// até existir um pacote compartilhado — inventar 100 campos aqui só criaria
// uma terceira verdade.
//
// As guardas (`assert*`) rodam em teste: contrato que ninguém verifica é
// comentário. Elas também são o ponto de extensão para o dia em que o web
// consumir estes tipos.
//
// TODO(ADR-045): publicar estes tipos para `app/web` (pacote/`paths`) para que
// o tipo do agregado na web deixe de ser escrito à mão.

/** Prefixo de todas as rotas internas versionadas. */
export const API_PREFIX = "/v1";

/** Campos obrigatórios do corpo de erro — o resto é contexto do caso. */
export const ERROR_FIELDS = Object.freeze(["error", "message"]);

/** Campos opcionais aceitos no envelope de leitura. */
export const ENVELOPE_META_FIELDS = Object.freeze(["total", "stale", "ageMs"]);

/**
 * @typedef {Object} ErrorBody
 * @property {string} error
 * @property {string} message
 * @property {string} [requestId]
 * @property {unknown} [detail]
 */

/**
 * Resultado de toda rota: o dispatcher HTTP só conhece `status` + `body`.
 *
 * @template [T=unknown]
 * @typedef {Object} RouteResult
 * @property {number} status
 * @property {T} body
 */

/**
 * Envelope de leitura usado por catálogos/listas. `stale` e `ageMs` só
 * aparecem quando há cache envolvido; `total` só em lista.
 *
 * @template T
 * @typedef {Object} ReadEnvelope
 * @property {T} data
 * @property {number} [total]
 * @property {boolean} [stale]
 * @property {number} [ageMs]
 */

export class ContractError extends Error {
  /** @param {string} message @param {Record<string, unknown>} [detail] */
  constructor(message, detail = {}) {
    super(message);
    this.name = "ContractError";
    this.detail = detail;
  }
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = (value) => value != null && typeof value === "object" && !Array.isArray(value);

/**
 * @param {unknown} value
 * @param {string} [label]
 * @returns {asserts value is RouteResult}
 */
export function assertRouteResult(value, label = "route") {
  if (!isObject(value)) throw new ContractError(`${label}: resultado não é objeto`);
  const status = value.status;
  if (typeof status !== "number" || !Number.isInteger(status) || status < 100 || status > 599) {
    throw new ContractError(`${label}: status inválido`, { status });
  }
  if (!("body" in value)) throw new ContractError(`${label}: body ausente`, { status });
}

/**
 * @param {unknown} value
 * @param {string} [label]
 * @returns {asserts value is ErrorBody}
 */
export function assertErrorBody(value, label = "error") {
  if (!isObject(value)) throw new ContractError(`${label}: corpo não é objeto`);
  for (const field of ERROR_FIELDS) {
    if (typeof value[field] !== "string" || !value[field]) {
      throw new ContractError(`${label}: campo "${field}" ausente ou vazio`, { field });
    }
  }
}

/**
 * @param {unknown} value
 * @param {string} [label]
 * @returns {asserts value is ReadEnvelope<unknown>}
 */
export function assertEnvelope(value, label = "envelope") {
  if (!isObject(value)) throw new ContractError(`${label}: corpo não é objeto`);
  if (!("data" in value) || value.data === undefined) {
    throw new ContractError(`${label}: data ausente`);
  }
  if ("total" in value && (typeof value.total !== "number" || !Number.isFinite(value.total))) {
    throw new ContractError(`${label}: total não é número finito`, { total: value.total });
  }
  if ("stale" in value && typeof value.stale !== "boolean") {
    throw new ContractError(`${label}: stale não é booleano`, { stale: value.stale });
  }
  if ("ageMs" in value && (typeof value.ageMs !== "number" || !Number.isFinite(value.ageMs))) {
    throw new ContractError(`${label}: ageMs não é número finito`, { ageMs: value.ageMs });
  }
}
