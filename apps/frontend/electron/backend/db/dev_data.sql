-- ===========================================
-- Time Manager — DEV SEED DATA (do not ship)
-- Assumes 01_schema.sql + 02_indexes.sql already applied.
-- Timestamps are ISO-8601 UTC with Z; triggers also normalize.
-- Current date assumed ~2025-09-30, but data is explicit anyway.
-- ===========================================

-- Reference data
INSERT INTO companies (id, name) VALUES (1,'Acme Corp'),(2,'Globex') ON CONFLICT DO NOTHING;
INSERT INTO projects (id, name, company_id) VALUES
  (1,'Website Redesign',1),
  (2,'Marketing Campaign',2),
  (3,'Mobile App',1)
ON CONFLICT DO NOTHING;

INSERT INTO priorities (id, label, weight) VALUES
  (1,'low',1),(2,'medium',2),(3,'high',3),(4,'urgent',4)
ON CONFLICT DO NOTHING;

INSERT INTO tags (id, name) VALUES
  (1,'frontend'),(2,'backend'),(3,'design'),(4,'ops'),(5,'urgent')
ON CONFLICT DO NOTHING;

-- -------------------------------------------------
-- Tasks across the year (some active, some closed)
-- -------------------------------------------------
INSERT INTO tasks (id, project_id, title, description, status, priority_id, eta_sec, due_at, started_at, ended_at, created_at, updated_at)
VALUES
  -- Today (Sep 30) active + earlier cross-midnight activity
  (1001, 1, 'Polish login UI', 'Refine form states & a11y', 'in progress', 2, 7200, '2025-10-03T17:00:00Z', '2025-09-30T07:30:00Z', NULL, '2025-09-29T09:00:00Z', '2025-09-30T07:30:00Z'),
  (1002, 1, 'Refactor auth API', 'Split controller/service', 'todo',        3, 10800,'2025-10-10T12:00:00Z', NULL, NULL, '2025-09-20T09:00:00Z','2025-09-20T09:00:00Z'),
  -- Last week
  (1003, 2, 'Q4 assets brief', 'Collect brand inputs',      'done',         1, 3600, '2025-09-25T18:00:00Z', '2025-09-23T09:00:00Z','2025-09-26T14:00:00Z','2025-09-20T10:00:00Z','2025-09-26T14:00:00Z'),
  -- Last month
  (1004, 3, 'Android crash fix', 'ANR on cold start',       'done',         4, 5400, '2025-08-20T16:00:00Z', '2025-08-12T08:00:00Z','2025-08-14T17:00:00Z','2025-08-10T09:00:00Z','2025-08-14T17:00:00Z'),
  -- Earlier this year (Q2)
  (1005, 1, 'Design tokens pass', 'Color/typography pass',  'done',         2, 7200, '2025-05-15T18:00:00Z', '2025-05-10T07:00:00Z','2025-05-10T16:00:00Z','2025-05-05T12:00:00Z','2025-05-10T16:00:00Z'),
  -- January
  (1006, 2, 'Campaign kickoff deck','Initial outline',      'done',         3, 3600, '2025-01-20T12:00:00Z', '2025-01-15T10:00:00Z','2025-01-15T12:30:00Z','2025-01-10T10:00:00Z','2025-01-15T12:30:00Z'),
  -- A task with no sessions yet
  (1007, 3, 'Push notifications', 'Evaluate FCM vs APNs',   'todo',         2, 5400, '2025-11-15T12:00:00Z', NULL, NULL, '2025-09-01T09:00:00Z','2025-09-01T09:00:00Z')
ON CONFLICT(id) DO NOTHING;

-- Optional tags
INSERT INTO task_tags (task_id, tag_id) VALUES
  (1001,1),(1001,3),
  (1003,3),
  (1004,2),(1004,5),
  (1005,3),
  (1006,4)
ON CONFLICT DO NOTHING;

-- -------------------------------------------
-- Sessions (+ pauses) — realistic distributions
-- -------------------------------------------

-- 1001: Today (Sep 30) morning focus, with a pause; still open now
INSERT INTO sessions (id, task_id, kind, started_at, ended_at) VALUES
  (2001, 1001, 'focus', '2025-09-30T07:30:00Z', NULL);
-- Paused 08:40–08:55 UTC
INSERT INTO session_pauses (id, session_id, started_at, ended_at) VALUES
  (3001, 2001, '2025-09-30T08:40:00Z', '2025-09-30T08:55:00Z');

-- 1001: Yesterday late night cross-midnight (Sep 29 → Sep 30)
INSERT INTO sessions (id, task_id, kind, started_at, ended_at) VALUES
  (2002, 1001, 'focus', '2025-09-29T22:30:00Z', '2025-09-30T01:00:00Z');
-- Pause 23:45–00:05 UTC (cross-midnight)
INSERT INTO session_pauses (id, session_id, started_at, ended_at) VALUES
  (3002, 2002, '2025-09-29T23:45:00Z', '2025-09-30T00:05:00Z');

-- 1003: Last week, two short sessions same day with a break gap (idle expected between sessions)
INSERT INTO sessions (id, task_id, kind, started_at, ended_at) VALUES
  (2101, 1003, 'focus', '2025-09-23T09:00:00Z', '2025-09-23T10:30:00Z'),
  (2102, 1003, 'focus', '2025-09-23T13:00:00Z', '2025-09-23T14:10:00Z');
INSERT INTO session_pauses (id, session_id, started_at, ended_at) VALUES
  (3101, 2101, '2025-09-23T09:40:00Z', '2025-09-23T09:50:00Z');

-- 1004: Last month multi-day spread
INSERT INTO sessions (id, task_id, kind, started_at, ended_at) VALUES
  (2201, 1004, 'focus', '2025-08-12T08:00:00Z', '2025-08-12T11:00:00Z'),
  (2202, 1004, 'focus', '2025-08-13T14:00:00Z', '2025-08-13T16:30:00Z'),
  (2203, 1004, 'focus', '2025-08-14T09:30:00Z', '2025-08-14T11:30:00Z');
INSERT INTO session_pauses (id, session_id, started_at, ended_at) VALUES
  (3201, 2202, '2025-08-13T15:00:00Z', '2025-08-13T15:10:00Z');

-- 1005: Q2 single day with mid-session break
INSERT INTO sessions (id, task_id, kind, started_at, ended_at) VALUES
  (2301, 1005, 'focus', '2025-05-10T07:00:00Z', '2025-05-10T16:00:00Z');
INSERT INTO session_pauses (id, session_id, started_at, ended_at) VALUES
  (3301, 2301, '2025-05-10T12:00:00Z', '2025-05-10T12:45:00Z');

-- 1006: January short session (with pause)
INSERT INTO sessions (id, task_id, kind, started_at, ended_at) VALUES
  (2401, 1006, 'focus', '2025-01-15T10:00:00Z', '2025-01-15T12:30:00Z');
INSERT INTO session_pauses (id, session_id, started_at, ended_at) VALUES
  (3401, 2401, '2025-01-15T11:10:00Z', '2025-01-15T11:20:00Z');
