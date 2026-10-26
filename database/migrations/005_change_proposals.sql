CREATE TABLE change_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    workspace_path TEXT NOT NULL,
    file_path TEXT NOT NULL,
    instruction TEXT NOT NULL,
    summary TEXT NOT NULL,
    before_content TEXT NOT NULL,
    after_content TEXT NOT NULL,
    before_hash TEXT NOT NULL,
    after_hash TEXT NOT NULL,
    patch TEXT NOT NULL,
    provider VARCHAR(20) NOT NULL CHECK (provider='openrouter'),
    model TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPLYING','APPLIED','REVERTING','REVERTED','REJECTED')),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id,request_id)
);
CREATE INDEX idx_proposals_project ON change_proposals (repository_id,created_at DESC,id);
CREATE INDEX idx_proposals_pending ON change_proposals (repository_id,status) WHERE status IN ('APPLYING','REVERTING');
