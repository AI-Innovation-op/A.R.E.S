import type { Attribution, ChatTask, Message, Reply, Source } from './api';
import type { FileReference } from './workspace';
import { generationData } from './stream';
export interface Conversation { id: string; title: string; revision: number; createdAt: string; updatedAt: string; projectId?: string }
export interface StoredMessage extends Message, Attribution { id: string; sequence: number; createdAt: string; sources: Source[]; task?: ChatTask; poseNumber?: number; memory?: Reply['memory']; workspace?: Reply['workspace']; useMemory?: boolean }
export interface ConversationPage { conversation: Conversation; messages: StoredMessage[]; hasMore: boolean }
export interface SavedTurn extends Reply { conversationId: string; revision: number; messages: StoredMessage[] }
export class HistoryError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
async function request<T>(path: string, init?: RequestInit,onDelta?:(text:string)=>void): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/conversations${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } }); }
  catch (error) { if (init?.signal?.aborted) throw error; throw new HistoryError('No se pudo conectar con el historial. Tu texto sigue en el editor.', 503); }
  const data: unknown = await generationData(response,onDelta);
  if (!response.ok) {
    const error = typeof data === 'object' && data !== null && 'error' in data ? data.error : null;
    const message = typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : 'El historial no está disponible.';
    throw new HistoryError(message, response.status);
  }
  return data as T;
}
export async function listConversations() {
  const data = await request<{ conversations: Conversation[] }>('');
  if (!Array.isArray(data.conversations)) throw new HistoryError('Respuesta de historial inválida.', 502);
  return data.conversations;
}
export async function createConversation(title = 'Nueva conversación', projectId?: string) {
  return (await request<{ conversation: Conversation }>('', { method: 'POST', body: JSON.stringify({ title, ...(projectId ? { projectId } : {}) }) })).conversation;
}
export async function readConversation(id: string, before?: number) {
  const data = await request<ConversationPage>(`/${encodeURIComponent(id)}${before ? `?before=${before}` : ''}`);
  if (!data.conversation || !Array.isArray(data.messages)) throw new HistoryError('Respuesta de historial inválida.', 502);
  return data;
}
export function sendPersistentMessage(conversation: Conversation, requestId: string, message: string, task: ChatTask, signal: AbortSignal, useMemory = false, files: FileReference[] = [], runIds: string[] = [],onDelta?:(text:string)=>void) {
  return request<SavedTurn>(`/${encodeURIComponent(conversation.id)}/messages`, {
    method: 'POST', signal,headers:onDelta?{Accept:'text/event-stream'}:{}, body: JSON.stringify({ requestId, revision: conversation.revision, message, task, useMemory, files, runIds }),
  },onDelta);
}
