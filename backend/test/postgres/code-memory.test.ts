import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { testDatabase } from './database.js';
import { PostgresLibrary } from '../../src/modules/library/infrastructure/postgres-library.js';
import { LocalFiles } from '../../src/modules/workspace/infrastructure/local-files.js';
import { WorkspaceService } from '../../src/modules/workspace/application/workspace-service.js';
import { PostgresWorkspace } from '../../src/modules/workspace/infrastructure/postgres-workspace.js';
import { LocalRunner } from '../../src/modules/workspace/infrastructure/local-runner.js';
import { CodeMemory } from '../../src/modules/memory/application/code-memory.js';
import { MemoryService } from '../../src/modules/memory/application/memory-service.js';
import { PostgresMemory } from '../../src/modules/memory/infrastructure/postgres-memory.js';
import { EMBEDDING_MODEL } from '../../src/modules/memory/domain/memory.js';
test('código RAG: solo seleccionados, excluye versiones obsoletas y secretos, aísla proyectos y revierte vectores inválidos',async()=>{
 const pool=await testDatabase(),owner=randomUUID(),root=await mkdtemp(path.join(tmpdir(),'ares-code-memory-'));let calls=0,bad=false;
 const embeddings={model:EMBEDDING_MODEL,embed:async(texts:string[])=>{calls++;return texts.map(()=>bad?[1]:Array.from({length:768},(_,i)=>i===0?1:0));}};
 const files=new LocalFiles([root]),workspace=new WorkspaceService(new PostgresWorkspace(pool,owner),files,new LocalRunner(null,text=>text));
 try{
  const project=await new PostgresLibrary(pool,owner).createProject('Memoria de código');await writeFile(path.join(root,'source.ts'),'export const greeting = "hola";');await writeFile(path.join(root,'private.ts'),'const apiKey = "sk-or-v1-'+ 'a'.repeat(40)+'";');await workspace.connect(project.id,root);
  const code=new CodeMemory(pool,owner,workspace,files,()=>embeddings),source=await files.read(root,'source.ts');await code.index(project.id,{path:source.path,sha256:source.sha256});const first=(await code.list(project.id))[0]!;assert.equal(first.current,true);await code.index(project.id,{path:source.path,sha256:source.sha256});assert.equal(calls,1);
  const memory=new MemoryService(new PostgresMemory(pool,owner),()=>embeddings,code),result=await memory.retrieve(project.id,'¿Cuál es el saludo?');assert.equal(result.references[0]?.sourceKind,'code');assert.match(result.references[0]!.excerpt,/hola/);
  const secret=await files.read(root,'private.ts');await assert.rejects(code.index(project.id,{path:secret.path,sha256:secret.sha256}),/sensibles/);
  await writeFile(path.join(root,'source.ts'),'export const greeting = "adiós";');assert.equal((await code.list(project.id))[0]!.current,false);assert.equal((await memory.retrieve(project.id,'saludo')).references.length,0);
  const updated=await files.read(root,'source.ts');bad=true;await assert.rejects(code.index(project.id,{path:updated.path,sha256:updated.sha256}));assert.equal((await code.list(project.id))[0]!.sha256,first.sha256);bad=false;await code.index(project.id,{path:updated.path,sha256:updated.sha256});assert.match((await code.search(project.id,EMBEDDING_MODEL,Array.from({length:768},(_,i)=>i===0?1:0)))[0]!.excerpt,/adiós/);
  await assert.rejects(new CodeMemory(pool,randomUUID(),new WorkspaceService(new PostgresWorkspace(pool,randomUUID()),files,new LocalRunner(null,text=>text)),files,()=>embeddings).list(project.id),/No se encontró/);
  await code.remove(project.id,first.id);assert.equal((await code.list(project.id)).length,0);
 }finally{await workspace.shutdown();try{await pool.query('DELETE FROM commanders WHERE id=$1',[owner]);}finally{await pool.end();}assert.equal(path.dirname(root),tmpdir());assert.ok(path.basename(root).startsWith('ares-code-memory-'));await rm(root,{recursive:true,force:true});}
});
