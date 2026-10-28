import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { mkdtemp, cp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { testDatabase } from "./database.js";
import { PostgresLibrary } from "../../src/modules/library/infrastructure/postgres-library.js";
import { LibraryService } from "../../src/modules/library/application/library-service.js";
import { PostgresHistory } from "../../src/modules/chat/infrastructure/postgres-history.js";
import { ConversationService } from "../../src/modules/chat/application/conversation-service.js";
import { PostgresWorkspace } from "../../src/modules/workspace/infrastructure/postgres-workspace.js";
import { LocalFiles } from "../../src/modules/workspace/infrastructure/local-files.js";
import {
  DockerRunner,
  findDocker,
} from "../../src/modules/workspace/infrastructure/docker-runner.js";
import { WorkspaceService } from "../../src/modules/workspace/application/workspace-service.js";
import { AccessControl } from "../../src/modules/access/access.js";
import { PrototypeService } from "../../src/modules/prototypes/prototype-service.js";
import { SendMessage } from "../../src/modules/chat/application/send-message.js";
import type { ChatGateway } from "../../src/modules/chat/domain/chat.js";
import { createApp } from "../../src/server.js";

test(
  "terminal real: proceso REPL → HTTP → PostgreSQL, Docker 3 pruebas, auditoría con fuente y ZIP",
  { timeout: 180000 },
  async () => {
    const pool = await testDatabase(),
      owner = randomUUID(),
      root = await mkdtemp(path.join(tmpdir(), "ares-terminal-sql-"));
    let child: ReturnType<typeof spawn> | undefined,
      service: WorkspaceService | undefined,
      server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
    try {
      await cp(new URL("../../../examples/pedidos/", import.meta.url), root, {
        recursive: true,
      });
      const manifest = path.join(root, "sources.json"),
        zip = path.join(root, "compiled.zip");
      await writeFile(
        manifest,
        JSON.stringify({
          entry: "index.html",
          files: [{ path: "index.html", content: '<p id="price">999</p>' }],
        }),
      );
      const library = new PostgresLibrary(pool, owner),
        project = await library.createProject("Terminal de prueba temporal");
      const files = new LocalFiles([root]),
        docker = await findDocker();
      assert.ok(
        docker,
        "Este recorrido requiere Docker y npm run runner:prepare.",
      );
      service = new WorkspaceService(
        new PostgresWorkspace(pool, owner),
        files,
        new DockerRunner(docker, files),
      );
      await service.connect(project.id, root);
      let generations = 0,
        auditHasSource = false;
      const gateway: ChatGateway = {
        generate: async (messages, task, options) => {
          generations++;
          if (generations === 2)
            auditHasSource = messages
              .at(-1)!
              .content.includes("src/orders/domain/order.mjs");
          await options?.onDelta?.("Propuesta sintética. ");
          await new Promise((resolve) => setTimeout(resolve, 100));
          await options?.onDelta?.("No ejecuté pruebas desde el modelo.");
          return {
            content: "Propuesta sintética. No ejecuté pruebas desde el modelo.",
            sources: [
              { uri: "https://example.com/fixture", title: "Fuente sintética" },
            ],
            provider: task === "documentation" ? "gemini" : "openrouter",
            model: "terminal-fixture",
          };
        },
      };
      const origin = "http://127.0.0.1:5175";
      const app = createApp({
        allowedOrigins: [origin],
        access: new AccessControl(pool, owner, "local", async () => {}),
        isolatedRunner: true,
        checkDatabase: async () => {},
        sendMessage: new SendMessage(gateway),
        conversations: new ConversationService(
          new PostgresHistory(pool, owner),
          gateway,
          undefined,
          service,
        ),
        library: new LibraryService(library, gateway),
        workspace: service,
        prototypes: new PrototypeService(
          () => owner,
          (text) => files.redact(text),
        ),
        getProviderStatus: () => ({
          gemini: { configured: true, model: "fixture" },
          openrouter: { configured: true, model: "fixture" },
        }),
      });
      server = app.listen(0, "127.0.0.1");
      await once(server, "listening");
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const environment = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key, value]) =>
            value !== undefined &&
            [
              "PATH",
              "SystemRoot",
              "TEMP",
              "TMP",
              "HOME",
              "USERPROFILE",
              "LOCALAPPDATA",
            ].some((name) => name.toLowerCase() === key.toLowerCase()),
        ),
      ) as Record<string, string>;
      child = spawn(
        process.execPath,
        [
          "--import",
          "tsx",
          "src/interfaces/repl-main.ts",
          "--api",
          `http://127.0.0.1:${address.port}`,
          "--origin",
          origin,
          "--project",
          project.id,
        ],
        {
          cwd: process.cwd(),
          env: environment,
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      let output = "",
        error = "",
        stage = 0,
        conversationId = "";
      child.stdout!.setEncoding("utf8");
      child.stderr!.setEncoding("utf8");
      child.stdout!.on("data", (chunk) => {
        output += String(chunk);
        conversationId =
          output.match(/conversación ([a-f0-9-]{36})/)?.[1] ?? conversationId;
        if (stage === 0 && output.includes("Los próximos turnos")) {
          stage = 1;
          child!.stdin!.write(
            "chat Explica la regla del pedido\nconversations\nread src/orders/domain/order.mjs\nddd src/orders/domain/order.mjs\nrun test\n",
          );
        }
        const prepared = output.match(
          /Para ejecutarlo: confirm ([a-f0-9]{64})/,
        );
        if (stage === 1 && prepared) {
          stage = 2;
          child!.stdin!.write(`confirm ${prepared[1]}\n`);
        }
        if (stage === 2 && output.includes("[PASSED · exitCode=0")) {
          stage = 3;
          child!.stdin!.write(
            `audit src/orders/domain/order.mjs\npreview "${manifest}"\n`,
          );
        }
        const artifact = output.match(/"id": "([a-f0-9]{64})"/);
        if (stage === 3 && artifact) {
          stage = 4;
          child!.stdin!.write(
            `zip ${artifact[1]} "${zip}"\nresume ${conversationId}\nexit\n`,
          );
          child!.stdin!.end();
        }
      });
      child.stderr!.on("data", (chunk) => {
        error += String(chunk);
      });
      const timeout = setTimeout(() => child?.kill(), 150000);
      const [code] = await once(child, "exit");
      clearTimeout(timeout);
      assert.equal(code, 0, output + "\n" + error);
      assert.equal(stage, 4, output);
      assert.equal(generations, 2);
      assert.equal(auditHasSource, true);
      assert.match(output, /3/);
      assert.match(output, /PASSED · exitCode=0/);
      assert.match(output, /Conversación recuperada/);
      assert.ok(
        (await readFile(zip))
          .subarray(0, 4)
          .equals(Buffer.from([80, 75, 3, 4])),
      );
      const conversations = await new PostgresHistory(pool, owner).list();
      assert.equal(conversations.length, 1);
      const page = await new PostgresHistory(pool, owner).read(
        conversations[0]!.id,
      );
      assert.equal(page.messages.length, 4);
      assert.equal(page.conversation.projectId, project.id);
      const runs = await service.runs(project.id);
      assert.equal(runs.length, 1);
      assert.equal(runs[0]!.status, "PASSED");
      assert.equal(runs[0]!.exitCode, 0);
    } finally {
      if (child && child.exitCode === null) child.kill();
      await service?.shutdown();
      if (server) {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server!.close(() => resolve()));
      }
      try {
        await pool.query("DELETE FROM commanders WHERE id=$1", [owner]);
      } finally {
        await pool.end();
      }
      assert.equal(path.dirname(root), tmpdir());
      assert.ok(path.basename(root).startsWith("ares-terminal-sql-"));
      await rm(root, { recursive: true, force: true });
    }
  },
);
