import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useChangesStore } from '../src/stores/changes';
import type { Proposal } from '../src/services/changes';
const proposal: Proposal = { id: 'proposal', projectId: 'project', requestId: 'request', workspacePath: 'D:/project', path: 'source.ts', instruction: 'Cambia valor', summary: 'Cambio', beforeContent: '42', afterContent: '43', beforeHash: 'a'.repeat(64), afterHash: 'b'.repeat(64), patch: '-42\n+43', provider: 'openrouter', model: 'coder', status: 'DRAFT', createdAt: '', updatedAt: '', lastError: null };
const file = { path: proposal.path, sha256: proposal.beforeHash, content: '42', bytes: 2, modifiedAt: '', redacted: false };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
beforeEach(() => setActivePinia(createPinia())); afterEach(() => vi.unstubAllGlobals());
it('generar prepara el diff sin solicitar aplicación y no envía contenido de archivo desde el cliente', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ proposal })).mockResolvedValueOnce(response({ proposals: [proposal] })); vi.stubGlobal('fetch', fetchMock);
  const store = useChangesStore(); store.projectId = 'project'; await store.generate(file, 'Cambia valor');
  const body = JSON.parse(fetchMock.mock.calls[0]![1].body); expect(body.sha256).toBe(file.sha256); expect(body.content).toBeUndefined(); expect(store.selected?.status).toBe('DRAFT');
  expect(fetchMock.mock.calls.every(call => !String(call[0]).endsWith('/apply'))).toBe(true);
});
it('aplicar envía únicamente la huella de la versión revisada', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ proposal: { ...proposal, status: 'APPLIED' } })).mockResolvedValueOnce(response({ proposals: [] })); vi.stubGlobal('fetch', fetchMock);
  const store = useChangesStore(); store.projectId = 'project'; store.selected = proposal;
  expect(await store.act('apply')).toBe(true); expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ approvedHash: proposal.afterHash }); expect(store.selected?.status).toBe('APPLIED');
});
it('un conflicto conserva el diff y permite recuperar el estado confirmado del servidor', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ error: { message: 'El archivo cambió' } }, 409)).mockResolvedValueOnce(response({ proposals: [{ ...proposal, status: 'APPLIED' }] })).mockResolvedValueOnce(response({ proposal: { ...proposal, status: 'APPLIED' } })); vi.stubGlobal('fetch', fetchMock);
  const store = useChangesStore(); store.projectId = 'project'; store.selected = proposal;
  expect(await store.act('apply')).toBe(false); expect(store.selected?.patch).toBe(proposal.patch); expect(store.error).toContain('cambió');
  await store.refresh(); expect(store.selected?.status).toBe('APPLIED');
});
it('reintentar una generación incierta reutiliza el mismo UUID', async () => {
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error('Red')).mockResolvedValueOnce(response({ proposal })).mockResolvedValueOnce(response({ proposals: [proposal] })); vi.stubGlobal('fetch', fetchMock);
  const store = useChangesStore(); store.projectId = 'project'; await store.generate(file, 'Cambia valor'); await store.generate(file, 'Cambia valor');
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body).requestId).toBe(JSON.parse(fetchMock.mock.calls[1]![1].body).requestId);
});
