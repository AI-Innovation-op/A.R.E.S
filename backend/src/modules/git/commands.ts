import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { checkEnvironment } from '../workspace/infrastructure/local-runner.js';
import { HttpError } from '../../shared/http-error.js';
export async function executable(name: 'git'|'gh') {
  for(const directory of (process.env.PATH??'').split(path.delimiter)) {
    if(!path.isAbsolute(directory))continue;
    const file=path.join(directory,process.platform==='win32'?name+'.exe':name);
    try{await access(file);return file;}catch{}
  }
  throw new HttpError(503,'GIT_TOOL_MISSING',`Instala ${name==='git'?'Git':'GitHub CLI (gh)'} y reinicia A.R.E.S.`);
}
export type Command = (tool:'git'|'gh',cwd:string,args:string[],options?:{env?:NodeJS.ProcessEnv;input?:string;optional?:boolean})=>Promise<string>;
export const command:Command=async(tool,cwd,args,options={})=>{
  const env={...checkEnvironment(),GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0',GIT_ATTR_NOSYSTEM:'1',GIT_NO_REPLACE_OBJECTS:'1',GH_PROMPT_DISABLED:'1',...options.env};
  return new Promise<string>(async(resolve,reject)=>{
    let file:string;try{file=await executable(tool);}catch(error){reject(error);return;}
    const child=spawn(file,args,{cwd,env,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});let output='',bytes=0;
    const timer=setTimeout(()=>child.kill(),60000);timer.unref();
    child.stdout.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>2*1024*1024)child.kill();else output+=chunk.toString('utf8');});child.stderr.resume();
    child.once('error',()=>{clearTimeout(timer);reject(new HttpError(503,'GIT_FAILED','No se pudo iniciar la herramienta Git.'));});
    child.once('close',code=>{clearTimeout(timer);if(code===0)resolve(output);else if(options.optional)resolve('');else reject(new HttpError(409,'GIT_FAILED','Git no completó la operación. Revisa el estado, identidad y acceso al repositorio.'));});
    child.stdin.on('error',()=>{});child.stdin.end(options.input??'');
  });
};
export const gitArgs=(root:string,args:string[])=>['--git-dir='+path.join(root,'.git'),'--work-tree='+root,'-c','core.hooksPath='+ (process.platform==='win32'?'NUL':'/dev/null'),'-c','core.fsmonitor=false','-c','commit.gpgSign=false',...args];
