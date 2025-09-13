-- Speeds up task lists, filters, and sorting by due date and status
CREATE INDEX IF NOT EXISTS idx_tasks_status_due ON tasks(status, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_priority   ON tasks(priority_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project    ON tasks(project_id);

-- Open session lookups (use partial indexes for “open” rows)
CREATE INDEX IF NOT EXISTS idx_sessions_open_by_task
  ON sessions(task_id)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pauses_open_by_session
  ON session_pauses(session_id)
  WHERE ended_at IS NULL;

-- Tag lookups (list tasks by tag, or tags by task)
CREATE INDEX IF NOT EXISTS idx_task_tags_task ON task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag  ON task_tags(tag_id);

-- Ensure uniqueness / lookups for tag and project/company relations
CREATE UNIQUE INDEX IF NOT EXISTS ux_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id);

