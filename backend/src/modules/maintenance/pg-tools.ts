import { spawn, type ChildProcess } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { HttpError } from '../../shared/http-error.js';
export class PgTools {
  private mode: 'native' | 'docker' | undefined;
  private executable = '';
  private child?: ChildProcess;
  constructor(private readonly url: string, private readonly projectRoot: string, private readonly bin?: string) {}
  async prepare() {
    for (const directory of [this.bin, process.platform === 'win32' ? undefined : '/usr/local/bin', process.platform === 'win32' ? undefined : '/usr/bin'].filter((value): value is string => !!value)) {
      const dump = path.join(directory, process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump');
      const restore = path.join(directory, process.platform === 'win32' ? 'pg_restore.exe' : 'pg_restore');
      try { await access(dump); await access(restore); this.mode = 'native'; this.executable = directory; return; } catch { /* Prueba Docker local. */ }
    }
    const url = new URL(this.url);
    if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname) || (url.port && url.port !== '5432')) throw new HttpError(503, 'PG_TOOLS_REQUIRED', 'Configura ARES_PG_BIN con las herramientas PostgreSQL compatibles con tu servidor.');
    const candidates = process.platform === 'win32' ? [path.join(process.env.LOCALAPPDATA ?? '', 'Programs/DockerDesktop/resources/bin/docker.exe'), 'C:/Program Files/Docker/Docker/resources/bin/docker.exe'] : [];
    for (const candidate of candidates) { try { await access(candidate); this.mode = 'docker'; this.executable = candidate; return; } catch {} }
    if (process.platform !== 'win32') { this.mode = 'docker'; this.executable = 'docker'; return; }
    throw new HttpError(503, 'PG_TOOLS_REQUIRED', 'Abre Docker Desktop o configura ARES_PG_BIN para los respaldos.');
  }
  async run(tool: 'pg_dump' | 'pg_restore', database: string, args: string[], file: string) {
    if (!this.mode) await this.prepare();
    const url = new URL(this.url), username = decodeURIComponent(url.username);
    const connection = ['--username', username, '--dbname', database, '--no-password'];
    const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, TEMP: process.env.TEMP, TMP: process.env.TMP, LANG: 'C.UTF-8' };
    let command: string, parameters: string[];
    if (this.mode === 'native') {
      command = path.join(this.executable, process.platform === 'win32' ? `${tool}.exe` : tool);
      env.PGPASSWORD = decodeURIComponent(url.password);
      parameters = ['--host', url.hostname.replace(/^\[|\]$/g, ''), '--port', url.port || '5432', ...connection, ...args];
    } else {
      command = this.executable; env.PATH = path.dirname(command) + path.delimiter + (env.PATH ?? '');
      parameters = ['compose', 'exec', '-T', 'db', tool, ...connection, ...args];
    }
    const child = spawn(command, parameters, { cwd: this.projectRoot, env, windowsHide: true, shell: false, stdio: ['pipe','pipe','pipe'] });
    this.child = child;
    const timeout = setTimeout(() => child.kill(), 180000); timeout.unref();
    const done = new Promise<void>((resolve, reject) => {
      child.once('error', () => reject(new HttpError(503, 'PG_TOOL_UNAVAILABLE', 'No se pudo iniciar la herramienta de PostgreSQL.')));
      child.once('close', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(new HttpError(503, 'PG_TOOL_FAILED', 'PostgreSQL no completó el respaldo o la recuperación. Comprueba Docker, permisos y la versión de las herramientas.')); });
    });
    child.stderr?.resume();
    try {
      if (tool === 'pg_dump') { child.stdin?.end(); await Promise.all([pipeline(child.stdout!, createWriteStream(file, { flags: 'wx', mode: 0o600 })), done]); }
      else { child.stdout?.resume(); await Promise.all([pipeline(createReadStream(file), child.stdin!), done]); }
    } catch (error) { child.kill(); await done.catch(() => {}); if (error instanceof HttpError) throw error; throw new HttpError(503, 'PG_TRANSFER_FAILED', 'No se pudo completar la copia local del respaldo.'); }
    finally { clearTimeout(timeout); if (this.child === child) this.child = undefined; }
  }
  cancel() { this.child?.kill(); }
}
