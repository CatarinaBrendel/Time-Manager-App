-- Pomodoro / time sessions
CREATE TABLE IF NOT EXISTS sessions (
id INTEGER PRIMARY KEY,
task_id INTEGER,
kind TEXT NOT NULL DEFAULT 'focus', -- focus | break
started_at TEXT NOT NULL,
ended_at TEXT, -- nullable while running
duration_sec INTEGER GENERATED ALWAYS AS (
CASE WHEN ended_at IS NOT NULL THEN
CAST(strftime('%s', ended_at) AS INTEGER) - CAST(strftime('%s', started_at) AS INTEGER)
ELSE NULL END
) VIRTUAL,
FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_task ON sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);