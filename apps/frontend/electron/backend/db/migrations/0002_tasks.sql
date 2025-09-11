-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id            INTEGER PRIMARY KEY,
  project_id    INTEGER,
  title         TEXT NOT NULL,
  description   TEXT DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'todo',  -- todo|in progress|done|archived
  priority_id   INTEGER,                        -- FK to priorities
  eta_sec       INTEGER,                        -- nullable; estimated effort in seconds
  due_at        TEXT,                           -- ISO8601 or NULL
  started_at    TEXT,                           -- first time user started working on it (nullable)
  ended_at      TEXT,                           -- when the task was completed/closed (nullable)
  created_by    INTEGER,                        -- FK users.id (nullable for now)
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at   TEXT,                           -- null unless status=archived
  FOREIGN KEY(project_id)  REFERENCES projects(id)   ON DELETE SET NULL,
  FOREIGN KEY(priority_id) REFERENCES priorities(id) ON DELETE SET NULL,
  FOREIGN KEY(created_by)  REFERENCES users(id)      ON DELETE SET NULL,
  CHECK (status IN ('todo','in progres','done','archived'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_project   ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status    ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due       ON tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_priority  ON tasks(priority_id);

-- Many-to-many: tasks <-> tags
CREATE TABLE IF NOT EXISTS task_tags (
  task_id INTEGER NOT NULL,
  tag_id  INTEGER NOT NULL,
  PRIMARY KEY (task_id, tag_id),
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
);

-- Notes / observations as a separate table (audit-friendly)
CREATE TABLE IF NOT EXISTS task_notes (
  id         INTEGER PRIMARY KEY,
  task_id    INTEGER NOT NULL,
  user_id    INTEGER,
  body       TEXT NOT NULL,                     -- markdown/plaintext
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id)  ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_task_notes_task ON task_notes(task_id);

-- Optional: event log for history (title/priority/status/due changes)
CREATE TABLE IF NOT EXISTS task_events (
  id          INTEGER PRIMARY KEY,
  task_id     INTEGER NOT NULL,
  user_id     INTEGER,
  event_type  TEXT NOT NULL,                   -- 'created','title_changed','status_changed', etc.
  payload_json TEXT NOT NULL DEFAULT '{}',     -- old/new values
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id)  ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id);
