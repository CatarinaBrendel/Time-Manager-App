-- Time sessions (Pomodoro-friendly)
CREATE TABLE IF NOT EXISTS sessions (
  id          INTEGER PRIMARY KEY,
  task_id     INTEGER,                   -- required if kind='focus'
  user_id     INTEGER,                   -- optional for now; required later if multi-user
  kind        TEXT NOT NULL DEFAULT 'focus',  -- 'focus' | 'break'
  started_at  TEXT NOT NULL,
  ended_at    TEXT,                      -- null while running
  duration_sec INTEGER GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NOT NULL THEN
      CAST(strftime('%s', ended_at) AS INTEGER) - CAST(strftime('%s', started_at) AS INTEGER)
    ELSE NULL END
  ) VIRTUAL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
  CHECK (kind IN ('focus','break'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_task    ON sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_open    ON sessions(ended_at);

-- Pauses within a session (unchanged but with user_id for completeness)
CREATE TABLE IF NOT EXISTS session_pauses (
  id          INTEGER PRIMARY KEY,
  session_id  INTEGER NOT NULL,
  started_at  TEXT NOT NULL,
  ended_at    TEXT,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pauses_session ON session_pauses(session_id);
CREATE INDEX IF NOT EXISTS idx_pauses_open    ON session_pauses(session_id, ended_at);

-- Ensure only one OPEN pause per session (you already have this)
CREATE TRIGGER IF NOT EXISTS trg_pauses_one_open
BEFORE INSERT ON session_pauses
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM session_pauses WHERE session_id = NEW.session_id AND ended_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'Pause already open for this session');
END;

-- Auto-close any open pause when the session ends (you already have this)
CREATE TRIGGER IF NOT EXISTS trg_session_end_closes_pauses
AFTER UPDATE OF ended_at ON sessions
FOR EACH ROW
WHEN NEW.ended_at IS NOT NULL
BEGIN
  UPDATE session_pauses
     SET ended_at = NEW.ended_at
   WHERE session_id = NEW.id AND ended_at IS NULL;
END;

-- Pause cannot start before session start (already present)
CREATE TRIGGER IF NOT EXISTS trg_pause_inside_session_start
BEFORE INSERT ON session_pauses
FOR EACH ROW
WHEN NEW.started_at < (SELECT started_at FROM sessions WHERE id = NEW.session_id)
BEGIN
  SELECT RAISE(ABORT, 'Pause starts before session start');
END;

-- NEW: focus sessions must have a task
CREATE TRIGGER IF NOT EXISTS trg_focus_requires_task
BEFORE INSERT ON sessions
FOR EACH ROW
WHEN NEW.kind = 'focus' AND NEW.task_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Focus session requires a task_id');
END;

-- NEW: only 1 open focus session per user (or globally if user_id is NULL)
-- If you’re single-user for now, this still works with user_id NULL by scoping to NULL.
CREATE TRIGGER IF NOT EXISTS trg_single_open_focus_session
BEFORE INSERT ON sessions
FOR EACH ROW
WHEN NEW.kind = 'focus' AND NEW.ended_at IS NULL AND EXISTS (
  SELECT 1 FROM sessions
   WHERE kind = 'focus'
     AND ended_at IS NULL
     AND COALESCE(user_id, -1) = COALESCE(NEW.user_id, -1)
)
BEGIN
  SELECT RAISE(ABORT, 'Another focus session is already running');
END;
