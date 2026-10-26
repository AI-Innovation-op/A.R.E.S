import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { testDatabase } from './database.js';
import { PostgresLibrary } from '../../src/modules/library/infrastructure/postgres-library.js';
import { PostgresWorkspace } from '../../src/modules/workspace/infrastructure/postgres-workspace.js';
import { LocalFiles } from '../../src/modules/workspace/infrastructure/local-files.js';
import { LocalRunner, findNpmCli } from '../../src/modules/workspace/infrastructure/local-runner.js';
import { WorkspaceService } from '../../src/modules/workspace/application/workspace-service.js';
import { PostgresProposals } from '../../src/modules/changes/infrastructure/postgres-proposals.js';
import { ProposalService } from '../../src/modules/changes/application/proposal-service.js';
import type { ProposalInput } from '../../src/modules/changes/domain/proposal.js';
import { SendMessage } from '../../src/modules/chat/application/send-message.js';
import { createApp } from '../../src/server.js';
const pool = await testDatabase(), owners: string[] = [], roots: string[] = [], workspaces: WorkspaceService[] = [];
after(async () => {
  await Promise.all(workspaces.map(service => service.shutdown()));
  try { await pool.query('DELETE FROM commanders WHERE id=ANY($1::uuid[])', [owners]); } finally { await pool.end(); }
  for (const root of roots) { assert.equal(path.dirname(root), tmpdir()); assert.ok(path.basename(root).startsWith('ares-changes-sql-')); await rm(root, { recursive: true, force: true }); }
});
async function setup(reply?: string) {
  const owner = randomUUID(); owners.push(owner); const project = await new PostgresLibrary(pool, owner).createProject('Cambios');
  const root = await mkdtemp(path.join(tmpdir(), 'ares-changes-sql-')); roots.push(root); const original = 'export const answer = 42;\r\n';
  await writeFile(path.join(root, 'source.ts'), original); await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node waiting.mjs' } })); await writeFile(path.join(root, 'waiting.mjs'), 'setInterval(()=>{},1000);');
  const files = new LocalFiles([root]), workspace = new WorkspaceService(new PostgresWorkspace(pool, owner), files, new LocalRunner(await findNpmCli(), text => files.redact(text))); workspaces.push(workspace); await workspace.connect(project.id, root);
  const repository = new PostgresProposals(pool, owner); let calls = 0;
  const gateway = { generate: async () => { calls++; return { content: reply ?? JSON.stringify({ summary: 'Cambia 42 por 43', content: 'export const answer = 43;\n' }), sources: [], provider: 'openrouter' as const, model: 'test-coder' }; } };
  const service = new ProposalService(repository, workspace, files, gateway);
  const source = await files.read(root, 'source.ts'); const input: ProposalInput = { projectId: project.id, requestId: randomUUID(), path: source.path, sha256: source.sha256, instruction: 'Cambia 42 por 43' };
  return { owner, project, root, original, files, workspace, repository, service, gateway, input, calls: () => calls };
}
test('genera un borrador sin escribir, aplica la versión revisada y restaura el respaldo exacto', async () => {
  const x = await setup(); const proposal = await x.service.generate(x.input); assert.equal(proposal.status, 'DRAFT'); assert.equal(await readFile(path.join(x.root, 'source.ts'), 'utf8'), x.original);
  await x.service.generate(x.input); assert.equal(x.calls(), 1); assert.equal('beforeContent' in (await x.service.list(x.project.id))[0]!, false);
  await assert.rejects(x.service.generate({ ...x.input, instruction: 'Otra petición' }), /ya se usó/); assert.equal(x.calls(), 1);
  assert.equal((await x.service.apply(x.project.id, proposal.id, proposal.afterHash)).status, 'APPLIED');
  assert.equal(await readFile(path.join(x.root, 'source.ts'), 'utf8'), 'export const answer = 43;\r\n');
  assert.equal((await x.service.apply(x.project.id, proposal.id, proposal.afterHash)).status, 'APPLIED');
  assert.equal((await x.service.revert(x.project.id, proposal.id, proposal.afterHash)).status, 'REVERTED');
  assert.equal(await readFile(path.join(x.root, 'source.ts'), 'utf8'), x.original);
  assert.equal((await x.service.revert(x.project.id, proposal.id, proposal.afterHash)).status, 'REVERTED');
  assert.equal((await x.workspace.runs(x.project.id)).length, 0);
});
test('no sobrescribe ediciones posteriores al diff ni a la aplicación', async () => {
  const x = await setup(); const proposal = await x.service.generate(x.input);
  await writeFile(path.join(x.root, 'source.ts'), 'edición manual'); await assert.rejects(x.service.apply(x.project.id, proposal.id, proposal.afterHash), /cambió/); assert.equal(await readFile(path.join(x.root, 'source.ts'), 'utf8'), 'edición manual');
  await writeFile(path.join(x.root, 'source.ts'), x.original); await x.service.apply(x.project.id, proposal.id, proposal.afterHash);
  await writeFile(path.join(x.root, 'source.ts'), 'trabajo posterior'); await assert.rejects(x.service.revert(x.project.id, proposal.id, proposal.afterHash), /posteriores/); assert.equal(await readFile(path.join(x.root, 'source.ts'), 'utf8'), 'trabajo posterior');
  assert.equal((await x.service.read(x.project.id, proposal.id)).beforeContent, x.original);
});
test('rechaza respuestas incompletas, secretos y archivos cambiados sin guardar un reemplazo', async () => {
  const invalid = await setup('{"summary":'); await assert.rejects(invalid.service.generate(invalid.input), /JSON completa/); assert.equal((await invalid.service.list(invalid.project.id)).length, 0);
  const unsafe = await setup(JSON.stringify({ summary: 'Clave', content: "const password = 'clave-privada-larga';" })); await assert.rejects(unsafe.service.generate(unsafe.input), /sensibles/); assert.equal((await unsafe.service.list(unsafe.project.id)).length, 0);
  const stale = await setup(); await writeFile(path.join(stale.root, 'source.ts'), 'otro'); await assert.rejects(stale.service.generate(stale.input), /cambió/); assert.equal(stale.calls(), 0);
  const secret = await setup(); await writeFile(path.join(secret.root, 'source.ts'), "const password = 'clave-privada-larga';"); const source = await secret.files.read(secret.root, 'source.ts'); await assert.rejects(secret.service.generate({ ...secret.input, sha256: source.sha256 }), /sensibles/); assert.equal(secret.calls(), 0);
  const denied = await setup(), pending = await denied.service.generate(denied.input);
  class DeniedFiles extends LocalFiles { override async replace(): Promise<never> { throw new Error('EACCES'); } }
  const writer = new ProposalService(denied.repository, denied.workspace, new DeniedFiles([denied.root]), denied.gateway);
  await assert.rejects(writer.apply(denied.project.id, pending.id, pending.afterHash), /confirmar/);
  assert.equal((await denied.service.read(denied.project.id, pending.id)).status, 'DRAFT');
  assert.equal(await readFile(path.join(denied.root, 'source.ts'), 'utf8'), denied.original);
});
test('protege propietario, carpeta original y aprobación HTTP, y permite descartar sin escribir', async () => {
  const x = await setup(), other = await setup(); const proposal = await x.service.generate(x.input);
  await assert.rejects(other.service.read(x.project.id, proposal.id), /No se encontró/);
  const app = createApp({ allowedOrigins: ['http://localhost:5173'], checkDatabase: async () => {}, sendMessage: new SendMessage(x.gateway), changes: x.service });
  assert.equal((await request(app).post(`/api/projects/${x.project.id}/changes/${proposal.id}/apply`).send({ approvedHash: proposal.afterHash })).status, 403);
  assert.equal((await request(app).post(`/api/projects/${x.project.id}/changes/${proposal.id}/apply`).set('Origin', 'http://localhost:5173').send({ approvedHash: proposal.afterHash, content: 'arbitrario' })).status, 400);
  await assert.rejects(x.service.apply(x.project.id, proposal.id, '0'.repeat(64)), /aprobada/);
  const nextRoot = path.join(x.root, 'otra-carpeta'); await mkdir(nextRoot); await x.workspace.connect(x.project.id, nextRoot);
  await assert.rejects(x.service.apply(x.project.id, proposal.id, proposal.afterHash), /carpeta anterior/); await x.workspace.connect(x.project.id, x.root);
  assert.equal((await x.service.reject(x.project.id, proposal.id)).status, 'REJECTED'); assert.equal(await readFile(path.join(x.root, 'source.ts'), 'utf8'), x.original);
  await assert.rejects(x.service.apply(x.project.id, proposal.id, proposal.afterHash), /pendiente/);
});
test('recupera una aplicación o restauración interrumpida entre disco y PostgreSQL', async () => {
  const x = await setup(), proposal = await x.service.generate(x.input);
  await x.repository.transition(x.project.id, proposal.id, ['DRAFT'], 'APPLYING');
  const preview = await x.workspace.preview(x.project.id);
  await assert.rejects(x.workspace.execute({ projectId: x.project.id, requestId: randomUUID(), directory: '', script: 'test', manifestHash: preview.manifestHash }), /pendiente/);
  await assert.rejects(x.workspace.connect(x.project.id, x.root), /pendiente/);
  await x.files.replace(x.root, 'source.ts', proposal.beforeHash, proposal.afterContent);
  assert.equal((await x.service.apply(x.project.id, proposal.id, proposal.afterHash)).status, 'APPLIED');
  await x.repository.transition(x.project.id, proposal.id, ['APPLIED'], 'REVERTING'); await x.files.replace(x.root, 'source.ts', proposal.afterHash, proposal.beforeContent);
  assert.equal((await x.service.revert(x.project.id, proposal.id, proposal.afterHash)).status, 'REVERTED'); assert.equal(await readFile(path.join(x.root, 'source.ts'), 'utf8'), x.original);
});
test('no escribe mientras hay una comprobación activa del repositorio', async () => {
  const x = await setup(), proposal = await x.service.generate(x.input), preview = await x.workspace.preview(x.project.id);
  const run = await x.workspace.execute({ projectId: x.project.id, requestId: randomUUID(), directory: '', script: 'test', manifestHash: preview.manifestHash });
  await assert.rejects(x.service.apply(x.project.id, proposal.id, proposal.afterHash), /termine/); assert.equal(await readFile(path.join(x.root, 'source.ts'), 'utf8'), x.original);
  await x.workspace.cancel(x.project.id, run.id); await x.workspace.shutdown();
  assert.equal((await x.service.apply(x.project.id, proposal.id, proposal.afterHash)).status, 'APPLIED');
});
