function TagsRepo(db) {
  const listStmt = db.prepare(`
    SELECT id, TRIM(name) AS name
    FROM tags
    WHERE name IS NOT NULL AND TRIM(name) <> ''
    ORDER BY LOWER(name) ASC
  `);
  return { list: () => listStmt.all() };
}
module.exports = { TagsRepo };
