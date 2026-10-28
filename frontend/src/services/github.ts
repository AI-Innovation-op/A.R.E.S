import type { Provider, Source } from "./api";
export type { RemoteFile as GitHubFile } from "../../../packages/contracts/index.js";
import type { RemoteFile as GitHubFile } from "../../../packages/contracts/index.js";
export interface GitHubSnapshot {
  id: string;
  repository: string;
  url: string;
  ref: string;
  commit: string;
  tree: string;
  files: GitHubFile[];
  listedFiles: number;
  incomplete: boolean;
  limited: boolean;
  expiresAt: string;
  limits: { files: number; fileBytes: number; totalBytes: number };
  pullRequest?: {
    url: string;
    title: string;
    head: { repository: string; commit: string };
    base: { repository: string; commit: string };
    changedFiles: number;
    files: { path: string; status: string }[];
    filesComplete: boolean;
  };
}
export interface GitHubRead {
  id: string;
  snapshotId: string;
  files: {
    path: string;
    blob: string;
    sha256: string;
    bytes: number;
    content: string;
    redacted: boolean;
    url: string;
  }[];
  failures: { path: string; reason: string }[];
  selected: number;
  bytes: number;
  manifest: string;
}
export interface GitHubReport {
  id: string;
  title: string;
  content: string;
  context: string;
  sources: Source[];
  provider: Provider;
  model: string;
  createdAt: string;
  persistable: boolean;
}
export async function githubRequest<T>(
  operation: "pull-request" | "inspect" | "read" | "analyze" | "save",
  body: object,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/github/${operation}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new Error(
      "No se pudo conectar con A.R.E.S. Conserva la selección y reintenta.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      data?.error?.message ?? "No se pudo completar la lectura de GitHub.",
    );
  if (
    !data ||
    typeof data !== "object" ||
    (operation !== "save" && typeof data.id !== "string")
  )
    throw new Error("El servidor no confirmó una lectura válida.");
  return data as T;
}
