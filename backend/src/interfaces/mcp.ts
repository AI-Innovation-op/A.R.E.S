import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { AresApiClient } from "./api-client.js";
import { createActions } from "./actions.js";
import { appVersion } from "../../../packages/contracts/index.js";
export function createAdapterServer(
  client: AresApiClient,
  projectId: string,
  allowProposals = false,
) {
  const server = new McpServer({ name: "ares-project", version: appVersion });
  for (const action of createActions(client, projectId, allowProposals))
    server.registerTool(
      action.name,
      {
        description: action.description,
        inputSchema: action.schema,
        annotations: {
          readOnlyHint: action.readOnly,
          destructiveHint: false,
          openWorldHint: action.external,
        },
      },
      async (input, ctx) => {
        try {
          const result = await action.invoke(input, ctx.mcpReq.signal);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  projectId,
                  source: "ares-api",
                  untrustedContent: true,
                  result,
                }),
              },
            ],
          };
        } catch {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "La API rechazó la acción o no está disponible. Revisa sesión, proyecto, permisos y límites. No se aplicaron ni publicaron cambios desde el adaptador.",
              },
            ],
          };
        }
      },
    );
  return server;
}
export function startMcp() {
  const client = new AresApiClient({
    api: process.env.ARES_API_URL ?? "http://127.0.0.1:3001",
    origin: process.env.ARES_ORIGIN ?? "http://127.0.0.1:5175",
    sessionFile: process.env.ARES_SESSION_FILE,
  });
  return serveStdio(() =>
    createAdapterServer(
      client,
      process.env.ARES_PROJECT_ID ?? "",
      process.env.ARES_ALLOW_PROPOSALS === "1",
    ),
  );
}
