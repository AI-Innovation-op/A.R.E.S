import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { AresApiClient } from "./api-client.js";
export interface AdapterAction {
  name: string;
  description: string;
  schema: z.ZodObject;
  readOnly: boolean;
  external: boolean;
  invoke: (input: unknown, signal?: AbortSignal) => Promise<unknown>;
}
export function createActions(
  client: AresApiClient,
  projectId: string,
  allowProposals = false,
): AdapterAction[] {
  if (!z.uuid().safeParse(projectId).success)
    throw new Error("Configura un identificador de proyecto UUID explícito.");
  const base = `/projects/${encodeURIComponent(projectId)}`,
    empty = z.object({}).strict(),
    id = z.uuid(),
    file = z.string().min(1).max(1000),
    sha = z.string().regex(/^[a-f0-9]{64}$/),
    actions: AdapterAction[] = [];
  function add<T extends z.ZodObject>(
    name: string,
    description: string,
    schema: T,
    readOnly: boolean,
    external: boolean,
    handler: (args: z.infer<T>, signal?: AbortSignal) => Promise<unknown>,
  ) {
    actions.push({
      name,
      description,
      schema,
      readOnly,
      external,
      invoke: async (input, signal) => handler(schema.parse(input), signal),
    });
  }
  add(
    "project_info",
    "Lee únicamente el proyecto configurado.",
    empty,
    true,
    false,
    async (_args, signal) => {
      const data = await client.request<{
        projects: { id: string; name: string }[];
      }>("/projects", undefined, signal);
      const project = data.projects.find((item) => item.id === projectId);
      if (!project)
        throw new Error(
          "No se encontró el proyecto configurado para esta sesión.",
        );
      return { project };
    },
  );
  add(
    "artifacts_list",
    "Lista borradores del proyecto. No genera ni modifica documentos.",
    z.object({ before: z.number().int().positive().optional() }).strict(),
    true,
    false,
    (args, signal) =>
      client.request(
        `/artifacts?${new URLSearchParams({ projectId, ...(args.before ? { before: String(args.before) } : {}) })}`,
        undefined,
        signal,
      ),
  );
  add(
    "artifact_read",
    "Lee un documento y sus fuentes; rechaza documentos de otro proyecto.",
    z.object({ id }).strict(),
    true,
    false,
    async (args, signal) => {
      const data = await client.request<{ artifact: { projectId: string } }>(
        `/artifacts/${args.id}`,
        undefined,
        signal,
      );
      if (data.artifact.projectId !== projectId)
        throw new Error("El documento no pertenece al proyecto configurado.");
      return data;
    },
  );
  add(
    "conversations_list",
    "Lista conversaciones del proyecto configurado.",
    empty,
    true,
    false,
    async (_args, signal) => {
      const data = await client.request<{
        conversations: { projectId?: string }[];
      }>("/conversations", undefined, signal);
      return {
        conversations: data.conversations.filter(
          (item) => item.projectId === projectId,
        ),
      };
    },
  );
  add(
    "conversation_read",
    "Lee mensajes confirmados del proyecto; no envía turnos.",
    z.object({ id, before: z.number().int().positive().optional() }).strict(),
    true,
    false,
    async (args, signal) => {
      const data = await client.request<{
        conversation: { projectId?: string };
      }>(
        `/conversations/${args.id}${args.before ? `?before=${args.before}` : ""}`,
        undefined,
        signal,
      );
      if (data.conversation.projectId !== projectId)
        throw new Error(
          "La conversación no pertenece al proyecto configurado.",
        );
      return data;
    },
  );
  add(
    "workspace_files",
    "Lista rutas de la carpeta ya conectada al proyecto. No conecta rutas nuevas.",
    z.object({ directory: z.string().max(1000).default("") }).strict(),
    true,
    false,
    (args, signal) =>
      client.request(
        `${base}/workspace/files?${new URLSearchParams(args)}`,
        undefined,
        signal,
      ),
  );
  add(
    "workspace_read",
    "Lee un archivo permitido del proyecto con SHA-256 y redacción de secretos.",
    z.object({ path: file }).strict(),
    true,
    false,
    (args, signal) =>
      client.request(
        `${base}/workspace/file?${new URLSearchParams(args)}`,
        undefined,
        signal,
      ),
  );
  add(
    "workspace_runs",
    "Lee comprobaciones registradas. No ejecuta procesos.",
    empty,
    true,
    false,
    (_args, signal) =>
      client.request(`${base}/workspace/runs`, undefined, signal),
  );
  add(
    "proposals_list",
    "Lista propuestas revisables del proyecto sin aplicarlas.",
    empty,
    true,
    false,
    (_args, signal) => client.request(`${base}/changes`, undefined, signal),
  );
  add(
    "github_inspect",
    "Inspecciona un repositorio público y fija commit; no llama al modelo.",
    z
      .object({ url: z.string().max(300), ref: z.string().max(180).optional() })
      .strict(),
    true,
    true,
    (args, signal) => client.request("/github/inspect", args, signal),
  );
  add(
    "github_pr_inspect",
    "Lee metadatos de un PR público y fija la cabecera. No lee la base ni el diff completo; no comenta ni publica.",
    z.object({ url: z.string().max(350) }).strict(),
    true,
    true,
    (args, signal) => client.request("/github/pull-request", args, signal),
  );
  add(
    "github_read",
    "Lee solo rutas elegidas de una instantánea del usuario. No analiza con IA.",
    z.object({ snapshotId: id, paths: z.array(file).min(1).max(8) }).strict(),
    true,
    true,
    (args, signal) => client.request("/github/read", args, signal),
  );
  if (allowProposals) {
    add(
      "architecture_check",
      "Ejecuta análisis estático de importaciones en archivos y huellas elegidos. No ejecuta el proyecto.",
      z
        .object({
          files: z
            .array(z.object({ path: file, sha256: sha }).strict())
            .min(1)
            .max(50),
        })
        .strict(),
      false,
      false,
      (args, signal) =>
        client.request(`${base}/workspace/architecture`, args, signal),
    );
    add(
      "change_propose",
      "Genera un borrador para un archivo del proyecto. Envía el contenido al proveedor configurado y consume cuota. No aplica, ejecuta ni publica.",
      z
        .object({
          path: file,
          sha256: sha,
          instruction: z.string().min(1).max(2500),
          requestId: id.optional(),
        })
        .strict(),
      false,
      true,
      (args, signal) =>
        client.request(
          `${base}/changes`,
          { ...args, requestId: args.requestId ?? randomUUID() },
          signal,
        ),
    );
    add(
      "github_analyze",
      "Envía la lectura seleccionada al modelo de programación; consume cuota. Revisión estática con fuentes, sin ejecutar pruebas ni comentar el PR.",
      z
        .object({ snapshotId: id, readId: id, requestId: id.optional() })
        .strict(),
      false,
      true,
      (args, signal) =>
        client.request(
          "/github/analyze",
          { ...args, requestId: args.requestId ?? randomUUID() },
          signal,
        ),
    );
  }
  return actions;
}
