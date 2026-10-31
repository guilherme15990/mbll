// Shim de resolução para o checkJs da API.
//
// `@types/node/process.d.ts` usa `typeof import("punycode")` para tipar
// `process.getBuiltinModule`. Com `allowJs: true`, o tsc resolvia o pacote
// `punycode` do node_modules (hoisted por jsdom → whatwg-url → tr46, sem
// arquivo de tipos) e passava a CHECAR o `.js` de terceiro — 16 erros que não
// têm relação nenhuma com o código da API.
//
// `paths.punycode` (jsconfig.json) aponta para este arquivo, então a resolução
// termina aqui e o restante do `@types/node` continua intacto. Se algum dia a
// API precisar de punycode de verdade, importe `node:punycode` explicitamente —
// e remova este shim.

declare const punycode: {
  version: string;
  decode(input: string): string;
  encode(input: string): string;
  toASCII(input: string): string;
  toUnicode(input: string): string;
  ucs2: {
    decode(input: string): number[];
    encode(input: number[]): string;
  };
};

export = punycode;
