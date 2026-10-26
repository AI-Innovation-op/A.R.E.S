import { safeMemory, type MemoryContext } from './memory';
import type { WorkspaceContext } from './workspace';
import { generationData } from './stream';
export interface Message { role: 'user' | 'model'; content: string }
export interface Source { uri: string; title: string }
export type Provider = 'gemini' | 'openrouter';
export type ChatTask = 'programming' | 'documentation' | 'audit' | 'architecture';
export interface Attribution { provider?: Provider; model?: string }
export interface Reply extends Attribution { content: string; sources: Source[]; memory?: MemoryContext; workspace?: WorkspaceContext }
export interface ProviderStatus { configured: boolean; model: string }
export interface CatalogModel { id: string; name: string; contextLength: number; inputPerMillion: number | null; outputPerMillion: number | null; free: boolean }

export function boundedHistory(messages: Message[], message: string): Message[] {
  const history = messages.slice(-16).map(entry => ({ role: entry.role, content: entry.content.slice(0, 16000) }));
  // El límite HTTP se mide en bytes, no caracteres. Se retiran siempre pares completos.
  while (history.length && new TextEncoder().encode(JSON.stringify({ message, history })).byteLength > 290 * 1024) {
    history.splice(0, 2);
  }
  return history;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
export function safeSources(input: unknown): Source[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input.flatMap((source: unknown) => {
    if (!isRecord(source) || typeof source.uri !== 'string' || typeof source.title !== 'string') return [];
    try {
      const url = new URL(source.uri);
      if (!['http:', 'https:'].includes(url.protocol) || seen.has(url.href)) return [];
      seen.add(url.href);
      return [{ uri: url.href, title: source.title }];
    } catch { return []; }
  }).slice(0, 5);
}

export async function sendChat(message: string, history: Message[], signal: AbortSignal, task: ChatTask = 'programming',onDelta?:(text:string)=>void): Promise<Reply> {
  let response: Response;
  try {
    response = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json',...(onDelta?{Accept:'text/event-stream'}:{}) },
      body: JSON.stringify({ message, history, task }), signal,
    });
  } catch (error: unknown) {
    if (signal.aborted) throw error;
    throw new Error('No se pudo conectar con A.R.E.S. Comprueba que el backend esté iniciado.');
  }
  const data: unknown = await generationData(response,onDelta);
  if (!response.ok) {
    const message = isRecord(data) && isRecord(data.error) && typeof data.error.message === 'string'
      ? data.error.message : [500, 502, 503, 504].includes(response.status)
        ? 'No se pudo conectar con el servidor local. Comprueba que A.R.E.S. esté iniciado.'
        : 'El servidor no pudo completar la solicitud.';
    throw new Error(message);
  }
  if (!isRecord(data) || typeof data.content !== 'string' || !data.content.trim()) {
    throw new Error('El servidor devolvió una respuesta vacía o inválida.');
  }
  return { content: data.content, sources: safeSources(data.sources),
    ...(safeMemory(data.memory) ? { memory: safeMemory(data.memory) } : {}),
    ...(data.provider === 'gemini' || data.provider === 'openrouter' ? { provider: data.provider } : {}),
    ...(typeof data.model === 'string' ? { model: data.model } : {}),
  };
}

export interface ConnectionStatus { state: 'offline' | 'needs-setup' | 'ready'; model: string; providers?: Record<Provider, ProviderStatus> }
export async function checkConnection(): Promise<ConnectionStatus> {
  try {
    const response = await fetch('/health', { signal: AbortSignal.timeout(4000) });
    const data: unknown = await response.json();
    if (!response.ok || !isRecord(data) || data.status !== 'ok') return { state: 'offline', model: '' };
    const chat = isRecord(data.chat) ? data.chat : {};
    const result: ConnectionStatus = { state: chat.configured === false ? 'needs-setup' : 'ready', model: typeof chat.model === 'string' ? chat.model : '' };
    if (isRecord(data.providers)) {
      const { gemini, openrouter } = data.providers;
      if (isRecord(gemini) && isRecord(openrouter) && typeof gemini.configured === 'boolean' && typeof openrouter.configured === 'boolean') {
        result.providers = {
          gemini: { configured: gemini.configured, model: typeof gemini.model === 'string' ? gemini.model : '' },
          openrouter: { configured: openrouter.configured, model: typeof openrouter.model === 'string' ? openrouter.model : '' },
        };
      }
    }
    return result;
  } catch { return { state: 'offline', model: '' }; }
}

export async function configureGemini(apiKey: string, model: string): Promise<void> {
  return configureProvider('gemini', apiKey, model);
}

export async function configureProvider(provider: Provider, apiKey: string, model: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/api/setup/${provider}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(apiKey ? { apiKey } : {}), model }), signal: AbortSignal.timeout(40000),
    });
  } catch { throw new Error('No se pudo contactar al servidor local. Inicia A.R.E.S. y vuelve a intentarlo.'); }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(isRecord(data) && isRecord(data.error) && typeof data.error.message === 'string' ? data.error.message : 'No se pudo guardar la configuración.');
  }
  if (!isRecord(data) || data.status !== 'configured') throw new Error('El servidor no confirmó la configuración.');
}

export async function listModels(): Promise<CatalogModel[]> {
  const response = await fetch('/api/models/openrouter', { signal: AbortSignal.timeout(20000) });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(data) || !Array.isArray(data.models)) throw new Error('No se pudo cargar el catálogo. Puedes escribir el identificador manualmente.');
  return data.models.filter((model: unknown): model is CatalogModel => isRecord(model) && typeof model.id === 'string' && typeof model.name === 'string' && typeof model.free === 'boolean');
}
