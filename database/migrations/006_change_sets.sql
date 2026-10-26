CREATE TABLE change_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  input_signature TEXT NOT NULL,
  workspace_path TEXT NOT NULL,
  instruction TEXT NOT NULL,
  summary TEXT NOT NULL,
  files JSONB NOT NULL CHECK (jsonb_typeof(files)='array' AND jsonb_array_length(files) BETWEEN 1 AND 5),
  approved_hash TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPLYING','APPLIED','REVERTING','REVERTED','REJECTED')),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(repository_id,request_id)
);
CREATE INDEX idx_change_sets_project ON change_sets(repository_id,created_at DESC);
