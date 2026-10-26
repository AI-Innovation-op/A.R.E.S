import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConsoleStore } from '../src/stores/console';
import { useLibraryStore } from '../src/stores/library';
import { useWorkspaceStore } from '../src/stores/workspace';
import type { ToolRun, SourceFile } from '../src/services/workspace';
const source: SourceFile = { path: 'src/app.ts', sha256: 'a'.repeat(64), content: 'export const answer=42;', bytes: 23, modifiedAt: '', redacted: false };
const run: ToolRun = { id: 'run-1', projectId: 'project-1', workspacePath: 'D:/project', requestId: 'request-1', directory: '', script: 'check', manifestHash: 'b'.repeat(64), command: 'node check.mjs', status: 'PASSED', output: 'CHECK_OK', truncated: false, exitCode: 0, startedAt: '', finishedAt: '' };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
beforeEach(() => { setActivePinia(createPinia()); vi.useFakeTimers(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it('adjunta referencias del proyecto sin enviar el contenido de archivos desde el cliente', async () => {
  const conversation = { id: 'conversation-1', title: 'Chat', revision: 0, projectId: 'project-1', createdAt: '', updatedAt: '' };
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ conversation }))
    .mockResolvedValueOnce(response({ content: 'ok', sources: [], conversationId: conversation.id, revision: 1, messages: [{ id: 'u', role: 'user', content: 'Revisa', sources: [] }, { id: 'm', role: 'model', content: 'ok', sources: [] }] }))
    .mockResolvedValueOnce(response({ conversations: [conversation] }));
  vi.stubGlobal('fetch', fetchMock);
  const library = useLibraryStore(); library.status = 'ready'; library.projectId = 'project-1'; library.projects = [{ id: 'project-1', name: 'Proyecto', createdAt: '' }];
  const store = useConsoleStore(); store.historyStatus = 'ready'; store.attach('project-1', source, run); store.draft = 'Revisa';
  await store.runChat(); const input = JSON.parse(fetchMock.mock.calls[1]![1].body);
  expect(input.files).toEqual([{ path: source.path, sha256: source.sha256 }]); expect(input.runIds).toEqual([run.id]); expect(input.files[0].content).toBeUndefined(); expect(store.attachedFiles).toHaveLength(0);
});
it('conserva adjuntos y texto cuando el servidor detecta un archivo cambiado', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: { message: 'El archivo cambió. Vuelve a leerlo.' } }, 409)));
  const store = useConsoleStore(); store.historyStatus = 'ready'; store.activeConversation = { id: 'chat', projectId: 'project-1', title: '', revision: 0, createdAt: '', updatedAt: '' };
  store.attach('project-1', source); store.draft = 'Revisa'; await store.runChat();
  expect(store.draft).toBe('Revisa'); expect(store.attachedFiles).toHaveLength(1); expect(store.error).toContain('cambió');
});
it('rechaza adjuntos de otro proyecto antes de llamar al servidor', async () => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  const store = useConsoleStore(); store.historyStatus = 'ready'; store.activeConversation = { id: 'chat', projectId: 'project-2', title: '', revision: 0, createdAt: '', updatedAt: '' };
  store.attach('project-1', source); store.draft = 'Revisa'; await store.runChat(); expect(fetchMock).not.toHaveBeenCalled(); expect(store.error).toContain('otro proyecto');
});
it('reintenta una ejecución incierta con el mismo UUID y conserva su resultado', async () => {
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error('Red')).mockResolvedValueOnce(response({ run })); vi.stubGlobal('fetch', fetchMock);
  const store = useWorkspaceStore(); store.projectId = 'project-1'; store.preview = { directory: '', manifestHash: run.manifestHash, scripts: [{ name: 'check', command: 'node check.mjs', runnable: true }], runnerAvailable: true };
  await store.execute('check'); await store.execute('check');
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body).requestId).toBe(JSON.parse(fetchMock.mock.calls[1]![1].body).requestId); expect(store.selectedRun?.status).toBe('PASSED');
});
