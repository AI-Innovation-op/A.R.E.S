import { createHash } from 'node:crypto';
import { z } from 'zod';
import { HttpError } from '../../shared/http-error.js';

const sha = z.string().regex(/^[a-f0-9]{40}$/);
export const githubLimits = { files: 8, fileBytes: 65536, totalBytes: 98304, treeEntries: 3000, ttlMs: 15 * 60 * 1000 };
import type{RemoteFile,RemoteTree}from'../../../../packages/contracts/index.js';
export type{RemoteFile,RemoteTree}from'../../../../packages/contracts/index.js';
export interface PublicReader {
  pullRequest?(url:string,signal:AbortSignal):Promise<PublicPullRequest>;
  inspect(url: string, ref: string | undefined, signal: AbortSignal): Promise<RemoteTree>;
  blob(repository: string, file: RemoteFile, signal: AbortSignal): Promise<Uint8Array>;
}
export interface PublicPullRequest{url:string;title:string;number:number;state:string;base:{repository:string;commit:string};head:{repository:string;commit:string};changedFiles:number;files:{path:string;status:string;additions:number;deletions:number}[];filesComplete:boolean;scope:'head-files-only'}
export function repositoryName(input: string) {
  // Validate the original path too: URL normalizes dot segments before validation.
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\/?$/.test(input)) throw new HttpError(400, 'GITHUB_URL', 'Usa https://github.com/organización/repositorio, sin consultas ni rutas de archivos.');
  const [owner, raw] = new URL(input).pathname.slice(1).replace(/\/$/, '').split('/');
  const repo = raw!.replace(/\.git$/i, '');
  if (!repo || repo === '.' || repo === '..') throw new HttpError(400, 'GITHUB_URL', 'Introduce el enlace de un repositorio público.');
  return `${owner}/${repo}`;
}
const ignored = /^(?:\.git|\.ssh|\.aws|\.codex|\.agents|\.local-setup|node_modules|vendor|dist|build|coverage|target|\.next|\.nuxt|\.venv|venv|__pycache__|test-results|playwright-report)$/i;
const secret = /^(?:\.env(?:\..*)?|\.npmrc|\.pypirc|\.netrc|\.pgpass|credentials(?:\..*)?|id_rsa(?:\..*)?|id_ed25519(?:\..*)?|.*\.(?:pem|key|p12|pfx|keystore))$/i;
const text = /\.(?:[cm]?[jt]sx?|vue|svelte|css|scss|html|json|md|mdx|txt|sql|prisma|graphql|gql|ya?ml|toml|py|go|rs|java|kt|cs|c|h|cpp|sh|ps1|xml|rb|php)$/i;
export function exclusion(path: string, mode: string, size: number) {
  if (mode !== '100644' && mode !== '100755') return 'Enlace simbólico o submódulo';
  const segments = path.split('/');
  if (path.length > 300 || segments.some(part => !part || part === '.' || part === '..' || /[\\\u0000-\u001f\u007f]/.test(part))) return 'Ruta no admitida';
  if (segments.some(part => secret.test(part))) return 'Archivo de credenciales';
  if (segments.some(part => ignored.test(part)) || /(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(path)) return 'Dependencias o archivo generado';
  if (!text.test(path) && !/^(?:Dockerfile|Makefile|LICENSE|\.gitignore|\.dockerignore|\.editorconfig)$/i.test(segments.at(-1)!)) return 'Formato no admitido';
  if (size > githubLimits.fileBytes) return 'Supera 64 KiB';
  return undefined;
}
const treeSchema = z.object({ truncated: z.boolean(), tree: z.array(z.object({ path: z.string(), mode: z.string(), type: z.string(), sha, size: z.number().int().nonnegative().optional() })) });
export class GitHubPublicReader implements PublicReader {
  constructor(private readonly fetcher: typeof fetch = fetch) {}
  private async request(path: string, limit: number, signal: AbortSignal, raw = false) {
    signal.throwIfAborted();
    let response: Response;
    try {
      response = await this.fetcher(`https://api.github.com/repos/${path}`, { signal, redirect: 'error', headers: {
        Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'ARES-public-reader',
      } });
    } catch (cause) { if (signal.aborted) throw cause; throw new HttpError(502, 'GITHUB_NETWORK', 'No se pudo conectar con GitHub. Reintenta la lectura.'); }
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 403 || response.status === 429) throw new HttpError(429, 'GITHUB_QUOTA', 'GitHub limitó la lectura pública. Espera antes de reintentar.');
      if (response.status === 404 || response.status === 409 || response.status === 422) throw new HttpError(404, 'GITHUB_NOT_FOUND', 'Repositorio público o revisión no disponible. Comprueba el enlace y la rama.');
      throw new HttpError(502, 'GITHUB_RESPONSE', 'GitHub no pudo completar la lectura.');
    }
    if (Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); throw new HttpError(413, 'GITHUB_SIZE', 'La respuesta de GitHub supera el límite de lectura.'); }
    const reader = response.body?.getReader();
    if (!reader) throw new HttpError(502, 'GITHUB_EMPTY', 'GitHub devolvió una respuesta vacía.');
    const chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > limit) throw new HttpError(413, 'GITHUB_SIZE', 'La respuesta de GitHub supera el límite de lectura.'); chunks.push(part.value); } }
    finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    return Buffer.concat(chunks, size);
  }
  private async json(path: string, limit: number, signal: AbortSignal) {
    try { return JSON.parse((await this.request(path, limit, signal)).toString('utf8')) as unknown; }
    catch (cause) { if (cause instanceof HttpError || signal.aborted) throw cause; throw new HttpError(502, 'GITHUB_JSON', 'GitHub devolvió metadatos inválidos.'); }
  }
  async pullRequest(url:string,signal:AbortSignal):Promise<PublicPullRequest>{
    const match=/^https:\/\/github\.com\/([A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+)\/pull\/([1-9][0-9]{0,8})\/?$/.exec(url);
    if(!match)throw new HttpError(400,'GITHUB_PR_URL','Usa https://github.com/organización/repositorio/pull/número.');
    const repository=repositoryName(`https://github.com/${match[1]}`),number=Number(match[2]);
    const side=z.object({sha,repo:z.object({full_name:z.string(),private:z.literal(false)})});
    const parsed=z.object({number:z.number().int(),title:z.string().max(500),state:z.string(),changed_files:z.number().int().nonnegative(),base:side,head:side}).safeParse(await this.json(`${repository}/pulls/${number}`,524288,signal));
    if(!parsed.success||parsed.data.number!==number||parsed.data.base.repo.full_name.toLowerCase()!==repository.toLowerCase())throw new HttpError(502,'GITHUB_PR_METADATA','No se confirmó un PR con repositorios públicos y revisiones disponibles.');
    const data=parsed.data,files=z.array(z.object({filename:z.string().max(300),status:z.string(),additions:z.number().int().nonnegative(),deletions:z.number().int().nonnegative()})).safeParse(await this.json(`${repository}/pulls/${number}/files?per_page=100`,2097152,signal));
    if(!files.success)throw new HttpError(502,'GITHUB_PR_FILES','No se pudo confirmar la lista de cambios del PR.');
    return{url:`https://github.com/${repository}/pull/${number}`,title:data.title.replace(/[\r\n]/g,' '),number,state:data.state,base:{repository,commit:data.base.sha},head:{repository:repositoryName(`https://github.com/${data.head.repo.full_name}`),commit:data.head.sha},changedFiles:data.changed_files,files:files.data.map(file=>({path:file.filename,status:file.status,additions:file.additions,deletions:file.deletions})),filesComplete:files.data.length===data.changed_files,scope:'head-files-only'};
  }
  async inspect(url: string, ref: string | undefined, signal: AbortSignal): Promise<RemoteTree> {
    const requested = repositoryName(url);
    const repo = z.object({ private: z.literal(false), full_name: z.string(), default_branch: z.string() }).safeParse(await this.json(requested, 65536, signal));
    if (!repo.success || repo.data.full_name.toLowerCase() !== requested.toLowerCase()) throw new HttpError(502, 'GITHUB_METADATA', 'No se confirmó un repositorio público con ese nombre.');
    const repository = repositoryName(`https://github.com/${repo.data.full_name}`), revision = ref || repo.data.default_branch;
    const commits = z.array(z.object({ sha, commit: z.object({ tree: z.object({ sha }) }) })).min(1).safeParse(await this.json(`${repository}/commits?${new URLSearchParams({ sha: revision, per_page: '1' })}`, 262144, signal));
    if (!commits.success) throw new HttpError(502, 'GITHUB_COMMIT', 'No se pudo fijar una revisión del repositorio.');
    const commit = commits.data[0]!;
    const parsed = treeSchema.safeParse(await this.json(`${repository}/git/trees/${commit.commit.tree.sha}?recursive=1`, 2097152, signal));
    if (!parsed.success) throw new HttpError(502, 'GITHUB_TREE', 'GitHub devolvió un árbol de archivos inválido.');
    const entries = parsed.data.tree.filter(item => item.type !== 'tree');
    const files = entries.slice(0, githubLimits.treeEntries).map(item => {
      const reason = item.size === undefined ? 'Tamaño no disponible' : exclusion(item.path, item.mode, item.size);
      return { path: item.path, sha: item.sha, size: item.size ?? 0, eligible: !reason, ...(reason ? { reason } : {}) };
    });
    return { repository, url: `https://github.com/${repository}`, ref: revision, commit: commit.sha, tree: commit.commit.tree.sha, files,
      listedFiles: files.length, incomplete: parsed.data.truncated, limited: entries.length > files.length };
  }
  async blob(repository: string, file: RemoteFile, signal: AbortSignal) {
    const bytes = await this.request(`${repository}/git/blobs/${file.sha}`, githubLimits.fileBytes, signal, true);
    const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (bytes.length !== file.size || hash !== file.sha) throw new HttpError(502, 'GITHUB_INTEGRITY', 'El contenido recibido no coincide con el archivo fijado.');
    return bytes;
  }
}
