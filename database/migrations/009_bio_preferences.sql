CREATE TABLE bio_preferences (
 commander_id UUID PRIMARY KEY REFERENCES commanders(id) ON DELETE CASCADE,
 enabled BOOLEAN NOT NULL DEFAULT FALSE,
 focus_minutes SMALLINT NOT NULL DEFAULT 25 CHECK(focus_minutes BETWEEN 1 AND 240),
 break_minutes SMALLINT NOT NULL DEFAULT 5 CHECK(break_minutes BETWEEN 1 AND 60),
 water_minutes SMALLINT NOT NULL DEFAULT 45 CHECK(water_minutes BETWEEN 5 AND 240),
 notifications BOOLEAN NOT NULL DEFAULT FALSE,
 phase TEXT NOT NULL DEFAULT 'IDLE' CHECK(phase IN('IDLE','FOCUS','BREAK','PAUSED_FOCUS','PAUSED_BREAK')),
 ends_at TIMESTAMPTZ,
 remaining_seconds INTEGER,
 water_at TIMESTAMPTZ,
 revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE bio_actions (
 commander_id UUID NOT NULL REFERENCES commanders(id) ON DELETE CASCADE,
 request_id UUID NOT NULL,
 action TEXT NOT NULL,
 revision INTEGER NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(commander_id,request_id)
);
CREATE INDEX idx_bio_actions_owner ON bio_actions(commander_id,created_at DESC);
