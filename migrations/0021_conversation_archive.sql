-- Per-user archive state for direct and future group conversations.
ALTER TABLE conversation_members ADD COLUMN archived_at INTEGER;
CREATE INDEX conversation_members_archive ON conversation_members(user_id, archived_at, conversation_id);
