import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { stripVTControlCharacters } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { AresApiClient } from "./api-client.js";
import { createActions } from "./actions.js";
import { TerminalOutput } from "./terminal-output.js";
import {
  providerForTask,
  type ChatTask,
  type ChatReply,
  type Message,
} from "../modules/chat/domain/chat.js";
import type {
  Conversation,
  ConversationPage,
  SavedTurn,
} from "../modules/chat/domain/history.js";
import type {
  SourceFile,
  ScriptPreview,
  ToolRun,
  PrototypeArtifact,
} from "../../../packages/contracts/index.js";

export const terminalText = (value: string) =>
  stripVTControlCharacters(value).replace(
    /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g,
    "",
  );
const uuid = z.uuid();
const tasks = [
  "programming",
  "documentation",
  "audit",
  "architecture",
] as const;
export function suggestTask(message: string): {
  task: ChatTask;
  reason: string;
} {
  const text = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (
    /\b(documenta\w*|readme|ficha\s+tecnica|adr|rfc|openapi|docstrings?)\b/.test(
      text,
    )
  )
    return { task: "documentation", reason: "La consulta pide documentación." };
  if (/\b(audita\w*|owasp|vulnerab\w*|seguridad)\b/.test(text))
    return {
      task: "audit",
      reason: "La consulta pide una revisión de seguridad o auditoría.",
    };
  if (
    /\b(ddd|arquitectura|bounded\s+contexts?|agregados?|hexagonal)\b/.test(text)
  )
    return {
      task: "architecture",
      reason: "La consulta trata de límites o reglas de arquitectura.",
    };
  return {
    task: "programming",
    reason: "Caso general de programación; puedes fijar otro modo.",
  };
}
const runningStates = new Set(["RUNNING"]);
export const terminalHelp = `A.R.E.S. · órdenes disponibles
  Escribe una pregunta directamente o chat <mensaje>       Respuesta por streaming
  status                                                  API, acceso y proveedores reales
  projects / project <UUID|off>                            Elegir proyecto; off usa sesión en memoria
  mode <auto|code|docs|audit|architecture>                 Elegir tarea/proveedor
  route [consulta]                                        Ver sugerencia y proveedor; no genera
  memory on|off                                           RAG explícito del proyecto; puede usar cuota
  bio                                                     Consultar preferencias y temporizadores
  conversations / resume <UUID> / new                     Historial del proyecto; new no borra
  read <ruta relativa> / audit <ruta relativa>              Leer / enviar archivo elegido a revisión IA
  ddd <ruta relativa>                                      Análisis estático de imports, sin ejecutar
  run <check|test|lint|build> [directorio]                   Revisar script y huella
  confirm <huella>                                         Ejecutar únicamente el script preparado
  runs                                                    Ver estados y salidas registradas
  results / open <UUID>                                    Biblioteca y fuentes
  preview <archivo.json> / zip <ID> <destino.zip>           Compilar fuentes / exportar misma versión
  retry / cancel / clear / exit                            Reintentar turno / cancelar / limpiar / salir
Ejemplo: mode documentation → Explica un agregado con un ejemplo.
Proyecto elegido: los turnos se guardan al enviarlos. Sin proyecto: memoria de esta terminal.
Las preguntas y audit consumen cuota IA. preview compila; abrir su enlace ejecuta la vista aislada.`;

