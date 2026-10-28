import { test } from "node:test";
import assert from "node:assert/strict";
import { PassThrough, Writable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { AresApiClient } from "../src/interfaces/api-client.js";
import { runRepl } from "../src/interfaces/repl.js";
function channels() {
  let text = "";
  return {
    input: new PassThrough(),
    output: new Writable({
      write(chunk, _encoding, done) {
        text += chunk.toString();
        done();
      },
    }),
    text: () => text,
  };
}
function client(
  action: (input: string, init?: RequestInit) => Response | Promise<Response>,
) {
  return new AresApiClient(
    { api: "http://127.0.0.1:3001", origin: "http://127.0.0.1:5175" },
    async (url, init) => {
      if (String(url).endsWith("/health"))
        return Response.json({ service: "ares-backend", version: "1.0.0" });
      if (String(url).endsWith("/access/session"))
        return Response.json({ mode: "local", user: { role: "admin" } });
      return action(String(url), init);
    },
  );
}
test("REPL: entrada canalizada conserva orden y confirma el segundo turno con contexto", async () => {
  const io = channels(),
    messages: unknown[] = [];
  const api = client(async (_url, init) => {
    messages.push(JSON.parse(String(init?.body)));
    await delay(20);
    return new Response(
      'event: done\ndata: {"content":"Respuesta confirmada","provider":"openrouter","model":"fixture"}\n\n',
      { headers: { "Content-Type": "text/event-stream" } },
    );
  });
  const running = runRepl(api, io);
  io.input.end("chat Primero\nchat Segundo\nexit\n");
  const result = await running;
  assert.equal(result.errors, 0);
  assert.equal(messages.length, 2);
  assert.equal((messages[1] as { history: unknown[] }).history.length, 2);
  assert.match(io.text(), /Terminal cerrada/);
});
test(
  "REPL: cancel interrumpe un SSE activo sin esperar la próxima orden ni guardar el parcial",
  { timeout: 5000 },
  async () => {
    const io = channels();
    let cancelled = false;
    const api = client(
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  'event: delta\ndata: {"text":"Propuesta parcial"}\n\n',
                ),
              );
            },
            cancel() {
              cancelled = true;
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        ),
    );
    const running = runRepl(api, io);
    io.input.write("chat Espera\n");
    for (let i = 0; i < 100 && !io.text().includes("Propuesta parcial"); i++)
      await delay(10);
    assert.match(io.text(), /Propuesta parcial/);
    io.input.end("cancel\nexit\n");
    const result = await running;
    assert.equal(cancelled, true);
    assert.equal(result.errors, 0);
    assert.match(io.text(), /Operación cancelada/);
    assert.doesNotMatch(io.text(), /\[Respuesta confirmada/);
  },
);
test("REPL: un error de API queda registrado para el código de salida de lotes", async () => {
  const io = channels(),
    api = client(() =>
      Response.json({ error: { message: "Cuota agotada" } }, { status: 429 }),
    );
  const running = runRepl(api, io);
  io.input.end("chat Consulta\nhelp\nexit\n");
  const result = await running;
  assert.equal(result.errors, 1);
  assert.match(io.text(), /Cuota agotada/);
  assert.match(io.text(), /órdenes disponibles/);
});
