import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConsoleStore } from '../src/stores/console';
import { useLibraryStore } from '../src/stores/library';
import { useMemoryStore } from '../src/stores/memory';
import { safeMemory } from '../src/services/memory';
const projectId = '10000000-0000-4000-8000-000000000001';
const conversation = { id: '10000000-0000-4000-8000-000000000002', title: 'Nueva conversación', revision: 0, projectId, createdAt: '', updatedAt: '' };
const memory = { projectId, projectName: 'Proyecto', indexedDocuments: 1, pendingDocuments: 0, references: [{ label: 'D1', artifactId: 'doc-1', title: 'Guía', excerpt: 'npm run dev', chunkNumber: 0, similarity: 0.8 }] };
const status = { projectId, projectName: 'Proyecto', documents: 1, indexedDocuments: 0, pendingDocuments: 1, chunks: 0, model: 'gemini-embedding-001', configured: true };
const response = (data: unknown) => new Response(JSON.stringify(data));
beforeEach(() => { setActivePinia(createPinia()); vi.useFakeTimers(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it('vincula una conversación nueva al proyecto y envía la opción de memoria sin fragmentos del cliente', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ conversation }))
    .mockResolvedValueOnce(response({ content: 'npm run dev [D1]', sources: [], memory, conversationId: conversation.id, revision: 1, messages: [{ id: 'u', role: 'user', content: 'Inicio', sources: [] }, { id: 'm', role: 'model', content: 'npm run dev [D1]', sources: [], memory }] }))
    .mockResolvedValueOnce(response({ conversations: [conversation] }));
  vi.stubGlobal('fetch', fetchMock);
  const library = useLibraryStore(); library.status = 'ready'; library.projectId = projectId; library.projects = [{ id: projectId, name: 'Proyecto', createdAt: '' }];
  const store = useConsoleStore(); store.historyStatus = 'ready'; store.useMemory = true; store.draft = 'Inicio';
  await store.runChat();
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body).projectId).toBe(projectId);
  const input = JSON.parse(fetchMock.mock.calls[1]![1].body); expect(input.useMemory).toBe(true); expect(input.memory).toBeUndefined(); expect(input.projectId).toBeUndefined();
  expect(store.messages[1]?.memory).toEqual(memory); expect(store.activeConversation?.projectId).toBe(projectId);
});
it('una consulta de memoria sin PostgreSQL conserva el texto y no envía una solicitud de sesión', async () => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  const store = useConsoleStore(); store.historyStatus = 'offline'; store.useMemory = true; store.draft = 'Mi consulta';
  await store.runChat(); expect(fetchMock).not.toHaveBeenCalled(); expect(store.draft).toBe('Mi consulta'); expect(store.error).toContain('PostgreSQL');
});
it('prepara los lotes pendientes y conserva el estado final del proyecto', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(response(status)).mockResolvedValueOnce(response({ ...status, chunks: 8 }))
    .mockResolvedValueOnce(response({ ...status, chunks: 10, indexedDocuments: 1, pendingDocuments: 0 }));
  vi.stubGlobal('fetch', fetchMock); const store = useMemoryStore(); await store.prepare(projectId);
  expect(fetchMock).toHaveBeenCalledTimes(3); expect(store.statuses[projectId]?.indexedDocuments).toBe(1); expect(store.busyProject).toBe('');
  expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({});
});
it('valida los metadatos recuperados y rechaza referencias mal formadas', () => {
  expect(safeMemory({ ...memory, references: [...memory.references, { label: 'D9', title: 'Falsa' }] })?.references).toHaveLength(1);
  expect(safeMemory({ projectId })).toBeUndefined(); expect(safeMemory(null)).toBeUndefined();
});
