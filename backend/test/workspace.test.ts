import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, symlink, link, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LocalFiles } from '../src/modules/workspace/infrastructure/local-files.js';
import { LocalRunner, findNpmCli, checkEnvironment } from '../src/modules/workspace/infrastructure/local-runner.js';
const roots: string[] = [];
async function fixture() { const root = await mkdtemp(path.join(tmpdir(), 'ares-workspace-')); roots.push(root); return root; }
after(async () => { for (const root of roots) { assert.equal(path.dirname(root), tmpdir()); assert.ok(path.basename(root).startsWith('ares-workspace-')); await rm(root, { recursive: true, force: true }); } });
test('lee archivos UTF-8, oculta secretos y excluye credenciales y carpetas generadas', async () => {
  const root = await fixture(), files = new LocalFiles([root], () => ['credencial-prueba-larga']);
  await writeFile(path.join(root, 'app.ts'), "const apiKey = 'credencial-prueba-larga';\nconst mensaje = 'Hola 🚀';");
  await writeFile(path.join(root, '.env'), 'SECRETO=no-publicar'); await mkdir(path.join(root, 'node_modules'));
  const page = await files.list(root); assert.deepEqual(page.entries.map(entry => entry.name), ['app.ts']);
  const source = await files.read(root, 'app.ts'); assert.equal(source.redacted, true); assert.ok(!source.content.includes('credencial-prueba-larga')); assert.match(source.content, /Hola 🚀/); assert.equal(source.sha256.length, 64);
  await assert.rejects(files.read(root, '.env'), /no permitida/);
});
test('bloquea traversal, rutas externas, junctions y enlaces físicos', async () => {
  const root = await fixture(), outside = await fixture(), files = new LocalFiles([root]);
  await writeFile(path.join(outside, 'private.ts'), 'contenido privado');
  await assert.rejects(files.root(outside), /fuera/); await assert.rejects(files.read(root, '../private.ts'), /no permitida/);
  await symlink(outside, path.join(root, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(files.read(root, 'alias/private.ts'), /fuera/);
  await writeFile(path.join(root, 'original.ts'), 'dato'); await link(path.join(root, 'original.ts'), path.join(root, 'hard.ts'));
  await assert.rejects(files.read(root, 'hard.ts'), /enlaces físicos/);
});
test('rechaza binarios, UTF-8 inválido y archivos que superan 64 KB', async () => {
  const root = await fixture(), files = new LocalFiles([root]);
  await writeFile(path.join(root, 'binary.ts'), Buffer.from([0, 1, 2])); await writeFile(path.join(root, 'large.ts'), 'x'.repeat(65537));
  await assert.rejects(files.read(root, 'binary.ts'), /UTF-8/); await assert.rejects(files.read(root, 'large.ts'), /64 KB/);
});
test('al compartir protege la instalación del servidor y permite raíces de proyectos externas',async()=>{const installation=await fixture(),external=await fixture();let shared=false;const files=new LocalFiles([installation,external],()=>[],()=>shared?[installation]:[]);assert.equal(await files.root(installation),installation);shared=true;assert.deepEqual(files.allowedRoots,[external]);await assert.rejects(files.root(installation),/fuera de la instalación/);assert.equal(await files.root(external),external);});
test('ejecuta npm con cwd que contiene espacios, omite hooks y no hereda claves del servidor', async () => {
  const root = await fixture(), cwd = path.join(root, 'carpeta con espacios'); await mkdir(cwd);
  await writeFile(path.join(cwd, 'package.json'), JSON.stringify({ scripts: { precheck: 'node pre.mjs', check: 'node check.mjs' } }));
  await writeFile(path.join(cwd, 'pre.mjs'), "import {writeFileSync} from 'node:fs'; writeFileSync('hook-ran.txt','NO');");
  await writeFile(path.join(cwd, 'check.mjs'), "console.log(process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY ? 'ENV_UNSAFE' : 'ENV_SAFE'); console.log('CHECK_OK');");
  assert.equal(checkEnvironment().GEMINI_API_KEY, undefined); assert.equal(checkEnvironment().OPENROUTER_API_KEY, undefined);
  const runner = new LocalRunner(await findNpmCli(), value => value); assert.equal(runner.available, true);
  const result = await runner.start(cwd, 'check').done; assert.equal(result.status, 'PASSED', result.output); assert.equal(result.exitCode, 0); assert.match(result.output, /CHECK_OK/); assert.match(result.output, /ENV_SAFE/);
  await assert.rejects(access(path.join(cwd, 'hook-ran.txt')));
});
test('distingue fallo, cancelación y timeout, y redacta la salida antes de entregarla', async () => {
  const root = await fixture();
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { check: 'node failed.mjs', test: 'node waiting.mjs' } }));
  await writeFile(path.join(root, 'failed.mjs'), "console.log('credencial-prueba-larga'); process.exitCode=7;");
  await writeFile(path.join(root, 'waiting.mjs'), "console.log('WAITING_READY');setInterval(()=>{},1000);");
  const files = new LocalFiles([root], () => ['credencial-prueba-larga']), runner = new LocalRunner(await findNpmCli(), value => files.redact(value));
  const failed = await runner.start(root, 'check').done; assert.equal(failed.status, 'FAILED'); assert.equal(failed.exitCode, 7, failed.output); assert.ok(!failed.output.includes('credencial-prueba-larga'));
  const pending = runner.start(root, 'test'); setTimeout(() => pending.cancel(), 200); assert.equal((await pending.done).status, 'CANCELLED');
  const limited = new LocalRunner(await findNpmCli(), value => value, 200); assert.equal((await limited.start(root, 'test').done).status, 'TIMEOUT');
  const started=runner.start(root,'test');const deadline=Date.now()+15000;while(!started.snapshot().output.includes('WAITING_READY')&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50));assert.match(started.snapshot().output,/WAITING_READY/);started.cancel();assert.equal((await started.done).status,'CANCELLED');
});
