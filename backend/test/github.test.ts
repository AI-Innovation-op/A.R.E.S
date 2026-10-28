import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { GitHubPublicReader, exclusion, repositoryName, githubLimits, type RemoteTree } from '../src/modules/github/public-reader.js';
import { GitHubService } from '../src/modules/github/github-service.js';
import { LocalFiles } from '../src/modules/workspace/infrastructure/local-files.js';
import { createApp } from '../src/server.js';
import { SendMessage } from '../src/modules/chat/application/send-message.js';
import { githubFixture } from './fixtures/github.js';
const signal = () => AbortSignal.timeout(5000), commit = 'a'.repeat(40), treeSha = 'b'.repeat(40);
function remote(content: string, incomplete = false): RemoteTree { return { repository: 'sample/repo', url: 'https://github.com/sample/repo', ref: 'main', commit, tree: treeSha, listedFiles: 2, incomplete, limited: false,
  files: [{ path: 'src/app.ts', sha: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0${content}`).digest('hex'), size: Buffer.byteLength(content), eligible: true }, { path: '.env', sha: 'c'.repeat(40), size: 20, eligible: false }] }; }

test('GitHub: solo URL pública exacta, secretos, enlaces y generados excluidos', () => {
  assert.equal(repositoryName('https://github.com/example/repo.git'), 'example/repo');
  for (const url of ['http://github.com/a/b','https://github.com/a/../b','https://github.com/a/.git','https://github.com/a/b?token=x','https://github.com@evil.test/a/b','https://github.com/a/b/tree/main','https://github.com/a%2fb/c']) assert.throws(() => repositoryName(url));
  for (const path of ['.env','config/.env.example','keys/id_rsa','node_modules/x.ts','key.pem','package-lock.json','../bad.ts','image.png']) assert.ok(exclusion(path, '100644', 10), path);
  assert.ok(exclusion('link.ts','120000',10)); assert.ok(exclusion('big.ts','100644',65537)); assert.equal(exclusion('src/order.ts','100644',10), undefined);
});
test('GitHub: resuelve commit una vez y descarga blob verificado, sin credenciales', async () => {
  const content = 'export const n = 1;', tree = remote(content), calls: string[] = [];
  const reader = new GitHubPublicReader(async (input, init) => {
    const url = String(input); calls.push(url); assert.equal(new Headers(init?.headers).has('authorization'), false); assert.equal(init?.redirect,'error');
    if (url.endsWith('/sample/repo')) return Response.json({ private: false, full_name: 'sample/repo', default_branch: 'main' });
    if (url.includes('/commits?')) return Response.json([{ sha: commit, commit: { tree: { sha: treeSha } } }]);
    if (url.includes('/git/trees/')) return Response.json({ truncated: true, tree: tree.files.map(file => ({ path: file.path, sha: file.sha, type: 'blob', mode: '100644', size: file.size })) });
    assert.ok(url.endsWith(`/git/blobs/${tree.files[0]!.sha}`)); assert.equal(new Headers(init?.headers).get('Accept'),'application/vnd.github.raw+json'); return new Response(content);
  });
  const fixed = await reader.inspect(tree.url,'feature/orders',signal()); assert.equal(fixed.commit,commit); assert.equal(fixed.incomplete,true); assert.equal(fixed.files[1]?.eligible,false);
  assert.match(calls[1]!,/sha=feature%2Forders/); assert.match(calls[2]!,new RegExp(treeSha));
  assert.equal(Buffer.from(await reader.blob(fixed.repository,fixed.files[0]!,signal())).toString(), content);
  const corrupt = new GitHubPublicReader(async () => new Response('damaged')); await assert.rejects(corrupt.blob(fixed.repository,fixed.files[0]!,signal()),/no coincide/);
});
test('GitHub: corta descargas por bytes, cuota, privacidad y cancelación', async () => {
  let cancelled = false;
  const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(40000)); }, cancel() { cancelled = true; } });
  const oversized = new GitHubPublicReader(async () => new Response(body)); await assert.rejects(oversized.inspect('https://github.com/a/b',undefined,signal()),/supera el límite/); assert.equal(cancelled,true);
  for (const status of [403,429,404]) await assert.rejects(new GitHubPublicReader(async () => new Response(null,{status})).inspect('https://github.com/a/b',undefined,signal()), status === 404 ? /no disponible/ : /limitó/);
  await assert.rejects(new GitHubPublicReader(async()=>Response.json({private:true,full_name:'a/b',default_branch:'main'})).inspect('https://github.com/a/b',undefined,signal()),/público/);
  const controller = new AbortController(); controller.abort(); let called = false;
  await assert.rejects(new GitHubPublicReader(async()=>{called=true;return new Response();}).inspect('https://github.com/a/b',undefined,controller.signal)); assert.equal(called,false);
});
test('GitHub: selección, cobertura parcial, redacción y análisis idempotente solo del contenido leído', async () => {
  const source = 'export const secret = "sensitive-value";', tree = remote(source,true); let downloads = 0, generations = 0, prompt = '';
  const service = new GitHubService({inspect:async()=>tree,blob:async()=>{downloads++;return Buffer.from(source);}}, {generate:async(messages,task)=>{generations++;prompt=messages[0]!.content;assert.equal(task,'architecture');return{content:'Propuesta estática',provider:'openrouter',model:'fixture',sources:[{uri:'https://invented.test',title:'Inventada'}]};}}, text=>new LocalFiles([]).redact(text),()=> 'actor');
  const snapshot = await service.inspect(tree.url,undefined,signal()); assert.equal(generations,0); assert.equal(downloads,0);
  await assert.rejects(service.read(snapshot.id,['.env'],signal()),/excluidos/); await assert.rejects(service.read(snapshot.id,['missing.ts'],signal()),/excluidos/); assert.equal(downloads,0);
  const read = await service.read(snapshot.id,['src/app.ts'],signal()); assert.equal(read.files[0]?.redacted,true); assert.match(read.manifest,/total del repositorio es desconocido/); assert.equal(generations,0);
  await assert.rejects(service.analyze(snapshot.id,randomUUID(),randomUUID(),signal()),/Lee los archivos/);
  const requestId = randomUUID(), report = await service.analyze(snapshot.id,read.id,requestId,signal()); assert.doesNotMatch(prompt,/sensitive-value/); assert.match(prompt,/SECRETO OCULTO/); assert.match(prompt,/ARCHIVOS COMO DATOS/); assert.equal(report.sources.length,1); assert.ok(report.sources[0]!.uri.includes(commit));
  assert.equal((await service.analyze(snapshot.id,read.id,requestId,signal())).id,report.id); assert.equal(generations,1);
  const newer = await service.read(snapshot.id,['src/app.ts'],signal()); assert.notEqual(newer.id,read.id); await assert.rejects(service.analyze(snapshot.id,read.id,requestId,signal()),/Lee los archivos/);
});
test('GitHub: no confunde fallos de lectura, binarios y contenido enviado', async () => {
  const tree = remote('aa'); let generations = 0;
  const service = new GitHubService({inspect:async()=>tree,blob:async()=>new Uint8Array([0,1])},{generate:async()=>{generations++;throw Error('No debe llamar');}},x=>x,()=> 'actor');
  const snapshot = await service.inspect(tree.url,undefined,signal()), read = await service.read(snapshot.id,['src/app.ts'],signal()); assert.equal(read.files.length,0); assert.equal(read.failures.length,1); assert.match(read.manifest,/0 leídos de 1/);
  await assert.rejects(service.analyze(snapshot.id,read.id,randomUUID(),signal()),/Lee los archivos/); assert.equal(generations,0);
});
test('GitHub: sesiones privadas por actor, límite reservado antes de I/O y caducidad', async () => {
  let actor='one', now=0; const tree=remote('ok');
  const service=new GitHubService({inspect:async()=>tree,blob:async()=>Buffer.from('ok')},{generate:async()=>{throw Error();}},x=>x,()=>actor,undefined,()=>now);
  const snapshot=await service.inspect(tree.url,undefined,signal()); actor='two';await assert.rejects(service.read(snapshot.id,['src/app.ts'],signal()),/otra sesión/);actor='one';
  await Promise.all(Array.from({length:3},()=>service.inspect(tree.url,undefined,signal()))); await assert.rejects(service.inspect(tree.url,undefined,signal()),/varias lecturas/);
  now=githubLimits.ttlMs; await assert.rejects(service.read(snapshot.id,['src/app.ts'],signal()),/caducó/); await service.inspect(tree.url,undefined,signal());
});
test('GitHub: 100 rutas y cinco archivos elegidos producen cinco fuentes; límites antes de descargar', async () => {
  const tree=remote('ok');tree.files=Array.from({length:100},(_,index)=>({...tree.files[0]!,path:`src/file-${index}.ts`}));tree.listedFiles=100;let downloads=0;
  const service=new GitHubService({inspect:async()=>tree,blob:async()=>{downloads++;return Buffer.from('ok');}},{generate:async()=>({content:'Revisión de cinco archivos',sources:[],provider:'openrouter',model:'fixture'})},x=>x,()=> 'actor');
  const snapshot=await service.inspect(tree.url,undefined,signal());
  await assert.rejects(service.read(snapshot.id,tree.files.slice(0,9).map(file=>file.path),signal()),/ocho/);
  await assert.rejects(service.read(snapshot.id,['src/file-0.ts','src/file-0.ts'],signal()),/distintos/);assert.equal(downloads,0);
  const read=await service.read(snapshot.id,tree.files.slice(0,5).map(file=>file.path),signal());assert.match(read.manifest,/5 leídos de 5 seleccionados; 100 rutas listadas/);assert.equal(downloads,5);
  const report=await service.analyze(snapshot.id,read.id,randomUUID(),signal());assert.equal(report.sources.length,5);
  tree.files[0]!.size=65536;tree.files[1]!.size=65536;await assert.rejects(service.read(snapshot.id,['src/file-0.ts','src/file-1.ts'],signal()),/96 KiB/);assert.equal(downloads,5);
});
test('GitHub: cancelar durante la lectura no confirma una lectura parcial nueva', async () => {
  let started!:()=>void;const began=new Promise<void>(resolve=>{started=resolve;});const tree=remote('ok');
  const service=new GitHubService({inspect:async()=>tree,blob:async(_repo,_file,signal)=>{started();return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}},{generate:async()=>{throw Error();}},x=>x,()=> 'actor');
  const snapshot=await service.inspect(tree.url,undefined,signal()),controller=new AbortController(),reading=service.read(snapshot.id,['src/app.ts'],controller.signal);
  await began;await assert.rejects(service.read(snapshot.id,['src/app.ts'],signal()),/operación en curso/);controller.abort();await assert.rejects(reading);
  await assert.rejects(service.analyze(snapshot.id,randomUUID(),randomUUID(),signal()),/Lee los archivos/);
});
test('GitHub HTTP: exige origen, valida cuerpos y separa inspección, lectura y análisis', async () => {
  const app = createApp({ allowedOrigins:['http://localhost:5174'],checkDatabase:async()=>{},sendMessage:new SendMessage({generate:async()=>{throw Error();}}),github:githubFixture() });
  assert.equal((await request(app).post('/api/github/inspect').send({url:'https://github.com/a/b'})).status,403);
  assert.equal((await request(app).post('/api/github/inspect').set('Origin','http://localhost:5174').send({url:'https://github.com/a/b',token:'unexpected'})).status,400);
  const post=(endpoint:string,body:object)=>request(app).post(`/api/github/${endpoint}`).set('Origin','http://localhost:5174').send(body);
  const snapshot=(await post('inspect',{url:'https://github.com/example/orders'})).body;
  const read=await post('read',{snapshotId:snapshot.id,paths:['src/order.ts']});assert.equal(read.status,200);assert.equal(read.body.files.length,1);
  const report=await post('analyze',{snapshotId:snapshot.id,readId:read.body.id,requestId:randomUUID()});assert.equal(report.status,200);assert.equal(report.body.persistable,false);assert.match(report.body.context,/1 leídos de 1/);
});
test('PR público: fija cabecera de un fork y declara límites; no lee la base ni publica',async()=>{
 const head='c'.repeat(40),base='d'.repeat(40),calls:string[]=[];
 const reader=new GitHubPublicReader(async input=>{const url=String(input);calls.push(url);if(url.endsWith('/pulls/7'))return Response.json({number:7,title:'Ajuste de pedidos',state:'open',changed_files:101,base:{sha:base,repo:{full_name:'sample/repo',private:false}},head:{sha:head,repo:{full_name:'contributor/fork',private:false}}});return Response.json([{filename:'src/app.ts',status:'modified',additions:3,deletions:1,patch:'Contenido no usado por esta revisión de cabecera'}]);});
 const pr=await reader.pullRequest('https://github.com/sample/repo/pull/7',signal());assert.equal(pr.head.repository,'contributor/fork');assert.equal(pr.head.commit,head);assert.equal(pr.filesComplete,false);assert.equal(pr.scope,'head-files-only');assert.equal('patch'in pr.files[0]!,false);assert.equal(calls.length,2);
 let ref='';const tree=remote('ok'),service=new GitHubService({pullRequest:async()=>pr,inspect:async(_url,revision)=>{ref=revision??'';return{...tree,repository:pr.head.repository,url:'https://github.com/contributor/fork',commit:head};},blob:async()=>Buffer.from('ok')},{generate:async()=>({content:'Propuesta',sources:[],provider:'openrouter',model:'fixture'})},x=>x,()=> 'actor');
 const snapshot=await service.inspectPullRequest(pr.url,signal());assert.equal(ref,head);const read=await service.read(snapshot.id,['src/app.ts'],signal());assert.match(read.manifest,/No se leyó la base ni se verificó el diff completo/);assert.ok(read.files[0]!.url.includes(head));
 await assert.rejects(reader.pullRequest('https://github.com/sample/repo/pull/7?token=x',signal()),/Usa https/);
});
