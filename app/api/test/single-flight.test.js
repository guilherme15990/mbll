// Single-flight compartilhado (F3): uma execução por chave, N chamadores.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSingleFlight } from "../src/application/singleFlight.js";

const tick = () => new Promise((r) => setImmediate(r));

describe("single-flight", () => {
  it("executa fn uma vez e entrega a mesma promise aos concorrentes", async () => {
    const flight = createSingleFlight();
    let calls = 0;
    let release;
    const gate = new Promise((r) => { release = r; });

    const fn = async () => { calls++; await gate; return { v: 1 }; };
    const a = flight.run("k", fn);
    const b = flight.run("k", fn);
    assert.equal(a, b, "mesma promise");
    assert.equal(flight.size, 1);

    release();
    assert.deepEqual(await a, { v: 1 });
    assert.deepEqual(await b, { v: 1 });
    assert.equal(calls, 1);
    await tick();
    assert.equal(flight.size, 0, "chave liberada após settle");
  });

  it("isola chaves diferentes", async () => {
    const flight = createSingleFlight();
    let calls = 0;
    const fn = async (n) => { calls++; return n; };
    assert.deepEqual(await Promise.all([flight.run("a", () => fn(1)), flight.run("b", () => fn(2))]), [1, 2]);
    assert.equal(calls, 2);
  });

  it("erro propaga para todos e libera a chave para retry", async () => {
    const flight = createSingleFlight();
    let calls = 0;
    const boom = () => { calls++; return Promise.reject(new Error("falhou")); };
    const a = flight.run("k", boom);
    const b = flight.run("k", boom);
    await assert.rejects(a, /falhou/);
    await assert.rejects(b, /falhou/);
    assert.equal(calls, 1);
    await tick();
    assert.equal(flight.has("k"), false);
    assert.equal(await flight.run("k", async () => "ok"), "ok");
  });

  it("peek não inicia execução; has reflete o andamento", async () => {
    const flight = createSingleFlight();
    assert.equal(flight.peek("k"), undefined);
    assert.equal(flight.has("k"), false);
    let release;
    const p = flight.run("k", () => new Promise((r) => { release = r; }));
    assert.equal(flight.peek("k"), p);
    assert.equal(flight.has("k"), true);
    await Promise.resolve(); // fn roda no microtask agendado por run()
    release("fim");
    assert.equal(await p, "fim");
  });
});
