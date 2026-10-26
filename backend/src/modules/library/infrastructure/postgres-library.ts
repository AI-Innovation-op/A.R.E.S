import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { ChatReply, Provider } from '../../chat/domain/chat.js';
import { documentType, type Artifact, type ArtifactInput, type ArtifactSummary, type LibraryRepository, type ModuleId, type Project } from '../domain/library.js';
import { HttpError } from '../../../shared/http-error.js';

interface ProjectRow extends QueryResultRow { id: string; name: string; created_at: Date }
interface ArtifactRow extends QueryResultRow {
  id: string; repository_id: string; sequence_number: string; module: ModuleId; format: string; title: string;
  provider: Provider; model: string; status: 'DRAFT'|'APPROVED'; revision:number;updated_at:Date;created_at: Date; technical_document_id: string | null;
  input_context: string; content: string; sources: ChatReply['sources'];
}
const project = (row: ProjectRow): Project => ({ id: row.id, name: row.name, createdAt: row.created_at.toISOString() });
const summaryColumns = 'a.id,a.repository_id,a.sequence_number,a.module,a.format,a.title,a.provider,a.model,a.status,a.created_at,a.technical_document_id,a.revision,a.updated_at';
function summary(row: ArtifactRow): ArtifactSummary {
  return { id: row.id, projectId: row.repository_id, sequence: Number(row.sequence_number), module: row.module, format: row.format, title: row.title,
    provider: row.provider, model: row.model, status: row.status, revision:row.revision,updatedAt:row.updated_at.toISOString(),createdAt: row.created_at.toISOString(), ...(row.technical_document_id ? { technicalDocumentId: row.technical_document_id } : {}) };
}
const artifact = (row: ArtifactRow): Artifact => ({ ...summary(row), context: row.input_context, content: row.content, sources: row.sources });
function sameInput(saved: Artifact, input: ArtifactInput) {
  if (saved.module !== input.module || saved.format !== input.format || saved.title !== input.title || saved.context !== input.context) {
    throw new HttpError(409, 'REQUEST_MISMATCH', 'Este identificador de envío ya se usó para otro borrador.');
  }
  return saved;
}
export class PostgresLibrary implements LibraryRepository {
  constructor(private readonly pool: Pool, private readonly commanderId: string) {}
  private async findProject(client: Pool | PoolClient, id: string, lock = false) {
    const result = await client.query<ProjectRow>(`SELECT * FROM repositories WHERE id=$1 AND commander_id=$2${lock ? ' FOR UPDATE' : ''}`, [id, this.commanderId]);
    if (!result.rows[0]) throw new HttpError(404, 'PROJECT_NOT_FOUND', 'No se encontró este proyecto.');
    return result.rows[0];
  }
  async projects() {
    const result = await this.pool.query<ProjectRow>('SELECT id,name,created_at FROM repositories WHERE commander_id=$1 ORDER BY created_at,id', [this.commanderId]);
    return result.rows.map(project);
  }
  async createProject(name: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO commanders (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [this.commanderId]);
      const result = await client.query<ProjectRow>('INSERT INTO repositories (commander_id,name) VALUES ($1,$2) RETURNING id,name,created_at', [this.commanderId, name]);
      await client.query('COMMIT'); return project(result.rows[0]!);
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
  }
  async list(projectId: string, module?: ModuleId, before?: number) {
    await this.findProject(this.pool, projectId);
    const result = await this.pool.query<ArtifactRow>(`SELECT ${summaryColumns} FROM module_artifacts a
      JOIN repositories r ON r.id=a.repository_id WHERE a.repository_id=$1 AND r.commander_id=$2
      AND ($3::text IS NULL OR a.module=$3) AND ($4::bigint IS NULL OR a.sequence_number<$4)
      ORDER BY a.sequence_number DESC LIMIT 26`, [projectId, this.commanderId, module ?? null, before ?? null]);
    return { artifacts: result.rows.slice(0, 25).map(summary), hasMore: result.rows.length > 25 };
  }
  async read(id: string) {
    const result = await this.pool.query<ArtifactRow>('SELECT a.* FROM module_artifacts a JOIN repositories r ON r.id=a.repository_id WHERE a.id=$1 AND r.commander_id=$2', [id, this.commanderId]);
    if (!result.rows[0]) throw new HttpError(404, 'ARTIFACT_NOT_FOUND', 'No se encontró este borrador.');
    return artifact(result.rows[0]);
  }
  private async previous(client: Pool | PoolClient, input: ArtifactInput) {
    const result = await client.query<ArtifactRow>(`SELECT a.* FROM module_artifacts a JOIN repositories r ON r.id=a.repository_id
      WHERE a.repository_id=$1 AND a.request_id=$2 AND r.commander_id=$3`, [input.projectId, input.requestId, this.commanderId]);
    return result.rows[0] ? sameInput(artifact(result.rows[0]), input) : undefined;
  }
  async prepare(input: ArtifactInput) {
    await this.findProject(this.pool, input.projectId);
    return this.previous(this.pool, input);
  }
  async commit(input: ArtifactInput, reply: ChatReply & { provider: Provider; model: string }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Serializa solo el guardado y la numeración ADR; nunca mantiene una transacción durante la llamada IA.
      await this.findProject(client, input.projectId, true);
      const existing = await this.previous(client, input);
      if (existing) { await client.query('COMMIT'); return existing; }
      let documentId: string | null = null;
      const type = documentType(input);
      if (type) {
        const number = type === 'ADR' ? (await client.query<{ next: number }>("SELECT COALESCE(MAX(adr_number),0)+1 AS next FROM technical_documents WHERE repository_id=$1 AND doc_type='ADR'", [input.projectId])).rows[0]!.next : null;
        const document = await client.query<{ id: string }>(`INSERT INTO technical_documents (repository_id,doc_type,adr_number,title,markdown_content,status)
          VALUES ($1,$2,$3,$4,$5,'DRAFT') RETURNING id`, [input.projectId, type, number, input.title, reply.content]);
        documentId = document.rows[0]!.id;
      }
      const result = await client.query<ArtifactRow>(`INSERT INTO module_artifacts
        (repository_id,request_id,module,format,title,input_context,content,provider,model,sources,technical_document_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11) RETURNING *`,
        [input.projectId, input.requestId, input.module, input.format, input.title, input.context, reply.content, reply.provider, reply.model, JSON.stringify(reply.sources), documentId]);
      await client.query('COMMIT'); return artifact(result.rows[0]!);
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
  }
}
