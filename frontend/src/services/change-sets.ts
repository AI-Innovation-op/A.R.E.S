import type { ProposalStatus } from './changes';
export interface ChangeFile { path: string; before: string | null; after: string; beforeHash: string | null; afterHash: string; patch: string }
export interface ChangeSet { id: string; projectId: string; requestId: string; workspacePath: string; instruction: string; summary: string; files: ChangeFile[]; approvedHash: string; model: string; status: ProposalStatus; lastError: string | null; createdAt: string; updatedAt: string }
export async function changeSetRequest<T>(project: string,suffix='',body?: unknown): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/projects/${encodeURIComponent(project)}/change-sets${suffix}`,body===undefined ? undefined : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(130000)}); }
  catch {throw new Error('No se pudo confirmar la operación. Actualiza antes de reintentar.');}
  const value=await response.json().catch(()=>null);if(!response.ok)throw new Error(value?.error?.message??'No se pudo completar el conjunto.');return value as T;
}
