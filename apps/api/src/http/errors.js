// Taxonomia de erro do fio (F2). Antes, qualquer exceção virava 502
// ("upstream indisponível") — mascarando bug de código como falha de rede.
//
// 400/404/410/422/429 = erro do cliente ou estado esperado (o handler decide).
// 500 = exceção não tratada (bug): corpo genérico, detalhe só no log.
// 502 = falha REAL do upstream (os handlers de aplicação já devolvem 502).
export const HTTP = Object.freeze({
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  GONE: 410,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL: 500,
  UPSTREAM: 502,
  UNAVAILABLE: 503,
});

export class HttpError extends Error {
  constructor(status, code, message = code, extra = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function errorBody(code, message, extra = {}) {
  return { error: code, message, ...extra };
}

export function toErrorResponse(e) {
  if (e instanceof HttpError) {
    return { status: e.status, body: errorBody(e.code, e.message, e.extra) };
  }
  return { status: HTTP.INTERNAL, body: errorBody("internal_error", "Internal error") };
}
