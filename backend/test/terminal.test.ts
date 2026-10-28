import { test } from "node:test";
import assert from "node:assert/strict";
import { AresApiClient } from "../src/interfaces/api-client.js";
import {
  TerminalSession,
  terminalText,
  suggestTask,
} from "../src/interfaces/terminal-session.js";
const project = "00000000-0000-4000-8000-000000000001",
  conversation = "00000000-0000-4000-8000-000000000002",
  other = "00000000-0000-4000-8000-000000000003",
  runId = "00000000-0000-4000-8000-000000000004",
  hash = "a".repeat(64);
const signal = () => new AbortController().signal;
const stream = (data: unknown, partial = "Texto progresivo") =>
  new Response(
    `event: delta\ndata: ${JSON.stringify({ text: partial })}\n\n${data ? `event: done\ndata: ${JSON.stringify(data)}\n\n` : ""}`,
    { headers: { "Content-Type": "text/event-stream" } },
  );
function session(fetcher: typeof fetch) {
  let output = "";
  const client = new AresApiClient(
    { api: "http://127.0.0.1:3001", origin: "http://127.0.0.1:5175" },
    fetcher,
  );
  return {
    terminal: new TerminalSession(client, (text) => {
      output += text;
    }),
    client,
    output: () => output,
  };
}
function setup(url: string) {
  if (url.endsWith("/projects"))
    return Response.json({
      projects: [{ id: project, name: "Proyecto sintético" }],
    });
  if (url.endsWith("/conversations"))
    return Response.json({
      conversation: {
        id: conversation,
        projectId: project,
        title: "Terminal",
        revision: 0,
      },
    });
  return undefined;
}

test("terminal: salud distingue el backend propio de otro puerto y limpia controles ANSI/OSC", async () => {
  const wrong = session(async () =>
    Response.json({ status: "ONLINE", agent: "otro backend" }),
  );
  await assert.rejects(wrong.client.health(), /no corresponde/);
  assert.equal(
    terminalText("Hola\x1b]52;c;c2VjcmV0\x07\x1b[31m\x08\r\nfin"),
    "Hola\nfin",
  );
});
test("terminal: chat sin proyecto conserva solo turnos confirmados y usa el modo elegido", async () => {
  const inputs: Record<string, unknown>[] = [];
  let fail = true;
  const state = session(async (_url, init) => {
    inputs.push(JSON.parse(String(init?.body)));
    if (fail) return stream(null);
    return stream({
      content: "Respuesta completa",
      provider: "gemini",
      model: "fixture",
    });
  });
  await state.terminal.execute("mode documentation", signal());
  await assert.rejects(
    state.terminal.execute("chat Consulta uno", signal()),
    /sin confirmar/,
  );
  fail = false;
  await state.terminal.execute("chat Consulta dos", signal());
  await state.terminal.execute("Consulta tres", signal());
  assert.deepEqual(inputs[1]?.history, []);
  assert.equal((inputs[2]?.history as unknown[]).length, 2);
  assert.equal(inputs[2]?.task, "documentation");
  assert.match(state.output(), /Respuesta confirmada/);
});
test("terminal: reintento persistente conserva requestId/revisión sin duplicar conversación", async () => {
  const inputs: Record<string, unknown>[] = [];
  let creates = 0;
  const state = session(async (url, init) => {
    const route = String(url);
    if (route.endsWith("/conversations")) creates++;
    const initial = setup(route);
    if (initial) return initial;
    inputs.push(JSON.parse(String(init?.body)));
    return inputs.length === 1
      ? stream(null)
      : stream({
          content: "Confirmado",
          provider: "openrouter",
          conversationId: conversation,
          revision: 1,
          messages: [],
        });
  });
  await state.terminal.execute("project " + project, signal());
  await assert.rejects(
    state.terminal.execute("chat Consulta", signal()),
    /sin confirmar/,
  );
  await assert.rejects(
    state.terminal.execute("chat No dupliques", signal()),
    /retry/,
  );
  await state.terminal.execute("retry", signal());
  assert.equal(creates, 1);
  assert.deepEqual(inputs[0], inputs[1]);
  assert.equal(state.terminal.conversation?.revision, 1);
});
test("terminal: resume y biblioteca rechazan otro proyecto antes de mostrar su contenido", async () => {
  const state = session(
    async (url) =>
      setup(String(url)) ??
      Response.json({
        conversation: { id: other, projectId: other, title: "No mostrar" },
        messages: [{ content: "PRIVATE_OTHER_PROJECT" }],
      }),
  );
  await state.terminal.execute("project " + project, signal());
  await assert.rejects(
    state.terminal.execute("resume " + other, signal()),
    /no pertenece/,
  );
  assert.doesNotMatch(state.output(), /PRIVATE_OTHER_PROJECT/);
});
test("terminal: resume oculta POSE interno del modelo y conserva el texto del usuario", async () => {
  const marker = "[🛡️ POSE 1: Centinela | OJOS: [| |] | ESCUDO: DOCS]";
  const state = session(async (url) => setup(String(url)) ?? Response.json({
    conversation: { id: conversation, projectId: project, title: "Historial", revision: 1 },
    messages: [{ role: "user", content: marker }, { role: "model", content: `Explicación.\n${marker}\nLímite.` }],
    hasMore: false,
  }));
  await state.terminal.execute("project " + project, signal());
  await state.terminal.execute("resume " + conversation, signal());
  assert.match(state.output(), /ARES: Explicación\.\nLímite\./);
  assert.equal(state.output().split(marker).length - 1, 1);
});

