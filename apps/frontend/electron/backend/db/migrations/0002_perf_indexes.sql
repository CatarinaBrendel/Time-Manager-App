-- compound/task filters you actually use
CREATE INDEX IF NOT EXISTS idx_tasks_status_due   ON tasks(status, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_project      ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority     ON tasks(priority_id);

-- “open things” fast paths
CREATE INDEX IF NOT EXISTS idx_sessions_task_open ON sessions(task_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pauses_sess_open   ON session_pauses(session_id) WHERE ended_at IS NULL;

-- tag linking lookups
CREATE INDEX IF NOT EXISTS idx_task_tags_task ON task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag  ON task_tags(tag_id);

-- Direct range probes (crucial for range filters)
CREATE INDEX IF NOT EXISTS idx_tasks_created_at          ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at              ON tasks(due_at);

-- Common combos that mirror WHERE filters you already use
CREATE INDEX IF NOT EXISTS idx_tasks_status_created      ON tasks(status, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status_due          ON tasks(status, due_at);

-- If you often filter by a specific project + period
CREATE INDEX IF NOT EXISTS idx_tasks_project_created     ON tasks(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_project_due         ON tasks(project_id, due_at);