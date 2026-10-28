import { readFile } from "node:fs/promises";
import { AresApiClient } from "./api-client.js";
import { createActions } from "./actions.js";
const args = process.argv.slice(2),
  command = args.shift() ?? "help",
  options = new Map<string, string>();
try {
  for (let i = 0; i < args.length; i++) {
    const name = args[i]!;
    if (name === "--allow-proposals") {
      options.set(name, "1");
      continue;
    }
    if (
      !["--api", "--origin", "--project", "--session-file", "--input"].includes(
        name,
      ) ||
      !args[i + 1] ||
      args[i + 1]!.startsWith("--")
    )
      throw new Error("Argumentos inválidos. Usa help.");
    options.set(name, args[++i]!);
  }
  const client = new AresApiClient({
    api:
      options.get("--api") ??
      process.env.ARES_API_URL ??
      "http://127.0.0.1:3001",
    origin:
      options.get("--origin") ??
      process.env.ARES_ORIGIN ??
      "http://127.0.0.1:5175",
    sessionFile: options.get("--session-file") ?? process.env.ARES_SESSION_FILE,
  });
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  const input = async () => {
    const file = options.get("--input");
    if (file) {
      const data = await readFile(file);
      if (data.length > 65536) throw new Error("El JSON supera 64 KiB.");
      return JSON.parse(data.toString());
    }
    if (process.stdin.isTTY) return {};
    let text = "";
    for await (const chunk of process.stdin) {
      text += chunk.toString();
      if (Buffer.byteLength(text) > 65536)
        throw new Error("El JSON supera 64 KiB.");
    }
    return text.trim() ? JSON.parse(text) : {};
  };
  let result: unknown;
  if (command === "help")
    result = {
      interactive: "npm run terminal (desde la raíz)",
      usage:
        "node backend/dist/interfaces/cli.js <acción> --project UUID [--api http://127.0.0.1:3001] [--origin http://127.0.0.1:5175] [--session-file archivo] [--input JSON] [--allow-proposals]",
      commands: [
        "projects",
        "tools",
        "login",
        "project_info",
        "artifacts_list",
        "artifact_read",
        "conversations_list",
        "conversation_read",
        "workspace_files",
        "workspace_read",
        "workspace_runs",
        "proposals_list",
        "github_inspect",
        "github_pr_inspect",
        "github_read",
      ],
      note: "login recibe {name,code} por entrada estándar y exige --session-file nuevo. Propuestas/IA requieren --allow-proposals. No hay comandos aplicar, ejecutar, publicar o push.",
    };
  else if (command === "projects")
    result = await client.request("/projects", undefined, controller.signal);
  else if (command === "login") {
    const target = options.get("--session-file");
    if (!target) throw new Error("Indica un archivo nuevo con --session-file.");
    const data = await input();
    result = await client.login(data.code, data.name, target);
  } else {
    const actions = createActions(
      client,
      options.get("--project") ?? process.env.ARES_PROJECT_ID ?? "",
      options.has("--allow-proposals"),
    );
    if (command === "tools")
      result = {
        tools: actions.map(({ name, description, readOnly }) => ({
          name,
          description,
          readOnly,
        })),
      };
    else {
      const action = actions.find((item) => item.name === command);
      if (!action)
        throw new Error(
          "Acción no disponible. Revisa tools y la habilitación de propuestas.",
        );
      result = {
        projectId: options.get("--project") ?? process.env.ARES_PROJECT_ID,
        result: await action.invoke(await input(), controller.signal),
      };
    }
  }
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} catch {
  process.stderr.write(
    "No se completó la acción. Comprueba argumentos, sesión, proyecto y permisos; no se aplicaron ni publicaron cambios desde este adaptador.\n",
  );
  process.exitCode = 1;
}
