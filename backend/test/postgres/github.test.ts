import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './database.js';
import { PostgresLibrary } from '../../src/modules/library/infrastructure/postgres-library.js';
import { githubFixture } from '../fixtures/github.js';
import { DocumentManagement } from '../../src/modules/library/application/document-management.js';
import { LocalFiles } from '../../src/modules/workspace/infrastructure/local-files.js';

test('GitHub: persiste informe y fuentes con revisión; guardar no genera ni duplica', async () => {
  const pool=await testDatabase(),owner=randomUUID();
  try {
    const library=new PostgresLibrary(pool,owner), project=await library.createProject('GitHub sintético'), service=githubFixture(library), signal=AbortSignal.timeout(10000);
    const snapshot=await service.inspect('https://github.com/example/orders',undefined,signal), read=await service.read(snapshot.id,['src/order.ts'],signal), report=await service.analyze(snapshot.id,read.id,randomUUID(),signal);
    const saved=await service.save(snapshot.id,report.id,project.id);assert.equal(saved.status,'DRAFT');assert.match(saved.context,/1 leídos de 1 seleccionados; 3 rutas/);assert.match(saved.sources[0]!.uri,/blob\/a{40}/);assert.match(saved.content,/Order.confirm/);
    const duplicate=await service.save(snapshot.id,report.id,project.id);assert.equal(saved.id,duplicate.id);assert.equal((await library.list(project.id)).artifacts.length,1);
    const manager=new DocumentManagement(pool,owner,new LocalFiles([]));await manager.change(saved.id,saved.revision??0,'edit',{title:'Título revisado',content:'Revisión humana'});
    const reopened=await service.save(snapshot.id,report.id,project.id);assert.equal(reopened.content,'Revisión humana');assert.equal(reopened.revision,(saved.revision??0)+1);assert.match(reopened.context,/Commit fijado/);
    await assert.rejects(service.save(snapshot.id,report.id,randomUUID()),/proyecto/);
  } finally {await pool.query('DELETE FROM commanders WHERE id=$1',[owner]);await pool.end();}
});
