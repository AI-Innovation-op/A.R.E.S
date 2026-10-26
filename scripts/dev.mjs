import { spawn } from 'node:child_process';
import { access, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const children = [];
let backendPort = process.env.PORT ?? '3000';
const frontendPort = process.env.ARES_UI_PORT ?? '5175';
let backendUrl = `http://127.0.0.1:${backendPort}`;
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
async function exists(path) { try { await access(path); return true; } catch { return false; } }
async function probe(url) {
  try { return await fetch(url, { signal: AbortSignal.timeout(1500) }); } catch { return null; }
}
function launch(name, args, folder, env = {}) {
  const child = spawn(process.execPath, args, { cwd: fileURLToPath(new URL(folder, root)), stdio: 'inherit', windowsHide: true, env: { ...process.env, ...env } });
  children.push(child);
  child.on('error', () => { console.error(`No se pudo iniciar ${name}.`); stop(1); });
  child.on('exit', code => { if (!stopping && code !== null) { console.error(`${name} se cerró (${code}).`); stop(code || 1); } });
}
let stopping = false;
function stop(code = 0) {
  if (stopping) return; stopping = true;
  children.forEach(child => child.kill());
  process.exitCode = code;
}
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());

for (const directory of ['backend/node_modules', 'frontend/node_modules']) {
  if (!await exists(new URL(directory, root))) {
    console.error(`Faltan dependencias. Ejecuta npm ci en ${directory.split('/')[0]}.`); process.exit(1);
  }
}
const env = new URL('backend/.env', root);
if (!await exists(env)) {
  await copyFile(new URL('backend/.env.example', root), env);
  console.log('Creado backend/.env. La clave se configura desde la consola local.');
}
let backend = await probe(`${backendUrl}/health`);
// Otros proyectos pueden usar 3000. Buscar un puerto local sin detenerlos.
if (!process.env.PORT) for (let port = 3001; backend && port <= 3010; port++) {
  const identity = await backend.clone().json().catch(() => null);
  if (identity?.service === 'ares-backend') break;
  backendPort = String(port); backendUrl = `http://127.0.0.1:${backendPort}`;
  backend = await probe(`${backendUrl}/health`);
}
if (process.env.ARES_SKIP_DATABASE !== '1') {
  const ready = await probe(`${backendUrl}/ready`);
  if (!ready?.ok) {
    console.log('Preparando PostgreSQL local con Docker…');
    await new Promise(resolve => {
      const prepare = spawn(process.execPath, ['scripts/db-up.mjs'], { cwd: fileURLToPath(root), env: process.env, windowsHide: true, stdio: 'inherit' });
      prepare.on('error', () => { console.log('El chat podrá abrirse en modo sesión; PostgreSQL sigue pendiente.'); resolve(); });
      prepare.on('exit', code => { if (code) console.log('PostgreSQL sigue pendiente; se abrirá el chat de sesión.'); resolve(); });
    });
  }
}
if (backend) {
  const info = await backend.json().catch(() => null);
  if (info?.service !== 'ares-backend') { console.error(`El puerto ${backendPort} está ocupado por otro servicio. No se ha detenido.`); process.exit(1); }
  console.log('El backend de A.R.E.S. ya estaba iniciado.');
} else launch('Backend', ['--import', 'tsx', 'src/app.ts'], 'backend/', { PORT: backendPort });
let backendStarted = false;
for (let attempt = 0; attempt < 75 && !stopping; attempt++) {
  const health = await probe(`${backendUrl}/health`);
  if (health && (await health.json().catch(() => null))?.service === 'ares-backend') { backendStarted = true; break; }
  await new Promise(resolve => setTimeout(resolve, 200));
}
if (!backendStarted) { console.error('El backend no pudo iniciarse. Revisa el mensaje de la terminal.'); stop(1); process.exit(1); }
const frontend = await probe(frontendUrl);
if (frontend) {
  if (!(await frontend.text()).includes('<title>A.R.E.S.')) {
    console.error(`El puerto ${frontendPort} está ocupado por otra aplicación. Usa ARES_UI_PORT para elegir otro puerto y añade su origen a CORS_ORIGINS.`); stop(1);
  } else console.log('La consola de A.R.E.S. ya estaba abierta.');
} else launch('Frontend', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', frontendPort], 'frontend/', { ARES_API_TARGET: backendUrl });
if (!stopping) console.log(`Abre ${frontendUrl} — mantén esta terminal abierta.`);
