import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConsoleStore } from '../src/stores/console';
import { getPose, getStancePose, parsePose } from '../src/domain/poses';
import { renderMarkdown } from '../src/utils/markdown';
import { boundedHistory, safeSources, type Message } from '../src/services/api';

function success(content = '[🛡️ POSE 15: SANTUARIO | OJOS: [^ ^] | ESCUDO: DOCS]\n\n# Respuesta') {
  return new Response(JSON.stringify({ content, sources: [] }), { status: 200 });
}
beforeEach(() => { setActivePinia(createPinia()); vi.useFakeTimers(); });
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllTimers(); vi.useRealTimers(); });

describe('estado de conversación', () => {
  it('actualiza la pose al llegar la cabecera SSE y anuncia la respuesta solo al confirmarse',async()=>{
    let stream!:ReadableStreamDefaultController<Uint8Array>;const encoder=new TextEncoder();const body=new ReadableStream<Uint8Array>({start(controller){stream=controller;}});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(body,{headers:{'Content-Type':'text/event-stream'}})));
    const store=useConsoleStore();store.draft='Propón un refactor.';const running=store.runChat();stream.enqueue(encoder.encode('event: delta\ndata: {"text":"[🛡️ POSE 11: CORTE]\\n\\nPropuesta en curso."}\n\n'));
    await vi.waitFor(()=>expect(store.pose.id).toBe(11));expect(store.pending).toBe(true);expect(store.completedReply).toBeNull();
    stream.enqueue(encoder.encode('event: done\ndata: {"content":"[🛡️ POSE 11: CORTE]\\n\\nPropuesta terminada.","sources":[]}\n\n'));stream.close();await running;expect(store.completedReply?.content).toContain('Propuesta terminada');expect(store.pending).toBe(false);
  });
  it('envía solo 16 mensajes de contexto en pares y reconoce la pose de respuesta', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => success());
    vi.stubGlobal('fetch', fetchMock);
    const store = useConsoleStore();
    for (let index = 0; index < 20; index++) store.messages.push({ id: index, role: index % 2 === 0 ? 'user' : 'model', content: `Turno ${index}`, sources: [] });
    store.draft = 'Nuevo mensaje';
    await store.runChat();
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.history).toHaveLength(16);
    expect(body.history[0]).toEqual({ role: 'user', content: 'Turno 4' });
    expect(body.message).toBe('Nuevo mensaje');
    expect(store.messages).toHaveLength(22);
    expect(store.pose.id).toBe(15);
    await vi.advanceTimersByTimeAsync(12000);
    expect(store.pose.id).toBe(1);
  });

  it('recupera un mensaje fallido sin romper el historial y permite reintentar', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'Cuota agotada' } }), { status: 429 }))
      .mockImplementationOnce(async () => success());
    vi.stubGlobal('fetch', fetchMock);
    const store = useConsoleStore();
    store.draft = 'Ayuda';
    await store.runChat();
    expect(store.error).toBe('Cuota agotada');
    expect(store.draft).toBe('Ayuda');
    expect(store.messages).toHaveLength(0);
    expect(store.pose.id).toBe(2);
    await store.runChat();
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body).history).toEqual([]);
    expect(store.messages).toHaveLength(2);
    expect(store.error).toBe('');
  });

  it('cancela una solicitud pendiente, recupera el texto y evita envíos dobles', async () => {
    const fetchMock = vi.fn().mockImplementation((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Cancelado', 'AbortError')));
    }));
    vi.stubGlobal('fetch', fetchMock);
    const store = useConsoleStore();
    store.draft = 'No perder este texto';
    const pending = store.runChat();
    store.draft = 'Segundo mensaje';
    await store.runChat();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    store.draft = '';
    store.cancel();
    await pending;
    expect(store.messages).toHaveLength(0);
    expect(store.draft).toBe('No perder este texto');
    expect(store.error).toBe('');
    expect(store.pending).toBe(false);
    expect(store.pose.id).toBe(1);
  });

  it('envía los módulos sin historial y conserva un borrador previo ante error', async () => {
    const fetchMock = vi.fn().mockImplementationOnce(async () => success('# Borrador de README'))
      .mockRejectedValueOnce(new Error('Offline'));
    vi.stubGlobal('fetch', fetchMock);
    const store = useConsoleStore();
    store.moduleStates.documentation.context = 'API de tareas en Node';
    await store.runModule('documentation');
    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(payload.history).toEqual([]);
    expect(payload.task).toBe('documentation');
    expect(payload.message).toContain('API de tareas en Node');
    expect(payload.message).toContain('sin indicador de pose');
    expect(store.moduleStates.documentation.result).toBe('# Borrador de README');
    expect(store.messages).toHaveLength(0);
    await store.runModule('documentation');
    expect(store.moduleStates.documentation.result).toBe('# Borrador de README');
    expect(store.error).toContain('No se pudo conectar');
  });

  it('no incorpora respuestas inválidas al historial', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"content":null}', { status: 200 })));
    const store = useConsoleStore();
    store.draft = 'Hola';
    await store.runChat();
    expect(store.messages).toHaveLength(0);
    expect(store.error).toContain('inválida');
  });
  it('elige poses de conversación antes y después de una respuesta sin indicador', async () => {
    let deliver: ((value: Response) => void) | undefined;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>(resolve => { deliver = resolve; })));
    const store = useConsoleStore(); store.draft = 'Refactoriza esta clase';
    const pending = store.runChat();
    expect(store.pose.id).toBe(10);
    deliver!(success('Una propuesta de refactorización.'));
    await pending;
    expect(store.pose.id).toBe(11);
  });
});

