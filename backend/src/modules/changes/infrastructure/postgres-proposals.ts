import type { Pool, QueryResultRow } from 'pg';
import type { Proposal, ProposalInput, ProposalRepository, ProposalStatus, ProposalSummary } from '../domain/proposal.js';
import { HttpError } from '../../../shared/http-error.js';
interface Row extends QueryResultRow { id: string; repository_id: string; request_id: string; workspace_path: string; file_path: string; instruction: string; summary: string; before_content: string; after_content: string; before_hash: string; after_hash: string; patch: string; provider: 'openrouter'; model: string; status: ProposalStatus; last_error: string | null; created_at: Date; updated_at: Date }
function summary(row: Row): ProposalSummary { return { id: row.id, projectId: row.repository_id, path: row.file_path, summary: row.summary, provider: row.provider, model: row.model, status: row.status, beforeHash: row.before_hash, afterHash: row.after_hash, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), lastError: row.last_error }; }
function proposal(row: Row): Proposal { return { ...summary(row), requestId: row.request_id, workspacePath: row.workspace_path, instruction: row.instruction, beforeContent: row.before_content, afterContent: row.after_content, patch: row.patch }; }
export class PostgresProposals implements ProposalRepository {
  constructor(private readonly pool: Pool, private readonly owner: string) {}
  private async owned(projectId: string) {
    if (!(await this.pool.query('SELECT 1 FROM repositories WHERE id=$1 AND commander_id=$2', [projectId, this.owner])).rows.length) throw new HttpError(404, 'PROJECT_NOT_FOUND', 'No se encontró este proyecto.');
  }
  async list(projectId: string) {
    await this.owned(projectId);
    const result = await this.pool.query<Row>(`SELECT p.id,p.repository_id,p.file_path,p.summary,p.provider,p.model,p.status,p.before_hash,p.after_hash,p.created_at,p.updated_at,p.last_error
      FROM change_proposals p JOIN repositories r ON r.id=p.repository_id WHERE p.repository_id=$1 AND r.commander_id=$2 ORDER BY (p.status IN ('APPLYING','REVERTING')) DESC,p.created_at DESC,p.id LIMIT 30`, [projectId, this.owner]);
    return result.rows.map(summary);
  }
  async read(projectId: string, id: string) {
    const result = await this.pool.query<Row>('SELECT p.* FROM change_proposals p JOIN repositories r ON r.id=p.repository_id WHERE p.id=$1 AND p.repository_id=$2 AND r.commander_id=$3', [id, projectId, this.owner]);
    if (!result.rows[0]) throw new HttpError(404, 'PROPOSAL_NOT_FOUND', 'No se encontró esta propuesta.');
    return proposal(result.rows[0]);
  }
  async previous(input: ProposalInput) {
    await this.owned(input.projectId);
    const result = await this.pool.query<Row>('SELECT * FROM change_proposals WHERE repository_id=$1 AND request_id=$2', [input.projectId, input.requestId]);
    if (!result.rows[0]) return;
    const saved = proposal(result.rows[0]);
    if (saved.path !== input.path || saved.beforeHash !== input.sha256 || saved.instruction !== input.instruction) throw new HttpError(409, 'REQUEST_MISMATCH', 'Este identificador ya se usó para otra propuesta.');
    return saved;
  }
  async create(value: Omit<Proposal, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'lastError'>) {
    await this.owned(value.projectId);
    const result = await this.pool.query<Row>(`INSERT INTO change_proposals (repository_id,request_id,workspace_path,file_path,instruction,summary,before_content,after_content,before_hash,after_hash,patch,provider,model)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (repository_id,request_id) DO NOTHING RETURNING *`, [value.projectId, value.requestId, value.workspacePath, value.path, value.instruction, value.summary, value.beforeContent, value.afterContent, value.beforeHash, value.afterHash, value.patch, value.provider, value.model]);
    if (result.rows[0]) return proposal(result.rows[0]);
    return (await this.previous({ projectId: value.projectId, requestId: value.requestId, path: value.path, instruction: value.instruction, sha256: value.beforeHash }))!;
  }
  async transition(projectId: string, id: string, from: ProposalStatus[], to: ProposalStatus, error?: string) {
    await this.owned(projectId);
    const result = await this.pool.query<Row>(`UPDATE change_proposals SET status=$1,last_error=$2,updated_at=NOW() WHERE id=$3 AND repository_id=$4 AND status=ANY($5::text[]) RETURNING *`, [to, error ?? null, id, projectId, from]);
    if (!result.rows[0]) throw new HttpError(409, 'PROPOSAL_STATE_CHANGED', 'La propuesta cambió de estado. Actualiza antes de continuar.');
    return proposal(result.rows[0]);
  }
}
