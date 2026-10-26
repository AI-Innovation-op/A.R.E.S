import { spawn, type ChildProcess } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { writeFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import type { RunStatus, ScriptName } from '../domain/workspace.js';
import { windowsJobCommand } from './windows-job.js';
export interface RunResult { status: Exclude<RunStatus, 'RUNNING'>; output: string; truncated: boolean; exitCode: number | null }
export interface RunningCheck { snapshot(): Pick<RunResult, 'output' | 'truncated'>; cancel(reason?: 'CANCELLED' | 'INTERRUPTED'): void; done: Promise<RunResult> }
export interface CheckRunner {readonly available:boolean;readonly isolation?:'local'|'docker';start(directory:string,script:ScriptName,root?:string):RunningCheck}
export async function findNpmCli() {
  const directory = path.dirname(process.execPath);
  const candidates = [path.join(directory, 'node_modules/npm/bin/npm-cli.js'), path.resolve(directory, '../lib/node_modules/npm/bin/npm-cli.js')];
  for (const candidate of candidates) { try { await access(candidate); return candidate; } catch { /* Prueba la siguiente ubicación del runtime. */ } }
  return null;
}
export function checkEnvironment() {
  const result: NodeJS.ProcessEnv = { CI: 'true', NO_COLOR: '1', NODE_ENV: 'test', npm_config_update_notifier: 'false' };
  result.PATH=path.dirname(process.execPath)+path.delimiter+(process.env.PATH??process.env.Path??'');
  if(process.platform==='win32')result.PATHEXT='.COM;.EXE;.BAT;.CMD';
  for (const name of ['SYSTEMROOT','SystemRoot','WINDIR','ComSpec','TEMP','TMP','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','LANG']) if (process.env[name]) result[name] = process.env[name];
  return result;
}
function terminate(child: ChildProcess) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    // Killing the Job-owning supervisor also kills every inherited descendant.
    child.kill();
  } else { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
}
export class LocalRunner {
  readonly isolation='local' as const;
  constructor(private readonly npmCli: string | null, private readonly redact: (text: string) => string, private readonly timeoutMs = 90000) {}
  get available() { return this.npmCli !== null; }
  start(directory: string, script: ScriptName): RunningCheck {
    if (!this.npmCli) throw new Error('npm no disponible');
    let output = '', truncated = false, reason: RunResult['status'] | undefined;
    const clean = () => this.redact(output).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\0/g, '');
    const shell = process.platform === 'win32' ? path.join(process.env.SystemRoot ?? process.env.SYSTEMROOT ?? 'C:\\Windows', 'System32/cmd.exe') : '/bin/sh';
    const nullFile = process.platform === 'win32' ? 'NUL' : '/dev/null';
    const globalConfig = path.join(tmpdir(), `ares-npm-global-${randomUUID()}.npmrc`);
    writeFileSync(globalConfig, '', { flag: 'wx' });
    const npmArgs=[this.npmCli, '--ignore-scripts', `--script-shell=${shell}`, `--userconfig=${nullFile}`, `--globalconfig=${globalConfig}`, '--offline', 'run', script];
    const executable=process.platform==='win32'?path.join(process.env.SystemRoot??'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'):process.execPath;
    const args=process.platform==='win32'?['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',windowsJobCommand(process.execPath,npmArgs,directory)]:npmArgs;
    const child = spawn(executable, args, {
      cwd: directory, env: checkEnvironment(), shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
    });
    const decoders = [new StringDecoder('utf8'), new StringDecoder('utf8')];
    function append(text: string) {
      output += text;
      if (output.length > 16000) { truncated = true; output = output.slice(-16000); const newline = output.indexOf('\n'); output = newline >= 0 ? output.slice(newline + 1) : ''; }
    }
    child.stdout?.on('data', (data: Buffer) => append(decoders[0]!.write(data)));
    child.stderr?.on('data', (data: Buffer) => append(decoders[1]!.write(data)));
    const timeout = setTimeout(() => { reason ??= 'TIMEOUT'; terminate(child); }, this.timeoutMs);
    timeout.unref();
    const done = new Promise<RunResult>(resolve => {
      child.on('error', () => { append('\nNo se pudo iniciar npm con el runtime local.'); });
      child.on('close', code => {
        try { unlinkSync(globalConfig); } catch { /* Archivo temporal sin credenciales; no impide registrar el resultado. */ }
        clearTimeout(timeout); append(decoders.map(decoder => decoder.end()).join(''));
        resolve({ status: reason ?? (code === 0 ? 'PASSED' : 'FAILED'), output: clean(), truncated, exitCode: code });
      });
    });
    return { snapshot: () => ({ output: clean(), truncated }), cancel: (status = 'CANCELLED') => { if (!reason) { reason = status; terminate(child); } }, done };
  }
}
