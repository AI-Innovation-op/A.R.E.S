import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const candidates = process.platform === 'win32' ? [join(process.env.LOCALAPPDATA ?? '', 'Programs/DockerDesktop/resources/bin/docker.exe'), 'C:/Program Files/Docker/Docker/resources/bin/docker.exe'] : [];
let executable = 'docker';
for (const path of candidates) { try { await access(path); executable = path; break; } catch {} }
const env = { ...process.env, ...(executable !== 'docker' ? { PATH: dirname(executable) + (process.platform === 'win32' ? ';' : ':') + process.env.PATH } : {}) };
function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, windowsHide: true, stdio: 'inherit' });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error('El comando no pudo completarse.')));
  });
}
try {
  await run(executable, ['compose', 'up', '-d', 'db', '--wait'], root);
  await run(process.execPath, ['--import', 'tsx', 'src/config/migrate-cli.ts'], join(root, 'backend'));
} catch {
  console.error('No se pudo preparar PostgreSQL. Abre Docker Desktop, comprueba que el motor esté listo y vuelve a ejecutar npm run db:up.'); process.exitCode = 1;
}
