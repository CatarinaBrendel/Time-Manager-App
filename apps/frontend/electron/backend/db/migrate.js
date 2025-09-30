const fs = require('fs');
const path = require('path');

function ensureMigrations(db, migrationsDir) {
db.exec(`CREATE TABLE IF NOT EXISTS meta_migrations (
id INTEGER PRIMARY KEY,
name TEXT NOT NULL UNIQUE,
applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

const files = fs
.readdirSync(migrationsDir)
.filter(f => f.endsWith('.sql'))
.sort();

const isApplied = db.prepare('SELECT 1 FROM meta_migrations WHERE name = ?').pluck();
const insertMig = db.prepare('INSERT INTO meta_migrations (name) VALUES (?)');

    for (const f of files) {
        const applied = isApplied.get(f);
        if (applied) continue;
        const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
        const trx = db.transaction(() => {
            db.exec(sql);
            insertMig.run(f);
        });
        trx();
        console.log('Applied migration:', f);
    }
}

module.exports = { ensureMigrations };