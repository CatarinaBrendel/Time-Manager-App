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
CREATE VIEW v_task_time AS
SELECT
  t.id   AS task_id,
  t.title,
  SUM(v.total_sec)     AS total_sec,
  SUM(v.paused_sec)    AS paused_sec,
  SUM(v.effective_sec) AS effective_sec
FROM tasks t
LEFT JOIN v_session_time v ON v.task_id = t.id
GROUP BY t.id, t.title;

-- 3) Enriched task snapshot
CREATE VIEW v_task_overview AS
WITH tags_concat AS (
  SELECT tt.task_id, GROUP_CONCAT(tg.name, ',') AS tags
  FROM task_tags tt
  JOIN tags tg ON tg.id = tt.tag_id
  GROUP BY tt.task_id
)
SELECT
  t.id                AS task_id,
  t.title,
  c.name              AS company,
  p.name              AS project,
  t.status,
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
  t.created_at,
  t.updated_at,
  t.archived_at
FROM tasks t
LEFT JOIN projects   p  ON p.id = t.project_id
LEFT JOIN companies  c  ON c.id = p.company_id
LEFT JOIN priorities pr ON pr.id = t.priority_id
LEFT JOIN v_task_time tc ON tc.task_id = t.id
LEFT JOIN tags_concat tg ON tg.task_id = t.id;
