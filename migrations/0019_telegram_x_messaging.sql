-- Telegram X Hero messaging foundation.
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'direct' CHECK (kind IN ('direct','group','channel')),
  title TEXT,
  photo_url TEXT,
  pair_key TEXT UNIQUE,
  created_by INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE conversation_members (
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at INTEGER NOT NULL,
  last_read_message_id INTEGER,
  muted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (conversation_id, user_id)
) WITHOUT ROWID;
CREATE INDEX conversation_members_user ON conversation_members(user_id, conversation_id);
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL DEFAULT '',
  media_type TEXT,
  media_url TEXT,
  media_name TEXT,
  reply_to_id INTEGER REFERENCES messages(id),
  edited_at INTEGER,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX messages_conversation ON messages(conversation_id, id DESC);
CREATE TABLE contacts (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, contact_user_id),
  CHECK (user_id <> contact_user_id)
) WITHOUT ROWID;
CREATE TABLE user_blocks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, blocked_user_id),
  CHECK (user_id <> blocked_user_id)
) WITHOUT ROWID;
CREATE TABLE message_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id),
  message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  reported_user_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by INTEGER
);
CREATE INDEX message_reports_status ON message_reports(status, id DESC);
CREATE TABLE typing_status (
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (conversation_id, user_id)
) WITHOUT ROWID;
CREATE INDEX typing_status_expiry ON typing_status(expires_at);
