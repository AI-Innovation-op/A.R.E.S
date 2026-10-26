import { access as accessMarker,lstat,realpath,mkdtemp,readFile,writeFile,open,rename,unlink,rm,stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LocalFiles } from '../workspace/infrastructure/local-files.js';
import type { WorkspaceService } from '../workspace/application/workspace-service.js';
import { command,gitArgs,type Command } from './commands.js';
import { HttpError } from '../../shared/http-error.js';
import { patchFor } from '../changes/domain/proposal.js';
export interface GitFile {path:string;status:string;sha256:string|null;eligible:boolean;reason?:string;patch?:string}
export interface GitStatus {initialized:boolean;root:string;head:string|null;branch:string;branches:string[];remote:string;files:GitFile[];identity:{name:string;email:string}}
export const githubRepository=(value:string)=>{const match=/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(value);if(!match||match[1]==='.'||match[1]==='..'||match[2]==='.'||match[2]==='..')throw new HttpError(400,'INVALID_REMOTE','Usa una URL HTTPS de repositorio GitHub sin credenciales.');return{owner:match[1]!,repo:match[2]!,url:`https://github.com/${match[1]}/${match[2]}.git`};};
export class GitService {
 constructor(private readonly workspace:WorkspaceService,private readonly files:LocalFiles,private readonly run:Command=command){}
 private async root(project:string){const settings=await this.workspace.settings(project);if(!settings.path)throw new HttpError(409,'WORKSPACE_NOT_CONNECTED','Conecta la carpeta del proyecto.');return this.files.root(settings.path);}
 private async initialized(root:string){try{const directory=path.join(root,'.git'),info=await lstat(directory);if(info.isSymbolicLink()||!info.isDirectory()||await realpath(directory)!==directory)throw new HttpError(403,'GIT_DIRECTORY_DENIED','Selecciona la raíz de un repositorio local con carpeta .git propia.');for(const name of ['objects','refs']){const entry=await realpath(path.join(directory,name));const relative=path.relative(directory,entry);if(relative.startsWith('..')||path.isAbsolute(relative))throw new HttpError(403,'GIT_DIRECTORY_DENIED','Los metadatos Git apuntan fuera del repositorio.');}try{const index=await lstat(path.join(directory,'index'));if(index.isSymbolicLink()||index.nlink>1)throw new HttpError(403,'GIT_DIRECTORY_DENIED','El índice Git debe ser un archivo propio.');}catch(error){if(!(error&&typeof error==='object'&&'code'in error&&error.code==='ENOENT'))throw error;}return true;}catch(error){if(error&&typeof error==='object'&&'code'in error&&error.code==='ENOENT')return false;throw error;}}
 private async git(root:string,args:string[],options:Parameters<Command>[3]={}){
  // Los filtros de atributos son programas configurables: no ejecutarlos al inspeccionar código.
  const keys=(await this.run('git',root,gitArgs(root,['config','--null','--name-only','--get-regexp','^filter\\..*\\.(clean|smudge|process|required)$']),{optional:true})).split('\0').filter(Boolean);
  if(keys.length>100||keys.some(key=>/[\r\n\0]/.test(key)))throw new HttpError(403,'GIT_FILTER_CONFIG','Configuración de filtros Git no compatible.');
  return this.run('git',root,gitArgs(root,[...keys.flatMap(key=>['-c',key+'='+(key.endsWith('.required')?'false':'')]),...args]),options);
 }
 async status(project:string):Promise<GitStatus>{
  const root=await this.root(project);if(!await this.initialized(root))return{initialized:false,root,head:null,branch:'main',branches:[],remote:'',files:[],identity:{name:'',email:''}};
  const head=(await this.git(root,['rev-parse','--verify','HEAD'],{optional:true})).trim()||null,branch=(await this.git(root,['symbolic-ref','--quiet','--short','HEAD'],{optional:true})).trim();
  const entries=(await this.git(root,['status','--porcelain=v1','-z','--untracked-files=all'])).split('\0'),files:GitFile[]=[];
  for(let i=0;i<entries.length;i++){const line=entries[i];if(!line)continue;const status=line.slice(0,2),name=line.slice(3);if(/[RC]/.test(status)){i++;files.push({path:name,status,sha256:null,eligible:false,reason:'Registra renombrados desde Git o sepáralos en creación y eliminación.'});continue;}
   if(files.length>=300)throw new HttpError(413,'GIT_TOO_MANY_FILES','Hay más de 300 cambios. Usa Git para reducir el conjunto antes de continuar.');
   try{await this.files.destination(root,name);const exists=await this.files.exists(root,name);const source=exists?await this.files.read(root,name):null;if(source?.redacted)throw new Error();const before=head?await this.git(root,['show',head+':'+name],{optional:true}):'';if(Buffer.byteLength(before)>65536||this.files.redact(before)!==before||before.includes('\0'))throw new Error();const patch=patchFor(name,before,source?.content??'').patch;if(patch.length>64000)throw new Error();files.push({path:name,status,sha256:source?.sha256??null,eligible:true,patch});}catch{files.push({path:name,status,sha256:null,eligible:false,reason:'Archivo sensible, enlace, binario, diff extenso o mayor de 64 KB.'});}
  }
  return{initialized:true,root,head,branch,branches:(await this.git(root,['for-each-ref','--format=%(refname:short)','refs/heads'])).trim().split('\n').filter(Boolean),remote:this.files.redact((await this.git(root,['remote','get-url','origin'],{optional:true})).trim()).replace(/(https?:\/\/)[^/@]+@/g,'$1[OCULTO]@'),files,identity:{name:this.files.redact((await this.git(root,['config','--get','user.name'],{optional:true})).trim()),email:this.files.redact((await this.git(root,['config','--get','user.email'],{optional:true})).trim())}};
 }
 async init(project:string){return this.workspace.exclusive(async()=>{await this.workspace.assertSettled(project);const root=await this.root(project);if(!await this.initialized(root)){const empty=await mkdtemp(path.join(tmpdir(),'ares-git-template-'));try{await this.run('git',root,['-c','init.defaultBranch=main','init','--template='+empty,'--initial-branch=main',root]);}finally{await this.clean(empty,'ares-git-template-');}}return this.status(project);});}
 private async clean(directory:string,prefix:string){if(path.dirname(directory)!==tmpdir()||!path.basename(directory).startsWith(prefix))throw new Error('Temporal Git inválido');await rm(directory,{recursive:true,force:true});}
 private async expected(project:string,head:string|null){const current=await this.status(project);if(!current.initialized||current.head!==head)throw new HttpError(409,'GIT_CHANGED','Git cambió desde la revisión. Actualiza el estado.');return current;}
 private async branchName(root:string,name:string){if(!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/.test(name))throw new HttpError(400,'INVALID_BRANCH','Nombre de rama inválido.');await this.git(root,['check-ref-format','--branch',name]);}
 async branch(project:string,name:string,create:boolean,head:string|null){return this.workspace.exclusive(async()=>{await this.workspace.assertSettled(project);const current=await this.expected(project,head);if(current.files.length)throw new HttpError(409,'GIT_DIRTY','Guarda los cambios en un commit antes de cambiar de rama.');await this.branchName(current.root,name);await this.git(current.root,['switch','--no-guess',...(create?['-c']:[]),name]);return this.status(project);});}
 async remote(project:string,url:string,expectedRemote:string){return this.workspace.exclusive(async()=>{await this.workspace.assertSettled(project);const current=await this.status(project);if(!current.initialized||current.remote!==expectedRemote)throw new HttpError(409,'GIT_CHANGED','El remoto cambió. Actualiza antes de continuar.');const target=githubRepository(url);await this.git(current.root,['remote',current.remote?'set-url':'add','origin',target.url]);return this.status(project);});}
 async commit(project:string,input:{head:string|null;message:string;name:string;email:string;files:{path:string;sha256:string|null}[]}){
  return this.workspace.exclusive(async()=>{
   await this.workspace.assertSettled(project);const current=await this.expected(project,input.head);if(!current.branch)throw new HttpError(409,'DETACHED_HEAD','Cambia a una rama antes de crear el commit.');
   for(const marker of ['MERGE_HEAD','CHERRY_PICK_HEAD','REVERT_HEAD','rebase-merge','rebase-apply']){try{await accessMarker(path.join(current.root,'.git',marker));throw new HttpError(409,'GIT_OPERATION_PENDING','Termina la fusión, rebase o cherry-pick desde Git antes de crear un commit en la consola.');}catch(error){if(error instanceof HttpError)throw error;}}
   if(this.files.redact(input.message)!==input.message||this.files.redact(input.name)!==input.name||this.files.redact(input.email)!==input.email)throw new HttpError(400,'GIT_SECRET','El mensaje o identidad contiene valores sensibles.');
   const unique=new Set<string>();for(const selected of input.files){const key=selected.path.toLowerCase();if(unique.has(key))throw new HttpError(400,'GIT_DUPLICATE','Selecciona cada archivo una sola vez.');unique.add(key);const file=current.files.find(item=>item.path===selected.path);if(!file?.eligible||file.sha256!==selected.sha256)throw new HttpError(409,'SOURCE_CHANGED','Un archivo seleccionado cambió o no está permitido. Actualiza la revisión.');}
   const temporary=await mkdtemp(path.join(tmpdir(),'ares-git-commit-')),index=path.join(temporary,'commit-index'),merged=path.join(temporary,'merged-index'),main=path.join(current.root,'.git','index'),lock=main+'.lock';let handle;let ownsLock=false;let committed:string|null=null;
   try{
    try{handle=await open(lock,'wx',0o600);ownsLock=true;}catch{throw new HttpError(409,'GIT_LOCKED','Otro proceso está usando el índice Git. Espera y actualiza.');}
    const env={GIT_INDEX_FILE:index,GIT_AUTHOR_NAME:input.name,GIT_AUTHOR_EMAIL:input.email,GIT_COMMITTER_NAME:input.name,GIT_COMMITTER_EMAIL:input.email};
    await this.git(current.root,['read-tree',...(current.head?[current.head]:['--empty'])],{env});
    try{await writeFile(merged,await readFile(main),{flag:'wx',mode:0o600});}catch(error){if(error&&typeof error==='object'&&'code'in error&&error.code==='ENOENT')await this.git(current.root,['read-tree',...(current.head?[current.head]:['--empty'])],{env:{GIT_INDEX_FILE:merged}});else throw error;}
    for(const selected of input.files){
     let blob:string|undefined,mode='100644';if(selected.sha256!==null){const file=await this.files.read(current.root,selected.path);if(file.redacted||file.sha256!==selected.sha256)throw new HttpError(409,'SOURCE_CHANGED','Un archivo cambió durante la preparación del commit.');blob=(await this.git(current.root,['hash-object','-w','--stdin','--no-filters'],{input:file.content})).trim();const info=await stat(await this.files.resolve(current.root,selected.path));if(process.platform!=='win32'&&(info.mode&0o111))mode='100755';}
     else if(await this.files.exists(current.root,selected.path))throw new HttpError(409,'SOURCE_CHANGED','Un archivo eliminado volvió a aparecer.');
     const args=blob?['update-index','--add','--cacheinfo',mode,blob,selected.path]:['update-index','--force-remove','--',selected.path];
     await this.git(current.root,args,{env});await this.git(current.root,args,{env:{GIT_INDEX_FILE:merged}});
    }
    const tree=(await this.git(current.root,['write-tree'],{env})).trim();
    if(current.head&&tree===(await this.git(current.root,['rev-parse',current.head+'^{tree}'])).trim())throw new HttpError(422,'GIT_NO_CHANGE','Los archivos seleccionados no cambian el commit actual.');
    const commit=(await this.git(current.root,['commit-tree',tree,...(current.head?['-p',current.head]:[]),'-m',input.message],{env})).trim();
    await handle.writeFile(await readFile(merged));await handle.sync();await handle.close();handle=undefined;
    await this.git(current.root,['update-ref','refs/heads/'+current.branch,commit,current.head??'0'.repeat(40)]);committed=commit;await rename(lock,main);ownsLock=false;
    return{commit,warning:null,status:await this.status(project)};
   }catch(error){if(committed)return{commit:committed,warning:'El commit existe, pero no se pudo actualizar el índice. Revisa Git antes del siguiente commit.',status:await this.status(project)};throw error;}
   finally{await handle?.close();if(ownsLock)await unlink(lock).catch(()=>{});await this.clean(temporary,'ares-git-commit-');}
  });
 }
 async publish(project:string,input:{head:string;remote:string;base:string;title:string;body:string;confirmed:boolean}){
  return this.workspace.exclusive(async()=>{
   await this.workspace.assertSettled(project);const current=await this.expected(project,input.head),target=githubRepository(input.remote);
   if(!input.confirmed||current.files.length||current.remote!==target.url||!current.branch||['main','master',input.base].includes(current.branch))throw new HttpError(409,'PUBLISH_REVIEW','Revisa el remoto, crea una rama de trabajo y guarda los cambios antes de publicar.');
   await this.branchName(current.root,input.base);
   if(this.files.redact(input.title+'\n'+input.body)!==input.title+'\n'+input.body)throw new HttpError(400,'GIT_SECRET','Retira los valores sensibles de la descripción.');
   // Solo se obtiene la credencial tras la acción explícita de publicación. Nunca se devuelve al cliente.
   const token=(await this.run('gh',current.root,['auth','token','--hostname','github.com'])).trim();if(!token)throw new HttpError(503,'GH_AUTH_REQUIRED','Inicia sesión con gh auth login antes de publicar.');
   const env={GIT_CONFIG_COUNT:'3',GIT_CONFIG_KEY_0:'credential.helper',GIT_CONFIG_VALUE_0:'',GIT_CONFIG_KEY_1:'http.https://github.com/.extraheader',GIT_CONFIG_VALUE_1:'AUTHORIZATION: basic '+Buffer.from('x-access-token:'+token).toString('base64'),GIT_CONFIG_KEY_2:'http.followRedirects',GIT_CONFIG_VALUE_2:'false'};
   // Red controlada: no cargar reescrituras URL, proxies, hooks o helpers del repositorio del usuario.
   const network=await mkdtemp(path.join(tmpdir(),'ares-git-network-'));
   try{
   await this.run('git',network,['init','--bare','--template=',network]);
   await writeFile(path.join(network,'objects','info','alternates'),path.join(current.root,'.git','objects').replaceAll('\\','/')+'\n',{flag:'wx',mode:0o600});
   await this.run('git',network,['--git-dir='+network,'-c','core.hooksPath='+(process.platform==='win32'?'NUL':'/dev/null'),'-c','http.sslVerify=true','push','--no-verify','--porcelain',target.url,current.head+':refs/heads/'+current.branch],{env});
   }finally{await this.clean(network,'ares-git-network-');}
   const ghEnv={GH_TOKEN:token};const listed=JSON.parse(await this.run('gh',tmpdir(),['pr','list','--repo',target.owner+'/'+target.repo,'--head',current.branch,'--json','url'],{env:ghEnv}));
   if(Array.isArray(listed)&&typeof listed[0]?.url==='string')return{url:listed[0].url,head:current.head,existing:true};
   const body={title:input.title,body:input.body,base:input.base,head:current.branch,draft:true};
   const response=JSON.parse(await this.run('gh',tmpdir(),['api','--hostname','github.com','--method','POST',`repos/${target.owner}/${target.repo}/pulls`,'--input','-'],{env:ghEnv,input:JSON.stringify(body)}));
   if(typeof response.html_url!=='string'||!response.html_url.startsWith(`https://github.com/${target.owner}/${target.repo}/pull/`))throw new HttpError(502,'PR_UNCONFIRMED','La rama se publicó, pero no se pudo confirmar el PR. Revisa GitHub antes de reintentar.');
   return{url:response.html_url,head:current.head,existing:false};
  });
 }
}
