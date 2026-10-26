import type { Pool, PoolClient } from 'pg';
import { CHUNK_VERSION, normalizedVector, type MemoryDocument, type MemoryReference, type MemoryRepository } from '../domain/memory.js';
import { HttpError } from '../../../shared/http-error.js';
export class PostgresMemory implements MemoryRepository {
  constructor(private readonly pool: Pool, private readonly commanderId: string) {}
  private async project(projectId: string) {
    const result = await this.pool.query<{ name: string }>('SELECT name FROM repositories WHERE id=$1 AND commander_id=$2', [projectId, this.commanderId]);
    if (!result.rows[0]) throw new HttpError(404, 'PROJECT_NOT_FOUND', 'No se encontró este proyecto.');
    return result.rows[0];
  }
  async status(projectId: string, model: string) {
    const project = await this.project(projectId);
    const result = await this.pool.query<{ documents: number; indexed: number }>(`SELECT count(*)::int AS documents, count(m.artifact_id)::int AS indexed
      FROM module_artifacts a LEFT JOIN artifact_memory m ON m.artifact_id=a.id AND m.embedding_model=$2 AND m.chunk_version=$3 WHERE a.repository_id=$1`, [projectId, model, CHUNK_VERSION]);
    const chunks = await this.pool.query<{ count: number }>('SELECT count(*)::int AS count FROM knowledge_embeddings WHERE repository_id=$1 AND embedding_model=$2 AND chunk_version=$3 AND artifact_id IS NOT NULL', [projectId, model, CHUNK_VERSION]);
    const row = result.rows[0]!;
    return { projectId, projectName: project.name, documents: row.documents, indexedDocuments: row.indexed, pendingDocuments: row.documents - row.indexed, chunks: chunks.rows[0]!.count, model };
  }
  async next(projectId: string, model: string): Promise<MemoryDocument | undefined> {
    await this.project(projectId);
    const result = await this.pool.query<{ id: string; title: string; content: string }>(`SELECT a.id,a.title,a.content FROM module_artifacts a
      LEFT JOIN artifact_memory m ON m.artifact_id=a.id AND m.embedding_model=$2 AND m.chunk_version=$3
      WHERE a.repository_id=$1 AND m.artifact_id IS NULL ORDER BY a.sequence_number LIMIT 1`, [projectId, model, CHUNK_VERSION]);
    const row = result.rows[0]; if (!row) return undefined;
    const existing = await this.pool.query<{ chunk_number: number }>('SELECT chunk_number FROM knowledge_embeddings WHERE artifact_id=$1 AND embedding_model=$2 AND chunk_version=$3', [row.id, model, CHUNK_VERSION]);
    return { ...row, projectId, completed: existing.rows.map(chunk => chunk.chunk_number) };
  }
  async save(document: MemoryDocument, model: string, chunks: { number: number; text: string; vector: number[] }[], total: number) {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const owned = await client.query<{ content: string }>(`SELECT a.content FROM module_artifacts a JOIN repositories r ON r.id=a.repository_id
        WHERE a.id=$1 AND a.repository_id=$2 AND r.commander_id=$3 FOR UPDATE OF a`, [document.id, document.projectId, this.commanderId]);
      if (!owned.rows[0] || owned.rows[0].content !== document.content) throw new HttpError(409, 'DOCUMENT_CHANGED', 'El documento cambió durante la indexación. Actualiza la biblioteca.');
      for (const chunk of chunks) {
        const vector = JSON.stringify(normalizedVector(chunk.vector));
        await client.query(`INSERT INTO knowledge_embeddings (repository_id,source_type,file_path,chunk_text,embedding,artifact_id,chunk_number,embedding_model,chunk_version)
          VALUES ($1,'DOC_SECTION',$2,$3,$4::vector,$5,$6,$7,$8)
          ON CONFLICT (artifact_id,embedding_model,chunk_version,chunk_number) DO NOTHING`, [document.projectId, document.title, chunk.text, vector, document.id, chunk.number, model, CHUNK_VERSION]);
      }
      const count = await client.query<{ count: number }>('SELECT count(*)::int AS count FROM knowledge_embeddings WHERE artifact_id=$1 AND embedding_model=$2 AND chunk_version=$3', [document.id, model, CHUNK_VERSION]);
      if (count.rows[0]!.count === total) await client.query(`INSERT INTO artifact_memory (artifact_id,embedding_model,chunk_version,chunk_count) VALUES ($1,$2,$3,$4)
        ON CONFLICT (artifact_id) DO UPDATE SET embedding_model=EXCLUDED.embedding_model,chunk_version=EXCLUDED.chunk_version,chunk_count=EXCLUDED.chunk_count,indexed_at=NOW()`, [document.id, model, CHUNK_VERSION, total]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
  }
  async search(projectId: string, model: string, vector: number[]): Promise<MemoryReference[]> {
    await this.project(projectId);
    // Búsqueda exacta tras filtrar el proyecto: evita perder vecinos por el filtro posterior de HNSW.
    const rows = await this.pool.query<{ artifact_id: string; title: string; chunk_text: string; chunk_number: number; similarity: number }>(`WITH scoped AS MATERIALIZED (
      SELECT k.*,a.title FROM knowledge_embeddings k JOIN module_artifacts a ON a.id=k.artifact_id
      JOIN repositories r ON r.id=a.repository_id JOIN artifact_memory m ON m.artifact_id=a.id
      WHERE k.repository_id=$1 AND a.repository_id=$1 AND r.commander_id=$2 AND k.embedding_model=$3 AND k.chunk_version=$4
      AND m.embedding_model=$3 AND m.chunk_version=$4 AND k.embedding IS NOT NULL)
      SELECT artifact_id,title,chunk_text,chunk_number,1-(embedding <=> $5::vector) AS similarity FROM scoped
      WHERE 1-(embedding <=> $5::vector)>=0.4 ORDER BY embedding <=> $5::vector,artifact_id,chunk_number LIMIT 4`, [projectId, this.commanderId, model, CHUNK_VERSION, JSON.stringify(normalizedVector(vector))]);
    return rows.rows.map((row, index) => ({ label: `D${index + 1}`, artifactId: row.artifact_id, title: row.title, excerpt: row.chunk_text, chunkNumber: row.chunk_number, similarity: Number(row.similarity) }));
  }
}
