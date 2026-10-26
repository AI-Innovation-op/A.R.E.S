import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { ChatReply, Message } from '../domain/chat.js';
import type { Conversation, HistoryRepository, StoredMessage, SavedTurn, TurnInput } from '../domain/history.js';
import { HttpError } from '../../../shared/http-error.js';

interface ConversationRow extends QueryResultRow { id: string; title: string | null; revision: number; created_at: Date; updated_at: Date; repository_id: string | null }
interface MessageRow extends QueryResultRow {
  id: string; sequence_number: string; created_at: Date; role: 'user' | 'model'; content: string;
  sources: StoredMessage['sources']; provider: StoredMessage['provider'] | null; model: string | null;
  task: StoredMessage['task'] | null; pose_number: number | null; request_id: string | null;
  use_memory: boolean; memory_context: ChatReply['memory'] | null;
  requested_files: NonNullable<TurnInput['files']>; requested_runs: string[]; workspace_context: ChatReply['workspace'] | null;
}
function conversation(row: ConversationRow): Conversation {
  return { id: row.id, title: row.title ?? 'Conversación', revision: row.revision, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), ...(row.repository_id ? { projectId: row.repository_id } : {}) };
}
function message(row: MessageRow): StoredMessage {
  return { id: row.id, sequence: Number(row.sequence_number), createdAt: row.created_at.toISOString(), role: row.role, content: row.content,
    sources: row.sources ?? [], ...(row.provider ? { provider: row.provider } : {}), ...(row.model ? { model: row.model } : {}),
    ...(row.task ? { task: row.task } : {}), ...(row.pose_number ? { poseNumber: row.pose_number } : {}),
    ...(row.memory_context ? { memory: row.memory_context } : {}), ...(row.use_memory ? { useMemory: true } : {}),
    ...(row.workspace_context ? { workspace: row.workspace_context } : {}),
  };
}

export class PostgresHistory implements HistoryRepository {
  constructor(private readonly pool: Pool, private readonly commanderId: string) {}
  private async owner() { await this.pool.query('INSERT INTO commanders (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [this.commanderId]); }
  private async find(client: Pool | PoolClient, id: string) {
    const result = await client.query<ConversationRow>('SELECT * FROM conversations WHERE id=$1 AND commander_id=$2', [id, this.commanderId]);
    if (!result.rows[0]) throw new HttpError(404, 'CONVERSATION_NOT_FOUND', 'No se encontró esta conversación.');
    return result.rows[0];
  }
  async list() {
    await this.owner();
    const result = await this.pool.query<ConversationRow>('SELECT * FROM conversations WHERE commander_id=$1 ORDER BY updated_at DESC,id LIMIT 100', [this.commanderId]);
    return result.rows.map(conversation);
  }
  async create(title: string, projectId?: string) {
    await this.owner();
    const result = await this.pool.query<ConversationRow>(`INSERT INTO conversations (commander_id,title,repository_id)
      SELECT $1,$2,$3::uuid WHERE $3::uuid IS NULL OR EXISTS (SELECT 1 FROM repositories WHERE id=$3 AND commander_id=$1) RETURNING *`, [this.commanderId, title, projectId ?? null]);
    if (!result.rows[0]) throw new HttpError(404, 'PROJECT_NOT_FOUND', 'No se encontró este proyecto.');
    return conversation(result.rows[0]!);
  }
  async read(id: string, before?: number) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const found = await this.find(client, id);
      const result = await client.query<MessageRow>('SELECT * FROM messages WHERE conversation_id=$1 AND ($2::bigint IS NULL OR sequence_number<$2) ORDER BY sequence_number DESC LIMIT 101', [id, before ?? null]);
      await client.query('COMMIT');
      return { conversation: conversation(found), hasMore: result.rows.length > 100, messages: result.rows.slice(0, 100).reverse().map(message) };
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
  }
  async prepare(input: TurnInput) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const found = await this.find(client, input.conversationId);
      const previous = await client.query<MessageRow>('SELECT * FROM messages WHERE conversation_id=$1 AND request_id=$2 ORDER BY sequence_number', [input.conversationId, input.requestId]);
      const user = previous.rows.find(row => row.role === 'user');
      const model = previous.rows.find(row => row.role === 'model');
      if (user && (user.content !== input.message || user.task !== input.task || user.use_memory !== !!input.useMemory || JSON.stringify(user.requested_files.map(file => [file.path, file.sha256])) !== JSON.stringify((input.files ?? []).map(file => [file.path, file.sha256])) || JSON.stringify(user.requested_runs) !== JSON.stringify(input.runIds ?? []))) throw new HttpError(409, 'REQUEST_MISMATCH', 'Este identificador de envío ya se usó para otro mensaje.');
      const context = await client.query<MessageRow>('SELECT * FROM messages WHERE conversation_id=$1 ORDER BY sequence_number DESC LIMIT 16', [input.conversationId]);
      await client.query('COMMIT');
      const existing: SavedTurn | undefined = user && model ? { content: model.content, sources: model.sources, ...(model.provider ? { provider: model.provider } : {}), ...(model.model ? { model: model.model } : {}), ...(model.memory_context ? { memory: model.memory_context } : {}), ...(model.workspace_context ? { workspace: model.workspace_context } : {}), conversationId: found.id, revision: found.revision, messages: previous.rows.map(message) } : undefined;
      return { conversation: conversation(found), history: context.rows.reverse().map(row => ({ role: row.role, content: row.content })), existing };
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
  }
  async commit(input: TurnInput, reply: ChatReply): Promise<SavedTurn> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query<ConversationRow>(`UPDATE conversations SET revision=revision+1, updated_at=NOW(),
        title=CASE WHEN revision=0 AND title='Nueva conversación' THEN $4 ELSE title END
        WHERE id=$1 AND commander_id=$2 AND revision=$3 RETURNING *`, [input.conversationId, this.commanderId, input.revision, input.message.slice(0, 80)]);
      if (!updated.rows[0]) throw new HttpError(409, 'CONVERSATION_CHANGED', 'La conversación cambió durante la generación. Vuelve a abrirla.');
      const poseMatch = reply.content.match(/^\[[^\r\n]*?\bPOSE\s+(\d{1,2}):/u);
      const pose = Number(poseMatch?.[1]);
      const user = await client.query<MessageRow>(`INSERT INTO messages (conversation_id,role,content,request_id,task,use_memory,requested_files,requested_runs) VALUES ($1,'user',$2,$3,$4,$5,$6::jsonb,$7::jsonb) RETURNING *`, [input.conversationId, input.message, input.requestId, input.task, !!input.useMemory, JSON.stringify(input.files ?? []), JSON.stringify(input.runIds ?? [])]);
      const model = await client.query<MessageRow>(`INSERT INTO messages (conversation_id,role,content,sources,pose_number,request_id,task,provider,model,memory_context,workspace_context)
        VALUES ($1,'model',$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb) RETURNING *`, [input.conversationId, reply.content, JSON.stringify(reply.sources), pose >= 1 && pose <= 16 ? pose : null, input.requestId, input.task, reply.provider ?? null, reply.model ?? null, reply.memory ? JSON.stringify(reply.memory) : null, reply.workspace ? JSON.stringify(reply.workspace) : null]);
      await client.query('COMMIT');
      return { ...reply, conversationId: input.conversationId, revision: updated.rows[0].revision, messages: [message(user.rows[0]!), message(model.rows[0]!)] };
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
  }
}
