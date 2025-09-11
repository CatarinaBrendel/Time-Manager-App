-- Optional early multi-user (even if single-user today)
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT
);

CREATE TABLE IF NOT EXISTS companies (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY,
  company_id  INTEGER,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id);

-- Normalized tags (no more JSON array)
CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Priority as first-class, sortable; feel free to seed weights (1=highest)
CREATE TABLE IF NOT EXISTS priorities (
  id     INTEGER PRIMARY KEY,
  label  TEXT NOT NULL UNIQUE,       -- e.g., 'Low','Medium','High','Urgent'
  weight INTEGER NOT NULL UNIQUE      -- lower means higher priority for sorting
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_priorities_weight ON priorities(weight);
