ALTER TABLE conversations ADD COLUMN repository_id UUID REFERENCES repositories(id) ON DELETE SET NULL;
CREATE INDEX idx_conversations_repository ON conversations (repository_id);
ALTER TABLE messages ADD COLUMN use_memory BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN memory_context JSONB;

ALTER TABLE knowledge_embeddings ADD COLUMN artifact_id UUID REFERENCES module_artifacts(id) ON DELETE CASCADE;
ALTER TABLE knowledge_embeddings ADD COLUMN chunk_number INTEGER CHECK (chunk_number >= 0);
ALTER TABLE knowledge_embeddings ADD COLUMN embedding_model TEXT;
ALTER TABLE knowledge_embeddings ADD COLUMN chunk_version INTEGER;
CREATE UNIQUE INDEX uq_artifact_embedding_chunk ON knowledge_embeddings (artifact_id, embedding_model, chunk_version, chunk_number);
CREATE INDEX idx_embeddings_artifact ON knowledge_embeddings (artifact_id);

CREATE TABLE artifact_memory (
    artifact_id UUID PRIMARY KEY REFERENCES module_artifacts(id) ON DELETE CASCADE,
    embedding_model TEXT NOT NULL,
    chunk_version INTEGER NOT NULL,
    chunk_count INTEGER NOT NULL CHECK (chunk_count > 0),
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
