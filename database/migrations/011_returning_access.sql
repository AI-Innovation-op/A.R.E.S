ALTER TABLE access_invites ADD COLUMN user_id UUID REFERENCES access_users(id) ON DELETE CASCADE;
CREATE INDEX access_invites_user ON access_invites(user_id);
