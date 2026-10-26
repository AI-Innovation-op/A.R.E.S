import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, writeFile, readFile, readdir, mkdir, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { replacement, patchFor } from '../src/modules/changes/domain/proposal.js';
import { LocalFiles, hashText } from '../src/modules/workspace/infrastructure/local-files.js';
const roots: string[] = [];
async function fixture() { const root = await mkdtemp(path.join(tmpdir(), 'ares-changes-')); roots.push(root); return root; }
after(async () => { for (const root of roots) { assert.equal(path.dirname(root), tmpdir()); assert.ok(path.basename(root).startsWith('ares-changes-')); await rm(root, { recursive: true, force: true }); } });
test('rechaza JSON incompleto, rutas del modelo, texto vacío y propuestas sin cambios', () => {
  for (const response of ['{"summary":', JSON.stringify({ summary: 'Cambio', content: 'nuevo', path: '../otro.ts' }), JSON.stringify({ summary: 'Cambio', content: ' ' }), JSON.stringify({ summary: 'Cambio', content: 'original' })]) assert.throws(() => replacement(response, 'original'));
});
test('conserva BOM y CRLF y genera un diff con eliminaciones y adiciones reales', () => {
  const before = '\uFEFFconst answer = 42;\r\n';
  const value = replacement(JSON.stringify({ summary: 'Cambia valor', content: 'const answer = 43;\n' }), before);
  assert.equal(value.content, '\uFEFFconst answer = 43;\r\n');
  const diff = patchFor('source.ts', before, value.content); assert.match(diff.patch, /-.*42/); assert.match(diff.patch, /\+.*43/); assert.notEqual(diff.beforeHash, diff.afterHash);
});
test('reemplaza un archivo existente y elimina el temporal, conservando el contenido exacto', async () => {
  const root = await fixture(), files = new LocalFiles([root]); const before = '\uFEFFvalor=42\r\n', after = '\uFEFFvalor=43\r\n';
  await writeFile(path.join(root, 'source.ts'), before);
  await files.replace(root, 'source.ts', hashText(before), after);
  assert.equal(await readFile(path.join(root, 'source.ts'), 'utf8'), after); assert.deepEqual(await readdir(root), ['source.ts']);
});
test('un hash obsoleto o un reemplazo con secretos no modifica el archivo', async () => {
  const root = await fixture(), files = new LocalFiles([root], () => ['credencial-de-prueba']); await writeFile(path.join(root, 'source.ts'), 'original');
  await assert.rejects(files.replace(root, 'source.ts', hashText('viejo'), 'nuevo'), /cambió/);
  await assert.rejects(files.replace(root, 'source.ts', hashText('original'), 'credencial-de-prueba'), /sensibles/);
  assert.equal(await readFile(path.join(root, 'source.ts'), 'utf8'), 'original');
});
test('la escritura bloquea traversal, junctions y nombres con saltos de línea', async () => {
  const root = await fixture(), outside = await fixture(), files = new LocalFiles([root]); await writeFile(path.join(outside, 'source.ts'), 'privado');
  await symlink(outside, path.join(root, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(files.replace(root, 'alias/source.ts', hashText('privado'), 'nuevo'), /fuera/);
  await assert.rejects(files.replace(root, '../source.ts', hashText('privado'), 'nuevo'));
  await assert.rejects(files.resolve(root, 'foo\nbar.ts'));
  assert.equal(await readFile(path.join(outside, 'source.ts'), 'utf8'), 'privado');
});
