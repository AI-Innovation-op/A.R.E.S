import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const candidates=[...(process.platform==='win32'?[path.join(process.env.LOCALAPPDATA??'','Programs/DockerDesktop/resources/bin/docker.exe'),'C:/Program Files/Docker/Docker/resources/bin/docker.exe']:[]),...(process.env.PATH??'').split(path.delimiter).map(dir=>path.join(dir,process.platform==='win32'?'docker.exe':'docker'))];
let docker;for(const candidate of candidates){try{await access(candidate);docker=candidate;break;}catch{}}
if(!docker)throw new Error('Instala e inicia Docker Desktop.');
const child=spawn(docker,['build','-t','ares-check-runner:1',fileURLToPath(new URL('../backend/runtime/',import.meta.url))],{stdio:'inherit',windowsHide:true,env:{...process.env,PATH:path.dirname(docker)+path.delimiter+(process.env.PATH??'')}});
child.on('exit',code=>{process.exitCode=code??1;});
