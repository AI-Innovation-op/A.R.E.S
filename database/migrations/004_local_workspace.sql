ALTER TABLE repositories ADD COLUMN local_path TEXT;
ALTER TABLE repositories ADD COLUMN connected_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN requested_files JSONB NOT NULL DEFAULT '[]';
ALTER TABLE messages ADD COLUMN requested_runs JSONB NOT NULL DEFAULT '[]';
ALTER TABLE messages ADD COLUMN workspace_context JSONB;
CREATE TABLE tool_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commander_id UUID NOT NULL REFERENCES commanders(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    package_path TEXT NOT NULL,
    workspace_path TEXT NOT NULL,
    script VARCHAR(20) NOT NULL CHECK (script IN ('check','test','lint','build')),
    manifest_hash TEXT NOT NULL,
    command TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING','PASSED','FAILED','CANCELLED','TIMEOUT','INTERRUPTED')),
    output TEXT NOT NULL DEFAULT '',
    truncated BOOLEAN NOT NULL DEFAULT FALSE,
    exit_code INTEGER,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    UNIQUE (repository_id, request_id)
);
CREATE UNIQUE INDEX uq_tool_running_owner ON tool_runs (commander_id) WHERE status='RUNNING';
CREATE INDEX idx_tool_runs_project ON tool_runs (repository_id, started_at DESC, id);