describe('poses y Markdown seguro', () => {
  it('recorta contexto multibyte por pares para respetar el límite HTTP', () => {
    const input: Message[] = Array.from({ length: 16 }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'model', content: '界'.repeat(16000) }));
    const history = boundedHistory(input, 'Nuevo mensaje');
    expect(history.length).toBeLessThan(16);
    expect(history.length % 2).toBe(0);
    expect(new TextEncoder().encode(JSON.stringify({ message: 'Nuevo mensaje', history })).byteLength).toBeLessThan(300 * 1024);
    expect(history[0]?.role).toBe('user');
  });
  it('extrae solo indicadores iniciales válidos, incluidas expresiones con corchetes', () => {
    expect(parsePose('[⚔️ POSE 11: CORTE | OJOS: [> <] | ESPADA: SOLID]\nCódigo').pose?.id).toBe(11);
    expect(parsePose('[⚔️ POSE 11: CORTE | OJOS: [> <] | ESPADA: SOLID]\nCódigo').text).toBe('Código');
    expect(parsePose('[POSE 17: inválido]\nTexto').pose).toBeNull();
    expect(parsePose('Código\n[POSE 11: ejemplo]').text).toContain('[POSE 11: ejemplo]');
    expect(getPose(12).eyes).toBe('> _ <');
    expect(getStancePose('SHIELD').id).toBe(15);
    expect(getPose(999).id).toBe(1);
  });

  it('mantiene Markdown y elimina scripts, eventos, imágenes y URLs ejecutables', () => {
    const html = renderMarkdown('# Título\n\n**Código**\n\n<script>alert(1)</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)" onclick="alert(1)">Enlace</a>\n\n```ts\nconst x = 1;\n```');
    expect(html).toContain('<h1>Título</h1>');
    expect(html).toContain('<strong>Código</strong>');
    expect(html).toContain('const x = 1;');
    expect(html).not.toMatch(/<script|<img|onerror|onclick|javascript:/i);
  });

  it('filtra, deduplica y limita las fuentes a cinco enlaces http(s)', () => {
    const sources = safeSources([
      { uri: 'javascript:alert(1)', title: 'malo' },
      { uri: 'https://example.com', title: 'uno' },
      { uri: 'https://example.com/', title: 'duplicado' },
      ...Array.from({ length: 8 }, (_, index) => ({ uri: `https://example.com/${index}`, title: 'fuente' })),
    ]);
    expect(sources).toHaveLength(5);
    expect(new Set(sources.map(source => source.uri)).size).toBe(5);
    expect(sources.every(source => source.uri.startsWith('https://'))).toBe(true);
  });
});
