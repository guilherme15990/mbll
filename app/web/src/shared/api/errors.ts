/**
 * Taxonomia de erro do transporte.
 *
 * Antes: todo erro virava `new Error("HTTP 500")` — a UI não distinguia "o
 * servidor respondeu 404" de "o servidor não respondeu". O `message` é
 * preservado (`HTTP ${status}`) para não mudar nenhum texto já exibido.
 */

/** A fonte respondeu, mas com status != 2xx. */
export class ApiError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(status: number, url: string) {
    super(`HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
  }

  /** 4xx = o pedido está errado; repetir não melhora. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

/** O fetch rejeitou: DNS, TLS, offline, CORS, abort. */
export class NetworkError extends Error {
  readonly url: string;
  readonly cause: unknown;

  constructor(url: string, cause: unknown) {
    super("Fonte indisponível");
    this.name = "NetworkError";
    this.url = url;
    this.cause = cause;
  }
}

/** Política de retry única do app: repetir só o que pode melhorar. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.isClientError) return false;
  return failureCount < 2;
}
