// JSON canônico + hash estável, sem dependência.
// Usado pelo SnapshotHistory (hash do lote) e pelo agregado de builds (hash dos
// catálogos/registros). Chaves de objeto ordenadas recursivamente; arrays mantêm
// a ordem (a ordem É parte do payload).
import { createHash } from "node:crypto";

export function canonicalPayload(v) {
  if (Array.isArray(v)) return `[${v.map(canonicalPayload).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalPayload(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

export function payloadHash(obj) {
  return createHash("sha256").update(canonicalPayload(obj), "utf8").digest("hex");
}
