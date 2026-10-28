import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { createApp } from "../src/server.js";
import { AccessControl } from "../src/modules/access/access.js";
import { LibraryService } from "../src/modules/library/application/library-service.js";
import { SendMessage } from "../src/modules/chat/application/send-message.js";
import type { LibraryRepository } from "../src/modules/library/domain/library.js";
const project = "00000000-0000-4000-8000-000000000001",
  artifactId = "00000000-0000-4000-8000-000000000002",
  origin = "http://127.0.0.1:5175";
test("CLI y MCP stdio reales usan la API con proyecto fijo; no hay generación ni comandos de aplicación", async () => {
  let calls = 0;
  const gateway = {
      generate: async () => {
        calls++;
        throw Error("No llamar al modelo");
      },
    },
    artifact = {
      id: artifactId,
      projectId: project,
      sequence: 1,
      module: "architecture" as const,
      format: "DDD + Hexagonal",
      title: "Pedido sintético",
      provider: "openrouter" as const,
      model: "fixture",
      status: "DRAFT" as const,
      createdAt: "2026-10-27T00:00:00Z",
      content: "No confirmar pedidos vacíos.",
      context: "Ejemplo aislado",
      sources: [{ uri: "https://example.com/docs", title: "Fuente sintética" }],
    };
  const repository: LibraryRepository = {
    projects: async () => [
      { id: project, name: "Proyecto de prueba", createdAt: "" },
    ],
    read: async () => artifact,
    list: async () => ({ artifacts: [artifact], hasMore: false }),
    createProject: async () => {
      throw Error();
    },
    prepare: async () => undefined,
    commit: async () => {
      throw Error();
    },
  };
  const app = createApp({
      allowedOrigins: [origin],
      checkDatabase: async () => {},
      access: new AccessControl(null, project, "local", async () => {}),
      sendMessage: new SendMessage(gateway),
      library: new LibraryService(repository, gateway),
    }),
    server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const api = `http://127.0.0.1:${address.port}`,
    environment = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key, value]) =>
          value !== undefined &&
          ["PATH", "SystemRoot", "TEMP", "TMP", "HOME", "USERPROFILE"].some(
            (name) => name.toLowerCase() === key.toLowerCase(),
          ),
      ),
    ) as Record<string, string>;
  const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", "src/interfaces/mcp-main.ts"],
      cwd: process.cwd(),
      env: {
        ...environment,
        ARES_API_URL: api,
        ARES_ORIGIN: origin,
        ARES_PROJECT_ID: project,
      },
      stderr: "pipe",
    }),
    client = new Client({ name: "ares-integration", version: "1.0.0" });
  try {
    await client.connect(transport);
    const catalog = await client.listTools();
    assert.ok(catalog.tools.some((tool) => tool.name === "workspace_read"));
    assert.ok(
      !catalog.tools.some((tool) =>
        /apply|execute|publish|push|change_propose/.test(tool.name),
      ),
    );
    const reply = await client.callTool({
      name: "artifact_read",
      arguments: { id: artifactId },
    });
    assert.ok(!reply.isError);
    const text = reply.content.find((item) => item.type === "text");
    assert.ok(text && text.type === "text");
    const data = JSON.parse(text.text);
    assert.equal(data.projectId, project);
    assert.equal(data.result.artifact.content, "No confirmar pedidos vacíos.");
    assert.equal(data.result.artifact.sources.length, 1);
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        "src/interfaces/cli.ts",
        "artifact_read",
        "--project",
        project,
        "--api",
        api,
        "--origin",
        origin,
      ],
      {
        cwd: process.cwd(),
        env: environment,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let out = "",
      err = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.stdin.end(JSON.stringify({ id: artifactId }));
    const [code] = await once(child, "close");
    assert.equal(code, 0, err);
    assert.equal(JSON.parse(out).result.artifact.content, artifact.content);
    assert.equal(calls, 0);
  } finally {
    await client.close();
    server.close();
    await once(server, "close");
  }
});
