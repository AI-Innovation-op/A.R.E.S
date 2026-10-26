-- Evolución aditiva: conserva todas las tablas y mensajes existentes.
ALTER TABLE conversations ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0);
ALTER TABLE conversations ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE messages ADD COLUMN sequence_number BIGINT GENERATED ALWAYS AS IDENTITY;
ALTER TABLE messages ADD COLUMN request_id UUID;
ALTER TABLE messages ADD COLUMN task VARCHAR(20) CHECK (task IN ('programming', 'documentation', 'audit', 'architecture'));
ALTER TABLE messages ADD COLUMN provider VARCHAR(12) CHECK (provider IN ('gemini', 'openrouter'));
ALTER TABLE messages ADD COLUMN model TEXT;
CREATE UNIQUE INDEX uq_messages_sequence ON messages (sequence_number);
CREATE UNIQUE INDEX uq_messages_request_role ON messages (conversation_id, request_id, role) WHERE request_id IS NOT NULL;
CREATE INDEX idx_messages_conversation_sequence ON messages (conversation_id, sequence_number DESC);
CREATE INDEX idx_conversations_commander_updated ON conversations (commander_id, updated_at DESC, id);
