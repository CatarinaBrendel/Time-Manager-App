-- Pause intervals within a session
CREATE TABLE IF NOT EXISTS session_pauses (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL,
  started_at TEXT NOT NULL,     -- when user hits Pause
  ended_at   TEXT,              -- when user hits Resume; NULL while paused
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pauses_session ON session_pauses(session_id);
CREATE INDEX IF NOT EXISTS idx_pauses_open    ON session_pauses(session_id, ended_at);

-- Ensure only one open pause per session
CREATE TRIGGER IF NOT EXISTS trg_pauses_one_open
BEFORE INSERT ON session_pauses
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM session_pauses
  WHERE session_id = NEW.session_id AND ended_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'Pause already open for this session');
END;

-- Auto-close any open pause when the session ends
CREATE TRIGGER IF NOT EXISTS trg_session_end_closes_pauses
AFTER UPDATE OF ended_at ON sessions
FOR EACH ROW
WHEN NEW.ended_at IS NOT NULL
BEGIN
  UPDATE session_pauses
     SET ended_at = NEW.ended_at
   WHERE session_id = NEW.id AND ended_at IS NULL;
END;

-- (Optional) Guard: pause times should not start before session start
CREATE TRIGGER IF NOT EXISTS trg_pause_inside_session_start
BEFORE INSERT ON session_pauses
FOR EACH ROW
WHEN NEW.started_at < (SELECT started_at FROM sessions WHERE id = NEW.session_id)
BEGIN
  SELECT RAISE(ABORT, 'Pause starts before session start');
END;

-- ---------- Reporting helpers ----------

-- View that computes TOTAL, PAUSED, and EFFECTIVE time.
-- Works for both running and finished sessions:
--   end_ts = COALESCE(session.ended_at, datetime('now'))
--   open pause end = COALESCE(pause.ended_at, end_ts)
CREATE VIEW IF NOT EXISTS v_session_time AS
WITH session_bounds AS (
  SELECT
    s.id,
    s.task_id,
    s.kind,
    s.started_at,
    s.ended_at,
    -- 'now' for running sessions, otherwise ended_at
    COALESCE(s.ended_at, datetime('now')) AS end_ts,
    CAST(strftime('%s', COALESCE(s.ended_at, datetime('now'))) AS INTEGER) -
    CAST(strftime('%s', s.started_at) AS INTEGER) AS total_sec
  FROM sessions s
),
pause_agg AS (
  SELECT
    sp.session_id,
    SUM(
      MAX(
        0,
        CAST(strftime('%s', COALESCE(sp.ended_at, sb.end_ts)) AS INTEGER) -
        CAST(strftime('%s', sp.started_at) AS INTEGER)
      )
    ) AS paused_sec
  FROM session_pauses sp
  JOIN session_bounds sb ON sb.id = sp.session_id
  GROUP BY sp.session_id
)
SELECT
  sb.id,
  sb.task_id,
  sb.kind,
  sb.started_at,
  sb.ended_at,
  sb.total_sec,
  COALESCE(pa.paused_sec, 0) AS paused_sec,
  MAX(sb.total_sec - COALESCE(pa.paused_sec, 0), 0) AS effective_sec
FROM session_bounds sb
LEFT JOIN pause_agg pa ON pa.session_id = sb.id;

-- Per-task rollup (includes running sessions; filter by ended_at IS NOT NULL if you want only finished)
CREATE VIEW IF NOT EXISTS v_task_time AS
SELECT
  t.id   AS task_id,
  t.title,
  SUM(v.total_sec)     AS total_sec,
  SUM(v.paused_sec)    AS paused_sec,
  SUM(v.effective_sec) AS effective_sec
FROM tasks t
LEFT JOIN v_session_time v ON v.task_id = t.id
GROUP BY t.id, t.title;
