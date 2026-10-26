import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import request from 'supertest';
import { RoutedGateway } from '../src/modules/chat/infrastructure/routed-gateway.js';
import { OpenRouterAdapter } from '../src/modules/chat/infrastructure/openrouter-adapter.js';
import { SendMessage } from '../src/modules/chat/application/send-message.js';
import { createApp } from '../src/server.js';
import { HttpError } from '../src/shared/http-error.js';
import { saveGeminiSettings } from '../src/config/gemini-settings.js';
import { listOpenRouterModels, saveOpenRouterSettings } from '../src/config/openrouter-settings.js';

test('enruta documentación a Gemini y programación, auditoría y arquitectura a OpenRouter', async () => {
  const calls: string[] = [];
  const gateway = new RoutedGateway(provider => ({ model: `${provider}-configured`, gateway: { generate: async () => {
    calls.push(provider); return { content: 'respuesta', sources: [], model: `${provider}-actual` };
  } } }));
  const app = createApp({ sendMessage: new SendMessage(gateway), allowedOrigins: [], checkDatabase: async () => {} });
  for (const [task, provider] of [['documentation', 'gemini'], ['programming', 'openrouter'], ['audit', 'openrouter'], ['architecture', 'openrouter']] as const) {
    const response = await request(app).post('/api/chat').send({ message: 'solicitud', task });
    assert.equal(response.status, 200); assert.equal(response.body.provider, provider); assert.equal(response.body.model, `${provider}-actual`);
  }
  const invalid = await request(app).post('/api/chat').send({ message: 'texto', task: 'unknown' });
  assert.equal(invalid.status, 400);
  assert.deepEqual(calls, ['gemini', 'openrouter', 'openrouter', 'openrouter']);
});

test('un proveedor ausente o fallido no cambia al otro de forma implícita', async () => {
  let geminiCalls = 0;
  const router = new RoutedGateway(provider => provider === 'gemini'
    ? { model: 'gemini', gateway: { generate: async () => { geminiCalls++; return { content: 'docs', sources: [] }; } } }
    : { model: 'coder', gateway: null });
  await assert.rejects(router.generate([], 'programming'), (error: unknown) => error instanceof HttpError && error.code === 'OPENROUTER_NOT_CONFIGURED');
  assert.equal(geminiCalls, 0);
});

