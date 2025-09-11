-- Keep updated_at fresh
CREATE TRIGGER IF NOT EXISTS trg_tasks_touch_updated
AFTER UPDATE ON tasks
FOR EACH ROW
BEGIN
  UPDATE tasks SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Keep archived_at aligned with status
CREATE TRIGGER IF NOT EXISTS trg_tasks_archive_timestamp
AFTER UPDATE OF status ON tasks
FOR EACH ROW
WHEN NEW.status = 'archived' AND NEW.archived_at IS NULL
BEGIN
  UPDATE tasks SET archived_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_unarchive_clear_timestamp
AFTER UPDATE OF status ON tasks
FOR EACH ROW
WHEN OLD.status = 'archived' AND NEW.status <> 'archived' AND NEW.archived_at IS NOT NULL
BEGIN
  UPDATE tasks SET archived_at = NULL WHERE id = NEW.id;
END;

-- Optionally set started_at / ended_at timestamps for convenience
CREATE TRIGGER IF NOT EXISTS trg_tasks_mark_doing_sets_started
AFTER UPDATE OF status ON tasks
FOR EACH ROW
WHEN NEW.status = 'in progress' AND NEW.started_at IS NULL
BEGIN
  UPDATE tasks SET started_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_mark_done_sets_ended
AFTER UPDATE OF status ON tasks
FOR EACH ROW
WHEN NEW.status = 'done' AND NEW.ended_at IS NULL
BEGIN
  UPDATE tasks SET ended_at = datetime('now') WHERE id = NEW.id;
END;
