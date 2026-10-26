import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { testDatabase } from './database.js';
import { PostgresLibrary } from '../../src/modules/library/infrastructure/postgres-library.js';
import { PostgresWorkspace } from '../../src/modules/workspace/infrastructure/postgres-workspace.js';
import { LocalFiles } from '../../src/modules/workspace/infrastructure/local-files.js';
import { LocalRunner, findNpmCli } from '../../src/modules/workspace/infrastructure/local-runner.js';
import { WorkspaceService } from '../../src/modules/workspace/application/workspace-service.js';
import { PostgresHistory } from '../../src/modules/chat/infrastructure/postgres-history.js';
import { ConversationService } from '../../src/modules/chat/application/conversation-service.js';
import { SendMessage } from '../../src/modules/chat/application/send-message.js';
import { createApp } from '../../src/server.js';
const pool = await testDatabase(), owners: string[] = [], roots: string[] = [], services: WorkspaceService[] = [];
after(async () => {
  await Promise.all(services.map(service => service.shutdown()));
  try { await pool.query('DELETE FROM commanders WHERE id=ANY($1::uuid[])', [owners]); } finally { await pool.end(); }
  for (const root of roots) { assert.equal(path.dirname(root), tmpdir()); assert.ok(path.basename(root).startsWith('ares-workspace-sql-')); await rm(root, { recursive: true, force: true }); }
});
async function setup() {
  const owner = randomUUID(); owners.push(owner);
  const project = await new PostgresLibrary(pool, owner).createProject('Código local');
  const root = await mkdtemp(path.join(tmpdir(), 'ares-workspace-sql-')); roots.push(root);
  await writeFile(path.join(root, 'source.ts'), 'export const answer = 42;');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { check: 'node check.mjs', test: 'node waiting.mjs' } }));
  await writeFile(path.join(root, 'check.mjs'), "console.log('CHECK_SQL_OK');");
  await writeFile(path.join(root, 'waiting.mjs'), 'setInterval(()=>{},1000);');
  const repository = new PostgresWorkspace(pool, owner), files = new LocalFiles([root]);
  const service = new WorkspaceService(repository, files, new LocalRunner(await findNpmCli(), text => files.redact(text))); services.push(service);
  await service.connect(project.id, root);
  return { owner, project, root, repository, service };
}
async function finished(service: WorkspaceService, projectId: string, id: string) {
  for (let i = 0; i < 600; i++) { const run = await service.run(projectId, id); if (run.status !== 'RUNNING') return run; await new Promise(resolve => setTimeout(resolve, 50)); }
  throw new Error('La comprobación no terminó');
}
test('conecta, ejecuta un script real, guarda la salida y reintenta sin repetir el proceso', async () => {
  const { project, service, root } = await setup(), preview = await service.preview(project.id);
  const input = { projectId: project.id, requestId: randomUUID(), directory: '', script: 'check' as const, manifestHash: preview.manifestHash };
  const started = await service.execute(input); assert.equal((await service.execute(input)).id, started.id);
  const done = await finished(service, project.id, started.id); assert.equal(done.status, 'PASSED'); assert.equal(done.exitCode, 0); assert.match(done.output, /CHECK_SQL_OK/); assert.equal(done.workspacePath, root);
  assert.equal((await service.execute(input)).id, started.id); assert.equal((await service.runs(project.id)).length, 1);
  await assert.rejects(service.execute({ ...input, script: 'test' }), /ya se usó/);
});
test('detecta cambios en el manifiesto y en los archivos antes de generar una respuesta', async () => {
  const { project, service, root } = await setup(), preview = await service.preview(project.id), source = await service.read(project.id, 'source.ts');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { check: 'node otro.mjs' } }));
  await assert.rejects(service.execute({ projectId: project.id, requestId: randomUUID(), directory: '', script: 'check', manifestHash: preview.manifestHash }), /cambió/);
  await writeFile(path.join(root, 'source.ts'), 'export const answer = 43;');
  await assert.rejects(service.context(project.id, [{ path: source.path, sha256: source.sha256 }], []), /cambió/);
  assert.equal((await service.runs(project.id)).length, 0);
});
test('conserva evidencia de archivos y comprobaciones con el chat y sus reintentos', async () => {
  const { owner, project, service } = await setup(), source = await service.read(project.id, 'source.ts'), preview = await service.preview(project.id);
  const run = await service.execute({ projectId: project.id, requestId: randomUUID(), directory: '', script: 'check', manifestHash: preview.manifestHash }); await finished(service, project.id, run.id);
  const history = new PostgresHistory(pool, owner), conversation = await history.create('Nueva conversación', project.id); let calls = 0;
  const chat = new ConversationService(history, { generate: async messages => { calls++; assert.match(messages.at(-1)!.content, /Evidencia local/); assert.match(messages.at(-1)!.content, /CHECK_SQL_OK/); assert.match(messages.at(-1)!.content, /answer = 42/); return { content: 'check terminó con código cero.', sources: [], provider: 'openrouter', model: 'test' }; } }, undefined, service);
  const input = { conversationId: conversation.id, requestId: randomUUID(), revision: 0, task: 'programming' as const, message: 'Revisa el resultado', files: [{ path: source.path, sha256: source.sha256 }], runIds: [run.id] };
  const reply = await chat.send(input); await chat.send(input); assert.equal(calls, 1);
  const restored = await history.read(conversation.id); assert.equal(restored.messages[0]!.content, input.message); assert.deepEqual(restored.messages[1]!.workspace, reply.workspace);
  await assert.rejects(chat.send({ ...input, files: [] }), /ya se usó/);
});
test('aísla proyectos y protege las rutas HTTP frente a comandos arbitrarios', async () => {
  const first = await setup(), second = await setup(), gateway = { generate: async () => ({ content: 'ok', sources: [] }) };
  await assert.rejects(first.service.settings(second.project.id), /No se encontró/);
  const app = createApp({ allowedOrigins: ['http://localhost:5173'], checkDatabase: async () => {}, sendMessage: new SendMessage(gateway), workspace: first.service });
  assert.equal((await request(app).post(`/api/projects/${first.project.id}/workspace`).send({ path: first.root })).status, 403);
  assert.equal((await request(app).get(`/api/projects/${first.project.id}/workspace/file`).query({ path: '../private.ts' })).status, 403);
  assert.equal((await request(app).post(`/api/projects/${first.project.id}/workspace/runs`).set('Origin', 'http://localhost:5173').send({ command: 'anything', script: 'dev' })).status, 400);
});
test('cancela procesos propios y marca ejecuciones anteriores como interrumpidas al recuperar el servidor', async () => {
  const { project, repository, service, root } = await setup(), preview = await service.preview(project.id);
  const run = await service.execute({ projectId: project.id, requestId: randomUUID(), directory: '', script: 'test', manifestHash: preview.manifestHash });
  await assert.rejects(service.connect(project.id, root), /termine/); await service.cancel(project.id, run.id);
  assert.equal((await finished(service, project.id, run.id)).status, 'CANCELLED');
  const stale = await repository.start({ projectId: project.id, requestId: randomUUID(), directory: '', script: 'check', manifestHash: preview.manifestHash }, 'check', root);
  await repository.interrupt(); assert.equal((await repository.run(project.id, stale.run.id)).status, 'INTERRUPTED');
});
