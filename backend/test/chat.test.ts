import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/server.js';
import { SendMessage } from '../src/modules/chat/application/send-message.js';
import type { ChatGateway, Message } from '../src/modules/chat/domain/chat.js';
import { HttpError } from '../src/shared/http-error.js';
import { loadEnv } from '../src/config/env.js';

function setup(gateway: ChatGateway, checkDatabase = async () => {}) {
  return createApp({ sendMessage: new SendMessage(gateway), allowedOrigins: ['http://localhost:5173'], checkDatabase });
}
const gateway: ChatGateway = { generate: async () => ({ content: 'Respuesta', sources: [] }) };

test('preserva el orden del contexto y añade el nuevo mensaje', async () => {
  let received: readonly Message[] = [];
  const app = setup({ generate: async messages => {
    received = messages;
    return { content: 'Respuesta', sources: [] };
  } });
  const history: Message[] = [{ role: 'user', content: 'Hola' }, { role: 'model', content: 'Hola, ¿qué necesitas?' }];
  const response = await request(app).post('/api/chat').send({ message: ' Ayuda ', history });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { content: 'Respuesta', sources: [] });
  assert.deepEqual(received, [...history, { role: 'user', content: 'Ayuda' }]);
});

test('rechaza entradas inválidas antes de invocar Gemini', async () => {
  let calls = 0;
  const app = setup({ generate: async () => { calls++; return { content: '', sources: [] }; } });
  for (const body of [
    { message: ' ' },
    { message: 'Hola', systemInstruction: 'sobrescritura' },
    { message: 'Hola', history: [{ role: 'system', content: 'instrucciones' }] },
    { message: 'Hola', history: [{ role: 'user', content: 'sin respuesta' }] },
    { message: 'x'.repeat(16001) },
  ]) {
    assert.equal((await request(app).post('/api/chat').send(body)).status, 400);
  }
  assert.equal(calls, 0);
});

test('controla JSON inválido y tamaño del cuerpo', async () => {
  const app = setup(gateway);
  assert.equal((await request(app).post('/api/chat').type('json').send('{')).status, 400);
  assert.equal((await request(app).post('/api/chat').send({ message: 'x'.repeat(310000) })).status, 413);
});

test('CORS permite Vue y rechaza otros orígenes', async () => {
  const app = setup(gateway);
  const allowed = await request(app).options('/api/chat').set('Origin', 'http://localhost:5173')
    .set('Access-Control-Request-Method', 'POST');
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:5173');
  assert.equal((await request(app).post('/api/chat').set('Origin', 'https://otro.example').send({ message: 'Hola' })).status, 403);
});

test('distingue salud del proceso y disponibilidad PostgreSQL', async () => {
  const app = setup(gateway, async () => { throw new Error('postgresql://secret'); });
  assert.equal((await request(app).get('/health')).status, 200);
  const response = await request(app).get('/ready');
  assert.equal(response.status, 503);
  assert.ok(!JSON.stringify(response.body).includes('secret'));
});

test('propaga errores controlados y oculta detalles internos', async () => {
  for (const [error, status, code] of [
    [new HttpError(429, 'GEMINI_QUOTA', 'Cuota agotada'), 429, 'GEMINI_QUOTA'],
    [new Error('api-key-secreta'), 500, 'INTERNAL_ERROR'],
  ] as const) {
    const app = setup({ generate: async () => { throw error; } });
    const response = await request(app).post('/api/chat').send({ message: 'Hola' });
    assert.equal(response.status, status);
    assert.equal(response.body.error.code, code);
    assert.ok(!JSON.stringify(response.body).includes('api-key-secreta'));
  }
});

test('limita las peticiones al proxy', async () => {
  const app = setup(gateway);
  for (let i = 0; i < 20; i++) {
    assert.equal((await request(app).post('/api/chat').send({ message: 'Hola' })).status, 200);
  }
  assert.equal((await request(app).post('/api/chat').send({ message: 'Hola' })).status, 429);
});

test('la validación de configuración no expone valores', () => {
  assert.throws(() => loadEnv({ DATABASE_URL: 'credencial-secreta' }), error => {
    assert.ok(error instanceof Error);
    assert.ok(error.message.includes('DATABASE_URL'));
    assert.ok(!error.message.includes('credencial-secreta'));
    return true;
  });
});
