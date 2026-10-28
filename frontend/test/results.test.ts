import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useResultStore } from '../src/stores/results';
import { useConsoleStore } from '../src/stores/console';
import { useLibraryStore } from '../src/stores/library';
import { resultBlocks } from '../src/domain/results';
import { useAccessStore } from '../src/stores/access';

const conversation = { id: 'conversation', projectId: 'project-a', title: 'Prueba', revision: 1, createdAt: '', updatedAt: '' };
const message = { id: 'reply', role: 'model' as const, content: '[🛡️ POSE 15: DOC]\n\n# Documento\n\nFuente verificable.', sources: [], provider: 'gemini' as const, model: 'fixture' };
const artifact = { id: 'artifact', projectId: 'project-a', title: 'Nota', content: '# Nota guardada', sources: [], provider: 'gemini', model: 'fixture', status: 'DRAFT', revision: 0, module: 'documentation', context: 'Turno confirmado', format: 'Nota de conversación', sequence: 1, createdAt: '' };
beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.unstubAllGlobals());

it('un informe GitHub conserva su alcance al incorporarlo, incluso después de editar el documento', async () => {
  const results = useResultStore(), chat = useConsoleStore(); useLibraryStore().projectId = 'project-a';
  const provenance = 'Lectura pública GitHub: https://github.com/example/orders\nCommit fijado: aaaa\nCobertura: 1 leído de 20 rutas';
  const report = { id:'report',title:'Informe',content:'# Hallazgo',context:provenance,sources:[],provider:'openrouter' as const,model:'fixture',createdAt:'',persistable:true };
  results.openGithub(report,'snapshot','project-a');
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({artifact:{...artifact,context:provenance}}))); vi.stubGlobal('fetch',fetch);
  await results.saveGithub(); expect(fetch).toHaveBeenCalledTimes(1); expect(fetch.mock.calls[0]?.[0]).toBe('/api/github/save');
  results.updated({...artifact,provider:'openrouter',content:'Documento editado, sin encabezado',context:provenance} as never);
  expect(results.useInMessage()).toBe(true); expect(chat.draft).toContain('Commit fijado: aaaa'); expect(chat.draft).toContain('1 leído de 20'); expect(chat.draft).toContain('Documento editado');
});

it('abre una respuesta sin otra inferencia y conserva su origen al cambiar el chat', () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const results = useResultStore(); results.openMessage(message, conversation, 'Solicitud original');
  expect(results.content.trim()).toBe('# Documento\n\nFuente verificable.');
  expect(results.origin).toMatchObject({ conversationId: 'conversation', messageId: 'reply', projectId: 'project-a', context: 'Solicitud original' });
  useConsoleStore().newConversation();
  expect(results.origin?.conversationId).toBe('conversation'); expect(fetch).not.toHaveBeenCalled();
});

it('distingue diagramas y bloques de código sin inferir nombres de archivos', () => {
  expect(resultBlocks('```mermaid\nflowchart LR\nA-->B\n```\n\n```ts\nexport const n = 1;\n```')).toEqual([
    { language: 'mermaid', content: 'flowchart LR\nA-->B' }, { language: 'ts', content: 'export const n = 1;' },
  ]);
});

it('incorpora el contenido revisado al borrador sin enviarlo y respeta el proyecto', () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const results = useResultStore(), chat = useConsoleStore();
  results.openMessage(message, conversation, 'Pregunta'); chat.draft = 'Mi pregunta existente';
  useLibraryStore().projectId = 'otro';
  expect(results.useInMessage()).toBe(false); expect(chat.draft).toBe('Mi pregunta existente');
  useLibraryStore().projectId = 'project-a';
  expect(results.useInMessage()).toBe(true); expect(chat.draft).toContain('Fuente verificable.'); expect(chat.draft).toContain('mensaje reply'); expect(chat.draft).toContain('Mi pregunta existente');
  expect(fetch).not.toHaveBeenCalled();
});

it('rechaza un contexto demasiado largo conservando el borrador', () => {
  const results = useResultStore(), chat = useConsoleStore();
  results.openMessage({ ...message, content: 'x'.repeat(16000) }, null, ''); chat.draft = 'Conservar';
  expect(results.useInMessage()).toBe(false); expect(chat.draft).toBe('Conservar');
});

it('impide reemplazar una edición pendiente y la conserva al cerrar', () => {
  const results = useResultStore(); results.openMessage(message, conversation, 'Original'); results.dirty = true;
  results.close(); expect(results.open).toBe(false);
  expect(results.openMessage({ ...message, content: 'Otro resultado' }, null, '')).toBe(false);
  expect(results.open).toBe(true); expect(results.origin?.context).toBe('Original');
});

it('guarda solo el ID del turno confirmado y conserva el resultado si falla', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'No disponible' } }), { status: 503 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ artifact })));
  vi.stubGlobal('fetch', fetch);
  const results = useResultStore(); results.openMessage(message, conversation, 'Pregunta');
  await results.saveNote(); expect(results.error).toBe('No disponible'); expect(results.content).toContain('Fuente verificable.');
  await results.saveNote(); expect(results.artifact?.id).toBe('artifact');
  expect(JSON.parse(fetch.mock.calls[1]![1].body)).toEqual({ messageId: 'reply' });
  await results.saveNote(); expect(fetch).toHaveBeenCalledTimes(2);
});

it('no guarda una respuesta de sesión como si fuera un turno persistido', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const results = useResultStore(); results.openMessage({ ...message, id: 1 }, null, 'Pregunta');
  await results.saveNote(); expect(fetch).not.toHaveBeenCalled();
});

it('una sesión lectora abre resultados sin guardar notas ni incorporar borradores', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const access = useAccessStore(); access.ready = true; access.user = { id: 'reader', name: 'Lector', role: 'viewer' };
  const results = useResultStore();
  expect(results.openMessage(message, conversation, 'Pregunta')).toBe(true);
  expect(results.useInMessage()).toBe(false);
  await results.saveNote(); expect(fetch).not.toHaveBeenCalled();
});

it('descarta una lectura tardía de Biblioteca si ya se abrió otro resultado', async () => {
  let finish!: (value: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
  const results = useResultStore(); const pending = results.openArtifact('artifact');
  results.openMessage(message, conversation, 'Conservar este origen');
  finish(new Response(JSON.stringify({ artifact }))); await pending;
  expect(results.artifact).toBeNull(); expect(results.origin?.context).toBe('Conservar este origen'); expect(results.loading).toBe(false);
});
