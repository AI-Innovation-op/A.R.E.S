import assert from 'node:assert/strict';
import { after,test } from 'node:test';
import { mkdtemp,writeFile,readFile,rm,access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LocalFiles } from '../src/modules/workspace/infrastructure/local-files.js';
import type { WorkspaceService } from '../src/modules/workspace/application/workspace-service.js';
import { GitService,githubRepository } from '../src/modules/git/git-service.js';
import { command,gitArgs,type Command } from '../src/modules/git/commands.js';
const roots:string[]=[];
after(async()=>{for(const root of roots){assert.equal(path.dirname(root),tmpdir());assert.ok(path.basename(root).startsWith('ares-git-test-'));await rm(root,{recursive:true,force:true});}});
const diagnostic:Command=async(tool,cwd,args,options)=>{try{return await command(tool,cwd,args,options);}catch(error){console.error('Comando de prueba Git fallido:',args);throw error;}};
async function fixture(run:Command=diagnostic){const root=await mkdtemp(path.join(tmpdir(),'ares-git-test-'));roots.push(root);await writeFile(path.join(root,'a.ts'),'export const a = 1;\n');await writeFile(path.join(root,'.gitignore'),'.env\nmarker.txt\n');await writeFile(path.join(root,'.env'),'SECRET=local-fixture-only');const files=new LocalFiles([root]);const workspace={settings:async()=>({path:root}),assertSettled:async()=>{},exclusive:async<T>(operation:()=>Promise<T>)=>operation()} as unknown as WorkspaceService;const service=new GitService(workspace,files,run);await service.init('project');return{root,files,service,git:(args:string[])=>diagnostic('git',root,gitArgs(root,args))};}
async function commitAll(x:Awaited<ReturnType<typeof fixture>>){const status=await x.service.status('project');return x.service.commit('project',{head:status.head,message:'Fixture inicial',name:'Prueba ARES',email:'test@example.com',files:status.files.filter(file=>file.eligible).map(({path,sha256})=>({path,sha256}))});}
test('commit seleccionado conserva el índice ajeno y excluye archivos no seleccionados',async()=>{
 const x=await fixture();await commitAll(x);await writeFile(path.join(x.root,'b.ts'),'export const b = 2;\n');await x.git(['add','--','b.ts']);await writeFile(path.join(x.root,'a.ts'),'export const a = 2;\n');const current=await x.service.status('project');
 const result=await x.service.commit('project',{head:current.head,message:'Actualiza a',name:'Prueba ARES',email:'test@example.com',files:current.files.filter(file=>file.path==='a.ts').map(({path,sha256})=>({path,sha256}))});
 assert.match(result.commit,/^[a-f0-9]{40}$/);assert.equal((await x.git(['show','HEAD:a.ts'])).trim(),'export const a = 2;');assert.doesNotMatch(await x.git(['ls-tree','--name-only','HEAD']),/b.ts|\.env/);assert.match(await x.git(['diff','--no-ext-diff','--no-textconv','--cached','--','b.ts']),/export const b = 2/);
});
test('rechaza una revisión obsoleta y respeta un lock de otro proceso',async()=>{
 const x=await fixture(),status=await x.service.status('project'),input={head:status.head,message:'Inicial',name:'Prueba ARES',email:'test@example.com',files:status.files.map(({path,sha256})=>({path,sha256}))};
 await writeFile(path.join(x.root,'.git','index.lock'),'other-process');await assert.rejects(x.service.commit('project',input),/Otro proceso/);assert.equal(await readFile(path.join(x.root,'.git','index.lock'),'utf8'),'other-process');await rm(path.join(x.root,'.git','index.lock'));
 await commitAll(x);await assert.rejects(x.service.commit('project',input),/Git cambió/);
});
test('ramas locales exigen carpeta limpia y no ejecutan filtros configurados',async()=>{
 const x=await fixture();await commitAll(x);const current=await x.service.status('project');await x.service.branch('project','feature/test',true,current.head);assert.equal((await x.service.status('project')).branch,'feature/test');
 await x.git(['config','filter.evil.clean','node -e "require(\'fs\').writeFileSync(\'marker.txt\',\'ran\')"']);await x.git(['config','filter.evil.required','true']);await writeFile(path.join(x.root,'.gitattributes'),'*.ts filter=evil\n');await writeFile(path.join(x.root,'a.ts'),'export const a = 3;\n');
 const dirty=await x.service.status('project');await assert.rejects(access(path.join(x.root,'marker.txt')));await assert.rejects(x.service.branch('project','main',false,dirty.head),/Guarda los cambios/);
});
test('publicación usa únicamente el remoto y commit revisados; credencial solo por entorno',async()=>{
 const networkCalls:{args:string[];env?:NodeJS.ProcessEnv}[]=[];
 const run:Command=async(tool,cwd,args,options)=>{
  if(tool==='gh'){if(args[0]==='auth')return'fixture-token-never-output';if(args[0]==='pr')return'[]';assert.equal(args[0],'api');const payload=JSON.parse(options?.input??'{}');assert.equal(payload.draft,true);return JSON.stringify({html_url:'https://github.com/example/project/pull/123'});}
  if(args.includes('push')){networkCalls.push({args,env:options?.env});return'';}
  return command(tool,cwd,args,options);
 };
 const x=await fixture(run);await commitAll(x);let state=await x.service.status('project');await x.service.branch('project','feature/pr',true,state.head);await x.service.remote('project','https://github.com/example/project','');state=await x.service.status('project');
 const result=await x.service.publish('project',{head:state.head!,remote:state.remote,base:'main',title:'Cambio comprobado',body:'Validación local.',confirmed:true});assert.equal(result.url,'https://github.com/example/project/pull/123');assert.equal(networkCalls.length,1);assert.ok(networkCalls[0]!.args.includes(state.head+':refs/heads/feature/pr'));assert.ok(!networkCalls[0]!.args.join(' ').includes('fixture-token'));assert.ok(networkCalls[0]!.env?.GIT_CONFIG_VALUE_1?.startsWith('AUTHORIZATION: basic '));
});
test('remotos rechazan credenciales, otros hosts y rutas ambiguas',()=>{assert.equal(githubRepository('https://github.com/example/project.git').url,'https://github.com/example/project.git');for(const url of ['http://github.com/a/b','https://token@github.com/a/b','https://evil.example/a/b','https://github.com/a/..','file:///D:/repo','https://github.com/a/b?token=x'])assert.throws(()=>githubRepository(url));});
