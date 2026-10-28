import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { stdin, stdout } from "node:process";
import { TerminalSession, terminalText } from "./terminal-session.js";
import { AresApiClient } from "./api-client.js";
import { appVersion } from "../../../packages/contracts/index.js";

export async function runRepl(
  client: AresApiClient,
  options: { input?: Readable; output?: Writable; projectId?: string } = {},
) {
  const input = options.input ?? stdin,
    output = options.output ?? stdout;
  const terminal = "isTTY" in input && !!input.isTTY;
  const write = (text: string) => {
    output.write(terminalText(text));
  };
  const initial = new AbortController();
  const stopInitial = () => initial.abort();
  process.once("SIGINT", stopInitial);
  try {
    const health = await client.health(initial.signal);
    const access = await client.request<{
      mode: string;
      user: { role: string } | null;
    }>("/access/session", undefined, initial.signal);
    if (!access.user)
      throw Error(
        "Inicia sesión con cli login y vuelve a abrir con --session-file.",
      );
    const logo = "\n  ╔═╗ ╦═╗ ╔═╗ ╔═╗\n  ╠═╣ ╠╦╝ ║╣  ╚═╗\n  ╩ ╩ ╩╚═ ╚═╝ ╚═╝\n";
    if (terminal && !process.env.NO_COLOR)
      output.write("\x1b[38;5;48m" + logo + "\x1b[0m");
    else write(logo);
    write(
      `  A.R.E.S. ${appVersion} · TERMINAL DE INGENIERÍA\n  Backend comprobado: ${client.api} · versión ${health.version ?? "no indicada"} · rol ${access.user.role}\n  Escribe help o una pregunta. Ctrl+C/cancel detienen la operación activa.\n  Sin proyecto: contexto en memoria. project UUID activa historial del proyecto.\n\n`,
    );
  } finally {
    process.off("SIGINT", stopInitial);
  }
  const session = new TerminalSession(client, write);
  if (options.projectId)
    await session.chooseProject(
      options.projectId,
      new AbortController().signal,
    );
  const completions = [
    "help",
    "status",
    "projects",
    "project",
    "mode",
    "route",
    "memory",
    "bio",
    "chat",
    "conversations",
    "resume",
    "new",
    "read",
    "audit",
    "ddd",
    "run",
    "confirm",
    "runs",
    "results",
    "open",
    "preview",
    "zip",
    "retry",
    "cancel",
    "clear",
    "exit",
  ];
  const rl = createInterface({
    input,
    output,
    terminal,
    historySize: 64,
    completer: (line: string) => {
      const found = completions.filter((item) => item.startsWith(line));
      return [found, line];
    },
  });
  // No hay archivo de historial de órdenes: mensajes y rutas no quedan en disco por readline.
  const queue: string[] = [];
  let busy = false,
    closed = false,
    exiting = false,
    errors = 0,
    active: AbortController | undefined;
  const prompt = () => {
    if (terminal && !closed && !exiting) {
      rl.setPrompt(
        `ares[${session.project ? "proyecto" : "sesión"}:${session.mode}]> `,
      );
      rl.prompt();
    }
  };
  await new Promise<void>((resolve) => {
    const finish = () => {
      if (closed && !busy) {
        process.off("SIGTERM", terminate);
        resolve();
      }
    };
    const terminate = () => {
      exiting = true;
      queue.length = 0;
      active?.abort();
      rl.close();
      finish();
    };
    process.once("SIGTERM", terminate);
    const drain = async () => {
      if (busy) return;
      busy = true;
      try {
        while (queue.length && !exiting) {
          const line = queue.shift()!;
          active = new AbortController();
          try {
            const action = await session.execute(line, active.signal);
            if (action === "exit") {
              exiting = true;
              queue.length = 0;
              rl.close();
            } else if (action === "clear" && terminal) {
              output.write("\x1b[2J\x1b[H");
              write(`A.R.E.S. ${appVersion} · help muestra las órdenes.\n`);
            }
          } catch (error) {
            if (!active.signal.aborted) errors++;
            write(
              `\n${active.signal.aborted ? "Operación cancelada." : `Error: ${error instanceof Error ? error.message : "No se completó la operación."}`}\n`,
            );
          } finally {
            active = undefined;
          }
        }
      } finally {
        busy = false;
        prompt();
        finish();
      }
    };
    rl.on("line", (line) => {
      if (line.length > 65536 || queue.length >= 16) {
        write("Orden o cola demasiado grande; no se envió.\n");
        return;
      }
      if (busy && line.trim().toLowerCase() === "cancel") {
        active?.abort();
        queue.length = 0;
        return;
      }
      if (
        busy &&
        terminal &&
        ["exit", "quit", "salir"].includes(line.trim().toLowerCase())
      ) {
        terminate();
        return;
      }
      queue.push(line);
      void drain();
    });
    rl.on("SIGINT", () => {
      if (active) {
        active.abort();
        queue.length = 0;
      } else {
        exiting = true;
        rl.close();
      }
    });
    rl.on("close", () => {
      closed = true;
      finish();
    });
    prompt();
  });
  write(
    "Terminal cerrada. El historial confirmado del servidor se conserva.\n",
  );
  return { errors };
}
