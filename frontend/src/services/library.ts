import type { ModuleId } from '../domain/modules';
import { safeSources, type Provider, type Source } from './api';
export interface Project { id: string; name: string; createdAt: string }
export interface ArtifactSummary {
  id: string; projectId: string; sequence: number; module: ModuleId; format: string; title: string;
  provider: Provider; model: string; status: 'DRAFT'|'APPROVED';revision?:number;updatedAt?:string; createdAt: string; technicalDocumentId?: string;
}
export interface Artifact extends ArtifactSummary { context: string; content: string; sources: Source[] }
export interface ArtifactPage { artifacts: ArtifactSummary[]; hasMore: boolean }
export interface ArtifactInput { projectId: string; requestId: string; module: ModuleId; format: string; title: string; context: string }
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } }); }
  catch (cause) { if (init?.signal?.aborted) throw cause; throw new Error('No se pudo conectar con la biblioteca. Tu texto sigue en el editor.'); }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = data && typeof data === 'object' && 'error' in data ? data.error : null;
    throw new Error(error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'La biblioteca no está disponible.');
  }
  return data as T;
}
export async function listProjects() {
  const data = await request<{ projects: Project[] }>('projects');
  if (!Array.isArray(data?.projects)) throw new Error('Respuesta de proyectos inválida.');
  return data.projects;
}
export async function createProject(name: string) {
  return (await request<{ project: Project }>('projects', { method: 'POST', body: JSON.stringify({ name }) })).project;
}
export function listArtifacts(projectId: string, module?: ModuleId, before?: number) {
  const query = new URLSearchParams({ projectId });
  if (module) query.set('module', module);
  if (before) query.set('before', String(before));
  return request<ArtifactPage>(`artifacts?${query}`);
}
function validated(artifact: Artifact) {
  if (!artifact?.id || typeof artifact.content !== 'string' || !artifact.content.trim() || !['documentation', 'audit', 'architecture'].includes(artifact.module)) throw new Error('Respuesta de borrador inválida.');
  return { ...artifact, sources: safeSources(artifact.sources) };
}
export async function readArtifact(id: string) {
  return validated((await request<{ artifact: Artifact }>(`artifacts/${encodeURIComponent(id)}`)).artifact);
}
export async function generateArtifact(input: ArtifactInput, signal: AbortSignal) {
  return validated((await request<{ artifact: Artifact }>('artifacts/generate', { method: 'POST', signal, body: JSON.stringify(input) })).artifact);
}
