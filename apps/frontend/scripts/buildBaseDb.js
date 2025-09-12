// apps/frontend/scripts/buildBaseDb.js
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

/**
 * Env:
 *  - OUTPUT_DB: absolute or relative path to the sqlite db to create (preferred)
 *  - DB_PATH  : fallback for backward-compat
 *  - MIGRATIONS_DIRS: colon-separated list of dirs to search for .sql files
 *                     (default set below; change to match your repo)
 */

// Resolve output DB path
const outPath =
  process.env.OUTPUT_DB ||
  process.env.DB_PATH ||
  path.join(process.cwd(), "apps/frontend/data/time_manager.db");

// Default migration directories (adjust to your structure)
const defaultDirs = [
  // common places in your tree:
  "apps/frontend/electron/backend/db/migrations",
  "apps/frontend/electron/backend/db/sql",
  "apps/frontend/scripts/sql",
  "sql", // if you keep a root-level sql/ dir too
];

// Allow override via env (colon-separated list)
const migrationDirs = (process.env.MIGRATIONS_DIRS || defaultDirs.join(":"))
  .split(":")
  .map((p) => p.trim())
  .filter(Boolean)
  .map((p) => path.resolve(process.cwd(), p))
  .filter((p) => fs.existsSync(p) && fs.statSync(p).isDirectory());

// Collect *.sql files from all dirs, de-duplicate by basename+dir, sort by filename
const sqlFiles = [];
for (const dir of migrationDirs) {
  for (const name of fs.readdirSync(dir)) {
    if (name.toLowerCase().endsWith(".sql")) {
      sqlFiles.push({ full: path.join(dir, name), base: name, dir });
    }
  }
}
sqlFiles.sort((a, b) => a.base.localeCompare(b.base, "en", { numeric: true }));

// Prepare output folder
fs.mkdirSync(path.dirname(outPath), { recursive: true });
try { fs.unlinkSync(outPath); } catch { /* ignore */ }

const db = new Database(outPath);
db.pragma("foreign_keys = ON");

try {
  db.exec("BEGIN IMMEDIATE;");
  for (const f of sqlFiles) {
    const sql = fs.readFileSync(f.full, "utf8");
    db.exec(sql);
  }
  db.exec("COMMIT;");
} catch (e) {
  try { db.exec("ROLLBACK;"); } catch {}
  db.close();
  console.error("[buildBaseDb] Migration failed at:", e?.message);
  process.exitCode = 1;
  process.exit();
}

db.close();

// Pretty print status
const relOut = path.relative(process.cwd(), outPath);
console.log(`[buildBaseDb] Created: ${relOut}`);
if (sqlFiles.length) {
  console.log("[buildBaseDb] Applied migrations (in order):");
  for (const f of sqlFiles) {
    const rel = path.relative(process.cwd(), f.full);
    console.log(`  - ${rel}`);
  }
} else {
  console.warn("[buildBaseDb] No .sql files found. Checked directories:");
  for (const d of migrationDirs) console.warn(`  - ${path.relative(process.cwd(), d)}`);
}
