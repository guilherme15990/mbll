/**
 * Primitiva HTTP da web. Sem conhecimento de domínio: um verbo, uma taxonomia.
 *
 * Toda leitura de `/v1` passa por aqui. O tratamento de status fica num lugar
 * só — antes vivia dentro do monolito `shared/api` misturado a 18 hooks e 40 tipos.
 */
import { ApiError, NetworkError } from "./errors";

export async function getJSON<T>(url: string): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url);
  } catch (cause) {
    throw new NetworkError(url, cause);
  }
  if (!r.ok) throw new ApiError(r.status, url);
  return r.json() as Promise<T>;
}
