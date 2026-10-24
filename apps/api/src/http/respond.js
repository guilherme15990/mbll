// Respostas HTTP: CORS + content-type + content-length, em um lugar só.
// `send` é para JSON/string; `sendBuffer` nunca decodifica bytes (F2: estático
// binário-safe); `sendEmpty` cobre 304/HEAD sem corpo.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "content-type",
};

const TEXTUAL = /^(text\/|application\/(json|xml|javascript)|image\/svg\+xml)/;

export function send(res, code, body, type = "application/json", headers = {}) {
  const data = typeof body === "string" ? body : JSON.stringify(body);
  const buf = Buffer.from(data, "utf8");
  res.writeHead(code, { ...CORS, "content-type": `${type}; charset=utf-8`, "content-length": String(buf.length), ...headers });
  res.end(buf);
}

export function sendBuffer(res, code, buf, type = "application/octet-stream", headers = {}) {
  res.writeHead(code, {
    ...CORS,
    "content-type": TEXTUAL.test(type) ? `${type}; charset=utf-8` : type,
    "content-length": String(buf.length),
    ...headers,
  });
  res.end(buf);
}

export function sendEmpty(res, code, headers = {}) {
  res.writeHead(code, { ...CORS, ...headers });
  res.end();
}