test('adaptador OpenRouter traduce roles, conserva el sistema y devuelve el modelo real', async () => {
  const fakeKey = 'sk-or-v1-only_test_value_1234567890';
  const adapter = new OpenRouterAdapter(fakeKey, 'test/coder:free', 'Sistema ARES', 1000, 256, async (url, init) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer ${fakeKey}`);
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.messages.map((message: { role: string }) => message.role), ['system', 'user', 'assistant', 'user']);
    assert.equal(body.messages[0].content, 'Sistema ARES'); assert.equal(body.model, 'test/coder:free');
    assert.equal(body.max_tokens, 256); assert.equal(body.stream, false);
    return new Response(JSON.stringify({ model: 'test/coder-v2:free', choices: [{ message: { content: 'Código generado' } }] }));
  });
  const reply = await adapter.generate([{ role: 'user', content: 'Hola' }, { role: 'model', content: 'Hola' }, { role: 'user', content: 'Programa' }]);
  assert.deepEqual(reply, { content: 'Código generado', sources: [], model: 'test/coder-v2:free' });
  assert.ok(!JSON.stringify(reply).includes(fakeKey));
});

test('OpenRouter traduce saldo, cuota, autenticación, indisponibilidad y respuestas inválidas', async () => {
  for (const [status, code] of [[402, 'OPENROUTER_CREDITS'], [429, 'OPENROUTER_QUOTA'], [401, 'OPENROUTER_AUTH'], [404, 'OPENROUTER_MODEL_UNAVAILABLE'], [500, 'OPENROUTER_UNAVAILABLE'], [200, 'OPENROUTER_EMPTY_RESPONSE']] as const) {
    const adapter = new OpenRouterAdapter('test-key', 'test/model', 'system', 1000, 256, async () => new Response('{}', { status }));
    await assert.rejects(adapter.generate([]), (error: unknown) => error instanceof HttpError && error.code === code);
  }
});
test('las propuestas North Mini Code reservan salida visible y rechazan respuestas cortadas sin revelar razonamiento', async () => {
  const adapter = new OpenRouterAdapter('test-key', 'cohere/north-mini-code:free', 'system', 1000, 256, async (_url, init) => {
    const body = JSON.parse(String(init?.body)); assert.deepEqual(body.reasoning, { enabled: false });
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '', reasoning: 'no-visible' } }] }));
  });
  const router = new RoutedGateway(() => ({ gateway: adapter, model: 'cohere/north-mini-code:free' }));
  await assert.rejects(router.generate([], 'programming', { purpose: 'proposal' }), (error: unknown) => error instanceof HttpError && error.code === 'OPENROUTER_OUTPUT_LIMIT' && !error.message.includes('no-visible'));
});

test('guardados simultáneos conservan las claves de ambos proveedores', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ares-providers-')); const path = pathToFileURL(join(directory, '.env'));
  try {
    await Promise.all([
      saveGeminiSettings(path, { apiKey: 'AQ.test_only_gemini_key_123456789', model: 'gemini-test' }),
      saveOpenRouterSettings(path, { apiKey: 'sk-or-v1-test_only_openrouter_key_123456789', model: 'test/coder:free' }),
    ]);
    const content = await readFile(path, 'utf8');
    assert.equal(content.match(/^GEMINI_API_KEY=/gm)?.length, 1); assert.equal(content.match(/^OPENROUTER_API_KEY=/gm)?.length, 1);
    assert.ok(content.includes('OPENROUTER_MODEL="test/coder:free"'));
  } finally { await rm(join(directory, '.env'), { force: true }); await rmdir(directory); }
});

test('catálogo admite precios variables y separa modelos gratuitos de pago', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ data: [
    { id: 'test/free', name: 'Free', context_length: 1000, pricing: { prompt: '0', completion: '0' } },
    { id: 'test/paid', name: 'Paid', context_length: 1000, pricing: { prompt: '0.000001', completion: '0.000002' } },
    { id: 'test/router', name: 'Router', context_length: 1000, pricing: { prompt: '-1', completion: '-1' } },
  ] }));
  try {
    const models = await listOpenRouterModels();
    assert.equal(models.find(model => model.id === 'test/free')?.free, true);
    assert.equal(models.find(model => model.id === 'test/paid')?.inputPerMillion, 1);
    assert.equal(models.find(model => model.id === 'test/router')?.inputPerMillion, null);
    assert.equal(models.find(model => model.id === 'test/router')?.free, false);
  } finally { globalThis.fetch = original; }
});

test('configuración de OpenRouter protege el origen y acepta cambios de modelo sin reflejar claves', async () => {
  let calls = 0;
  const app = createApp({
    sendMessage: new SendMessage({ generate: async () => ({ content: 'ok', sources: [] }) }), allowedOrigins: ['http://127.0.0.1:5175'], checkDatabase: async () => {},
    configureOpenRouter: async settings => { calls++; assert.equal(settings.model, 'test/coder:free'); },
  });
  const payload = { model: 'test/coder:free' };
  assert.equal((await request(app).post('/api/setup/openrouter').send(payload)).status, 403);
  assert.equal(calls, 0);
  const response = await request(app).post('/api/setup/openrouter').set('Origin', 'http://127.0.0.1:5175').send(payload);
  assert.equal(response.status, 200); assert.equal(calls, 1);
  assert.deepEqual(response.body, { status: 'configured', provider: 'openrouter', model: 'test/coder:free' });
});
