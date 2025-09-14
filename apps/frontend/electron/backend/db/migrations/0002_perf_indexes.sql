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
