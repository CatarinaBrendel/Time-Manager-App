PRAGMA foreign_keys=ON;

-- ===== Core reference =====
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

-- ===== Tasks & tags link =====
CREATE TABLE tasks (
  id            INTEGER PRIMARY KEY,
  project_id    INTEGER,
  title         TEXT NOT NULL,
  description   TEXT DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'todo',  -- todo|in progress|done|archived
  priority_id   INTEGER,
  eta_sec       INTEGER,                        -- estimate in seconds
  due_at        TEXT,                           -- ISO8601
  started_at    TEXT,
  ended_at      TEXT,
  created_by    INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at   TEXT,
  FOREIGN KEY(project_id)  REFERENCES projects(id)   ON DELETE SET NULL,
  FOREIGN KEY(priority_id) REFERENCES priorities(id) ON DELETE SET NULL,
  CHECK (status IN ('todo','in progress','done','archived'))
);

CREATE TABLE task_tags (
  task_id INTEGER NOT NULL,
  tag_id  INTEGER NOT NULL,
  PRIMARY KEY(task_id, tag_id),
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
);

-- Touch updated_at on any task change
DROP TRIGGER IF EXISTS trg_tasks_touch_updated_at;
CREATE TRIGGER trg_tasks_touch_updated_at
AFTER UPDATE ON tasks
BEGIN
  UPDATE tasks SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ===== Sessions & pauses =====
CREATE TABLE sessions (
  id         INTEGER PRIMARY KEY,
  task_id    INTEGER NOT NULL,
  kind       TEXT    NOT NULL DEFAULT 'focus',
  started_at TEXT    NOT NULL,
  ended_at   TEXT,                              -- NULL = open
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE session_pauses (
  id         INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL,
  started_at TEXT    NOT NULL,
  ended_at   TEXT,                              -- NULL = open
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- ===== Uniqueness (case-insensitive) =====
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name_nocase ON projects(name COLLATE NOCASE);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_nocase     ON tags(name COLLATE NOCASE);
CREATE UNIQUE INDEX IF NOT EXISTS idx_priorities_label     ON priorities(label);

-- ===== Guard: at most ONE UNPAUSED focus session globally =====
DROP TRIGGER IF EXISTS trg_one_open_focus;
DROP TRIGGER IF EXISTS trg_one_unpaused_focus;
CREATE TRIGGER trg_one_unpaused_focus
BEFORE INSERT ON sessions
WHEN NEW.kind='focus' AND NEW.ended_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM sessions s
    WHERE s.kind='focus' AND s.ended_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM session_pauses sp
        WHERE sp.session_id = s.id AND sp.ended_at IS NULL
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'Another focus session is already running');
END;

-- ===== Views: time rollups (normalize ISO for julianday) =====
DROP VIEW IF EXISTS v_task_time;
CREATE VIEW v_task_time AS
WITH norm_sessions AS (
  SELECT
    s.id,
    s.task_id,
    REPLACE(REPLACE(s.started_at, 'T', ' '), 'Z', '') AS s_start,
    CASE WHEN s.ended_at IS NULL THEN NULL
         ELSE REPLACE(REPLACE(s.ended_at, 'T', ' '), 'Z', '')
    END AS s_end
  FROM sessions s
  WHERE s.kind='focus'
),
norm_pauses AS (
  SELECT
    sp.session_id,
    REPLACE(REPLACE(sp.started_at, 'T', ' '), 'Z', '') AS p_start,
    CASE WHEN sp.ended_at IS NULL THEN NULL
         ELSE REPLACE(REPLACE(sp.ended_at, 'T', ' '), 'Z', '')
    END AS p_end
  FROM session_pauses sp
),
session_totals AS (
  SELECT
    n.task_id,
    SUM((julianday(COALESCE(n.s_end, CURRENT_TIMESTAMP))
        - julianday(n.s_start)) * 86400.0) AS total_sec
  FROM norm_sessions n
  GROUP BY n.task_id
),
pause_totals AS (
  SELECT
    ns.task_id,
    SUM((julianday(COALESCE(np.p_end, CURRENT_TIMESTAMP))
        - julianday(np.p_start)) * 86400.0) AS paused_sec
  FROM norm_sessions ns
  JOIN norm_pauses  np ON np.session_id = ns.id
  GROUP BY ns.task_id
)
SELECT
  t.id AS task_id,
  CAST(ROUND(COALESCE(st.total_sec, 0)) AS INTEGER)  AS total_sec,
  CAST(ROUND(COALESCE(pt.paused_sec,0)) AS INTEGER)  AS paused_sec,
  CAST(ROUND(MAX(COALESCE(st.total_sec,0) - COALESCE(pt.paused_sec,0), 0)) AS INTEGER) AS effective_sec
FROM tasks t
LEFT JOIN session_totals st ON st.task_id = t.id
LEFT JOIN pause_totals  pt ON pt.task_id = t.id;

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
  t.created_at, t.updated_at, t.archived_at
FROM tasks t
LEFT JOIN projects    p  ON p.id = t.project_id
LEFT JOIN companies   c  ON c.id = p.company_id
LEFT JOIN priorities  pr ON pr.id = t.priority_id
LEFT JOIN v_task_time tc ON tc.task_id = t.id
LEFT JOIN tags_concat tg ON tg.task_id = t.id;

-- Per-session totals (incl. pauses) so legacy backend code keeps working
CREATE VIEW v_session_time AS
WITH
  norm_sessions AS (
    SELECT
      s.id,
      s.task_id,
      REPLACE(REPLACE(s.started_at, 'T', ' '), 'Z', '') AS s_start,
      CASE WHEN s.ended_at IS NULL THEN NULL
           ELSE REPLACE(REPLACE(s.ended_at, 'T', ' '), 'Z', '')
      END AS s_end
    FROM sessions s
    WHERE s.kind = 'focus'
  ),
  pause_totals AS (
    SELECT
      sp.session_id,
      SUM((julianday(COALESCE(REPLACE(REPLACE(sp.ended_at,'T',' '),'Z',''), CURRENT_TIMESTAMP))
          - julianday(REPLACE(REPLACE(sp.started_at,'T',' '),'Z',''))) * 86400.0) AS paused_sec
    FROM session_pauses sp
    GROUP BY sp.session_id
  ),
  session_totals AS (
    SELECT
      ns.id AS session_id,
      ns.task_id,
      (julianday(COALESCE(ns.s_end, CURRENT_TIMESTAMP)) - julianday(ns.s_start)) * 86400.0 AS total_sec
    FROM norm_sessions ns
  )
SELECT
  s.session_id,
  s.task_id,
  CAST(ROUND(COALESCE(s.total_sec, 0)) AS INTEGER)      AS total_sec,
  CAST(ROUND(COALESCE(p.paused_sec, 0)) AS INTEGER)     AS paused_sec,
  CAST(ROUND(MAX(COALESCE(s.total_sec,0) - COALESCE(p.paused_sec,0), 0)) AS INTEGER) AS effective_sec
FROM session_totals s
LEFT JOIN pause_totals p ON p.session_id = s.session_id;
