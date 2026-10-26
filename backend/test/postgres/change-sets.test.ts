import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { mkdtemp,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { testDatabase } from './database.js';
import { PostgresLibrary } from '../../src/modules/library/infrastructure/postgres-library.js';
import { LocalFiles,hashText } from '../../src/modules/workspace/infrastructure/local-files.js';
import { WorkspaceService } from '../../src/modules/workspace/application/workspace-service.js';
import { LocalRunner,findNpmCli } from '../../src/modules/workspace/infrastructure/local-runner.js';
import { PostgresWorkspace } from '../../src/modules/workspace/infrastructure/postgres-workspace.js';
import { PostgresChangeSets } from '../../src/modules/changes/infrastructure/postgres-change-sets.js';
import { ChangeSetService } from '../../src/modules/changes/application/change-set-service.js';
import { patchFor } from '../../src/modules/changes/domain/proposal.js';
import { createApp } from '../../src/server.js';
import { SendMessage } from '../../src/modules/chat/application/send-message.js';
const pool=await testDatabase(),owners:string[]=[],roots:string[]=[],workspaces:WorkspaceService[]=[];
after(async()=>{await Promise.all(workspaces.map(item=>item.shutdown()));try{await pool.query('DELETE FROM commanders WHERE id=ANY($1::uuid[])',[owners]);}finally{await pool.end();}for(const root of roots){assert.equal(path.dirname(root),tmpdir());assert.ok(path.basename(root).startsWith('ares-sets-sql-'));await rm(root,{recursive:true,force:true});}});
async function fixture(){
 const owner=randomUUID();owners.push(owner);const project=await new PostgresLibrary(pool,owner).createProject('Conjuntos');
 const root=await mkdtemp(path.join(tmpdir(),'ares-sets-sql-'));roots.push(root);
 const before='export const answer = 42;\n'+'// contexto sin cambios\n'.repeat(500),after=before.replace('= 42','= 43');
 await writeFile(path.join(root,'large.ts'),before);await writeFile(path.join(root,'package.json'),JSON.stringify({scripts:{check:'node -e "console.log(42)"'}}));
 const files=new LocalFiles([root]),repository=new PostgresChangeSets(pool,owner),workspaceRepository=new PostgresWorkspace(pool,owner),workspace=new WorkspaceService(workspaceRepository,files,new LocalRunner(await findNpmCli(),text=>files.redact(text)));workspaces.push(workspace);await workspace.connect(project.id,root);
 let calls=0;const gateway={generate:async()=>{calls++;return{content:JSON.stringify({summary:'Actualiza valor y añade guía',files:[{path:'large.ts',patch:patchFor('large.ts',before,after).patch},{path:'new.md',content:'# Guía\nValor: 43.\n'}]}),sources:[],provider:'openrouter' as const,model:'fixture'};}};
 const service=new ChangeSetService(repository,workspace,files,gateway),input={projectId:project.id,requestId:randomUUID(),instruction:'Actualiza valor y añade guía',files:[{path:'large.ts',sha256:hashText(before)},{path:'new.md',sha256:null}]};
 return{owner,project,root,before,after,files,repository,workspaceRepository,workspace,service,input,gateway,calls:()=>calls};
}
test('parches de archivo grande y creación: revisa, aplica, ejecuta check y restaura ambos',async()=>{
 const x=await fixture(),set=await x.service.generate(x.input);assert.equal(set.status,'DRAFT');assert.equal(set.files.length,2);assert.equal(await x.files.exists(x.root,'new.md'),false);assert.equal((await x.service.generate(x.input)).id,set.id);assert.equal(x.calls(),1);
 assert.equal((await x.service.act(x.project.id,set.id,'apply',set.approvedHash)).status,'APPLIED');assert.equal(await readFile(path.join(x.root,'large.ts'),'utf8'),x.after);assert.equal(await readFile(path.join(x.root,'new.md'),'utf8'),'# Guía\nValor: 43.\n');
 const preview=await x.workspace.preview(x.project.id),run=await x.workspace.execute({projectId:x.project.id,requestId:randomUUID(),directory:'',script:'check',manifestHash:preview.manifestHash});let done=run;for(let i=0;i<1000&&done.status==='RUNNING';i++){await new Promise(resolve=>setTimeout(resolve,30));done=await x.workspace.run(x.project.id,run.id);}assert.equal(done.status,'PASSED');
 await x.service.act(x.project.id,set.id,'revert',set.approvedHash);assert.equal(await readFile(path.join(x.root,'large.ts'),'utf8'),x.before);assert.equal(await x.files.exists(x.root,'new.md'),false);
});
test('valida todos los originales y la aprobación antes de escribir, conserva ediciones posteriores',async()=>{
 const x=await fixture(),set=await x.service.generate(x.input);await assert.rejects(x.service.act(x.project.id,set.id,'apply','0'.repeat(64)),/huella/);
 await writeFile(path.join(x.root,'new.md'),'Mis notas');await assert.rejects(x.service.act(x.project.id,set.id,'apply',set.approvedHash),/No se escribió/);assert.equal(await readFile(path.join(x.root,'large.ts'),'utf8'),x.before);
});
test('recupera una aplicación parcial después de reiniciar y bloquea comprobaciones mientras esté pendiente',async()=>{
 const x=await fixture(),set=await x.service.generate(x.input);await x.repository.transition(x.project.id,set.id,['DRAFT'],'APPLYING');await x.files.replace(x.root,'large.ts',hashText(x.before),x.after);
 const preview=await x.workspace.preview(x.project.id);await assert.rejects(x.workspace.execute({projectId:x.project.id,requestId:randomUUID(),directory:'',script:'check',manifestHash:preview.manifestHash}),/pendiente/);
 const restarted=new ChangeSetService(x.repository,x.workspace,x.files,x.gateway);await restarted.act(x.project.id,set.id,'apply',set.approvedHash);await restarted.act(x.project.id,set.id,'revert',set.approvedHash);assert.equal(await readFile(path.join(x.root,'large.ts'),'utf8'),x.before);assert.equal(await x.files.exists(x.root,'new.md'),false);
});
test('rechaza rutas y secretos antes de llamar al modelo; aísla propietarios y exige origen HTTP',async()=>{
 const x=await fixture();for(const path of ['../outside.ts','.env','CON.ts','evil.ts:stream','a\n.ts'])await assert.rejects(x.service.generate({...x.input,files:[{path,sha256:null}]}));assert.equal(x.calls(),0);
 await assert.rejects(new PostgresChangeSets(pool,randomUUID()).list(x.project.id),/No se encontró/);
 const app=createApp({allowedOrigins:['http://localhost:5175'],checkDatabase:async()=>{},sendMessage:new SendMessage(x.gateway),changeSets:x.service});assert.equal((await request(app).post(`/api/projects/${x.project.id}/change-sets`).send(x.input)).status,403);
});
test('un archivo nuevo no se elimina al restaurar si recibió cambios posteriores',async()=>{
 const x=await fixture(),set=await x.service.generate(x.input);await x.service.act(x.project.id,set.id,'apply',set.approvedHash);await writeFile(path.join(x.root,'new.md'),'Notas posteriores');await assert.rejects(x.service.act(x.project.id,set.id,'revert',set.approvedHash),/ediciones posteriores/);assert.equal(await readFile(path.join(x.root,'new.md'),'utf8'),'Notas posteriores');assert.equal(await readFile(path.join(x.root,'large.ts'),'utf8'),x.after);
});
test('sincroniza documentación guardada mediante un diff local, sin enviar datos al modelo',async()=>{
 const x=await fixture(),library=new PostgresLibrary(pool,x.owner);const artifact=await library.commit({projectId:x.project.id,requestId:randomUUID(),module:'documentation',format:'README.md',title:'Guía local',context:'Proyecto de prueba'},{content:'# Guía local\nInicia con npm run dev.\n',sources:[],provider:'gemini',model:'fixture'});
 const service=new ChangeSetService(x.repository,x.workspace,x.files,x.gateway,library),set=await service.document(x.project.id,{requestId:randomUUID(),artifactId:artifact.id,path:'README.md'});assert.equal(x.calls(),0);assert.equal(await x.files.exists(x.root,'README.md'),false);assert.match(set.files[0]!.patch,/Guía local/);await service.act(x.project.id,set.id,'apply',set.approvedHash);assert.equal(await readFile(path.join(x.root,'README.md'),'utf8'),artifact.content);
});
