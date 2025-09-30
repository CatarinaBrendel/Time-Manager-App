PRAGMA foreign_keys = ON;

-- =========================================
-- Time Manager — Performance Indexes (v2)
-- - Optimize for: task lists w/ filters, date windows,
--   v_activity_events day/week scans, and idle window queries.
-- - All metrics exclude archived tasks, so most composite
--   indexes lead with is_archived.
-- =========================================

/* ------------ TASKS ------------- */

-- Fast global filter to exclude archived tasks
CREATE INDEX IF NOT EXISTS idx_tasks_is_archived            ON tasks(is_archived);

-- Common list filters + sorts (status, due_at) but always excluding archived
CREATE INDEX IF NOT EXISTS idx_tasks_arch_status_due        ON tasks(is_archived, status, due_at);

-- Project-scoped lists with time filters (created_at OR due_at)
CREATE INDEX IF NOT EXISTS idx_tasks_arch_project_created   ON tasks(is_archived, project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_arch_project_due       ON tasks(is_archived, project_id, due_at);

-- Priority filters (keep light; many teams sort by priority)
CREATE INDEX IF NOT EXISTS idx_tasks_arch_priority          ON tasks(is_archived, priority_id);

-- Direct range probes (keep singles; SQLite can still use them)
CREATE INDEX IF NOT EXISTS idx_tasks_created_at             ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at_only            ON tasks(due_at);

-- If you still query by status alone (rare once archived is common)
CREATE INDEX IF NOT EXISTS idx_tasks_status_created         ON tasks(status, created_at);

/* ------------ SESSIONS ------------- */

-- Open sessions fast path (unchanged)
CREATE INDEX IF NOT EXISTS idx_sessions_task_open           ON sessions(task_id) WHERE ended_at IS NULL;

-- Time-ordered scans for focus sessions (range clamps in rollups)
CREATE INDEX IF NOT EXISTS idx_sessions_focus_started       ON sessions(task_id, started_at) WHERE kind='focus';
CREATE INDEX IF NOT EXISTS idx_sessions_focus_ended         ON sessions(task_id, ended_at)   WHERE kind='focus';
-- Also keep plain time-only for global day/week scans
CREATE INDEX IF NOT EXISTS idx_sessions_started_at          ON sessions(started_at) WHERE kind='focus';
CREATE INDEX IF NOT EXISTS idx_sessions_ended_at            ON sessions(ended_at)   WHERE kind='focus';

/* ------------ SESSION_PAUSES ------------- */

-- Open pauses fast path (unchanged)
CREATE INDEX IF NOT EXISTS idx_pauses_sess_open             ON session_pauses(session_id) WHERE ended_at IS NULL;

-- Lookups and overlap clamps during window math
CREATE INDEX IF NOT EXISTS idx_pauses_session_started       ON session_pauses(session_id, started_at);
CREATE INDEX IF NOT EXISTS idx_pauses_session_ended         ON session_pauses(session_id, ended_at);
CREATE INDEX IF NOT EXISTS idx_pauses_started_at            ON session_pauses(started_at);
CREATE INDEX IF NOT EXISTS idx_pauses_ended_at              ON session_pauses(ended_at);

/* ------------ TASK_TAGS ------------- */

-- Tag linking lookups (unchanged)
CREATE INDEX IF NOT EXISTS idx_task_tags_task               ON task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag                ON task_tags(tag_id);

/* ------------ OPTIONAL: CLOCK EVENTS ------------- */

-- Daily clock-in/out lookups: filter by kind + time window
CREATE INDEX IF NOT EXISTS idx_clock_events_kind_at         ON clock_events(kind, at);
-- (You already have idx_clock_events_at; keeping both is fine)

/* ------------ LEGACY / KEEP FOR COMPAT ------------- */

-- If you still rely on these in older queries, keep them.
CREATE INDEX IF NOT EXISTS idx_tasks_status_due             ON tasks(status, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_project                ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority               ON tasks(priority_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_created        ON tasks(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_project_due            ON tasks(project_id, due_at);
