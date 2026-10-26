import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import request from 'supertest';
import { createApp } from '../src/server.js';
import { SendMessage } from '../src/modules/chat/application/send-message.js';
import { loadEnv } from '../src/config/env.js';
import { saveGeminiSettings } from '../src/config/gemini-settings.js';

const fakeKey = 'AQ.test_key_only_for_local_validation_123';
const settings = { apiKey: fakeKey, model: 'test-model' };
const origin = 'http://127.0.0.1:5175';
function setup(configure = async (_settings: typeof settings) => {}) {
  return createApp({
    allowedOrigins: [origin], checkDatabase: async () => {},
    sendMessage: new SendMessage({ generate: async () => ({ content: 'ok', sources: [] }) }),
    getChatStatus: () => ({ configured: false, model: 'test-model' }),
    configureGemini: configure,
  });
}

test('arranca sin clave ni PostgreSQL y permite el puerto 5175 por defecto', () => {
  const config = loadEnv({});
  assert.equal(config.GEMINI_API_KEY, undefined);
  assert.equal(config.DATABASE_URL, undefined);
  assert.ok(config.CORS_ORIGINS.includes(origin));
  assert.equal(loadEnv({ GEMINI_API_KEY: '' }).GEMINI_API_KEY, undefined);
  assert.equal(config.GEMINI_TIMEOUT_MS, 60000);
  assert.equal(config.GEMINI_THINKING_LEVEL, 'low');
  assert.throws(() => loadEnv({ GEMINI_THINKING_LEVEL: 'invalid' }));
});

test('health informa de configuración pendiente sin devolver secretos', async () => {
  const response = await request(setup()).get('/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.service, 'ares-backend');
  assert.equal(response.body.chat.configured, false);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.ok(!JSON.stringify(response.body).includes(fakeKey));
});

test('configuración local rechaza orígenes ajenos y solicitudes sin Origin', async () => {
  let calls = 0;
  const app = setup(async () => { calls++; });
  const missing = await request(app).post('/api/setup/gemini').send(settings);
  const external = await request(app).post('/api/setup/gemini').set('Origin', 'https://ajeno.example').send(settings);
  assert.equal(missing.status, 403); assert.equal(external.status, 403); assert.equal(calls, 0);
});

test('valida la configuración y nunca refleja la clave guardada', async () => {
  let calls = 0;
  const app = setup(async input => { calls++; assert.deepEqual(input, settings); });
  const invalid = await request(app).post('/api/setup/gemini').set('Origin', origin).send({ apiKey: 'x', model: '../x\nHOST=bad' });
  assert.equal(invalid.status, 400); assert.equal(calls, 0);
  const response = await request(app).post('/api/setup/gemini').set('Origin', origin).send(settings);
  assert.equal(response.status, 200); assert.equal(calls, 1);
  assert.deepEqual(response.body, { status: 'configured', model: 'test-model' });
  assert.ok(!JSON.stringify(response.body).includes(fakeKey));
});

test('guarda .env sin duplicados y conserva las otras variables', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ares-settings-'));
  const path = pathToFileURL(join(directory, '.env'));
  try {
    await writeFile(path, '# local\nPORT=3000\nGEMINI_API_KEY=previous_test_value\nGEMINI_API_KEY=duplicate_test_value\nGEMINI_MODEL=old\n');
    await saveGeminiSettings(path, settings);
    const content = await readFile(path, 'utf8');
    assert.ok(content.includes('PORT=3000'));
    assert.equal(content.match(/^GEMINI_API_KEY=/gm)?.length, 1);
    assert.ok(content.includes(`GEMINI_API_KEY="${fakeKey}"`));
    assert.ok(!content.includes('previous_test_value'));
    await assert.rejects(saveGeminiSettings(path, { ...settings, apiKey: `${fakeKey}\nHOST=bad` }));
    assert.equal(await readFile(path, 'utf8'), content);
  } finally { await rm(join(directory, '.env'), { force: true }); await rmdir(directory); }
});