test("terminal: auditoría adjunta ruta/huella y no confirma ejecución de pruebas; ddd usa AST API", async () => {
  let body: Record<string, unknown> | undefined,
    staticChecks = 0;
  const state = session(async (url, init) => {
    const route = String(url),
      initial = setup(route);
    if (initial) return initial;
    if (route.includes("/workspace/file?"))
      return Response.json({
        file: {
          path: "domain/order.ts",
          sha256: hash,
          content: "export const total=1;",
          redacted: false,
        },
      });
    if (route.endsWith("/architecture")) {
      staticChecks++;
      return Response.json({ findings: [], scope: "static" });
    }
    body = JSON.parse(String(init?.body));
    return stream({
      content: "Análisis estático",
      conversationId: conversation,
      revision: 1,
      messages: [],
      provider: "openrouter",
    });
  });
  await state.terminal.execute("project " + project, signal());
  await state.terminal.execute("audit domain/order.ts", signal());
  assert.deepEqual(body?.files, [{ path: "domain/order.ts", sha256: hash }]);
  await state.terminal.execute("ddd domain/order.ts", signal());
  assert.equal(staticChecks, 1);
});
test("terminal: run prepara, exige huella y después muestra estado/exit reales de API", async () => {
  let posts = 0;
  const state = session(async (url, init) => {
    const route = String(url),
      initial = setup(route);
    if (initial) return initial;
    if (route.includes("/scripts?"))
      return Response.json({
        scripts: [{ name: "test", command: "node --test", runnable: true }],
        manifestHash: hash,
        runnerAvailable: true,
      });
    if (route.endsWith("/workspace"))
      return Response.json({ runnerIsolation: "docker" });
    if (init?.method === "POST") {
      posts++;
      return Response.json({
        run: {
          id: runId,
          requestId: JSON.parse(String(init.body)).requestId,
          status: "RUNNING",
          output: "inicio",
          exitCode: null,
        },
      });
    }
    return Response.json({
      run: {
        id: runId,
        status: "PASSED",
        output: "inicio\n3 tests passed",
        exitCode: 0,
      },
    });
  });
  await state.terminal.execute("project " + project, signal());
  await state.terminal.execute("run test", signal());
  assert.equal(posts, 0);
  await assert.rejects(
    state.terminal.execute("confirm " + "b".repeat(64), signal()),
    /No coincide/,
  );
  await state.terminal.execute("confirm " + hash, signal());
  assert.equal(posts, 1);
  assert.match(state.output(), /PASSED · exitCode=0/);
  await assert.rejects(
    state.terminal.execute("run rm -rf", signal()),
    /Usa run/,
  );
});
test("terminal: cancelar durante el arranque recupera solo su requestId y cancela ese job", async () => {
  const controller = new AbortController();
  let requestId = "",
    cancelled = false;
  const state = session(async (url, init) => {
    const route = String(url),
      initial = setup(route);
    if (initial) return initial;
    if (route.includes("/scripts?"))
      return Response.json({
        scripts: [{ name: "test", command: "node --test", runnable: true }],
        manifestHash: hash,
        runnerAvailable: true,
      });
    if (route.endsWith("/workspace"))
      return Response.json({ runnerIsolation: "docker" });
    if (route.endsWith("/cancel")) {
      cancelled = true;
      return Response.json({});
    }
    if (init?.method === "POST") {
      requestId = JSON.parse(String(init.body)).requestId;
      controller.abort();
      throw Error("aborted");
    }
    return Response.json({
      runs: [{ id: runId, requestId, status: "RUNNING" }],
    });
  });
  await state.terminal.execute("project " + project, signal());
  await state.terminal.execute("run test", signal());
  await assert.rejects(
    state.terminal.execute("confirm " + hash, controller.signal),
  );
  assert.equal(cancelled, true);
});
test("terminal: stream no admite confirmación vacía y respeta errores de roles", async () => {
  const state = session(async () =>
    Response.json(
      { error: { message: "Tu acceso es de lectura." } },
      { status: 403 },
    ),
  );
  await assert.rejects(
    state.terminal.execute("chat Consulta", signal()),
    /lectura/,
  );
  const incomplete = session(async () => stream({ content: "" }));
  await assert.rejects(
    incomplete.terminal.execute("chat Consulta", signal()),
    /contenido completo/,
  );
});
test("terminal: auto enruta documentación a Gemini y arquitectura/código a OpenRouter; el modo manual prevalece", async () => {
  const tasks: string[] = [];
  const state = session(async (url, init) => {
    if (String(url).endsWith("/health"))
      return Response.json({
        service: "ares-backend",
        providers: {
          gemini: { configured: true, model: "g-fixture" },
          openrouter: { configured: true, model: "o-fixture" },
        },
      });
    const input = JSON.parse(String(init?.body));
    tasks.push(input.task);
    return stream({
      content: "Propuesta",
      provider: input.task === "documentation" ? "gemini" : "openrouter",
    });
  });
  await state.terminal.execute("mode auto", signal());
  await state.terminal.execute("route Genera un README", signal());
  assert.equal(tasks.length, 0);
  assert.match(state.output(), /g-fixture/);
  await state.terminal.execute("chat Genera un README", signal());
  await state.terminal.execute("chat Diseña bounded contexts DDD", signal());
  await state.terminal.execute("mode code", signal());
  await state.terminal.execute("chat Genera un README", signal());
  assert.deepEqual(tasks, ["documentation", "architecture", "programming"]);
  assert.equal(suggestTask("Audita seguridad de esta función").task, "audit");
  assert.equal(suggestTask("Hola").task, "programming");
});
test("terminal: una ejecución FAILED no se presenta como éxito", async () => {
  const state = session(async (url, init) => {
    const route = String(url),
      initial = setup(route);
    if (initial) return initial;
    if (route.includes("/scripts?"))
      return Response.json({
        scripts: [{ name: "test", command: "node --test", runnable: true }],
        manifestHash: hash,
        runnerAvailable: true,
      });
    if (route.endsWith("/workspace"))
      return Response.json({ runnerIsolation: "docker" });
    return Response.json({
      run: { id: runId, status: "FAILED", output: "not ok 1", exitCode: 1 },
    });
  });
  await state.terminal.execute("project " + project, signal());
  await state.terminal.execute("run test", signal());
  await assert.rejects(
    state.terminal.execute("confirm " + hash, signal()),
    /no terminó satisfactoriamente/,
  );
  assert.match(state.output(), /FAILED · exitCode=1/);
  assert.doesNotMatch(state.output(), /PASSED/);
});
