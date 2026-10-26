CREATE TABLE code_memory_files (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
 workspace_path TEXT NOT NULL,
 file_path TEXT NOT NULL,
 source_hash TEXT NOT NULL,
 content TEXT NOT NULL,
 embedding_model TEXT NOT NULL,
 chunk_count INTEGER NOT NULL CHECK(chunk_count>0),
 indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(repository_id,file_path)
);
CREATE INDEX idx_code_memory_project ON code_memory_files(repository_id);
CREATE TABLE code_memory_chunks (
 file_id UUID NOT NULL REFERENCES code_memory_files(id) ON DELETE CASCADE,
 chunk_number INTEGER NOT NULL,
 chunk_text TEXT NOT NULL,
 embedding VECTOR(768) NOT NULL,
 PRIMARY KEY(file_id,chunk_number)
);
