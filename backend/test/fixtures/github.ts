import { createHash } from 'node:crypto';
import { GitHubService } from '../../src/modules/github/github-service.js';
import { LocalFiles } from '../../src/modules/workspace/infrastructure/local-files.js';
import type { LibraryRepository } from '../../src/modules/library/domain/library.js';
export const githubFixtureFiles: Record<string, string> = { 'README.md': '# Pedidos de prueba\nRepositorio sintético.', 'src/order.ts': 'export class Order { confirm() { return "confirmed"; } }', '.env': 'SECRET=excluded' };
export function githubFixture(library?: LibraryRepository) {
  return new GitHubService({
    inspect: async () => ({ repository: 'example/orders', url: 'https://github.com/example/orders', ref: 'main', commit: 'a'.repeat(40), tree: 'b'.repeat(40), listedFiles: 3, incomplete: false, limited: false,
      files: Object.entries(githubFixtureFiles).map(([path, content]) => ({ path, sha: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0${content}`).digest('hex'), size: Buffer.byteLength(content), eligible: path !== '.env', ...(path === '.env' ? { reason: 'Archivo de credenciales' } : {}) })) }),
    blob: async (_repo, file) => Buffer.from(githubFixtureFiles[file.path]!),
  }, { generate: async () => ({ content: '### Evidencia estática\n\n`src/order.ts` define Order.confirm. El ejemplo no comprueba invariantes de pedidos.\n\n### Propuesta\n\nDefinir invariantes del agregado antes de separar adaptadores. No se ejecutaron pruebas.', sources: [], provider: 'openrouter', model: 'github-fixture' }) }, text => new LocalFiles([]).redact(text), () => 'fixture', library);
}
