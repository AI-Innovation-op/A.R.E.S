CREATE TABLE access_users (
 id UUID PRIMARY KEY REFERENCES commanders(id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 role TEXT NOT NULL CHECK(role IN ('admin','editor','viewer')),
 disabled BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE access_invites (
 hash TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('admin','editor','viewer')),
 created_by UUID NOT NULL REFERENCES access_users(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL, redeemed_at TIMESTAMPTZ
);
CREATE TABLE access_sessions (
 hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES access_users(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX access_sessions_user ON access_sessions(user_id);
CREATE TABLE usage_policy (
 id BOOLEAN PRIMARY KEY DEFAULT true CHECK(id), daily_calls INTEGER NOT NULL DEFAULT 500 CHECK(daily_calls BETWEEN 1 AND 10000),
 user_calls INTEGER NOT NULL DEFAULT 200 CHECK(user_calls BETWEEN 1 AND 10000),
 daily_bytes BIGINT NOT NULL DEFAULT 2000000 CHECK(daily_bytes BETWEEN 1000 AND 100000000),
 concurrency INTEGER NOT NULL DEFAULT 2 CHECK(concurrency BETWEEN 1 AND 10)
);
INSERT INTO usage_policy(id) VALUES(true);
CREATE TABLE usage_requests (
 id UUID PRIMARY KEY, actor UUID NOT NULL, provider TEXT NOT NULL, kind TEXT NOT NULL,
 input_bytes INTEGER NOT NULL CHECK(input_bytes>=0), started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 finished_at TIMESTAMPTZ, status TEXT NOT NULL CHECK(status IN ('running','success','failed'))
);
CREATE INDEX usage_requests_day_actor ON usage_requests(started_at,actor);
