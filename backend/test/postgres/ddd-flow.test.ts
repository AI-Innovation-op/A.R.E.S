import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { testDatabase } from './database.js';
import { PostgresLibrary } from '../../src/modules/library/infrastructure/postgres-library.js';
import { LibraryService } from '../../src/modules/library/application/library-service.js';
import { PostgresWorkspace } from '../../src/modules/workspace/infrastructure/postgres-workspace.js';
import { LocalFiles } from '../../src/modules/workspace/infrastructure/local-files.js';
import { WorkspaceService } from '../../src/modules/workspace/application/workspace-service.js';
import { DockerRunner, findDocker } from '../../src/modules/workspace/infrastructure/docker-runner.js';
import { PostgresProposals } from '../../src/modules/changes/infrastructure/postgres-proposals.js';
import { ProposalService } from '../../src/modules/changes/application/proposal-service.js';
import request from 'supertest';
import { createApp } from '../../src/server.js';
import { SendMessage } from '../../src/modules/chat/application/send-message.js';

test('DDD: borrador persistente → diff → aplicación → Docker real → restauración exacta', { timeout: 180000 }, async () => {
  const pool = await testDatabase(), owner = randomUUID();
  const root = await mkdtemp(path.join(tmpdir(), 'ares-ddd-flow-'));
  let workspace: WorkspaceService | undefined;
  try {
    await cp(fileURLToPath(new URL('../../../examples/ddd-orders', import.meta.url)), root, { recursive: true });
    const library = new PostgresLibrary(pool, owner), project = await library.createProject('DDD recorrido sintético');
    const files = new LocalFiles([root]);
    workspace = new WorkspaceService(new PostgresWorkspace(pool, owner), files, new DockerRunner(await findDocker(), files));
    await workspace.connect(project.id, root);
    const source = await workspace.read(project.id, 'src/orders/domain/order.mjs');
    const fixed = source.content.replace('    if (!product', "    if (this.#confirmed) throw new Error('Pedido confirmado');\n    if (!product");
    const gateway = { generate: async () => ({ content: JSON.stringify({ summary: 'Protege la invariante del agregado Order', content: fixed }), sources: [], provider: 'openrouter' as const, model: 'synthetic-ddd-fixture' }) };
    const app=createApp({allowedOrigins:['http://127.0.0.1:5174'],checkDatabase:async()=>{},sendMessage:new SendMessage(gateway),workspace});
    const endpoint=`/api/projects/${project.id}/workspace/architecture`, body={files:[{path:source.path,sha256:source.sha256}],aliases:[]};
    assert.equal((await request(app).post(endpoint).send(body)).status,403);
    const checked=await request(app).post(endpoint).set('Origin','http://127.0.0.1:5174').send(body);assert.equal(checked.status,200);assert.equal(checked.body.status,'clear');
    assert.equal((await request(app).post(endpoint).set('Origin','http://127.0.0.1:5174').send({...body,files:[{path:source.path,sha256:'0'.repeat(64)}]})).status,409);
    assert.equal((await request(app).post(endpoint).set('Origin','http://127.0.0.1:5174').send({...body,files:[{path:'../private.ts',sha256:source.sha256}]})).status,403);
    const docs = new LibraryService(library, { generate: async () => ({ content: '# Contexto Pedidos\n\nOrder es el agregado. Invariante: un pedido confirmado no admite nuevas líneas. El puerto repository pertenece al caso de uso, no al ORM.', sources: [], provider: 'openrouter' as const, model: 'synthetic-ddd-fixture' }) });
    const document = await docs.generate({ projectId: project.id, requestId: randomUUID(), module: 'architecture', format: 'DDD + Hexagonal', title: 'Pedidos', context: 'No modificar pedidos confirmados.' });
    assert.match((await library.read(document.id)).content, /Invariante/);
    const runTests = async () => {
      const preview = await workspace!.preview(project.id);
      const started = await workspace!.execute({ projectId: project.id, requestId: randomUUID(), directory: '', script: 'test', manifestHash: preview.manifestHash });
      let result = started;
      const deadline = Date.now() + 60000;
      while (result.status === 'RUNNING' && Date.now() < deadline) { await new Promise(resolve => setTimeout(resolve, 200)); result = await workspace!.run(project.id, started.id); }
      return result;
    };
    const initial = await runTests(); assert.equal(initial.status, 'FAILED', initial.output); assert.match(initial.output, /Missing expected exception/);
    const proposals = new ProposalService(new PostgresProposals(pool, owner), workspace, files, gateway);
    const proposal = await proposals.generate({ projectId: project.id, requestId: randomUUID(), path: source.path, sha256: source.sha256, instruction: 'Protege la invariante del documento Pedidos.' });
    assert.match(proposal.patch, /\+.*Pedido confirmado/);
    assert.equal((await workspace.read(project.id, source.path)).content, source.content);
    await proposals.apply(project.id, proposal.id, proposal.afterHash);
    const after = await runTests(); assert.equal(after.status, 'PASSED', after.output); assert.match(after.output, /sin red/);
    await proposals.revert(project.id, proposal.id, proposal.afterHash);
    assert.equal(await readFile(path.join(root, source.path), 'utf8'), source.content);
    const restored = await runTests(); assert.equal(restored.status, 'FAILED', restored.output); assert.match(restored.output, /Missing expected exception/);
  } finally {
    await workspace?.shutdown();
    await pool.query('DELETE FROM commanders WHERE id=$1', [owner]); await pool.end();
    assert.equal(path.dirname(root), path.resolve(tmpdir())); assert.ok(path.basename(root).startsWith('ares-ddd-flow-'));
    await rm(root, { recursive: true, force: true });
  }
});
