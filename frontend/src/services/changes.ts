export type ProposalStatus = 'DRAFT' | 'APPLYING' | 'APPLIED' | 'REVERTING' | 'REVERTED' | 'REJECTED';
export interface ProposalSummary { id: string; projectId: string; path: string; summary: string; provider: 'openrouter'; model: string; status: ProposalStatus; beforeHash: string; afterHash: string; createdAt: string; updatedAt: string; lastError: string | null }
export interface Proposal extends ProposalSummary { requestId: string; workspacePath: string; instruction: string; beforeContent: string; afterContent: string; patch: string }
export const proposalLabels: Record<ProposalStatus, string> = { DRAFT: 'Por revisar', APPLYING: 'Aplicación por confirmar', APPLIED: 'Aplicado', REVERTING: 'Restauración por confirmar', REVERTED: 'Restaurado', REJECTED: 'Descartado' };
export async function changeRequest<T>(projectId: string, suffix = '', body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/changes${suffix}`, body === undefined ? { signal } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }); }
  catch (cause) { if (signal?.aborted) throw cause; throw new Error('No se pudo contactar al servidor de propuestas. Actualiza antes de reintentar.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? 'No se pudo completar la operación de cambio.');
  return data as T;
}
