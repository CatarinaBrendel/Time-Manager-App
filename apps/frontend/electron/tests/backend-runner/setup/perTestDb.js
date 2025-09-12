const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const REPO_ROOT = "/work"; // repo is copied here by Dockerfile.test
// Point this to where your real .sql migrations live:
const MIG_DIRS = [
  "apps/frontend/electron/backend/db/migrations",
];

function makeTmpDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tmdb-"));
  return path.join(dir, `test-${crypto.randomBytes(4).toString("hex")}.db`);
}

function readMigrations() {
  const files = [];
  for (const rel of MIG_DIRS) {
    const abs = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs)) {
      if (name.toLowerCase().endsWith(".sql")) files.push(path.join(abs, name));
    }
  }
  // sort lexicographically with numeric awareness: 0001_, 0002_, ...
  return files.sort((a, b) =>
    path.basename(a).localeCompare(path.basename(b), "en", { numeric: true })
  );
}

beforeAll(() => {
  const dbPath = makeTmpDb();
  process.env.NODE_ENV = "test";
  process.env.DB_PATH = dbPath;

  // Use the runner's better-sqlite3 (installed in /runner/node_modules)
  const Database = require("better-sqlite3");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = DELETE"); // avoid -wal/-shm
  db.pragma("case_sensitive_like = OFF");

  try {
    const migrations = readMigrations();
    if (migrations.length === 0) {
      console.warn("[perTestDb] No .sql migrations found under:", MIG_DIRS);
    }
    db.exec("BEGIN IMMEDIATE;");
    for (const f of migrations) {
      const sql = fs.readFileSync(f, "utf8");
      db.exec(sql);
    }
    db.exec("COMMIT;");
    console.log("[perTestDb] DB ready at", dbPath, "— applied", migrations.length, "files");
  } catch (e) {
    try { db.exec("ROLLBACK;"); } catch {}
    db.close();
    throw e;
  }
  db.close();
});

afterAll(() => {
  try { if (process.env.DB_PATH) fs.unlinkSync(process.env.DB_PATH); } catch {}
});
