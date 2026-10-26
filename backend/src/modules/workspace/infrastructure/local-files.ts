import { createHash, randomUUID } from 'node:crypto';
import { lstat, open, opendir, realpath, stat, rename, unlink, link } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from '../../../shared/http-error.js';
import type { FilePage, SourceFile } from '../domain/workspace.js';

const excluded = new Set(['.git','.codex','.agents','.aws','.ssh','.local-setup','node_modules','dist','build','coverage','test-results','playwright-report','.venv','venv','__pycache__','.next','.nuxt','.cache','target']);
const forbidden = /^(?:\.env(?:\..*)?|\.npmrc|\.pypirc|\.netrc|\.pgpass|credentials(?:\..*)?|id_rsa(?:\..*)?|id_ed25519(?:\..*)?|.*\.(?:pem|key|p12|pfx|keystore))$/i;
const extensions = new Set(['.ts','.js','.mjs','.cjs','.vue','.jsx','.tsx','.css','.scss','.sass','.less','.html','.json','.md','.mdx','.txt','.sql','.prisma','.graphql','.gql','.yaml','.yml','.toml','.py','.go','.rs','.java','.kt','.cs','.c','.h','.cpp','.sh','.ps1']);
export const hashText = (text: string) => createHash('sha256').update(text).digest('hex');
function inside(root: string, candidate: string) { const relative = path.relative(root, candidate); return !relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); }
function permitted(relative: string) { return relative.split(/[\\/]/).every(segment => segment && segment !== '.' && segment !== '..' && !/[ .]$/.test(segment) && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment) && !excluded.has(segment.toLowerCase()) && !forbidden.test(segment)); }
function textFile(name: string) { return extensions.has(path.extname(name).toLowerCase()) || ['Dockerfile','Makefile','LICENSE','.gitignore','.dockerignore','.editorconfig'].includes(name); }

