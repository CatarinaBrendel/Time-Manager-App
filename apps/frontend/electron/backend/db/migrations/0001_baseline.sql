PRAGMA foreign_keys = ON;

-- =========================================
-- Time Manager — Baseline Schema (v2)
-- Adds: tasks.is_archived, app_settings, clock_events
-- All rollups exclude archived tasks.
-- Timestamps are ISO-8601 UTC 'Z' normalized via triggers.
-- =========================================

-- ========= CORE REFERENCE =========
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS priorities;
DROP TABLE IF EXISTS tags;

CREATE TABLE companies (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE projects (
  id          INTEGER PRIMARY KEY,
  company_id  INTEGER,
  name        TEXT NOT NULL UNIQUE,
  FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE SET NULL
);

CREATE TABLE priorities (
  id     INTEGER PRIMARY KEY,
  label  TEXT NOT NULL UNIQUE,   -- low|medium|high|urgent
  weight INTEGER NOT NULL        -- 1..4 (bigger = higher)
);

CREATE TABLE tags (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- ========= SETTINGS (user-configurable, single row id=1) =========
DROP TABLE IF EXISTS app_settings;
CREATE TABLE app_settings (
  id              INTEGER PRIMARY KEY CHECK (id=1),
  timezone        TEXT NOT NULL DEFAULT 'Europe/Berlin',
  idle_mode       TEXT NOT NULL DEFAULT 'fixed',      -- 'auto' | 'fixed' | 'clocked'
  work_start      TEXT NOT NULL DEFAULT '08:00',      -- 'HH:MM' (local)
  work_end        TEXT NOT NULL DEFAULT '17:00',      -- 'HH:MM' (local)
  idle_grace_min  INTEGER NOT NULL DEFAULT 0,         -- e.g., 10
  strict_day_pauses INTEGER NOT NULL DEFAULT 0,       -- 1: only count pauses fully inside day window
  CHECK (idle_mode IN ('auto','fixed','clocked')),
  CHECK (idle_grace_min >= 0),
  CHECK (strict_day_pauses IN (0,1))
);
INSERT OR IGNORE INTO app_settings(id) VALUES (1);

-- ========= OPTIONAL CLOCK EVENTS (future-proof) =========
DROP TABLE IF EXISTS clock_events;
CREATE TABLE clock_events (
  id   INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('in','out')),
  at   TEXT NOT NULL               -- ISO8601 UTC Z
);
CREATE INDEX IF NOT EXISTS idx_clock_events_at ON clock_events(at);

-- ========= TASKS & TAGS =========
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS task_tags;

CREATE TABLE tasks (
  id            INTEGER PRIMARY KEY,
  project_id    INTEGER,
  title         TEXT NOT NULL,
  description   TEXT DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'todo',          -- todo|in progress|done|archived
  is_archived   INTEGER NOT NULL DEFAULT 0,            -- 0/1; excludes from metrics when 1
  priority_id   INTEGER,
  eta_sec       INTEGER,                               -- estimate in seconds
  due_at        TEXT,                                  -- ISO8601 UTC Z (nullable)
  started_at    TEXT,
  ended_at      TEXT,
  created_by    INTEGER,

  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  archived_at   TEXT,

  FOREIGN KEY(project_id)  REFERENCES projects(id)   ON DELETE SET NULL,
  FOREIGN KEY(priority_id) REFERENCES priorities(id) ON DELETE SET NULL,
  CHECK (status IN ('todo','in progress','done','archived')),
  CHECK (is_archived IN (0,1))
);

CREATE TABLE task_tags (
  task_id INTEGER NOT NULL,
  tag_id  INTEGER NOT NULL,
  PRIMARY KEY(task_id, tag_id),
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
);

-- ========= SESSIONS & PAUSES =========
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS session_pauses;

CREATE TABLE sessions (
  id         INTEGER PRIMARY KEY,
  task_id    INTEGER NOT NULL,
  kind       TEXT    NOT NULL DEFAULT 'focus',  -- 'focus' (can add 'break' later)
  started_at TEXT    NOT NULL,                  -- ISO8601 UTC Z
  ended_at   TEXT,                              -- NULL = open
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE session_pauses (
  id         INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL,
  started_at TEXT    NOT NULL,                  -- ISO8601 UTC Z
  ended_at   TEXT,                              -- NULL = open
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- ========= UNIQUENESS (case-insensitive) =========
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name_nocase ON projects(name COLLATE NOCASE);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_nocase     ON tags(name COLLATE NOCASE);
CREATE UNIQUE INDEX IF NOT EXISTS idx_priorities_label     ON priorities(label);

-- ========= DATA HYGIENE / GUARDS =========

-- Touch tasks.updated_at on any change (prevent update loop)
DROP TRIGGER IF EXISTS trg_tasks_touch_updated_at;
CREATE TRIGGER trg_tasks_touch_updated_at
AFTER UPDATE ON tasks
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE tasks
  SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id = NEW.id;
END;

-- Auto-manage archived_at with is_archived
DROP TRIGGER IF EXISTS trg_tasks_archived_flags;
CREATE TRIGGER trg_tasks_archived_flags
AFTER UPDATE OF is_archived ON tasks
BEGIN
  UPDATE tasks
  SET archived_at = CASE
    WHEN NEW.is_archived = 1 AND (NEW.archived_at IS NULL OR NEW.archived_at = '') THEN strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHEN NEW.is_archived = 0 THEN NULL
    ELSE NEW.archived_at
  END
  WHERE id = NEW.id;
END;

-- Normalize TASKS timestamps to UTC Z on INSERT
DROP TRIGGER IF EXISTS trg_tasks_normalize_insert;
CREATE TRIGGER trg_tasks_normalize_insert
AFTER INSERT ON tasks
BEGIN
  UPDATE tasks SET
    created_at  = COALESCE(created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at  = COALESCE(updated_at, created_at),
    due_at      = CASE WHEN due_at      IS NOT NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', due_at)      END,
    started_at  = CASE WHEN started_at  IS NOT NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', started_at)  END,
    ended_at    = CASE WHEN ended_at    IS NOT NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', ended_at)    END,
    archived_at = CASE WHEN archived_at IS NOT NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', archived_at) END,
    created_at  = strftime('%Y-%m-%dT%H:%M:%fZ', created_at),
    updated_at  = strftime('%Y-%m-%dT%H:%M:%fZ', updated_at)
  WHERE id = NEW.id;
END;

-- Normalize TASKS timestamps on update (only those columns)
DROP TRIGGER IF EXISTS trg_tasks_normalize_update;
CREATE TRIGGER trg_tasks_normalize_update
AFTER UPDATE OF due_at, started_at, ended_at, archived_at, created_at, updated_at ON tasks
BEGIN
  UPDATE tasks SET
    due_at      = CASE WHEN NEW.due_at      IS NOT NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', NEW.due_at)      END,
    started_at  = CASE WHEN NEW.started_at  IS NOT NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', NEW.started_at)  END,
    ended_at    = CASE WHEN NEW.ended_at    IS NOT NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', NEW.ended_at)    END,
    archived_at = CASE WHEN NEW.archived_at IS NOT NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', NEW.archived_at) END,
    created_at  = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.created_at),
    updated_at  = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.updated_at)
  WHERE id = NEW.id;
END;

-- At most ONE UNPAUSED focus session globally
DROP TRIGGER IF EXISTS trg_one_unpaused_focus;
CREATE TRIGGER trg_one_unpaused_focus
BEFORE INSERT ON sessions
WHEN NEW.kind='focus' AND NEW.ended_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM sessions s
    JOIN tasks t ON t.id = s.task_id
    WHERE s.kind='focus' AND s.ended_at IS NULL
      AND t.is_archived = 0
      AND NOT EXISTS (
        SELECT 1 FROM session_pauses sp
        WHERE sp.session_id = s.id AND sp.ended_at IS NULL
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'Another focus session is already running');
END;

-- Sessions must end after they start (when ended)
DROP TRIGGER IF EXISTS trg_sessions_end_after_start;
CREATE TRIGGER trg_sessions_end_after_start
BEFORE UPDATE OF ended_at ON sessions
WHEN NEW.kind='focus' AND NEW.ended_at IS NOT NULL
  AND julianday(NEW.ended_at) <= julianday(NEW.started_at)
BEGIN
  SELECT RAISE(ABORT, 'Session ended_at must be after started_at');
END;

-- Pauses must lie inside their session interval
DROP TRIGGER IF EXISTS trg_pauses_inside_session;
CREATE TRIGGER trg_pauses_inside_session
BEFORE INSERT ON session_pauses
WHEN EXISTS (
  SELECT 1
  FROM sessions s
  WHERE s.id = NEW.session_id AND s.kind='focus'
    AND (
      julianday(NEW.started_at) < julianday(s.started_at)
      OR (s.ended_at IS NOT NULL AND julianday(NEW.started_at) >= julianday(s.ended_at))
    )
)
BEGIN
  SELECT RAISE(ABORT, 'Pause must start within its session interval');
END;

-- Prevent overlapping pauses for the same session
DROP TRIGGER IF EXISTS trg_no_overlap_pauses;
CREATE TRIGGER trg_no_overlap_pauses
BEFORE INSERT ON session_pauses
WHEN EXISTS (
  SELECT 1 FROM session_pauses p
  WHERE p.session_id = NEW.session_id
    AND COALESCE(NEW.ended_at, '9999-12-31T23:59:59.999Z') > p.started_at
    AND COALESCE(p.ended_at, '9999-12-31T23:59:59.999Z') > NEW.started_at
)
BEGIN
  SELECT RAISE(ABORT, 'Overlapping pauses in the same session are not allowed');
END;

-- Normalize SESSIONS timestamps
DROP TRIGGER IF EXISTS trg_sessions_normalize_insert;
CREATE TRIGGER trg_sessions_normalize_insert
AFTER INSERT ON sessions
BEGIN
  UPDATE sessions SET
    started_at = strftime('%Y-%m-%dT%H:%M:%fZ', started_at),
    ended_at   = CASE WHEN ended_at IS NOT NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', ended_at) END
  WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS trg_sessions_normalize_update;
CREATE TRIGGER trg_sessions_normalize_update
AFTER UPDATE OF started_at, ended_at ON sessions
BEGIN
  UPDATE sessions SET
    started_at = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.started_at),
    ended_at   = CASE WHEN NEW.ended_at IS NOT NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', NEW.ended_at) END
  WHERE id = NEW.id;
END;

-- Normalize SESSION_PAUSES timestamps
DROP TRIGGER IF EXISTS trg_pauses_normalize_insert;
CREATE TRIGGER trg_pauses_normalize_insert
AFTER INSERT ON session_pauses
BEGIN
  UPDATE session_pauses SET
    started_at = strftime('%Y-%m-%dT%H:%M:%fZ', started_at),
    ended_at   = CASE WHEN ended_at IS NOT NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', ended_at) END
  WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS trg_pauses_normalize_update;
CREATE TRIGGER trg_pauses_normalize_update
AFTER UPDATE OF started_at, ended_at ON session_pauses
BEGIN
  UPDATE session_pauses SET
    started_at = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.started_at),
    ended_at   = CASE WHEN NEW.ended_at IS NOT NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', NEW.ended_at) END
  WHERE id = NEW.id;
