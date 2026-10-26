import { afterEach, expect, it, vi } from 'vitest';
import { checkConnection, configureGemini, sendChat } from '../src/services/api';
afterEach(() => vi.unstubAllGlobals());

it('distingue servidor apagado, clave pendiente y chat configurado', async () => {
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', chat: { configured: false, model: 'test' } })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', chat: { configured: true, model: 'test' } })));
  vi.stubGlobal('fetch', fetchMock);
  expect((await checkConnection()).state).toBe('offline');
  expect(await checkConnection()).toEqual({ state: 'needs-setup', model: 'test' });
  expect((await checkConnection()).state).toBe('ready');
});

it('explica un proxy 502 sin JSON como fallo de conexión local', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 502 })));
  await expect(sendChat('hola', [], new AbortController().signal)).rejects.toThrow('servidor local');
});

it('no comunica éxito si el guardado no fue confirmado', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
  await expect(configureGemini('test-key', 'test-model')).rejects.toThrow('no confirmó');
});
