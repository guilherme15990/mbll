// Validadores de query compartilhados pelas rotas.
// Antes cada handler repetia `RANKS.includes(rank) || WINDOWS.has(window)`;
// a regra agora tem um dono só — o fio (códigos de erro) continua o mesmo.
import { RANKS } from "../arena.js";

export const WINDOWS = new Set([1, 3, 7, 15, 30]);

export const isRank = (r) => RANKS.includes(r);
export const isWindow = (w) => WINDOWS.has(w);
export const isDays = (d, { min = 1, max = 90 } = {}) =>
  Number.isInteger(d) && d >= min && d <= max;
