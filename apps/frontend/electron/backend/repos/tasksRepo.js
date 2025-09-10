function TasksRepo(db) {
  const toJson = (v) => JSON.stringify(Array.isArray(v) ? v : []);

  const insert = db.prepare(`
    INSERT INTO tasks (title, description, status, due_at, tags_json)
    VALUES (@title, @description, 'todo', @due_at, @tags_json)
  `);

  const update = db.prepare(`
    UPDATE tasks SET
      title = COALESCE(@title, title),
      description = COALESCE(@description, description),
      status = COALESCE(@status, status),
      due_at = COALESCE(@due_at, due_at),
      tags_json = COALESCE(@tags_json, tags_json),
      updated_at = datetime('now')
    WHERE id = @id
  `);

  const getStmt = db.prepare(`
    SELECT id, title, description, status, due_at, tags_json, created_at, updated_at
    FROM tasks WHERE id = ?
  `);

  const listStmt = db.prepare(`
    SELECT id, title, description, status, due_at, tags_json, created_at, updated_at
    FROM tasks ORDER BY created_at DESC LIMIT ? OFFSET ?
  `);

  

  const mapRow = (row) => row && {
    ...row,
    tags: (() => {
      try { return Array.isArray(row.tags_json) ? row.tags_json :
                   row.tags_json ? JSON.parse(row.tags_json) : []; }
      catch { return []; }
    })(),
  };

  return {
    create(data) {
      const res = insert.run({
        title: data.title,
        description: data.description ?? '',
        due_at: data.due_at ?? null,
        tags_json: toJson(data.tags),
      });
      return mapRow(getStmt.get(Number(res.lastInsertRowid)));   // ← return full row
    },
    update(partial) {
      update.run({
        id: partial.id,
        title: partial.title ?? null,
        description: partial.description ?? null,
        status: partial.status ?? null,
        due_at: partial.due_at ?? null,
        tags_json: partial.tags !== undefined ? toJson(partial.tags) : null,
      });
      return mapRow(getStmt.get(partial.id));                    // ← return full row
    },
    get(id)   { return mapRow(getStmt.get(id)); },
    list(l=50,o=0){ return listStmt.all(l,o).map(mapRow); },
    delete(id){ db.prepare(`DELETE FROM tasks WHERE id = ?`).run(id); return { ok: true }; },
  };
}
module.exports = { TasksRepo };
