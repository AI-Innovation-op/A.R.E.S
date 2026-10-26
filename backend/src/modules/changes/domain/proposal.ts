import { createTwoFilesPatch } from 'diff';
import { z } from 'zod';
import { HttpError } from '../../../shared/http-error.js';
import { hashText } from '../../workspace/infrastructure/local-files.js';
export type ProposalStatus = 'DRAFT' | 'APPLYING' | 'APPLIED' | 'REVERTING' | 'REVERTED' | 'REJECTED';
export interface ProposalInput { projectId: string; requestId: string; path: string; sha256: string; instruction: string }
export interface ProposalSummary { id: string; projectId: string; path: string; summary: string; provider: 'openrouter'; model: string; status: ProposalStatus; beforeHash: string; afterHash: string; createdAt: string; updatedAt: string; lastError: string | null }
export interface Proposal extends ProposalSummary { requestId: string; workspacePath: string; instruction: string; beforeContent: string; afterContent: string; patch: string }
export interface ProposalRepository {
  list(projectId: string): Promise<ProposalSummary[]>;
  read(projectId: string, id: string): Promise<Proposal>;
  previous(input: ProposalInput): Promise<Proposal | undefined>;
  create(proposal: Omit<Proposal, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'lastError'>): Promise<Proposal>;
  transition(projectId: string, id: string, from: ProposalStatus[], to: ProposalStatus, error?: string): Promise<Proposal>;
}
export function replacement(content: string, original: string) {
  const stripped = content.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '');
  let value: unknown; try { value = JSON.parse(stripped); } catch { throw new HttpError(502, 'INVALID_PROPOSAL', 'El modelo no devolvió una propuesta JSON completa. Reintenta con un cambio más pequeño.'); }
  const parsed = z.object({ summary: z.string().trim().min(1).max(1500), content: z.string().min(1).max(30000) }).strict().safeParse(value);
  if (!parsed.success) throw new HttpError(502, 'INVALID_PROPOSAL', 'La propuesta no contiene un resumen y archivo completos.');
  let result = parsed.data.content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (original.includes('\r\n')) result = result.replace(/\n/g, '\r\n');
  if (original.startsWith('\uFEFF')) result = '\uFEFF' + result;
  if (!result.trim() || result.includes('\0') || Buffer.from(result, 'utf8').toString('utf8') !== result || Buffer.byteLength(result, 'utf8') > 65536) throw new HttpError(502, 'INVALID_PROPOSAL', 'El archivo propuesto debe ser texto UTF-8 válido de hasta 64 KB.');
  if (result === original) throw new HttpError(422, 'NO_CHANGE', 'El modelo no propuso ningún cambio en el archivo.');
  return { summary: parsed.data.summary, content: result };
}
export function patchFor(path: string, before: string, after: string) {
  const patch = createTwoFilesPatch(`a/${path}`, `b/${path}`, before, after, 'original', 'propuesta', { context: 3, timeout: 250 });
  if (!patch) throw new HttpError(422, 'DIFF_TOO_LARGE', 'El cambio es demasiado extenso. Solicita una modificación más pequeña.');
  return { patch, beforeHash: hashText(before), afterHash: hashText(after) };
}
