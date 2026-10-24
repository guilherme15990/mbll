// Estático do apps/web/dist — binário-safe, com ETag/304 e cache por tipo.
//
// Antes: `readFile(file, "utf8")` corrompia png/woff/ico e não havia cache.
// Agora: Buffer intacto, Content-Length correto, ETag fraco (size+mtime),
// last-modified e Cache-Control por classe de arquivo.
import { readFile, stat } from "node:fs/promises";
import { extname, normalize, resolve, sep } from "node:path";
import { sendBuffer, sendEmpty } from "./respond.js";

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".map": "application/json",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".txt": "text/plain",
  ".xml": "application/xml",
};

// assets/ do Vite e nomes com hash são imutáveis; HTML não pode ser cacheado.
const IMMUTABLE = /(^|[\\/])assets[\\/]|[-.][a-z0-9]{8,}\.(?:js|css|woff2?|png|svg|webp)$/i;

function cacheControl(rel) {
  if (IMMUTABLE.test(rel)) return "public, max-age=31536000, immutable";
  if (extname(rel).toLowerCase() === ".html") return "no-cache";
  return "public, max-age=3600";
}

function mimeOf(file) {
  return MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
}

function etagMatches(header, etag) {
  return String(header).split(",").some((t) => {
    const v = t.trim();
    return v === "*" || v === etag;
  });
}

function insideRoot(root, file) {
  const base = root.endsWith(sep) ? root : root + sep;
  return file === root || file.startsWith(base);
}

/**
 * Tenta servir um arquivo de `webDist`. Devolve `true` se respondeu (inclui 304);
 * `false` deixa o chamador responder 404. Nunca lança.
 */
/**
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {string} pathname
 * @param {{ webDist?: string }} [options]
 */
export async function serveStatic(req, res, pathname, { webDist } = {}) {
  if (!webDist) return false;
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return false; }
  if (decoded.includes("\0")) return false;

  const rel = normalize(decoded === "/" ? "/index.html" : decoded).replace(/^[/\\]+/, "");
  const file = resolve(webDist, rel);
  if (rel.startsWith("..") || !insideRoot(webDist, file)) return false;

  let st;
  try { st = await stat(file); } catch { return false; }
  if (!st.isFile()) return false;

  const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
  const headers = {
    etag,
    "last-modified": st.mtime.toUTCString(),
    "cache-control": cacheControl(rel),
  };

  const inm = req.headers["if-none-match"];
  if (typeof inm === "string" && etagMatches(inm, etag)) {
    sendEmpty(res, 304, headers);
    return true;
  }

  let buf;
  try { buf = await readFile(file); } catch { return false; }

  if (req.method === "HEAD") {
    sendEmpty(res, 200, { ...headers, "content-type": mimeOf(file), "content-length": String(buf.length) });
    return true;
  }
  sendBuffer(res, 200, buf, mimeOf(file), headers);
  return true;
}
