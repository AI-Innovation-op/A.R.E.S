import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AresApiClient, localAddress } from "../src/interfaces/api-client.js";
import { createActions } from "../src/interfaces/actions.js";
const project = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002",
  origin = "http://127.0.0.1:5175";
test("adaptador: backend local exacto, sin redirecciones ni credenciales en URL", () => {
  for (const url of [
    "https://example.com",
    "http://127.0.0.1@evil.test",
    "http://localhost/path",
    "http://localhost/?key=x",
    "file:///a",
  ])
    assert.throws(() => localAddress(url));
  assert.equal(localAddress("http://127.0.0.1:3001"), "http://127.0.0.1:3001");
});
test("adaptador: catálogo acotado y proyecto fijo; opt-in de propuestas no expone aplicación/ejecución/publicación", async () => {
  const client = new AresApiClient(
    { api: "http://localhost:3001", origin },
    async (input, init) => {
      assert.equal(init?.redirect, "error");
      assert.equal(new Headers(init?.headers).get("Origin"), origin);
      if (String(input).includes("/artifacts/"))
        return Response.json({
          artifact: { projectId: other, content: "No debe devolverse" },
        });
      return Response.json({});
    },
  );
  const actions = createActions(client, project),
    names = actions.map((item) => item.name);
  assert.ok(names.includes("workspace_read"));
  assert.ok(!names.includes("change_propose"));
  assert.ok(
    !names.some((name) => /apply|revert|execute|publish|push|shell/.test(name)),
  );
  await assert.rejects(
    actions
      .find((item) => item.name === "artifact_read")!
      .invoke({ id: other }),
    /no pertenece/,
  );
  await assert.rejects(
    actions
      .find((item) => item.name === "workspace_read")!
      .invoke({ path: "a.ts", projectId: other }),
  );
  assert.ok(
    createActions(client, project, true).some(
      (item) => item.name === "change_propose",
    ),
  );
  assert.throws(() => createActions(client, "not-a-project"));
});
test("adaptador: limita respuesta antes de acumular y respeta rechazo de la API", async () => {
  let cancelled = false;
  const client = new AresApiClient(
    { api: "http://localhost:3001", origin },
    async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.enqueue(new Uint8Array(1100000));
          },
          cancel() {
            cancelled = true;
          },
        }),
      ),
  );
  await assert.rejects(client.request("/projects"), /supera 2 MiB/);
  assert.equal(cancelled, true);
  const denied = new AresApiClient(
    { api: "http://localhost:3001", origin },
    async () =>
      Response.json(
        { error: { message: "Acceso de solo lectura" } },
        { status: 403 },
      ),
  );
  await assert.rejects(denied.request("/x", {}), /solo lectura/);
});
test("adaptador: canje explícito guarda cookie sin devolverla y la vincula a backend y origen", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "ares-adapter-")),
    file = path.join(directory, "session.json"),
    token = "s".repeat(43);
  let received = "";
  try {
    const client = new AresApiClient(
      { api: "http://localhost:3001", origin },
      async () =>
        new Response("{}", {
          headers: {
            "Set-Cookie": `ares_session=${token}; HttpOnly; SameSite=Strict`,
          },
        }),
    );
    const result = await client.login("i".repeat(43), "Prueba sintética", file);
    assert.equal(JSON.stringify(result).includes(token), false);
    assert.equal(
      JSON.parse(await readFile(file, "utf8")).cookie,
      `ares_session=${token}`,
    );
    const signed = new AresApiClient(
      { api: "http://localhost:3001", origin, sessionFile: file },
      async (_input, init) => {
        received = new Headers(init?.headers).get("cookie") ?? "";
        return Response.json({ ok: true });
      },
    );
    await signed.request("/access/session");
    assert.equal(received, `ares_session=${token}`);
    await assert.rejects(
      new AresApiClient(
        { api: "http://localhost:3002", origin, sessionFile: file },
        async () => Response.json({}),
      ).request("/access/session"),
      /no corresponde/,
    );
    await assert.rejects(client.login("i".repeat(43), "Prueba", file));
  } finally {
    if (
      path.dirname(directory) !== tmpdir() ||
      !path.basename(directory).startsWith("ares-adapter-")
    )
      throw Error("Ruta inesperada");
    await rm(directory, { recursive: true, force: true });
  }
});
