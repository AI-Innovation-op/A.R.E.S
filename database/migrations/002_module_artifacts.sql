-- Borradores generados por los módulos, conservados por proyecto.
CREATE TABLE module_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    sequence_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    module VARCHAR(30) NOT NULL CHECK (module IN ('documentation', 'audit', 'architecture')),
    format VARCHAR(80) NOT NULL,
    title VARCHAR(255) NOT NULL,
    input_context TEXT NOT NULL,
    content TEXT NOT NULL,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('gemini', 'openrouter')),
    model TEXT NOT NULL,
    sources JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status = 'DRAFT'),
    technical_document_id UUID REFERENCES technical_documents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, request_id)
);
CREATE INDEX idx_artifacts_project_sequence ON module_artifacts (repository_id, sequence_number DESC);
CREATE INDEX idx_artifacts_project_module_sequence ON module_artifacts (repository_id, module, sequence_number DESC);
