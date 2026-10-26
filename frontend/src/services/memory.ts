export interface MemoryReference { label: string; artifactId: string; title: string; excerpt: string; chunkNumber: number; similarity: number;sourceKind?:'code';filePath?:string;sha256?:string }
export interface MemoryContext { projectId: string; projectName: string; indexedDocuments: number; pendingDocuments: number; references: MemoryReference[] }
export interface MemoryStatus { projectId: string; projectName: string; documents: number; indexedDocuments: number; pendingDocuments: number; chunks: number; model: string; configured: boolean;codeFiles?:number;indexedCodeFiles?:number }
export function safeMemory(value: unknown): MemoryContext | undefined {
  if (!value || typeof value !== 'object' || !('projectId' in value) || typeof value.projectId !== 'string' || !('projectName' in value) || typeof value.projectName !== 'string' || !('references' in value) || !Array.isArray(value.references)) return;
  const references = value.references.filter((item): item is MemoryReference => item && typeof item === 'object' && /^D[1-4]$/.test(item.label) && typeof item.artifactId === 'string' && typeof item.title === 'string' && typeof item.excerpt === 'string' && Number.isInteger(item.chunkNumber) && Number.isFinite(item.similarity)).slice(0, 4);
  return { projectId: value.projectId, projectName: value.projectName, indexedDocuments: 'indexedDocuments' in value ? Number(value.indexedDocuments) || 0 : 0, pendingDocuments: 'pendingDocuments' in value ? Number(value.pendingDocuments) || 0 : 0, references };
}
export async function memoryRequest(projectId: string, index = false, signal?: AbortSignal): Promise<MemoryStatus> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/memory${index ? '/index' : ''}`, index ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal } : { signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? 'No se pudo consultar la memoria del proyecto.');
  if (!data || typeof data.indexedDocuments !== 'number' || typeof data.pendingDocuments !== 'number' || typeof data.configured !== 'boolean') throw new Error('Respuesta de memoria inválida.');
  return data;
}
