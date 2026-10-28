import type { RunStatus } from "../../../packages/contracts/index.js";
export type {
  FileReference,
  SourceFile,
  FileEntry,
  FilePage,
  ScriptName,
  RunStatus,
  ScriptPreview,
  ToolRun,
  WorkspaceContext,
} from "../../../packages/contracts/index.js";
export interface WorkspaceSettings {
  projectId: string;
  path: string | null;
  connectedAt?: string;
  allowedRoots: string[];
  runnerAvailable: boolean;
  runnerIsolation?: "local" | "docker";
}
export async function workspaceRequest<T>(
  projectId: string,
  suffix = "",
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/workspace${suffix}`,
      body === undefined
        ? undefined
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    );
  } catch {
    throw new Error("No se pudo conectar con el repositorio local.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      data?.error?.message ??
        "No se pudo completar la operación del repositorio.",
    );
  return data as T;
}
export const runLabels: Record<RunStatus, string> = {
  RUNNING: "En ejecución",
  PASSED: "Completado",
  FAILED: "Falló",
  CANCELLED: "Cancelado",
  TIMEOUT: "Tiempo agotado",
  INTERRUPTED: "Interrumpido",
};
