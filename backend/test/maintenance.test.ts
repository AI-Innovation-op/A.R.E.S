import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/server.js';
import { SendMessage } from '../src/modules/chat/application/send-message.js';
import type { BackupService } from '../src/modules/maintenance/backups.js';
test('mantenimiento exige origen local y no reduce el tamaño permitido de otros módulos', async () => {
  let calls = 0;
  const backups = { status: async () => ({ backups: [] }), create: async () => { calls++; return { id: 'backup' }; }, verify: async () => ({ verifiedAt: 'now' }) } as unknown as BackupService;
  const app = createApp({ allowedOrigins: ['http://localhost:5175'], checkDatabase: async () => {}, sendMessage: new SendMessage({ generate: async () => ({ content: 'ok', sources: [] }) }), backups });
  assert.equal((await request(app).post('/api/maintenance/backups').send({})).status, 403);
  assert.equal((await request(app).post('/api/maintenance/backups').set('Origin','http://localhost:5175').send({ path: 'elsewhere' })).status, 400);
  assert.equal((await request(app).post('/api/maintenance/backups').set('Origin','http://localhost:5175').send({})).status, 200);
  assert.equal(calls, 1);
  assert.equal((await request(app).post('/api/chat').set('Origin','http://localhost:5175').send({ message: 'a'.repeat(5000), history: [] })).status, 200);
  // Incluso las rutas posteriores a mantenimiento deben conservar su propio parser/límite.
  assert.equal((await request(app).post('/api/unknown').send({ content: 'a'.repeat(5000) })).status, 404);
});
