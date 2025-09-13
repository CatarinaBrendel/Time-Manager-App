-- 1) Base per-session time rollup (running+finished sessions)
CREATE VIEW v_session_time AS
WITH session_bounds AS (
  SELECT
    s.id,
    s.task_id,
    s.kind,
    s.started_at,
    s.ended_at,
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

-- 2) Per-task rollup
-- Helper to normalize ISO timestamps: "YYYY-MM-DDTHH:MM:SS(.mmm)Z" -> "YYYY-MM-DD HH:MM:SS(.mmm)"
-- Done inline via REPLACE to avoid needing custom function

DROP VIEW IF EXISTS v_task_time;

CREATE VIEW v_task_time AS
WITH norm_sessions AS (
  SELECT
    s.id,
    s.task_id,
    -- replace T with space; strip trailing Z if present
    REPLACE(REPLACE(s.started_at, 'T', ' '), 'Z', '') AS s_start,
    CASE
      WHEN s.ended_at IS NULL THEN NULL
      ELSE REPLACE(REPLACE(s.ended_at, 'T', ' '), 'Z', '')
    END AS s_end
  FROM sessions s
  WHERE s.kind = 'focus'
),
norm_pauses AS (
  SELECT
    sp.session_id,
    REPLACE(REPLACE(sp.started_at, 'T', ' '), 'Z', '') AS p_start,
    CASE
      WHEN sp.ended_at IS NULL THEN NULL
      ELSE REPLACE(REPLACE(sp.ended_at, 'T', ' '), 'Z', '')
    END AS p_end
  FROM session_pauses sp
),
session_totals AS (
  SELECT
    n.task_id,
    -- total seconds in session (if still open, use CURRENT_TIMESTAMP)
    SUM(
      (julianday(COALESCE(n.s_end, CURRENT_TIMESTAMP)) - julianday(n.s_start)) * 86400.0
    ) AS total_sec
  FROM norm_sessions n
  GROUP BY n.task_id
),
pause_totals AS (
  SELECT
    ns.task_id,
    SUM(
      (julianday(COALESCE(np.p_end, CURRENT_TIMESTAMP)) - julianday(np.p_start)) * 86400.0
    ) AS paused_sec
  FROM norm_sessions ns
  JOIN norm_pauses  np ON np.session_id = ns.id
  GROUP BY ns.task_id
)
SELECT
  t.id AS task_id,
  CAST(ROUND(COALESCE(st.total_sec, 0)) AS INTEGER)     AS total_sec,
  CAST(ROUND(COALESCE(pt.paused_sec, 0)) AS INTEGER)    AS paused_sec,
  CAST(ROUND(MAX(COALESCE(st.total_sec, 0) - COALESCE(pt.paused_sec, 0), 0)) AS INTEGER) AS effective_sec
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