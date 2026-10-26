import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConsoleStore } from '../src/stores/console';
const id = '10000000-0000-4000-8000-000000000001';
const conversation = { id, title: 'Guardada', revision: 0, createdAt: '2026-10-25T00:00:00Z', updatedAt: '2026-10-25T00:00:00Z' };
const pair = [
  { id: '20000000-0000-4000-8000-000000000001', sequence: 1, createdAt: conversation.createdAt, role: 'user', content: 'Hola', sources: [], task: 'documentation' },
  { id: '20000000-0000-4000-8000-000000000002', sequence: 2, createdAt: conversation.createdAt, role: 'model', content: 'Documento', sources: [], task: 'documentation', provider: 'gemini', model: 'test-model' },
];
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('recupera conversación, proveedor y último modo al iniciar una nueva instancia', async () => {
  localStorage.setItem('ares.activeConversation', id);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ conversations: [conversation] }))
    .mockResolvedValueOnce(response({ conversation: { ...conversation, revision: 1 }, messages: pair, hasMore: false })));
  const store = useConsoleStore(); await store.initializeHistory();
  expect(store.historyStatus).toBe('ready'); expect(store.messages).toHaveLength(2);
  expect(store.messages[1]?.provider).toBe('gemini'); expect(store.messages[1]?.model).toBe('test-model');
  expect(store.chatMode).toBe('documentation'); expect(store.activeConversation?.revision).toBe(1);
  expect(JSON.stringify(localStorage)).not.toContain('Documento');
});

it('reintenta un envío con el mismo requestId y sustituye el mensaje optimista por el par guardado', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ conversations: [conversation] }))
    .mockResolvedValueOnce(response({ conversation, messages: [], hasMore: false }))
    .mockResolvedValueOnce(response({ error: { message: 'PostgreSQL temporalmente ocupado' } }, 503))
    .mockResolvedValueOnce(response({ content: 'Documento', sources: [], provider: 'gemini', model: 'test-model', conversationId: id, revision: 1, messages: pair }))
    .mockResolvedValueOnce(response({ conversations: [{ ...conversation, revision: 1 }] }));
  vi.stubGlobal('fetch', fetchMock);
  const store = useConsoleStore(); await store.initializeHistory();
  store.draft = 'Hola'; store.chatMode = 'documentation'; await store.runChat();
  expect(store.draft).toBe('Hola'); expect(store.messages).toHaveLength(0);
  await store.runChat();
  const first = JSON.parse(fetchMock.mock.calls[2]![1].body), second = JSON.parse(fetchMock.mock.calls[3]![1].body);
  expect(first.requestId).toBe(second.requestId); expect(first.history).toBeUndefined(); expect(first.task).toBe('documentation');
  expect(store.messages).toHaveLength(2); expect(store.messages[0]?.id).toBe(pair[0]?.id); expect(store.activeConversation?.revision).toBe(1);
});

it('una base desconectada conserva los mensajes de sesión y no aparenta guardarlos', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: { message: 'Sin base' } }, 503)));
  const store = useConsoleStore(); store.messages.push({ id: 1, role: 'user', content: 'No perder', sources: [] });
  await store.initializeHistory();
  expect(store.historyStatus).toBe('offline'); expect(store.messages[0]?.content).toBe('No perder');
  expect(store.historyNotice).toContain('solo en esta sesión'); expect(store.activeConversation).toBeNull();
});
