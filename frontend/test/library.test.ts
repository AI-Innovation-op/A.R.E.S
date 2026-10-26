import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConsoleStore } from '../src/stores/console';
import { useLibraryStore } from '../src/stores/library';
import type { Artifact } from '../src/services/library';
const saved: Artifact = { id: 'artifact-1', projectId: 'project-1', sequence: 1, module: 'documentation', format: 'README.md', title: 'README de prueba', provider: 'gemini', model: 'gemini-test', status: 'DRAFT', createdAt: new Date().toISOString(), context: 'Contexto original', content: '# Guardado', sources: [] };
beforeEach(() => { setActivePinia(createPinia()); vi.useFakeTimers(); });
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllTimers(); vi.useRealTimers(); });
function ready() { const library = useLibraryStore(); library.status = 'ready'; library.projects = [{ id: 'project-1', name: 'Mi proyecto', createdAt: '' }]; library.projectId = 'project-1'; return library; }
it('genera en el proyecto activo y conserva la atribución y confirmación del guardado', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ artifact: saved })));
  vi.stubGlobal('fetch', fetchMock); ready(); const store = useConsoleStore();
  store.moduleStates.documentation.context = saved.context; store.moduleStates.documentation.title = saved.title;
  await store.runModule('documentation');
  expect(fetchMock.mock.calls[0]![0]).toBe('/api/artifacts/generate');
  const body = JSON.parse(fetchMock.mock.calls[0]![1].body); expect(body.projectId).toBe('project-1'); expect(body.module).toBe('documentation'); expect(body.history).toBeUndefined();
  expect(store.moduleStates.documentation).toMatchObject({ artifactId: saved.id, savedProject: 'Mi proyecto', result: '# Guardado', provider: 'gemini', model: 'gemini-test' });
});
it('un fallo conserva el borrador anterior y reutiliza el envío para recuperar un guardado incierto', async () => {
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error('sin conexión')).mockResolvedValueOnce(new Response(JSON.stringify({ artifact: saved })));
  vi.stubGlobal('fetch', fetchMock); ready(); const store = useConsoleStore(); store.moduleStates.documentation.context = saved.context; store.moduleStates.documentation.result = '# Anterior';
  await store.runModule('documentation'); expect(store.moduleStates.documentation.result).toBe('# Anterior'); expect(store.error).toContain('biblioteca');
  await store.runModule('documentation');
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body).requestId).toBe(JSON.parse(fetchMock.mock.calls[1]![1].body).requestId);
  expect(store.moduleStates.documentation.artifactId).toBe(saved.id);
});
it('no genera sin proyecto cuando la biblioteca está conectada y restaura el contexto explícitamente', async () => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); const library = ready(); library.projectId = '';
  const store = useConsoleStore(); store.moduleStates.documentation.context = saved.context;
  await store.runModule('documentation'); expect(fetchMock).not.toHaveBeenCalled(); expect(store.error).toContain('proyecto');
  store.restoreArtifact(saved, 'Proyecto restaurado'); expect(store.moduleStates.documentation).toMatchObject({ context: saved.context, title: saved.title, result: saved.content, savedProject: 'Proyecto restaurado' });
});