interface PendingTurn {
  message: string;
  task: ChatTask;
  requestId: string;
  revision: number;
  files: { path: string; sha256: string }[];
  useMemory: boolean;
}
export class TerminalSession {
  task: ChatTask = "programming";
  project?: { id: string; name: string };
  conversation?: Conversation;
  private history: Message[] = [];
  private pending?: PendingTurn;
  private prepared?: {
    projectId: string;
    script: string;
    directory: string;
    manifestHash: string;
  };
  private useMemory = false;
  private automatic = false;
  get mode() {
    return this.automatic ? "auto" : this.task;
  }
  constructor(
    readonly client: AresApiClient,
    private readonly output: (text: string) => void,
  ) {}
  private write(value: string) {
    this.output(terminalText(value));
  }
  private json(value: unknown) {
    this.write(JSON.stringify(value, null, 2) + "\n");
  }
  private needProject() {
    if (!this.project)
      throw Error(
        "Elige primero project UUID. La carpeta se conecta desde Repositorio en la consola.",
      );
    return this.project.id;
  }
  private async action(
    name: string,
    input: unknown,
    signal: AbortSignal,
    proposals = false,
  ) {
    const action = createActions(
      this.client,
      this.needProject(),
      proposals,
    ).find((item) => item.name === name);
    if (!action) throw Error("Orden no disponible.");
    return action.invoke(input, signal);
  }
  async chooseProject(id: string, signal: AbortSignal) {
    if (!uuid.safeParse(id).success)
      throw Error("El proyecto debe ser un UUID de projects.");
    const data = await this.client.request<{
      projects: { id: string; name: string }[];
    }>("/projects", undefined, signal);
    const project = data.projects.find((item) => item.id === id);
    if (!project) throw Error("No se encontró ese proyecto en tu sesión.");
    this.project = project;
    this.reset();
    this.write(
      `Proyecto: ${project.name}. Los próximos turnos se guardarán en una conversación nueva.\n`,
    );
  }
  private reset() {
    this.conversation = undefined;
    this.history = [];
    this.pending = undefined;
    this.prepared = undefined;
    this.useMemory = false;
  }
  private async resume(id: string, signal: AbortSignal) {
    if (!uuid.safeParse(id).success)
      throw Error("Identificador de conversación inválido.");
    const page = (await this.action(
      "conversation_read",
      { id },
      signal,
    )) as ConversationPage;
    this.conversation = page.conversation;
    this.pending = undefined;
    this.history = [];
    this.write(
      `Conversación recuperada: ${page.conversation.title} · revisión ${page.conversation.revision}\n`,
    );
    for (const message of page.messages) {
      this.write(`${message.role === "user" ? "Tú" : "ARES"}: `);
      if (message.role === "model") {
        const printer = new TerminalOutput((text) => this.write(text));
        printer.push(terminalText(message.content));
        printer.finish();
        this.write("\n");
      } else this.write(message.content + "\n");
    }
    if (page.hasMore)
      this.write(
        "Se muestran los mensajes recientes; hay mensajes anteriores en la consola.\n",
      );
  }
  private async chat(
    message: string,
    signal: AbortSignal,
    files: PendingTurn["files"] = [],
    retry = false,
    forcedTask?: ChatTask,
  ) {
    if (!message.trim() || message.length > 16000)
      throw Error("Escribe un mensaje de hasta 16 000 caracteres.");
    if (this.pending && !retry)
      throw Error(
        "Quedó un turno sin confirmar. Usa retry para recuperar el mismo envío, resume para sincronizar o new para empezar otro.",
      );
    if (files.length && !this.project)
      throw Error(
        "La auditoría de archivos necesita proyecto y carpeta conectada.",
      );
    if (this.project && !this.conversation) {
      const data = await this.client.request<{ conversation: Conversation }>(
        "/conversations",
        { projectId: this.project.id, title: message.slice(0, 100) },
        signal,
      );
      if (data.conversation.projectId !== this.project.id)
        throw Error("El servidor devolvió una conversación de otro proyecto.");
      this.conversation = data.conversation;
    }
    const turn = this.pending ?? {
      message,
      task:
        forcedTask ?? (this.automatic ? suggestTask(message).task : this.task),
      requestId: randomUUID(),
      revision: this.conversation?.revision ?? 0,
      files,
      useMemory: this.useMemory,
    };
    if (this.conversation) this.pending = turn;
    this.write(
      `ARES · ${providerForTask(turn.task)} · generando (texto parcial hasta confirmación)\n`,
    );
    let deltas = 0;
    const printer = new TerminalOutput((text) => this.write(text));
    try {
      let reply: ChatReply;
      const onDelta = (text: string) => {
        deltas++;
        printer.push(terminalText(text));
      };
      if (this.conversation) {
        const result = await this.client.stream<SavedTurn>(
          `/conversations/${this.conversation.id}/messages`,
          turn,
          onDelta,
          signal,
        );
        if (
          result.conversationId !== this.conversation.id ||
          !Number.isInteger(result.revision)
        )
          throw Error("Confirmación de conversación incompatible.");
        this.conversation = { ...this.conversation, revision: result.revision };
        this.pending = undefined;
        reply = result;
      } else {
        const history = [...this.history];
        while (
          history.length &&
          Buffer.byteLength(
            JSON.stringify({ message: turn.message, history }),
          ) > 280000
        )
          history.splice(0, 2);
        reply = await this.client.stream<ChatReply>(
          "/chat",
          { message: turn.message, task: turn.task, history },
          onDelta,
          signal,
        );
        this.history = [
          ...history,
          { role: "user", content: turn.message },
          { role: "model", content: reply.content.slice(0, 16000) },
        ].slice(-16) as Message[];
      }
      if (!deltas) printer.push(terminalText(reply.content)); // Reintento idempotente ya confirmado.
      printer.finish();
      this.write(
        `\n[Respuesta confirmada · ${reply.provider ?? providerForTask(turn.task)} / ${reply.model ?? "modelo no indicado"}${this.conversation ? " · conversación " + this.conversation.id + " · revisión " + this.conversation.revision : " · sesión en memoria"}]\n`,
      );
      if (reply.sources?.length) this.json({ fuentes: reply.sources });
    } catch (cause) {
      printer.finish();
      this.write(
        "\n[Respuesta sin confirmar; el texto parcial no acredita un turno guardado.]\n",
      );
      throw cause;
    }
  }
  private async runPrepared(hash: string, signal: AbortSignal) {
    const prepared = this.prepared;
    if (
      !prepared ||
      hash !== prepared.manifestHash ||
      prepared.projectId !== this.project?.id
    )
      throw Error(
        "No coincide con el script preparado. Usa run para revisarlo de nuevo.",
      );
    this.prepared = undefined;
    const base = `/projects/${prepared.projectId}/workspace/runs`;
    const requestId = randomUUID();
    let run: ToolRun;
    try {
      run = (
        await this.client.request<{ run: ToolRun }>(
          base,
          {
            requestId,
            script: prepared.script,
            directory: prepared.directory,
            manifestHash: hash,
          },
          signal,
        )
      ).run;
    } catch (cause) {
      if (signal.aborted) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const data = await this.client
            .request<{ runs: ToolRun[] }>(
              base,
              undefined,
              AbortSignal.timeout(2000),
            )
            .catch(() => ({ runs: [] }));
          const started = data.runs.find(
            (item) => item.requestId === requestId,
          );
          if (started) {
            await this.client
              .request(
                `${base}/${started.id}/cancel`,
                {},
                AbortSignal.timeout(10000),
              )
              .catch(() =>
                this.write(
                  "No se confirmó cancelar el arranque. Consulta runs.\n",
                ),
              );
            break;
          }
          await delay(100);
        }
      }
      throw cause;
    }
    this.write(`Ejecución registrada: ${run.id}\n`);
    let printed = 0;
    try {
      for (let attempt = 0; attempt < 330; attempt++) {
        if (run.output.length > printed) {
          this.write(run.output.slice(printed));
          printed = run.output.length;
        }
        if (!runningStates.has(run.status)) {
          this.write(
            `\n[${run.status} · exitCode=${run.exitCode ?? "no confirmado"} · ${run.id}]\n`,
          );
          if (run.status !== "PASSED" || run.exitCode !== 0)
            throw Error(
              "La comprobación no terminó satisfactoriamente. Revisa su estado y salida.",
            );
          return;
        }
        await delay(500, undefined, { signal });
        run = (
          await this.client.request<{ run: ToolRun }>(
            `${base}/${run.id}`,
            undefined,
            signal,
          )
        ).run;
      }
      throw Error(
        "El seguimiento agotó su tiempo; se solicitó cancelar. Consulta runs para el estado final.",
      );
    } finally {
      if (runningStates.has(run.status))
        await this.client
          .request(`${base}/${run.id}/cancel`, {}, AbortSignal.timeout(10000))
          .catch(() =>
            this.write(
              "No se confirmó la cancelación remota. Consulta runs.\n",
            ),
          );
    }
  }
  async execute(
    line: string,
    signal: AbortSignal,
  ): Promise<"continue" | "exit" | "clear"> {
    if (line.length > 65536) throw Error("La orden supera 64 KiB.");
    const trimmed = line.trim();
    if (!trimmed) return "continue";
    const split = trimmed.indexOf(" "),
      command = (split < 0 ? trimmed : trimmed.slice(0, split)).toLowerCase(),
      arg = split < 0 ? "" : trimmed.slice(split + 1).trim();
    if (["exit", "quit", "salir"].includes(command)) return "exit";
    if (["clear", "cls"].includes(command)) return "clear";
    if (["help", "ayuda"].includes(command)) {
      this.write(terminalHelp + "\n");
      return "continue";
    }
    if (command === "status") {
      this.json({
        backend: await this.client.health(signal),
        access: await this.client.request("/access/session", undefined, signal),
        project: this.project,
        conversation: this.conversation,
        mode: this.mode,
        memory: this.useMemory,
      });
      return "continue";
    }
    if (command === "projects") {
      this.json(await this.client.request("/projects", undefined, signal));
      return "continue";
    }
    if (command === "project") {
      if (arg === "off") {
        this.project = undefined;
        this.reset();
        this.write("Sesión en memoria. No se borró ningún historial.\n");
      } else if (!arg) this.json({ project: this.project ?? null });
      else await this.chooseProject(arg, signal);
      return "continue";
    }
    if (command === "mode") {
      if (!arg) this.write(`Modo ${this.mode}\n`);
      else if (arg === "auto") {
        this.automatic = true;
        this.write(
          "Modo auto: reglas locales por tarea. Documentación usa Gemini; código/auditoría/arquitectura usan OpenRouter. El historial confirmado acompaña cada turno al proveedor elegido. Sin fallback cruzado al fallar.\n",
        );
      } else {
        const selected =
          arg === "docs"
            ? "documentation"
            : arg === "code"
              ? "programming"
              : arg;
        if (!(tasks as readonly string[]).includes(selected))
          throw Error("Usa auto, code, docs, audit o architecture.");
        this.task = selected as ChatTask;
        this.automatic = false;
        this.write(`Modo ${this.task} → ${providerForTask(this.task)}.\n`);
      }
      return "continue";
    }
    if (command === "route") {
      const suggestion = suggestTask(arg),
        task = this.automatic ? suggestion.task : this.task,
        health = await this.client.health(signal),
        provider = providerForTask(task);
      this.json({
        mode: this.mode,
        selectedTask: task,
        provider,
        status: health.providers?.[provider],
        ...(arg ? { suggestion } : {}),
        policy:
          "Sugerencia por reglas locales, no comprensión semántica garantizada. El modo manual prevalece. Consultar no genera; no hay fallback cruzado.",
      });
      return "continue";
    }
    if (command === "memory") {
      this.needProject();
      if (!["on", "off"].includes(arg))
        throw Error(
          "Usa memory on|off. Consultar memoria puede usar embeddings Gemini y cuota.",
        );
      this.useMemory = arg === "on";
      this.write(
        `Memoria del proyecto: ${this.useMemory ? "activa para los siguientes turnos" : "desactivada"}.\n`,
      );
      return "continue";
    }
    if (command === "bio") {
      this.json(await this.client.request("/bio", undefined, signal));
      return "continue";
    }
    if (command === "new") {
      this.reset();
      this.write(
        "Contexto nuevo. Se conserva el historial anterior del servidor.\n",
      );
      return "continue";
    }
    if (command === "conversations") {
      this.json(await this.action("conversations_list", {}, signal));
      return "continue";
    }
    if (command === "resume") {
      await this.resume(arg, signal);
      return "continue";
    }
    if (command === "retry") {
      if (!this.pending)
        throw Error("No hay un turno pendiente de confirmación.");
      await this.chat(this.pending.message, signal, this.pending.files, true);
      return "continue";
    }
    if (command === "results") {
      this.json(await this.action("artifacts_list", {}, signal));
      return "continue";
    }
    if (command === "open") {
      this.json(await this.action("artifact_read", { id: arg }, signal));
      return "continue";
    }
    if (["read", "audit", "ddd"].includes(command)) {
      const { file } = (await this.action(
        "workspace_read",
        { path: arg },
        signal,
      )) as { file: SourceFile };
      if (command === "read") this.json({ file });
      else if (command === "ddd")
        this.json(
          await this.action(
            "architecture_check",
            { files: [{ path: file.path, sha256: file.sha256 }] },
            signal,
            true,
          ),
        );
      else
        await this.chat(
          `Audita estáticamente el archivo adjunto ${file.path}. Explica riesgos con ejemplos y distingue hallazgos de hipótesis. No afirmes ejecución de pruebas.`,
          signal,
          [{ path: file.path, sha256: file.sha256 }],
          false,
          "audit",
        );
      return "continue";
    }
    if (command === "runs") {
      this.json(await this.action("workspace_runs", {}, signal));
      return "continue";
    }
    if (command === "run") {
      const [script, ...directoryParts] = arg.split(/\s+/),
        directory = directoryParts.join(" ");
      if (!["check", "test", "lint", "build"].includes(script ?? ""))
        throw Error("Usa run check|test|lint|build [directorio].");
      const projectId = this.needProject(),
        preview = await this.client.request<ScriptPreview>(
          `/projects/${projectId}/workspace/scripts?${new URLSearchParams({ directory })}`,
          undefined,
          signal,
        );
      const settings = await this.client.request<{ runnerIsolation?: string }>(
        `/projects/${projectId}/workspace`,
        undefined,
        signal,
      );
      const selected = preview.scripts.find(
        (item) => item.name === script && item.runnable,
      );
      if (!selected || !preview.runnerAvailable)
        throw Error(
          "Ese script o el ejecutor no están disponibles. Revisa Repositorio y Docker.",
        );
      this.prepared = {
        projectId,
        script: script!,
        directory,
        manifestHash: preview.manifestHash,
      };
      this.write(
        `Preparado, todavía no ejecutado:\n${script}: ${selected.command}\nDirectorio: ${directory || "."}\nEjecutor: ${settings.runnerIsolation ?? "no confirmado"}\nHuella del manifiesto npm: ${preview.manifestHash}\nPara ejecutarlo: confirm ${preview.manifestHash}\n`,
      );
      return "continue";
    }
    if (command === "confirm") {
      await this.runPrepared(arg, signal);
      return "continue";
    }
    if (command === "preview") {
      const bytes = await readFile(unquote(arg));
      if (bytes.length > 1048576) throw Error("El manifiesto supera 1 MiB.");
      let bundle: unknown;
      try {
        bundle = JSON.parse(bytes.toString("utf8"));
      } catch {
        throw Error(
          "El archivo no es un manifiesto JSON válido. No se envió al servidor.",
        );
      }
      const { artifact } = await this.client.request<{
        artifact: PrototypeArtifact;
      }>("/prototypes/build", bundle, signal);
      for (const file of [
        ...artifact.files,
        artifact.runtime,
        ...artifact.licenses,
      ])
        if (
          createHash("sha256").update(file.content).digest("hex") !==
          file.sha256
        )
          throw Error("No coincide una huella del prototipo.");
      this.json({
        id: artifact.id,
        revision: artifact.revision,
        evidence: "compilado; sin pruebas de negocio",
        runtimeSha256: artifact.runtime.sha256,
        view: this.client.api + artifact.previewPath,
        expiresAt: artifact.expiresAt,
        note: "Abrir el enlace ejecuta la vista aislada. Usa zip ID destino.zip para conservarla.",
      });
      return "continue";
    }
    if (command === "zip") {
      const first = arg.indexOf(" "),
        id = arg.slice(0, first),
        destination = unquote(arg.slice(first + 1));
      if (first < 0 || !destination.toLowerCase().endsWith(".zip"))
        throw Error("Usa zip ID destino.zip; el archivo debe ser nuevo.");
      const bytes = await this.client.binary(`/prototypes/${id}/zip`, signal);
      await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
      this.json({
        saved: destination,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
      return "continue";
    }
    if (command === "cancel") {
      this.write("No hay una operación en curso.\n");
      return "continue";
    }
    await this.chat(command === "chat" ? arg : trimmed, signal);
    return "continue";
  }
}
function unquote(value: string) {
  return /^(["']).*\1$/.test(value) ? value.slice(1, -1) : value;
}
