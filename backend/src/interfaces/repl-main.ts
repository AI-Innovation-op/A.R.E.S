#!/usr/bin/env node
import { AresApiClient } from "./api-client.js";
import { runRepl } from "./repl.js";
import { terminalHelp, terminalText } from "./terminal-session.js";
const args = process.argv.slice(2),
  options = new Map<string, string>();
try {
  if (args.includes("--help")) {
    process.stdout.write(
      terminalHelp +
        "\nOpciones: --api URL --origin URL --project UUID --session-file archivo\n",
    );
  } else {
    for (let i = 0; i < args.length; i++) {
      const key = args[i]!;
      if (
        !["--api", "--origin", "--project", "--session-file"].includes(key) ||
        !args[i + 1] ||
        args[i + 1]!.startsWith("--")
      )
        throw Error("Opciones inválidas. Usa --help.");
      options.set(key, args[++i]!);
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
      sessionFile:
        options.get("--session-file") ?? process.env.ARES_SESSION_FILE,
    });
    const result = await runRepl(client, {
      projectId: options.get("--project") ?? process.env.ARES_PROJECT_ID,
    });
    if (!process.stdin.isTTY && result.errors) process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(
    terminalText(
      `No se pudo abrir la terminal: ${error instanceof Error ? error.message : "revisa backend y acceso."}\nInicia nuestra consola con npm run dev o indica --api y --origin.\n`,
    ),
  );
  process.exitCode = 1;
}
