CREATE TABLE IF NOT EXISTS studio_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS studio_flows (
  id TEXT PRIMARY KEY, binding TEXT NOT NULL, kind TEXT NOT NULL,
  payload TEXT NOT NULL, expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS studio_sessions (
  id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, login TEXT NOT NULL,
  token TEXT NOT NULL, csrf TEXT NOT NULL, expires INTEGER NOT NULL, touched INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS studio_sessions_expiry ON studio_sessions(expires);
CREATE INDEX IF NOT EXISTS studio_flows_expiry ON studio_flows(expires);
