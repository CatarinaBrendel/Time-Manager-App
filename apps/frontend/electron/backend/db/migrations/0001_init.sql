-- Tasks & meta table
CREATE TABLE IF NOT EXISTS meta_migrations (
id INTEGER PRIMARY KEY,
name TEXT NOT NULL UNIQUE,
applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
id INTEGER PRIMARY KEY,
title TEXT NOT NULL,
description TEXT DEFAULT '',
status TEXT NOT NULL DEFAULT 'todo', -- todo | doing | done | archived
due_at TEXT, -- ISO string or null
tags_json TEXT DEFAULT '[]', -- JSON array of strings
created_at TEXT NOT NULL DEFAULT (datetime('now')),
updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at);