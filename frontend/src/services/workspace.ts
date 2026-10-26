export interface FileReference { path: string; sha256: string }
export interface SourceFile extends FileReference { content: string; bytes: number; modifiedAt: string; redacted: boolean }
export interface FileEntry { name: string; path: string; directory: boolean }
export interface FilePage { directory: string; entries: FileEntry[]; truncated: boolean }
export interface WorkspaceSettings { projectId: string; path: string | null; connectedAt?: string; allowedRoots: string[]; runnerAvailable: boolean; runnerIsolation?: 'local'|'docker' }
export type ScriptName = 'check' | 'test' | 'lint' | 'build';
export type RunStatus = 'RUNNING' | 'PASSED' | 'FAILED' | 'CANCELLED' | 'TIMEOUT' | 'INTERRUPTED';
export interface ScriptPreview { directory: string; manifestHash: string; scripts: { name: ScriptName; command: string; runnable: boolean }[]; runnerAvailable: boolean }
export interface ToolRun { id: string; projectId: string; requestId: string; directory: string; workspacePath: string; script: ScriptName; manifestHash: string; command: string; status: RunStatus; output: string; truncated: boolean; exitCode: number | null; startedAt: string; finishedAt: string | null }
export interface WorkspaceContext { projectId: string; sourceRoot: string | null; files: (SourceFile & { truncated: boolean })[]; runs: ToolRun[] }
export async function workspaceRequest<T>(projectId: string, suffix = '', body?: unknown): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workspace${suffix}`, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  catch { throw new Error('No se pudo conectar con el repositorio local.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? 'No se pudo completar la operación del repositorio.');
  return data as T;
}
export const runLabels: Record<RunStatus, string> = { RUNNING: 'En ejecución', PASSED: 'Completado', FAILED: 'Falló', CANCELLED: 'Cancelado', TIMEOUT: 'Tiempo agotado', INTERRUPTED: 'Interrumpido' };
