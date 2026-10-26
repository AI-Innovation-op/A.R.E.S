import { applyPatch, parsePatch } from 'diff';
import { z } from 'zod';
import { HttpError } from '../../../shared/http-error.js';
import { hashText } from '../../workspace/infrastructure/local-files.js';
import { patchFor, type ProposalStatus } from './proposal.js';
export interface ChangeFile { path: string; before: string | null; after: string; beforeHash: string | null; afterHash: string; patch: string }
export interface ChangeSet { id: string; projectId: string; requestId: string; inputSignature: string; workspacePath: string; instruction: string; summary: string; files: ChangeFile[]; approvedHash: string; model: string; status: ProposalStatus; lastError: string | null; createdAt: string; updatedAt: string }
export interface ChangeSetInput { projectId: string; requestId: string; instruction: string; files: { path: string; sha256: string | null }[] }
export function parseChangeSet(output: string, sources: { path: string; content: string | null }[]) {
  let value: unknown;
  try { value = JSON.parse(output.trim().replace(/^```(?:json)?\s*\n?/i,'').replace(/\n?```\s*$/,'')); } catch { throw new HttpError(502,'INVALID_CHANGE_SET','El modelo no devolvió JSON completo. Solicita un cambio más pequeño.'); }
  const parsed = z.object({ summary: z.string().trim().min(1).max(1500), files: z.array(z.object({ path: z.string(), patch: z.string().max(64000).optional(), content: z.string().max(64000).optional() }).strict()).min(1).max(5) }).strict().safeParse(value);
  if (!parsed.success || parsed.data.files.length !== sources.length || new Set(parsed.data.files.map(item => item.path)).size !== sources.length) throw new HttpError(502,'INVALID_CHANGE_SET','La respuesta debe cubrir exactamente los archivos seleccionados.');
  const files: ChangeFile[] = sources.map(source => {
    const proposed = parsed.data.files.find(item => item.path === source.path);
    if (!proposed || (source.content === null ? proposed.patch !== undefined || proposed.content === undefined : proposed.content !== undefined || proposed.patch === undefined)) throw new HttpError(502,'INVALID_CHANGE_SET','La propuesta contiene rutas u operaciones inesperadas.');
    let after: string | false;
    if (source.content === null) after = proposed.content!;
    else {
      try { const patches = parsePatch(proposed.patch!); if (patches.length !== 1 || patches[0]!.hunks.length === 0) throw new Error(); after = applyPatch(source.content,patches[0]!,{fuzzFactor:0,autoConvertLineEndings:true}); }
      catch { throw new HttpError(502,'INVALID_PATCH','El parche no es válido. No se guardó ningún cambio.'); }
    }
    if (after === false || !after.trim() || after.includes('\0') || Buffer.from(after).toString('utf8') !== after || Buffer.byteLength(after) > 65536 || after === source.content) throw new HttpError(502,'INVALID_PATCH','El parche no se puede aplicar al original o no contiene un cambio válido de hasta 64 KB.');
    const diff = patchFor(source.path,source.content ?? '',after);
    return { path: source.path, before: source.content, after, beforeHash: source.content === null ? null : diff.beforeHash, afterHash: diff.afterHash, patch: diff.patch };
  });
  return { summary: parsed.data.summary, files, approvedHash: hashText(JSON.stringify(files.map(({path,beforeHash,afterHash}) => ({path,beforeHash,afterHash})))) };
}