END;

-- ========= VIEWS (archived tasks are excluded) =========
DROP VIEW IF EXISTS v_task_time;
CREATE VIEW v_task_time AS
WITH
session_totals AS (
  SELECT
    s.task_id,
    SUM((julianday(COALESCE(s.ended_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')))
        - julianday(s.started_at)) * 86400.0) AS total_sec
  FROM sessions s
  JOIN tasks t ON t.id = s.task_id
  WHERE s.kind='focus' AND t.is_archived = 0
  GROUP BY s.task_id
),
pause_totals AS (
  SELECT
    s.task_id,
    SUM((julianday(COALESCE(p.ended_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')))
        - julianday(p.started_at)) * 86400.0) AS paused_sec
  FROM sessions s
  JOIN tasks t ON t.id = s.task_id
  JOIN session_pauses p ON p.session_id = s.id
  WHERE s.kind='focus' AND t.is_archived = 0
  GROUP BY s.task_id
)
SELECT
  t.id AS task_id,
  CAST(ROUND(COALESCE(st.total_sec, 0)) AS INTEGER)  AS total_sec,
  CAST(ROUND(COALESCE(pt.paused_sec,0)) AS INTEGER)  AS paused_sec,
  CAST(ROUND(MAX(COALESCE(st.total_sec,0) - COALESCE(pt.paused_sec,0), 0)) AS INTEGER) AS effective_sec
FROM tasks t
LEFT JOIN session_totals st ON st.task_id = t.id
LEFT JOIN pause_totals  pt ON pt.task_id = t.id
WHERE t.is_archived = 0;

DROP VIEW IF EXISTS v_task_overview;
CREATE VIEW v_task_overview AS
WITH tags_concat AS (
  SELECT tt.task_id, GROUP_CONCAT(tg.name, ',') AS tags
  FROM task_tags tt
  JOIN tags tg ON tg.id = tt.tag_id
  GROUP BY tt.task_id
)
SELECT
  t.id                AS task_id,
  t.project_id        AS project_id,
  p.company_id        AS company_id,
  t.priority_id       AS priority_id,

  t.title,
  t.description,
  c.name              AS company,
  p.name              AS project,
  pr.label            AS priority,
  pr.weight           AS priority_weight,

  t.started_at,
  t.ended_at,
  t.due_at,
  t.eta_sec,

  COALESCE(tc.total_sec, 0)     AS total_sec,
  COALESCE(tc.paused_sec, 0)    AS paused_sec,
  COALESCE(tc.effective_sec, 0) AS effective_sec,

  tg.tags             AS tags_csv,

  t.status,
  t.is_archived,
  t.created_at, t.updated_at, t.archived_at
FROM tasks t
LEFT JOIN projects    p  ON p.id = t.project_id
LEFT JOIN companies   c  ON c.id = p.company_id
LEFT JOIN priorities  pr ON pr.id = t.priority_id
LEFT JOIN v_task_time tc ON tc.task_id = t.id
LEFT JOIN tags_concat tg ON tg.task_id = t.id
WHERE t.is_archived = 0;

DROP VIEW IF EXISTS v_session_time;
CREATE VIEW v_session_time AS
WITH
session_totals AS (
  SELECT
    s.id AS session_id,
    s.task_id,
    (julianday(COALESCE(s.ended_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')))
     - julianday(s.started_at)) * 86400.0 AS total_sec
  FROM sessions s
  JOIN tasks t ON t.id = s.task_id
  WHERE s.kind='focus' AND t.is_archived = 0
),
pause_totals AS (
  SELECT
    p.session_id,
    SUM((julianday(COALESCE(p.ended_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')))
        - julianday(p.started_at)) * 86400.0) AS paused_sec
  FROM session_pauses p
  WHERE EXISTS (SELECT 1 FROM sessions s JOIN tasks t ON t.id = s.task_id WHERE s.id = p.session_id AND t.is_archived = 0)
  GROUP BY p.session_id
)
SELECT
  s.session_id,
  s.task_id,
  CAST(ROUND(COALESCE(s.total_sec, 0)) AS INTEGER)                                                  AS total_sec,
  CAST(ROUND(COALESCE(p.paused_sec, 0)) AS INTEGER)                                                 AS paused_sec,
  CAST(ROUND(MAX(COALESCE(s.total_sec,0) - COALESCE(p.paused_sec,0),0)) AS INTEGER)                 AS effective_sec
FROM session_totals s
LEFT JOIN pause_totals p ON p.session_id = s.session_id;

-- Unified event stream (+1 start/resume, -1 pause/stop), excluding archived tasks
DROP VIEW IF EXISTS v_activity_events;
CREATE VIEW v_activity_events AS
SELECT s.started_at AS ts, +1 AS delta
FROM sessions s
JOIN tasks t ON t.id = s.task_id
WHERE s.kind='focus' AND t.is_archived = 0
UNION ALL
SELECT s.ended_at AS ts, -1 AS delta
FROM sessions s
JOIN tasks t ON t.id = s.task_id
WHERE s.kind='focus' AND s.ended_at IS NOT NULL AND t.is_archived = 0
UNION ALL
SELECT p.started_at AS ts, -1 AS delta
FROM session_pauses p
JOIN sessions s ON s.id = p.session_id
JOIN tasks t ON t.id = s.task_id
WHERE t.is_archived = 0
UNION ALL
SELECT p.ended_at AS ts, +1 AS delta
FROM session_pauses p
JOIN sessions s ON s.id = p.session_id
JOIN tasks t ON t.id = s.task_id
WHERE p.ended_at IS NOT NULL AND t.is_archived = 0;

-- ========= NOTES =========
-- 1) All metrics/views exclude tasks where is_archived = 1.
-- 2) Keep your performance/usage indexes in 02_indexes.sql (unchanged).
-- 3) app_settings row id=1 stores defaults; the app can read/patch it.
