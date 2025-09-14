function ProjectsRepo(db) {
  const listStmt   = db.prepare(`SELECT id, TRIM(name) AS name FROM projects WHERE TRIM(name) <> '' ORDER BY LOWER(name) ASC`);
  const getByName  = db.prepare(`SELECT id FROM projects WHERE LOWER(name) = LOWER(?) LIMIT 1`);
  const insertStmt = db.prepare(`INSERT INTO projects (name) VALUES (?)`);

  const ensure = (name) => {
    const n = String(name || "").trim();
    if (!n) return null;
    const got = getByName.get(n);
    if (got?.id) return got.id;
    const r = insertStmt.run(n);
    return r.lastInsertRowid;
  };

  return { list: () => listStmt.all(), ensure };
}
module.exports = { ProjectsRepo };
