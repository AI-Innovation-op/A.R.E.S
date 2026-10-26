ALTER TABLE module_artifacts DROP CONSTRAINT module_artifacts_status_check;
ALTER TABLE module_artifacts ADD CONSTRAINT module_artifacts_status_check CHECK (status IN ('DRAFT','APPROVED'));
ALTER TABLE module_artifacts ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE module_artifacts ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE TABLE artifact_revisions (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 artifact_id UUID NOT NULL REFERENCES module_artifacts(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL,
 title TEXT NOT NULL,
 content TEXT NOT NULL,
 status TEXT NOT NULL,
 saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(artifact_id,revision)
);