export class LocalFiles {
  constructor(private readonly roots: string[], private readonly secrets: () => (string | undefined)[] = () => [],private readonly protectedRoots:()=>string[]=()=>[]) {}
  get allowedRoots() { return this.roots.filter(root => path.resolve(root) !== path.parse(path.resolve(root)).root && !this.protectedRoots().some(protectedRoot=>inside(path.resolve(root),path.resolve(protectedRoot))||inside(path.resolve(protectedRoot),path.resolve(root)))); }
  redact(text: string): string {
    let result = text;
    for (const secret of this.secrets()) if (secret && secret.length >= 8) result = result.split(secret).join('[SECRETO OCULTO]');
    return result.replace(/\b(?:sk-(?:or-v1-)?[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{25,}|AQ\.[A-Za-z0-9_-]{20,})\b/g, '[SECRETO OCULTO]')
      .replace(/((?:["']?(?:api[_-]?key|password|secret|access[_-]?token|authorization)["']?)\s*[:=]\s*)(["'])([^\r\n"']{8,})\2/gi, '$1$2[SECRETO OCULTO]$2')
      .replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+@/gi, '$1[SECRETO OCULTO]@');
  }
  async root(input: string) {
    if (!path.isAbsolute(input) || input.startsWith('\\\\') || /[\u0000-\u001f\u007f]/.test(input)) throw new HttpError(400, 'INVALID_LOCAL_PATH', 'Introduce una ruta local absoluta.');
    let resolved: string;
    try { resolved = await realpath(input); if (!(await stat(resolved)).isDirectory()) throw new Error(); }
    catch { throw new HttpError(404, 'WORKSPACE_NOT_FOUND', 'No se encontró esa carpeta local.'); }
    for(const protectedRoot of this.protectedRoots()){let canonical:string;try{canonical=await realpath(protectedRoot);}catch{canonical=path.resolve(protectedRoot);}if(inside(canonical,resolved)||inside(resolved,canonical))throw new HttpError(403,'SERVER_WORKSPACE_PROTECTED','En modo compartido, conecta proyectos fuera de la instalación del servidor A.R.E.S.');}
    for (const candidate of this.allowedRoots) {
      let root: string; try { root = await realpath(candidate); } catch { continue; }
      if (inside(root, resolved)) {
        const relative = path.relative(root, resolved);
        if (!relative || permitted(relative)) return resolved;
      }
    }
    throw new HttpError(403, 'WORKSPACE_OUTSIDE_ROOTS', 'Esta carpeta está fuera de las raíces de trabajo habilitadas.');
  }
  async resolve(rootPath: string, relative = '', directory = false) {
    const root = await this.root(rootPath);
    if (relative && (!permitted(relative) || path.isAbsolute(relative) || relative.includes(':') || /[\u0000-\u001f\u007f]/.test(relative))) throw new HttpError(403, 'FILE_DENIED', 'Ruta de archivo no permitida.');
    const candidate = path.resolve(root, relative);
    if (!inside(root, candidate)) throw new HttpError(403, 'FILE_DENIED', 'La ruta debe pertenecer a la carpeta conectada.');
    let resolved: string;
    try {
      const item = await lstat(candidate);
      if (item.isSymbolicLink()) throw new HttpError(403, 'FILE_DENIED', 'Los enlaces simbólicos y junctions no están disponibles.');
      resolved = await realpath(candidate);
      if (!inside(root, resolved) || (path.relative(root, resolved) && !permitted(path.relative(root, resolved)))) throw new HttpError(403, 'FILE_DENIED', 'El archivo apunta fuera de las rutas disponibles.');
      const info = await stat(resolved);
      if (directory ? !info.isDirectory() : !info.isFile()) throw new Error();
    } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(404, 'FILE_NOT_FOUND', 'No se encontró el archivo o carpeta.'); }
    return resolved;
  }
  async list(root: string, directory = ''): Promise<FilePage> {
    const absolute = await this.resolve(root, directory, true);
    const entries: FilePage['entries'] = []; let scanned = 0, truncated = false;
    const iterator = await opendir(absolute);
    for await (const entry of iterator) {
      if (++scanned > 2000) { truncated = true; break; }
      if (entry.isSymbolicLink() || excluded.has(entry.name.toLowerCase()) || forbidden.test(entry.name) || (!entry.isDirectory() && (!entry.isFile() || !textFile(entry.name)))) continue;
      if (entries.length >= 300) { truncated = true; break; }
      entries.push({ name: entry.name, path: [directory, entry.name].filter(Boolean).join('/'), directory: entry.isDirectory() });
    }
    entries.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name));
    return { directory, entries, truncated };
  }
  async read(root: string, relative: string, maximum=65536): Promise<SourceFile> {
    if(!Number.isSafeInteger(maximum)||maximum<1||maximum>5*1024*1024)throw new Error('Límite interno de lectura inválido');
    const absolute = await this.resolve(root, relative);
    if (!textFile(path.basename(relative))) throw new HttpError(415, 'TEXT_FILE_REQUIRED', 'Selecciona un archivo de código o documentación compatible.');
    const handle = await open(absolute, 'r');
    try {
      const info = await handle.stat();
      if (info.nlink > 1) throw new HttpError(403, 'FILE_DENIED', 'Los archivos con enlaces físicos no están disponibles.');
      if (info.size > maximum) throw new HttpError(413, 'FILE_TOO_LARGE', `El archivo supera ${maximum/1024} KB. Selecciona un archivo más pequeño.`);
      const data = Buffer.alloc(maximum+1); const { bytesRead } = await handle.read(data, 0, data.length, 0);
      if (bytesRead > maximum) throw new HttpError(413, 'FILE_TOO_LARGE', `El archivo supera ${maximum/1024} KB.`);
      const raw = data.subarray(0, bytesRead).toString('utf8');
      if (raw.includes('\0') || raw.includes('\uFFFD')) throw new HttpError(415, 'TEXT_FILE_REQUIRED', 'El archivo debe ser texto UTF-8.');
      const content = this.redact(raw);
      return { path: relative.replace(/\\/g, '/'), content, bytes: bytesRead, modifiedAt: info.mtime.toISOString(), sha256: hashText(content), redacted: content !== raw };
    } finally { await handle.close(); }
  }
  async replace(root: string, relative: string, expectedHash: string, content: string) {
    const current = await this.read(root, relative);
    if (current.redacted || current.sha256 !== expectedHash) throw new HttpError(409, 'SOURCE_CHANGED', 'El archivo cambió o contiene valores sensibles. Vuelve a leerlo antes de aplicar.');
    if (this.redact(content) !== content || !content.trim() || content.includes('\0') || Buffer.byteLength(content, 'utf8') > 65536) throw new HttpError(400, 'INVALID_REPLACEMENT', 'El reemplazo contiene datos sensibles o no es texto permitido.');
    const absolute = await this.resolve(root, relative);
    const info = await stat(absolute);
    const temporary = path.join(path.dirname(absolute), `.ares-${randomUUID()}.tmp`);
    try {
      const handle = await open(temporary, 'wx', info.mode);
      try { await handle.writeFile(content, 'utf8'); await handle.sync(); } finally { await handle.close(); }
      const latest = await this.read(root, relative);
      if (latest.sha256 !== expectedHash || latest.redacted || await this.resolve(root, relative) !== absolute) throw new HttpError(409, 'SOURCE_CHANGED', 'El archivo cambió durante la aplicación. No se sobrescribió.');
      await rename(temporary, absolute);
    } finally { await unlink(temporary).catch(() => {}); }
    return this.read(root, relative);
  }
  async destination(root: string, relative: string) {
    if (!relative || !permitted(relative) || path.isAbsolute(relative) || /[:\u0000-\u001f\u007f]/.test(relative) || !textFile(path.basename(relative))) throw new HttpError(403, 'FILE_DENIED', 'Ruta nueva no permitida. Usa una carpeta existente y un archivo de código o documentación.');
    const parent = await this.resolve(root, path.dirname(relative) === '.' ? '' : path.dirname(relative), true);
    return path.join(parent, path.basename(relative));
  }
  async exists(root: string, relative: string) {
    const target = await this.destination(root, relative);
    try { await lstat(target); return true; } catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return false; throw error; }
  }
  async create(root: string, relative: string, content: string) {
    const target = await this.destination(root, relative);
    if (!content.trim() || content.includes('\0') || this.redact(content) !== content || Buffer.byteLength(content) > 65536) throw new HttpError(400,'INVALID_REPLACEMENT','Contenido nuevo inválido o sensible.');
    const temporary = path.join(path.dirname(target),`.ares-${randomUUID()}.tmp`);
    try {
      const handle = await open(temporary,'wx',0o600);
      try { await handle.writeFile(content,'utf8'); await handle.sync(); } finally { await handle.close(); }
      try { await link(temporary,target); } catch { throw new HttpError(409,'SOURCE_CHANGED','El archivo nuevo ya existe o no se puede crear.'); }
    } finally { await unlink(temporary).catch(()=>{}); }
    return this.read(root,relative);
  }
  async removeCreated(root: string, relative: string, expectedHash: string) {
    const current = await this.read(root,relative);
    if (current.redacted || current.sha256 !== expectedHash) throw new HttpError(409,'SOURCE_CHANGED','El archivo nuevo cambió; se conserva para evitar perder tus ediciones.');
    await unlink(await this.resolve(root,relative));
  }
}
