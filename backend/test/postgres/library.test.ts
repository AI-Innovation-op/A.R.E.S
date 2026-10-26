import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import request from 'supertest';
import { testDatabase } from './database.js';
import { PostgresLibrary } from '../../src/modules/library/infrastructure/postgres-library.js';
import { LibraryService } from '../../src/modules/library/application/library-service.js';
import type { ArtifactInput } from '../../src/modules/library/domain/library.js';
import type { Provider } from '../../src/modules/chat/domain/chat.js';
import { SendMessage } from '../../src/modules/chat/application/send-message.js';
import { createApp } from '../../src/server.js';
const pool = await testDatabase();
const owners: string[] = [];
function repository() { const id = randomUUID(); owners.push(id); return new PostgresLibrary(pool, id); }
const reply = { content: '# Documento', sources: [], provider: 'gemini' as const, model: 'test-gemini' };
async function input(repo: PostgresLibrary, format = 'README.md'): Promise<ArtifactInput> {
  const project = await repo.createProject('Proyecto de prueba');
  return { projectId: project.id, requestId: randomUUID(), module: 'documentation', title: 'Mi documento', context: 'API en TypeScript', format };
}
after(async () => { try { await pool.query('DELETE FROM commanders WHERE id=ANY($1::uuid[])', [owners]); } finally { await pool.end(); } });

test('guarda documento canónico y artefacto juntos, conserva el contexto y reintenta sin otra llamada IA', async () => {
  const repo = repository(), data = await input(repo); let calls = 0;
  const service = new LibraryService(repo, { generate: async (messages, task) => { calls++; assert.equal(task, 'documentation'); assert.match(messages[0]!.content, /API en TypeScript/); return reply; } });
  const saved = await service.generate(data);
  assert.deepEqual(await repo.read(saved.id), saved); assert.equal(saved.context, data.context); assert.equal(saved.status, 'DRAFT');
  assert.deepEqual(await service.generate(data), saved); assert.equal(calls, 1);
  const document = await pool.query('SELECT doc_type,status,markdown_content FROM technical_documents WHERE id=$1', [saved.technicalDocumentId]);
  assert.deepEqual(document.rows[0], { doc_type: 'README', status: 'DRAFT', markdown_content: reply.content });
  await assert.rejects(service.generate({ ...data, context: 'Otra consulta' }), /ya se usó/);
  await assert.rejects(service.generate({ ...data, requestId: randomUUID(), format: 'Seguridad' }), /no pertenece/);
  assert.equal(calls, 1);
});
test('dos ADR concurrentes tienen numeración distinta y una auditoría no inventa métricas', async () => {
  const repo = repository(), data = await input(repo, 'ADR');
  await Promise.all([repo.commit(data, reply), repo.commit({ ...data, requestId: randomUUID(), module: 'architecture', format: 'Decisión ADR' }, { ...reply, provider: 'openrouter' })]);
  const numbers = await pool.query('SELECT adr_number FROM technical_documents WHERE repository_id=$1 ORDER BY adr_number', [data.projectId]);
  assert.deepEqual(numbers.rows.map(row => row.adr_number), [1, 2]);
  const audit = await repo.commit({ ...data, requestId: randomUUID(), module: 'audit', format: 'Seguridad' }, { ...reply, provider: 'openrouter' });
  assert.equal(audit.technicalDocumentId, undefined);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM code_audits WHERE repository_id=$1', [data.projectId])).rows[0].count, 0);
});
test('revierte también el documento canónico si el guardado del artefacto falla', async () => {
  const repo = repository(), data = await input(repo);
  await assert.rejects(repo.commit(data, { ...reply, provider: 'invalid' as Provider }));
  assert.equal((await repo.list(data.projectId)).artifacts.length, 0);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM technical_documents WHERE repository_id=$1', [data.projectId])).rows[0].count, 0);
  const service = new LibraryService(repo, { generate: async () => { throw new Error('cuota'); } });
  await assert.rejects(service.generate(data), /cuota/); assert.equal((await repo.list(data.projectId)).artifacts.length, 0);
});
test('aísla los proyectos y borradores de otros comandantes antes de generar', async () => {
  const repo = repository(), other = repository(), data = await input(repo), saved = await repo.commit(data, reply);
  await assert.rejects(other.read(saved.id), /No se encontró/); await assert.rejects(other.list(data.projectId), /No se encontró/);
  await assert.rejects(other.prepare(data), /No se encontró/); await assert.rejects(other.commit({ ...data, requestId: randomUUID() }, reply), /No se encontró/);
  assert.equal((await other.projects()).length, 0);
});
test('pagina por secuencia y filtra módulos sin devolver el contexto en la lista', async () => {
  const repo = repository(), data = await input(repo);
  for (let i = 0; i < 27; i++) await repo.commit({ ...data, requestId: randomUUID(), module: 'audit', format: 'Seguridad' }, { ...reply, provider: 'openrouter' });
  const page = await repo.list(data.projectId); assert.equal(page.artifacts.length, 25); assert.equal(page.hasMore, true);
  assert.equal('context' in page.artifacts[0]!, false); assert.equal('content' in page.artifacts[0]!, false);
  const older = await repo.list(data.projectId, 'audit', page.artifacts.at(-1)!.sequence);
  assert.equal(older.artifacts.length, 2); assert.equal(older.hasMore, false);
  assert.equal((await repo.list(data.projectId, 'documentation')).artifacts.length, 0);
});
test('HTTP valida entradas, protege escrituras y elige la tarea del módulo en el servidor', async () => {
  const repo = repository(), data = await input(repo); let calls = 0;
  const gateway = { generate: async (_messages: unknown, task?: string) => { calls++; assert.equal(task, 'documentation'); return reply; } };
  const app = createApp({ allowedOrigins: ['http://localhost:5173'], checkDatabase: async () => {}, sendMessage: new SendMessage(gateway), library: new LibraryService(repo, gateway) });
  assert.equal((await request(app).post('/api/projects').send({ name: 'Otro' })).status, 403);
  assert.equal((await request(app).get('/api/artifacts?projectId=wrong')).status, 400);
  assert.equal((await request(app).post('/api/artifacts/generate').set('Origin', 'http://localhost:5173').send({ ...data, provider: 'openrouter' })).status, 400);
  assert.equal(calls, 0);
  const generated = await request(app).post('/api/artifacts/generate').set('Origin', 'http://localhost:5173').send(data);
  assert.equal(generated.status, 200); assert.equal(generated.body.artifact.provider, 'gemini'); assert.equal(calls, 1);
  assert.equal((await request(app).get(`/api/artifacts/${generated.body.artifact.id}`)).body.artifact.context, data.context);
});
